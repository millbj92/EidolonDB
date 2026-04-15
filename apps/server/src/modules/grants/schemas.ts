import { z } from 'zod';

export const createGrantSchema = z.object({
  ownerEntityId: z.string().uuid(),
  granteeEntityId: z.string().uuid().nullable().optional(),
  permission: z.enum(['read', 'read-write']).default('read'),
  scopeTier: z.enum(['short_term', 'episodic', 'semantic']).nullable().optional(),
  scopeTag: z.string().nullable().optional(),
});

export const listGrantsQuerySchema = z.object({
  ownerEntityId: z.string().uuid().optional(),
  granteeEntityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateGrantInput = z.infer<typeof createGrantSchema>;
export type ListGrantsQueryInput = z.infer<typeof listGrantsQuerySchema>;
