import type { FastifyBaseLogger } from 'fastify';
import { sql } from 'drizzle-orm';
import { db, lifecycleRuns } from '../../common/db/index.js';
import { createMemory, deleteMemory, listMemories, updateMemory } from '../memories/index.js';
import { createRelation } from '../relations/index.js';
import {
  DEFAULT_LIFECYCLE_RULES,
  type LifecycleAction,
  type LifecycleRulesConfig,
} from './schemas.js';
import {
  DISTILLATION_PROMPT_VERSION,
  DISTILLATION_VERSION,
  distillEpisodicMemory,
} from './distillationService.js';

export interface LifecycleRunResult {
  success: boolean;
  runId: string;
  dryRun: boolean;
  summary: {
    expired: number;
    promoted: number;
    distilled: number;
    archived: number;
    unchanged: number;
    durationMs: number;
  };
  details: LifecycleAction[];
  errors: string[];
}

interface LifecycleRunOptions {
  dryRun?: boolean;
  triggeredBy?: string;
  rules?: Partial<LifecycleRulesConfig>;
  logger?: FastifyBaseLogger;
}

function mergeLifecycleRules(rules?: Partial<LifecycleRulesConfig>): LifecycleRulesConfig {
  return {
    shortTerm: {
      ...DEFAULT_LIFECYCLE_RULES.shortTerm,
      ...(rules?.shortTerm ?? {}),
    },
    episodic: {
      ...DEFAULT_LIFECYCLE_RULES.episodic,
      ...(rules?.episodic ?? {}),
    },
  };
}

function memoryErrorMessage(memoryId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown lifecycle error';
  return `Memory ${memoryId}: ${message}`;
}

function clampImportance(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export async function runLifecycle(
  tenantId: string,
  options?: LifecycleRunOptions
): Promise<LifecycleRunResult> {
  const startedAt = Date.now();
  const now = new Date();
  const dryRun = options?.dryRun ?? false;
  const triggeredByBase = options?.triggeredBy ?? 'manual';
  const triggeredBy = dryRun ? `${triggeredByBase}:dry_run` : triggeredByBase;
  const rules = mergeLifecycleRules(options?.rules);

  const details: LifecycleAction[] = [];
  const errors: string[] = [];

  const summary: LifecycleRunResult['summary'] = {
    expired: 0,
    promoted: 0,
    distilled: 0,
    archived: 0,
    unchanged: 0,
    durationMs: 0,
  };

  const pageSize = 500;
  let offset = 0;
  const allMemories: Awaited<ReturnType<typeof listMemories>>['memories'] = [];

  while (true) {
    const page = await listMemories(tenantId, {
      offset,
      limit: pageSize,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    allMemories.push(...page.memories);

    if (page.memories.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  for (const memory of allMemories) {
    const ageMs = now.getTime() - memory.createdAt.getTime();
    const accessCount = memory.accessCount ?? 0;
    const retrievalCount = memory.retrievalCount ?? 0;
    const importanceScore = memory.importanceScore ?? 0.5;

    try {
      if (memory.tier === 'short_term') {
        if (ageMs <= rules.shortTerm.expireAfterMs) {
          details.push({
            memoryId: memory.id,
            action: 'unchanged',
            fromTier: 'short_term',
            reason: 'short_term memory is not old enough for expiration or promotion',
          });
          summary.unchanged += 1;
          continue;
        }

        if (accessCount === 0) {
          if (!rules.shortTerm.expireIfUnaccessed) {
            details.push({
              memoryId: memory.id,
              action: 'unchanged',
              fromTier: 'short_term',
              reason: 'unaccessed short_term expiration is disabled by rules',
            });
            summary.unchanged += 1;
            continue;
          }

          if (!dryRun) {
            await deleteMemory(tenantId, memory.id);
          }
          details.push({
            memoryId: memory.id,
            action: 'expired',
            fromTier: 'short_term',
            reason: 'short_term memory is stale and never accessed',
          });
          summary.expired += 1;
          continue;
        }

        if (accessCount >= rules.shortTerm.promoteIfAccessCount) {
          if (!dryRun) {
            const updated = await updateMemory(tenantId, memory.id, { tier: 'episodic' });
            if (!updated) {
              throw new Error('Promotion failed: memory not found');
            }
          }
          details.push({
            memoryId: memory.id,
            action: 'promoted',
            fromTier: 'short_term',
            toTier: 'episodic',
            reason: 'short_term memory stayed active and reached promotion threshold',
          });
          summary.promoted += 1;
          continue;
        }

        if (!dryRun) {
          await deleteMemory(tenantId, memory.id);
        }
        details.push({
          memoryId: memory.id,
          action: 'expired',
          fromTier: 'short_term',
          reason: 'short_term memory aged out without enough accesses for promotion',
        });
        summary.expired += 1;
        continue;
      }

      if (memory.tier === 'episodic') {
        if (ageMs > rules.episodic.archiveAfterMs && accessCount <= rules.episodic.archiveIfAccessCount) {
          if (!dryRun) {
            await deleteMemory(tenantId, memory.id);
          }
          details.push({
            memoryId: memory.id,
            action: 'archived',
            fromTier: 'episodic',
            reason: 'episodic memory is stale and archival threshold is met',
          });
          summary.archived += 1;
          continue;
        }

        // Skip memories that have already been distilled — they'll be archived naturally
        // once they age past archiveAfterMs. Re-distilling produces redundant semantic duplicates.
        const alreadyDistilled =
          memory.metadata &&
          typeof memory.metadata === 'object' &&
          memory.metadata['distilledAt'] != null;

        if (alreadyDistilled) {
          details.push({
            memoryId: memory.id,
            action: 'unchanged',
            fromTier: 'episodic',
            reason: 'episodic memory already distilled; skipping to avoid duplicate semantic memories',
          });
          summary.unchanged += 1;
          continue;
        }

        if (
          ageMs > rules.episodic.distillAfterMs &&
          importanceScore >= rules.episodic.distillIfImportance &&
          (
            accessCount >= rules.episodic.distillIfAccessCount ||
            // Retrieval signals that memory was surfaced by search even without explicit access.
            // It's weaker than access, but still indicates potential usefulness.
            retrievalCount >= 3
          )
        ) {
          let distillation: Awaited<ReturnType<typeof distillEpisodicMemory>>;
          try {
            distillation = await distillEpisodicMemory(memory.content, options?.logger);
          } catch (error) {
            const message = memoryErrorMessage(memory.id, error);
            errors.push(message);
            options?.logger?.warn({ err: error, memoryId: memory.id }, 'Distillation failed; keeping memory unchanged');
            details.push({
              memoryId: memory.id,
              action: 'unchanged',
              fromTier: 'episodic',
              reason: 'distillation failed, memory left unchanged',
            });
            summary.unchanged += 1;
            continue;
          }

          if (!distillation) {
            details.push({
              memoryId: memory.id,
              action: 'unchanged',
              fromTier: 'episodic',
              reason: 'distillation confidence below threshold',
            });
            summary.unchanged += 1;
            continue;
          }

          if (dryRun) {
            details.push({
              memoryId: memory.id,
              action: 'distilled',
              fromTier: 'episodic',
              toTier: 'semantic',
              reason: 'episodic memory met distillation thresholds (dry run)',
            });
            summary.distilled += 1;
            continue;
          }

          const semanticMemory = await createMemory(tenantId, {
            ownerEntityId: memory.ownerEntityId ?? undefined,
            tier: 'semantic',
            content: distillation.distilledContent,
            sourceArtifactId: memory.sourceArtifactId ?? undefined,
            sourceEventId: memory.sourceEventId ?? undefined,
            importanceScore: clampImportance(importanceScore * 0.95),
            metadata: {
              distilledFromMemoryId: memory.id,
              distillation: {
                version: DISTILLATION_VERSION,
                promptVersion: DISTILLATION_PROMPT_VERSION,
                confidence: distillation.confidence,
                rationale: distillation.rationale,
              },
            },
            tags: memory.tags ?? [],
          });

          await createRelation(tenantId, {
            type: 'DISTILLED_FROM',
            fromType: 'memory',
            fromId: semanticMemory.memory.id,
            toType: 'memory',
            toId: memory.id,
            properties: {
              confidence: distillation.confidence,
              rationale: distillation.rationale,
              distilledAt: now.toISOString(),
            },
            tags: ['distilled'],
          });

          const existingMetadata =
            memory.metadata && typeof memory.metadata === 'object' ? memory.metadata : {};
          const updated = await updateMemory(tenantId, memory.id, {
            metadata: {
              ...existingMetadata,
              distilledAt: now.toISOString(),
              distilledMemoryId: semanticMemory.memory.id,
            },
          });

          if (!updated) {
            throw new Error('Failed to update episodic memory metadata after distillation');
          }

          details.push({
            memoryId: memory.id,
            action: 'distilled',
            fromTier: 'episodic',
            toTier: 'semantic',
            reason: 'episodic memory distilled into semantic memory',
            newMemoryId: semanticMemory.memory.id,
          });
          summary.distilled += 1;
          continue;
        }

        if (ageMs > rules.episodic.distillAfterMs && importanceScore < rules.episodic.distillIfImportance) {
          details.push({
            memoryId: memory.id,
            action: 'unchanged',
            fromTier: 'episodic',
            reason: 'episodic memory not important enough to distill',
          });
          summary.unchanged += 1;
          continue;
        }

        details.push({
          memoryId: memory.id,
          action: 'unchanged',
          fromTier: 'episodic',
          reason: 'episodic memory did not meet archive or distillation conditions',
        });
        summary.unchanged += 1;
        continue;
      }

      details.push({
        memoryId: memory.id,
        action: 'unchanged',
        fromTier: 'semantic',
        reason: 'semantic memories are permanent',
      });
      summary.unchanged += 1;
    } catch (error) {
      const message = memoryErrorMessage(memory.id, error);
      errors.push(message);
      options?.logger?.error({ err: error, memoryId: memory.id }, 'Lifecycle processing failed for memory');
      details.push({
        memoryId: memory.id,
        action: 'error',
        fromTier: memory.tier,
        reason: message,
      });
    }
  }

  if (!dryRun) {
    try {
      await db.execute(sql`
        UPDATE memories
        SET
          recency_score = exp(-(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0) / 7.0),
          updated_at = NOW()
        WHERE tenant_id = ${tenantId}
      `);
    } catch (error) {
      const message = `Recency score update failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      errors.push(message);
      options?.logger?.error({ err: error }, 'Lifecycle recency score update failed');
    }
  }

  summary.durationMs = Date.now() - startedAt;

  const [run] = await db
    .insert(lifecycleRuns)
    .values({
      tenantId,
      triggeredBy,
      durationMs: summary.durationMs,
      expired: summary.expired,
      promoted: summary.promoted,
      distilled: summary.distilled,
      archived: summary.archived,
      unchanged: summary.unchanged,
      errors,
      completedAt: new Date(),
    })
    .returning({ id: lifecycleRuns.id });

  if (!run) {
    throw new Error('Failed to persist lifecycle run record');
  }

  return {
    success: true,
    runId: run.id,
    dryRun,
    summary,
    details,
    errors,
  };
}
