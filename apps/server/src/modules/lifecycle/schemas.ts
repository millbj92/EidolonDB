import { z } from 'zod';

export const lifecycleRunRequestSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  triggeredBy: z.string().min(1).optional().default('manual'),
});

export type LifecycleRunRequest = z.infer<typeof lifecycleRunRequestSchema>;

export const lifecycleActionSchema = z.object({
  memoryId: z.string().uuid(),
  action: z.enum(['expired', 'promoted', 'distilled', 'archived', 'unchanged', 'error']),
  fromTier: z.enum(['short_term', 'episodic', 'semantic']),
  toTier: z.enum(['short_term', 'episodic', 'semantic']).optional(),
  reason: z.string(),
  newMemoryId: z.string().uuid().optional(),
});

export type LifecycleAction = z.infer<typeof lifecycleActionSchema>;

export const lifecycleRunResponseSchema = z.object({
  success: z.boolean(),
  runId: z.string().uuid(),
  dryRun: z.boolean(),
  summary: z.object({
    expired: z.number(),
    promoted: z.number(),
    distilled: z.number(),
    archived: z.number(),
    unchanged: z.number(),
    durationMs: z.number(),
  }),
  details: z.array(lifecycleActionSchema),
  errors: z.array(z.string()),
});

export type LifecycleRunResponse = z.infer<typeof lifecycleRunResponseSchema>;

export const lifecycleRulesConfigSchema = z.object({
  shortTerm: z.object({
    expireAfterMs: z.number().int().positive(),
    promoteIfAccessCount: z.number().int().nonnegative(),
    expireIfUnaccessed: z.boolean(),
  }),
  episodic: z.object({
    distillAfterMs: z.number().int().positive(),
    distillIfImportance: z.number().min(0).max(1),
    distillIfAccessCount: z.number().int().nonnegative(),
    archiveAfterMs: z.number().int().positive(),
    archiveIfAccessCount: z.number().int().nonnegative(),
  }),
});

export type LifecycleRulesConfig = z.infer<typeof lifecycleRulesConfigSchema>;

export const DEFAULT_LIFECYCLE_RULES: LifecycleRulesConfig = {
  shortTerm: {
    expireAfterMs: 24 * 60 * 60 * 1000,
    promoteIfAccessCount: 2,
    expireIfUnaccessed: true,
  },
  episodic: {
    distillAfterMs: 7 * 24 * 60 * 60 * 1000,
    distillIfImportance: 0.7,
    distillIfAccessCount: 2,
    archiveAfterMs: 30 * 24 * 60 * 60 * 1000,
    archiveIfAccessCount: 0,
  },
};
