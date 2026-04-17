import { env } from '../../common/config/index.js';
import { OpenAIEmbeddingsProvider } from '../../common/embeddings/index.js';
import { queryMemories, type MemoryQueryResult } from '../memories/index.js';
import type { ValidateRequest, ValidateResponse, ValidateEvidence, ValidateVerdict } from './schemas.js';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const VALIDATE_MODEL = 'gpt-4o-mini';

type MemoryClassification = 'SUPPORTS' | 'CONTRADICTS' | 'NEUTRAL';

interface ClassificationResultItem {
  index: number;
  classification: MemoryClassification;
  reason?: string;
}

interface OpenAIChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseJsonArrayFromContent(content: string): unknown[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through and try array extraction.
  }

  const firstBracket = content.indexOf('[');
  const lastBracket = content.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const parsed = JSON.parse(content.slice(firstBracket, lastBracket + 1)) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }

  throw new Error('Failed to parse JSON array from model response');
}

function buildEvidence(memoryResult: MemoryQueryResult): ValidateEvidence {
  return {
    memoryId: memoryResult.memory.id,
    content: memoryResult.memory.content,
    similarity: clamp01(memoryResult.reasons.semantic),
    tier: memoryResult.memory.tier,
    createdAt: memoryResult.memory.createdAt,
  };
}

async function runChatCompletion(prompt: string): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is required for validation');
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: VALIDATE_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI validate request failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as OpenAIChatCompletionsResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('OpenAI validate request returned empty content');
  }

  return content;
}

async function classifyMemories(
  claim: string,
  memories: MemoryQueryResult[]
): Promise<ClassificationResultItem[]> {
  const memoriesList = memories
    .map((memory, index) => `${index}. ${memory.memory.content}`)
    .join('\n');

  const prompt = [
    'You are a fact-checker. Given a claim and a list of memories, classify each memory as:',
    '- SUPPORTS: the memory directly supports or confirms the claim',
    '- CONTRADICTS: the memory directly contradicts or refutes the claim',
    '- NEUTRAL: the memory is unrelated or neither supports nor contradicts',
    '',
    `Claim: ${claim}`,
    '',
    'Memories:',
    memoriesList,
    '',
    'Respond with a JSON array: [{"index": 0, "classification": "SUPPORTS|CONTRADICTS|NEUTRAL", "reason": "one sentence"}]',
  ].join('\n');

  const content = await runChatCompletion(prompt);
  const parsed = parseJsonArrayFromContent(content);

  const results: ClassificationResultItem[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const rawIndex = (item as Record<string, unknown>)['index'];
    const rawClassification = (item as Record<string, unknown>)['classification'];
    const rawReason = (item as Record<string, unknown>)['reason'];

    if (!Number.isInteger(rawIndex) || typeof rawClassification !== 'string') {
      continue;
    }

    if (!['SUPPORTS', 'CONTRADICTS', 'NEUTRAL'].includes(rawClassification)) {
      continue;
    }

    results.push({
      index: rawIndex as number,
      classification: rawClassification as MemoryClassification,
      reason: typeof rawReason === 'string' ? rawReason : undefined,
    });
  }

  return results;
}

async function generateReasoning(
  claim: string,
  verdict: ValidateVerdict,
  supporting: ValidateEvidence[],
  contradicting: ValidateEvidence[]
): Promise<string> {
  const supportingLines = supporting
    .slice(0, 3)
    .map((memory) => `- ${memory.content}`)
    .join('\n');
  const contradictingLines = contradicting
    .slice(0, 3)
    .map((memory) => `- ${memory.content}`)
    .join('\n');

  const prompt = [
    'Write a concise 1-2 sentence explanation for a memory-grounded claim verdict.',
    'Do not mention confidence scores. Keep the wording factual and direct.',
    '',
    `Claim: ${claim}`,
    `Verdict: ${verdict}`,
    '',
    'Supporting memories:',
    supportingLines || '- none',
    '',
    'Contradicting memories:',
    contradictingLines || '- none',
    '',
    'Return plain text only.',
  ].join('\n');

  const content = await runChatCompletion(prompt);
  return content.replace(/^"|"$/g, '').trim();
}

export async function validateClaim(
  tenantId: string,
  input: ValidateRequest
): Promise<ValidateResponse> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is required for validation');
  }

  const embeddingsProvider = new OpenAIEmbeddingsProvider();

  const memoryResults = await queryMemories(
    tenantId,
    {
      text: input.claim,
      k: input.k,
      ownerEntityId: input.agentEntityId,
      tiers: input.tier ? [input.tier] : undefined,
      weights: {
        semantic: 1,
        recency: 0,
        importance: 0,
      },
      minScore: Math.min(input.threshold ?? 0.7, 0.3), // cast wide net for LLM — threshold applied to confidence scoring only
      includeShared: false,
    },
    {
      embeddingsProvider,
    }
  );

  const classifications = memoryResults.length > 0
    ? await classifyMemories(input.claim, memoryResults)
    : [];

  const supporting: ValidateEvidence[] = [];
  const contradicting: ValidateEvidence[] = [];

  for (const classification of classifications) {
    const memory = memoryResults[classification.index];
    if (!memory) {
      continue;
    }

    if (classification.classification === 'SUPPORTS') {
      supporting.push(buildEvidence(memory));
    } else if (classification.classification === 'CONTRADICTS') {
      contradicting.push(buildEvidence(memory));
    }
  }

  const verdict: ValidateVerdict = supporting.length > 0
    ? 'supported'
    : contradicting.length > 0
      ? 'contradicted'
      : 'unverified';

  const confidence = verdict === 'supported'
    ? clamp01(average(supporting.map((memory) => memory.similarity)))
    : verdict === 'contradicted'
      ? clamp01(average(contradicting.map((memory) => memory.similarity)))
      : 0;

  const reasoning = await generateReasoning(input.claim, verdict, supporting, contradicting);

  return {
    verdict,
    confidence,
    claim: input.claim,
    supporting,
    contradicting,
    reasoning,
  };
}
