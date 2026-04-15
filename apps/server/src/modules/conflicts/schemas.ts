import { z } from 'zod';

export const conflictStrategySchema = z.enum(['newer-wins', 'higher-importance', 'merge', 'manual']);

export const detectConflictsSchema = z.object({
  autoResolve: z.boolean().default(false),
  strategy: conflictStrategySchema.default('newer-wins'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const resolveConflictSchema = z.object({
  memoryIdA: z.string().uuid(),
  memoryIdB: z.string().uuid(),
  strategy: conflictStrategySchema,
});

export type ConflictStrategy = z.infer<typeof conflictStrategySchema>;
export type DetectConflictsInput = z.infer<typeof detectConflictsSchema>;
export type ResolveConflictInput = z.infer<typeof resolveConflictSchema>;
