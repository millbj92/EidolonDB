import { z } from 'zod';
import { memoryTierSchema } from '../memories/schemas.js';

export const validateRequestSchema = z.object({
  claim: z.string().min(1).max(2000),
  agentEntityId: z.string().uuid().optional(),
  k: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.7),
  tier: memoryTierSchema.optional(),
});

export const validateVerdictSchema = z.enum(['supported', 'contradicted', 'unverified']);

export const validateEvidenceSchema = z.object({
  memoryId: z.string().uuid(),
  content: z.string(),
  similarity: z.number().min(0).max(1),
  tier: memoryTierSchema,
  createdAt: z.string().datetime(),
});

export const validateResponseSchema = z.object({
  verdict: validateVerdictSchema,
  confidence: z.number().min(0).max(1),
  claim: z.string(),
  supporting: z.array(validateEvidenceSchema),
  contradicting: z.array(validateEvidenceSchema),
  reasoning: z.string(),
});

export type ValidateRequest = z.infer<typeof validateRequestSchema>;
export type ValidateResponse = z.infer<typeof validateResponseSchema>;
export type ValidateVerdict = z.infer<typeof validateVerdictSchema>;
export type ValidateEvidence = z.infer<typeof validateEvidenceSchema>;
