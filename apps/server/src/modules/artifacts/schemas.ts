import { z } from 'zod';

export const createArtifactSchema = z.object({
  kind: z.string().min(1),
  mimeType: z.string().min(1),
  content: z.string(),
  metadata: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
  autoProcess: z.object({
    chunkSize: z.number().min(100).max(10000).optional().default(1000),
    chunkOverlap: z.number().min(0).max(500).optional().default(200),
    generateEmbeddings: z.boolean().optional().default(true),
    ownerEntityId: z.string().uuid().optional(),
    memoryTier: z.enum(['short_term', 'episodic', 'semantic']).optional().default('semantic'),
  }).optional(),
});

export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

export const artifactResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  kind: z.string(),
  mimeType: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ArtifactResponse = z.infer<typeof artifactResponseSchema>;

export const createArtifactResponseSchema = z.object({
  artifact: artifactResponseSchema,
  memories: z.array(z.object({
    id: z.string().uuid(),
    content: z.string(),
    embeddingId: z.string().uuid().nullable(),
  })).optional(),
});

export type CreateArtifactResponse = z.infer<typeof createArtifactResponseSchema>;
