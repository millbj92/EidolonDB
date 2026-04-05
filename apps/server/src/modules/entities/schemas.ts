import { z } from 'zod';

export const createEntitySchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  properties: z.record(z.unknown()).optional().default({}),
  primaryArtifactId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;

export const entityResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  type: z.string(),
  name: z.string(),
  properties: z.record(z.unknown()),
  primaryArtifactId: z.string().uuid().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EntityResponse = z.infer<typeof entityResponseSchema>;
