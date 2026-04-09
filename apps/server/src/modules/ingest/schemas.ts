import { z } from 'zod';

export const sourceSchema = z.enum(['chat', 'note', 'event', 'document', 'system']);

export const dedupStatusSchema = z.enum([
  'new',
  'duplicate',
  'near_duplicate',
  'conflict',
  'needs_review',
]);
export type DedupStatus = z.infer<typeof dedupStatusSchema>;

export const candidateMemorySchema = z.object({
  content: z.string().min(1),
  memoryType: z.enum(['short_term', 'episodic', 'semantic']),
  importance: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).default([]),
  sourceSpan: z.string().min(1),
  rationale: z.string().min(1),
});
export type CandidateMemory = z.infer<typeof candidateMemorySchema>;

export const extractorOutputSchema = z.object({
  candidateMemories: z.array(candidateMemorySchema),
});
export type ExtractorOutput = z.infer<typeof extractorOutputSchema>;

export const ingestRequestSchema = z.object({
  content: z.string().min(1).max(50000),
  source: sourceSchema,
  actorId: z.string().optional(),
  sessionId: z.string().optional(),
  ownerEntityId: z.string().uuid().optional(),
  autoStore: z.boolean().optional().default(true),
  debug: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional(),
});
export type IngestRequest = z.infer<typeof ingestRequestSchema>;

export const acceptedMemorySchema = candidateMemorySchema.extend({
  memoryId: z.string().uuid().optional(),
  dedupStatus: dedupStatusSchema,
});
export type AcceptedMemory = z.infer<typeof acceptedMemorySchema>;

export const rejectedMemorySchema = candidateMemorySchema.extend({
  dedupStatus: dedupStatusSchema,
  reason: z.string(),
});
export type RejectedMemory = z.infer<typeof rejectedMemorySchema>;

export const ingestResponseSchema = z.object({
  success: z.boolean(),
  traceId: z.string().uuid(),
  summary: z.object({
    candidates: z.number().int().min(0),
    accepted: z.number().int().min(0),
    rejected: z.number().int().min(0),
  }),
  acceptedMemories: z.array(acceptedMemorySchema),
  rejectedMemories: z.array(rejectedMemorySchema),
  warnings: z.array(z.string()),
  sessionSummary: z.string().optional(),
  debug: z.object({
    normalizedInput: z.string(),
    extractorVersion: z.string(),
    promptVersion: z.string(),
    durationMs: z.number().int().min(0),
  }).optional(),
});
export type IngestResponse = z.infer<typeof ingestResponseSchema>;
