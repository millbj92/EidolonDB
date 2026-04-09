import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { env } from '../../common/config/index.js';
import { db, ingestTraces } from '../../common/db/index.js';
import type { EmbeddingsProvider } from '../../common/embeddings/index.js';
import { createMemory } from '../memories/index.js';
import { checkDedup, type DedupResult } from './dedupService.js';
import {
  extractCandidateMemories,
  EXTRACTOR_VERSION,
  PROMPT_VERSION,
} from './extractionService.js';
import type {
  AcceptedMemory,
  CandidateMemory,
  IngestRequest,
  IngestResponse,
  RejectedMemory,
} from './schemas.js';

export interface IngestPipelineResult extends IngestResponse {
  errors: string[];
}

interface IngestPipelineOptions {
  logger?: FastifyBaseLogger;
}

interface OpenAIChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const SUMMARY_MODEL = 'gpt-4o-mini';

function normalizeInput(rawInput: string): string {
  return rawInput
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function rejectionFromCandidate(
  candidate: CandidateMemory,
  reason: string,
  dedupStatus: RejectedMemory['dedupStatus']
): RejectedMemory {
  return {
    ...candidate,
    dedupStatus,
    reason,
  };
}

function traceCandidate(candidate: CandidateMemory, dedup: DedupResult | null, outcome: string): Record<string, unknown> {
  return {
    ...candidate,
    dedupStatus: dedup?.status ?? 'new',
    matchedMemoryId: dedup?.matchedMemoryId,
    similarity: dedup?.similarity,
    outcome,
  };
}

function extractSessionNumber(value: unknown): number | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = (value as Record<string, unknown>)['sessionNumber'];
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}

function buildSessionSummaryPrompt(acceptedMemories: AcceptedMemory[], sessionNumber: number): string {
  const facts = acceptedMemories.map((memory) => `- ${memory.content}`).join('\n');
  return [
    'Summarize the following facts from a conversation session in one concise sentence.',
    'Start with "Session [N]:" where N is the session number.',
    '',
    'Facts:',
    facts,
  ].join('\n');
}

async function generateSessionSummary(
  acceptedMemories: AcceptedMemory[],
  sessionNumber: number,
  logger?: FastifyBaseLogger
): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('Session summary generation requires OPENAI_API_KEY');
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      messages: [
        {
          role: 'user',
          content: buildSessionSummaryPrompt(acceptedMemories, sessionNumber),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger?.error(
      {
        status: response.status,
        body: errorBody,
      },
      'OpenAI session summary request failed'
    );
    throw new Error(`OpenAI session summary failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionsResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    logger?.error({ response: data }, 'OpenAI session summary returned empty content');
    throw new Error('OpenAI session summary returned empty content');
  }

  return content;
}

export async function runIngestPipeline(
  tenantId: string,
  request: IngestRequest,
  embeddingsProvider?: EmbeddingsProvider,
  options?: IngestPipelineOptions
): Promise<IngestPipelineResult> {
  const logger = options?.logger;
  const startedAt = Date.now();
  const traceId = randomUUID();

  const warnings: string[] = [];
  const errors: string[] = [];
  const acceptedMemories: AcceptedMemory[] = [];
  const rejectedMemories: RejectedMemory[] = [];
  const traceCandidates: Record<string, unknown>[] = [];
  let sessionSummary: string | undefined;

  const rawInput = request.content;
  const normalizedInput = normalizeInput(rawInput);
  let candidateMemories: CandidateMemory[] = [];
  let pipelineError: Error | null = null;

  try {
    if (normalizedInput.length < 10) {
      throw new Error('Normalized content must be at least 10 characters');
    }

    try {
      candidateMemories = await extractCandidateMemories(normalizedInput, { logger });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Extraction failed';
      warnings.push(`Extraction skipped: ${message}`);
      errors.push(message);
      logger?.warn({ err: error }, 'Extraction stage failed; continuing with empty candidates');
    }

    for (const candidate of candidateMemories) {
      if (candidate.confidence < 0.3) {
        rejectedMemories.push(
          rejectionFromCandidate(candidate, 'Rejected: confidence below 0.3', 'needs_review')
        );
        traceCandidates.push(traceCandidate(candidate, null, 'rejected_low_confidence'));
        continue;
      }

      // Importance gate: skip low-signal memories that would become clutter.
      // short_term gets a lower bar (0.3) since it's transient anyway;
      // episodic and semantic need to clear 0.5 to earn a slot in long-term memory.
      const importanceThreshold = candidate.memoryType === 'short_term' ? 0.3 : 0.5;
      if (candidate.importance < importanceThreshold) {
        rejectedMemories.push(
          rejectionFromCandidate(candidate, `Rejected: importance ${candidate.importance} below threshold ${importanceThreshold}`, 'needs_review')
        );
        traceCandidates.push(traceCandidate(candidate, null, 'rejected_low_importance'));
        continue;
      }

      let dedupResult: DedupResult;
      try {
        dedupResult = await checkDedup(tenantId, candidate, embeddingsProvider);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Dedup failed';
        warnings.push(`Dedup failed for candidate: ${message}`);
        errors.push(message);
        dedupResult = { status: 'needs_review' };
      }

      if (dedupResult.status === 'duplicate') {
        rejectedMemories.push(
          rejectionFromCandidate(candidate, 'Rejected: duplicate memory', dedupResult.status)
        );
        traceCandidates.push(traceCandidate(candidate, dedupResult, 'rejected_duplicate'));
        continue;
      }

      if (dedupResult.status === 'conflict' || dedupResult.status === 'needs_review') {
        rejectedMemories.push(
          rejectionFromCandidate(candidate, 'Rejected: requires manual review', dedupResult.status)
        );
        traceCandidates.push(traceCandidate(candidate, dedupResult, 'rejected_review'));
        continue;
      }

      if (dedupResult.status === 'near_duplicate') {
        warnings.push(
          `Near-duplicate candidate accepted (matched ${dedupResult.matchedMemoryId ?? 'unknown'})`
        );
      }

      acceptedMemories.push({
        ...candidate,
        dedupStatus: dedupResult.status,
      });
      traceCandidates.push(traceCandidate(candidate, dedupResult, 'accepted'));
    }

    if (request.autoStore) {
      for (let i = 0; i < acceptedMemories.length; i += 1) {
        const accepted = acceptedMemories[i];
        if (!accepted) {
          continue;
        }

        try {
          const sessionNumber = extractSessionNumber(request.metadata);
          const { memory } = await createMemory(
            tenantId,
            {
              ownerEntityId: request.ownerEntityId,
              tier: accepted.memoryType,
              content: accepted.content,
              importanceScore: accepted.importance,
              tags: accepted.tags,
              metadata: {
                source: request.source,
                actorId: request.actorId ?? null,
                sessionId: request.sessionId ?? null,
                sessionNumber,
                sourceSpan: accepted.sourceSpan,
                rationale: accepted.rationale,
                ingestionMetadata: request.metadata ?? {},
              },
            },
            {
              generateEmbedding: true,
              embeddingsProvider,
            }
          );

          acceptedMemories[i] = {
            ...accepted,
            memoryId: memory.id,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Memory persistence failed';
          warnings.push(`Failed to persist candidate memory: ${message}`);
          errors.push(message);
        }
      }
    }

    const sessionNumber = extractSessionNumber(request.metadata);
    if (request.autoStore && acceptedMemories.length > 0 && sessionNumber !== null) {
      try {
        const summary = await generateSessionSummary(acceptedMemories, sessionNumber, logger);
        await createMemory(
          tenantId,
          {
            ownerEntityId: request.ownerEntityId,
            tier: 'episodic',
            content: summary,
            importanceScore: 0.7,
            tags: ['session-summary'],
            metadata: {
              sessionNumber,
              source: request.source,
              isSummary: true,
            },
          },
          {
            generateEmbedding: true,
            embeddingsProvider,
          }
        );
        sessionSummary = summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Session summary generation failed';
        warnings.push(`Session summary skipped: ${message}`);
        logger?.warn({ err: error }, 'Session summary generation failed; continuing ingest');
      }
    }
  } catch (error) {
    pipelineError = error instanceof Error ? error : new Error('Ingest pipeline failed');
    errors.push(pipelineError.message);
  }

  const durationMs = Date.now() - startedAt;

  await db.insert(ingestTraces).values({
    tenantId,
    traceId,
    rawInput,
    normalizedInput,
    source: request.source,
    actorId: request.actorId ?? null,
    sessionId: request.sessionId ?? null,
    extractorVersion: EXTRACTOR_VERSION,
    promptVersion: PROMPT_VERSION,
    candidateCount: candidateMemories.length,
    acceptedCount: acceptedMemories.length,
    rejectedCount: rejectedMemories.length,
    candidates: traceCandidates,
    warnings,
    errors,
    durationMs,
    autoStore: request.autoStore,
  });

  if (pipelineError) {
    throw pipelineError;
  }

  return {
    success: true,
    traceId,
    summary: {
      candidates: candidateMemories.length,
      accepted: acceptedMemories.length,
      rejected: rejectedMemories.length,
    },
    acceptedMemories,
    rejectedMemories,
    warnings,
    sessionSummary,
    debug: {
      normalizedInput,
      extractorVersion: EXTRACTOR_VERSION,
      promptVersion: PROMPT_VERSION,
      durationMs,
    },
    errors,
  };
}
