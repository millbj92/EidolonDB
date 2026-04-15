import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../common/db/client.js';
import {
  memoryGrants,
  type MemoryGrant,
  type NewMemoryGrant,
} from '../../common/db/schema.js';
import type { CreateGrantInput, ListGrantsQueryInput } from './schemas.js';

export class DuplicateGrantError extends Error {
  constructor() {
    super('Grant already exists for the same owner/grantee/tier/tag scope');
    this.name = 'DuplicateGrantError';
  }
}

function normalizeNullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

export async function createGrant(
  tenantId: string,
  input: CreateGrantInput
): Promise<MemoryGrant> {
  const granteeEntityId = normalizeNullable(input.granteeEntityId);
  const scopeTier = normalizeNullable(input.scopeTier);
  const scopeTag = normalizeNullable(input.scopeTag);

  const [existing] = await db
    .select()
    .from(memoryGrants)
    .where(
      and(
        eq(memoryGrants.tenantId, tenantId),
        eq(memoryGrants.ownerEntityId, input.ownerEntityId),
        sql`${memoryGrants.granteeEntityId} IS NOT DISTINCT FROM ${granteeEntityId}`,
        sql`${memoryGrants.scopeTier} IS NOT DISTINCT FROM ${scopeTier}`,
        sql`${memoryGrants.scopeTag} IS NOT DISTINCT FROM ${scopeTag}`
      )
    )
    .limit(1);

  if (existing) {
    throw new DuplicateGrantError();
  }

  const newGrant: NewMemoryGrant = {
    tenantId,
    ownerEntityId: input.ownerEntityId,
    granteeEntityId,
    permission: input.permission,
    scopeTier,
    scopeTag,
  };

  try {
    const [grant] = await db.insert(memoryGrants).values(newGrant).returning();

    if (!grant) {
      throw new Error('Failed to create grant');
    }

    return grant;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      throw new DuplicateGrantError();
    }

    throw error;
  }
}

export interface ListGrantsResult {
  grants: MemoryGrant[];
  total: number;
  offset: number;
  limit: number;
}

export async function listGrants(
  tenantId: string,
  query: ListGrantsQueryInput
): Promise<ListGrantsResult> {
  const { ownerEntityId, granteeEntityId, limit, offset } = query;
  const conditions = [eq(memoryGrants.tenantId, tenantId)];

  if (ownerEntityId) {
    conditions.push(eq(memoryGrants.ownerEntityId, ownerEntityId));
  }
  if (granteeEntityId) {
    conditions.push(eq(memoryGrants.granteeEntityId, granteeEntityId));
  }

  const whereClause = and(...conditions);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memoryGrants)
    .where(whereClause);

  const grants = await db
    .select()
    .from(memoryGrants)
    .where(whereClause)
    .orderBy(desc(memoryGrants.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    grants,
    total: Number(totalRow?.count ?? 0),
    offset,
    limit,
  };
}

export async function getGrantById(
  tenantId: string,
  id: string
): Promise<MemoryGrant | null> {
  const [grant] = await db
    .select()
    .from(memoryGrants)
    .where(and(eq(memoryGrants.tenantId, tenantId), eq(memoryGrants.id, id)))
    .limit(1);

  return grant ?? null;
}

export async function deleteGrant(
  tenantId: string,
  id: string
): Promise<boolean> {
  const result = await db
    .delete(memoryGrants)
    .where(and(eq(memoryGrants.tenantId, tenantId), eq(memoryGrants.id, id)))
    .returning({ id: memoryGrants.id });

  return result.length > 0;
}

export async function getGrantsForGrantee(
  tenantId: string,
  granteeEntityId: string
): Promise<MemoryGrant[]> {
  return db
    .select()
    .from(memoryGrants)
    .where(
      and(
        eq(memoryGrants.tenantId, tenantId),
        or(eq(memoryGrants.granteeEntityId, granteeEntityId), isNull(memoryGrants.granteeEntityId))
      )
    );
}
