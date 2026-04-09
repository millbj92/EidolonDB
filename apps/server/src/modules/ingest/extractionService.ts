import type { FastifyBaseLogger } from 'fastify';
import { env } from '../../common/config/index.js';
import {
  candidateMemorySchema,
  extractorOutputSchema,
  type CandidateMemory,
  type ExtractorOutput,
} from './schemas.js';

export const EXTRACTOR_VERSION = 'v1';
export const PROMPT_VERSION = 'auto-extract-v1';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const EXTRACTION_MODEL = 'gpt-4o-mini';

interface OpenAIChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface ExtractOptions {
  logger?: FastifyBaseLogger;
}

function buildSystemPrompt(): string {
  return [
    'You extract memory-worthy facts from user text for an AI memory store.',
    'Always extract from the provided input first; deduplication is handled later by the pipeline.',
    'Do not decide whether a fact is already known or already stored.',
    'Do not drop the entire input because it appears repetitive or overlapping.',
    'Extract only durable, decision-relevant information:',
    '- stable facts about people/projects/systems',
    '- goals, plans, decisions, commitments',
    '- milestones and notable events',
    '- explicit preferences and constraints',
    'Do not include filler, small talk, or transient chatter unless action-relevant.',
    'For each candidate memory produce:',
    '- content: concise standalone statement',
    '- memoryType: one of short_term | episodic | semantic',
    '- importance: number 0..1',
    '- confidence: number 0..1',
    '- tags: short lowercase keywords array',
    '- sourceSpan: exact supporting snippet from input',
    '- rationale: brief reason this memory matters',
    'Score importance (0..1) based on future retrieval utility:',
    '- 0.8-1.0: Technology decisions, configuration values, named roles, explicit preferences, project names and goals — facts an agent will need verbatim in future sessions',
    '- 0.5-0.7: Supporting context, background information, process details',
    '- 0.3-0.4: Transient state, in-progress work, things likely to change soon',
    '- 0.0-0.2: Filler, acknowledgments, conversational noise',
    'Key rule: length does not determine importance. A single short declarative fact scores 0.9 if it will be needed in future sessions. Score on utility, not verbosity.',
    'Output MUST be strict JSON with shape:',
    '{"candidateMemories":[{...}]}',
    'Return only valid JSON. No prose. No markdown.',
  ].join('\n');
}

function parseExtractorResponse(
  responseText: string,
  logger?: FastifyBaseLogger
): ExtractorOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    logger?.error({ rawResponse: responseText, error }, 'Extractor returned malformed JSON');
    throw new Error('Extractor returned malformed JSON');
  }

  const validated = extractorOutputSchema.safeParse(parsed);
  if (!validated.success) {
    logger?.error(
      {
        rawResponse: responseText,
        issues: validated.error.issues,
      },
      'Extractor output failed schema validation'
    );
    throw new Error('Extractor output failed schema validation');
  }

  return validated.data;
}

export async function extractCandidateMemories(
  normalizedInput: string,
  options?: ExtractOptions
): Promise<CandidateMemory[]> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('LLM extraction requires OPENAI_API_KEY');
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        {
          role: 'user',
          content: normalizedInput,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    options?.logger?.error(
      {
        status: response.status,
        body: errorBody,
      },
      'OpenAI extraction request failed'
    );
    throw new Error(`OpenAI extraction failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionsResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    options?.logger?.error({ response: data }, 'OpenAI extraction returned empty content');
    throw new Error('OpenAI extraction returned empty content');
  }

  const extractorOutput = parseExtractorResponse(content, options?.logger);
  return extractorOutput.candidateMemories.map((candidate) => candidateMemorySchema.parse(candidate));
}
