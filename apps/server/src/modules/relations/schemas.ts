import { z } from 'zod';

export const relationNodeTypeSchema = z.enum(['entity', 'artifact', 'memory']);
export type RelationNodeType = z.infer<typeof relationNodeTypeSchema>;

export const createRelationSchema = z.object({
  type: z.string().min(1),
  fromType: relationNodeTypeSchema,
  fromId: z.string().uuid(),
  toType: relationNodeTypeSchema,
  toId: z.string().uuid(),
  weight: z.number().optional(),
  properties: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
});

export type CreateRelationInput = z.infer<typeof createRelationSchema>;

export const relationResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  type: z.string(),
  fromType: relationNodeTypeSchema,
  fromId: z.string().uuid(),
  toType: relationNodeTypeSchema,
  toId: z.string().uuid(),
  weight: z.number().nullable(),
  properties: z.record(z.unknown()),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RelationResponse = z.infer<typeof relationResponseSchema>;

export const listRelationsQuerySchema = z
  .object({
    fromType: relationNodeTypeSchema.optional(),
    fromId: z.string().uuid().optional(),
    toType: relationNodeTypeSchema.optional(),
    toId: z.string().uuid().optional(),
    type: z.string().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    offset: z.coerce.number().min(0).optional().default(0),
  })
  .refine((value) => !!value.fromId || !!value.toId, {
    message: 'At least one of fromId or toId is required',
  });

export type ListRelationsQueryInput = z.infer<typeof listRelationsQuerySchema>;

export const traverseRelationsQuerySchema = z.object({
  startType: relationNodeTypeSchema,
  startId: z.string().uuid(),
  relationTypes: z
    .preprocess((value) => {
      if (typeof value !== 'string' || value.length === 0) {
        return undefined;
      }
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }, z.array(z.string().min(1)).optional()),
  depth: z.coerce.number().min(1).max(3).optional().default(1),
  direction: z.enum(['outgoing', 'incoming', 'both']).optional().default('outgoing'),
});

export type TraverseRelationsQueryInput = z.infer<typeof traverseRelationsQuerySchema>;

export const traverseRelationsResponseSchema = z.object({
  nodes: z.array(
    z.object({
      type: relationNodeTypeSchema,
      id: z.string().uuid(),
    })
  ),
  edges: z.array(relationResponseSchema),
});

export type TraverseRelationsResponse = z.infer<typeof traverseRelationsResponseSchema>;
