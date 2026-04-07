import { z } from 'zod';

export const markUsedRequestSchema = z.object({
  memoryIds: z.array(z.string().uuid()).min(1),
  sessionId: z.string().optional(),
  actorId: z.string().optional(),
  relevanceFeedback: z.record(z.string().uuid(), z.number().min(0).max(1)).optional(),
});

export type MarkUsedRequest = z.infer<typeof markUsedRequestSchema>;

export const markUsedResponseSchema = z.object({
  updated: z.number(),
  memoryIds: z.array(z.string().uuid()),
});

export type MarkUsedResponse = z.infer<typeof markUsedResponseSchema>;

export const retrievalStatsResponseSchema = z.object({
  memoryId: z.string().uuid(),
  retrievalCount: z.number(),
  usageCount: z.number(),
  avgRelevanceFeedback: z.number().nullable(),
  avgRetrievalScore: z.number().nullable(),
  lastRetrievedAt: z.string().nullable(),
});

export type RetrievalStatsResponse = z.infer<typeof retrievalStatsResponseSchema>;

export const listRetrievalStatsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(['retrievalCount', 'usageCount', 'lastRetrievedAt'])
    .optional()
    .default('retrievalCount'),
});

export type ListRetrievalStatsQuery = z.infer<typeof listRetrievalStatsQuerySchema>;
