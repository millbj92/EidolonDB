import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { env } from '../../common/config/index.js';
import { db, memories, type Memory } from '../../common/db/index.js';
import type { EmbeddingsProvider } from '../../common/embeddings/index.js';
import { createMemory, queryMemories } from '../memories/index.js';

export interface ConflictCandidate {
  memoryId: string;
  content: string;
  similarity: number;
}

export interface ConflictDetectionResult {
  isConflict: boolean;
  conflictingMemoryId?: string;
  confidence?: number;
  explanation?: string;
}

export type ConflictResolutionStrategy = 'newer-wins' | 'higher-importance' | 'merge' | 'manual';

export interface ResolveConflictResult {
  status: 'flagged' | 'resolved';
  strategy: ConflictResolutionStrategy;
  conflictGroupId: string;
  mergedMemoryId?: string;
  resolvedMemoryIds: string[];
}

interface OpenAIChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface DetectConflictOptions {
  excludeMemoryId?: string;
}

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const CONFLICT_MODEL = 'gpt-4o-mini';
const CONFLICT_SIMILARITY_THRESHOLD = 0.65;
const CONFLICT_VECTOR_K = 5;

function parseJsonFromContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }
    throw new Error('Failed to parse JSON payload from model response');
  }
}

async function runChatCompletion(prompt: string, responseFormatJson: boolean): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is required for conflict detection');
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: CONFLICT_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      ...(responseFormatJson
        ? {
          response_format: {
            type: 'json_object',
          },
        }
        : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI conflict request failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as OpenAIChatCompletionsResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('OpenAI conflict request returned empty content');
  }

  return content;
}

async function getConflictCandidates(
  tenantId: string,
  text: string,
  embeddingsProvider: EmbeddingsProvider,
  excludeMemoryId?: string
): Promise<ConflictCandidate[]> {
  const results = await queryMemories(
    tenantId,
    {
      text,
      k: CONFLICT_VECTOR_K,
      weights: {
        semantic: 1,
        recency: 0,
        importance: 0,
      },
      minScore: 0,
      includeShared: false,
    },
    { embeddingsProvider }
  );

  return results
    .map((result) => ({
      memoryId: result.memory.id,
      content: result.memory.content,
      similarity: result.reasons.semantic,
    }))
    .filter((candidate) => candidate.memoryId !== excludeMemoryId)
    .filter((candidate) => candidate.similarity > CONFLICT_SIMILARITY_THRESHOLD);
}

export async function isContradiction(
  contentA: string,
  contentB: string
): Promise<ConflictDetectionResult> {
  const prompt = [
    'You are a contradiction detector. Given two statements, determine if they make opposing claims about the same subject.',
    '',
    `Statement A: ${contentA}`,
    `Statement B: ${contentB}`,
    '',
    'Answer with JSON only:',
    '{',
    '  "isContradiction": true|false,',
    '  "confidence": 0.0-1.0,',
    '  "explanation": "one sentence"',
    '}',
    '',
    'Rules:',
    '- Only flag as contradiction if they make OPPOSING claims (not just different topics)',
    '- "Port is 8080" vs "Port is 3000" = contradiction',
    '- "Uses Python" vs "Uses Go" = contradiction',
    '- "Uses Python" vs "Port is 3000" = NOT a contradiction (different subjects)',
    '- Updates/corrections count as contradictions ("was 8080, now 3000")',
  ].join('\n');

  const raw = await runChatCompletion(prompt, true);
  const parsed = parseJsonFromContent(raw);

  const contradiction = parsed['isContradiction'] === true;
  const confidence = typeof parsed['confidence'] === 'number' ? parsed['confidence'] : 0;
  const explanation = typeof parsed['explanation'] === 'string' ? parsed['explanation'] : '';

  return {
    isConflict: contradiction,
    confidence,
    explanation,
  };
}

export async function detectConflict(
  tenantId: string,
  newContent: string,
  embeddingsProvider?: EmbeddingsProvider,
  options?: DetectConflictOptions
): Promise<ConflictDetectionResult> {
  if (!embeddingsProvider) {
    return { isConflict: false };
  }

  const candidates = await getConflictCandidates(
    tenantId,
    newContent,
    embeddingsProvider,
    options?.excludeMemoryId
  );

  for (const candidate of candidates) {
    const contradiction = await isContradiction(newContent, candidate.content);
    if (contradiction.isConflict) {
      return {
        isConflict: true,
        conflictingMemoryId: candidate.memoryId,
        confidence: contradiction.confidence,
        explanation: contradiction.explanation,
      };
    }
  }

  return { isConflict: false };
}

async function getMemory(tenantId: string, memoryId: string): Promise<Memory> {
  const [memory] = await db
    .select()
    .from(memories)
    .where(and(eq(memories.tenantId, tenantId), eq(memories.id, memoryId)))
    .limit(1);

  if (!memory) {
    throw new Error(`Memory with id ${memoryId} not found`);
  }

  return memory;
}

async function markPairFlagged(
  tenantId: string,
  memoryIdA: string,
  memoryIdB: string,
  conflictGroupId: string
): Promise<void> {
  const now = new Date();

  await Promise.all([
    db
      .update(memories)
      .set({
        conflictStatus: 'flagged',
        conflictGroupId,
        updatedAt: now,
      })
      .where(and(eq(memories.tenantId, tenantId), eq(memories.id, memoryIdA))),
    db
      .update(memories)
      .set({
        conflictStatus: 'flagged',
        conflictGroupId,
        updatedAt: now,
      })
      .where(and(eq(memories.tenantId, tenantId), eq(memories.id, memoryIdB))),
  ]);
}

async function mergeConflictMemories(contentA: string, contentB: string): Promise<string> {
  const prompt = [
    'Merge these two contradictory memories into a single accurate statement that captures both the old and new state:',
    '',
    `Memory A: ${contentA}`,
    `Memory B: ${contentB}`,
    '',
    'Return only the merged statement, no explanation.',
  ].join('\n');

  return runChatCompletion(prompt, false);
}

export async function resolveConflict(
  tenantId: string,
  memoryIdA: string,
  memoryIdB: string,
  strategy: ConflictResolutionStrategy
): Promise<ResolveConflictResult> {
  const [memoryA, memoryB] = await Promise.all([
    getMemory(tenantId, memoryIdA),
    getMemory(tenantId, memoryIdB),
  ]);

  const conflictGroupId = memoryA.conflictGroupId ?? memoryB.conflictGroupId ?? randomUUID();
  await markPairFlagged(tenantId, memoryA.id, memoryB.id, conflictGroupId);

  if (strategy === 'manual') {
    return {
      status: 'flagged',
      strategy,
      conflictGroupId,
      resolvedMemoryIds: [],
    };
  }

  const now = new Date();

  if (strategy === 'newer-wins') {
    const older = memoryA.createdAt <= memoryB.createdAt ? memoryA : memoryB;

    await db
      .update(memories)
      .set({
        conflictStatus: 'resolved',
        conflictGroupId,
        conflictResolution: 'newer-wins',
        resolvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(memories.tenantId, tenantId), eq(memories.id, older.id)));

    return {
      status: 'resolved',
      strategy,
      conflictGroupId,
      resolvedMemoryIds: [older.id],
    };
  }

  if (strategy === 'higher-importance') {
    const importanceA = memoryA.importanceScore ?? 0;
    const importanceB = memoryB.importanceScore ?? 0;
    const resolved = importanceA < importanceB
      ? memoryA
      : importanceB < importanceA
        ? memoryB
        : (memoryA.createdAt <= memoryB.createdAt ? memoryA : memoryB);

    await db
      .update(memories)
      .set({
        conflictStatus: 'resolved',
        conflictGroupId,
        conflictResolution: 'higher-importance',
        resolvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(memories.tenantId, tenantId), eq(memories.id, resolved.id)));

    return {
      status: 'resolved',
      strategy,
      conflictGroupId,
      resolvedMemoryIds: [resolved.id],
    };
  }

  const mergedContent = await mergeConflictMemories(memoryA.content, memoryB.content);
  const keeper = (memoryA.importanceScore ?? 0) >= (memoryB.importanceScore ?? 0) ? memoryA : memoryB;
  const mergedTags = Array.from(new Set([...(memoryA.tags ?? []), ...(memoryB.tags ?? [])]));

  const { memory: mergedMemory } = await createMemory(tenantId, {
    ownerEntityId: keeper.ownerEntityId ?? undefined,
    tier: keeper.tier,
    content: mergedContent.trim(),
    importanceScore: Math.max(memoryA.importanceScore ?? 0, memoryB.importanceScore ?? 0),
    tags: mergedTags,
    metadata: {
      mergedFromMemoryIds: [memoryA.id, memoryB.id],
      conflictGroupId,
      strategy: 'merge',
    },
  });

  await Promise.all([
    db
      .update(memories)
      .set({
        conflictStatus: 'resolved',
        conflictGroupId,
        conflictResolution: 'merge',
        resolvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(memories.tenantId, tenantId), eq(memories.id, memoryA.id))),
    db
      .update(memories)
      .set({
        conflictStatus: 'resolved',
        conflictGroupId,
        conflictResolution: 'merge',
        resolvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(memories.tenantId, tenantId), eq(memories.id, memoryB.id))),
  ]);

  return {
    status: 'resolved',
    strategy,
    conflictGroupId,
    mergedMemoryId: mergedMemory.id,
    resolvedMemoryIds: [memoryA.id, memoryB.id],
  };
}
