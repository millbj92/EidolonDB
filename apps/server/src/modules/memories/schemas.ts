import { z } from 'zod';

export const memoryTierSchema = z.enum(['short_term', 'episodic', 'semantic']);
export type MemoryTier = z.infer<typeof memoryTierSchema>;

export const createMemorySchema = z.object({
  ownerEntityId: z.string().uuid().optional(),
  tier: memoryTierSchema,
  content: z.string().min(1),
  sourceArtifactId: z.string().uuid().optional(),
  sourceEventId: z.string().uuid().optional(),
  importanceScore: z.number().min(0).max(1).optional().default(0.5),
  metadata: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
});

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;

export const memoryResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  ownerEntityId: z.string().uuid().nullable(),
  tier: memoryTierSchema,
  content: z.string(),
  sourceArtifactId: z.string().uuid().nullable(),
  sourceEventId: z.string().uuid().nullable(),
  embeddingId: z.string().uuid().nullable(),
  importanceScore: z.number().nullable(),
  recencyScore: z.number().nullable(),
  accessCount: z.number().nullable(),
  lastAccessedAt: z.string().nullable(),
  metadata: z.record(z.unknown()),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MemoryResponse = z.infer<typeof memoryResponseSchema>;

// Query schemas
export const memoryQuerySchema = z.object({
  // Vector search
  text: z.string().min(1).optional(),
  k: z.number().min(1).max(100).optional().default(10),

  // Filters
  ownerEntityId: z.string().uuid().optional(),
  tiers: z.array(memoryTierSchema).optional(),
  tags: z.array(z.string()).optional(),
  sourceArtifactId: z.string().uuid().optional(),

  // Time range
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),

  // Scoring weights (must sum to 1.0, will be normalized if not)
  weights: z.object({
    semantic: z.number().min(0).max(1).optional().default(0.7),
    recency: z.number().min(0).max(1).optional().default(0.2),
    importance: z.number().min(0).max(1).optional().default(0.1),
  }).optional().default({}),

  // Minimum score threshold (0-1)
  minScore: z.number().min(0).max(1).optional().default(0),
});

export type MemoryQueryInput = z.infer<typeof memoryQuerySchema>;

export const memoryQueryResultSchema = z.object({
  memory: memoryResponseSchema,
  score: z.number(),
  reasons: z.object({
    semantic: z.number(),
    recency: z.number(),
    importance: z.number(),
  }),
});

export type MemoryQueryResult = z.infer<typeof memoryQueryResultSchema>;

export const memoryQueryResponseSchema = z.object({
  results: z.array(memoryQueryResultSchema),
  query: z.object({
    text: z.string().optional(),
    k: z.number(),
  }),
});

export type MemoryQueryResponse = z.infer<typeof memoryQueryResponseSchema>;
