import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
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
    debug: {
      normalizedInput,
      extractorVersion: EXTRACTOR_VERSION,
      promptVersion: PROMPT_VERSION,
      durationMs,
    },
    errors,
  };
}
