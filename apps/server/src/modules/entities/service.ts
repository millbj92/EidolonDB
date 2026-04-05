import { eq, and } from 'drizzle-orm';
import { db, entities, type Entity, type NewEntity } from '../../common/db/index.js';
import type { CreateEntityInput } from './schemas.js';

export async function createEntity(
  tenantId: string,
  input: CreateEntityInput
): Promise<Entity> {
  const newEntity: NewEntity = {
    tenantId,
    type: input.type,
    name: input.name,
    properties: input.properties,
    primaryArtifactId: input.primaryArtifactId ?? null,
    tags: input.tags,
  };

  const [entity] = await db.insert(entities).values(newEntity).returning();

  if (!entity) {
    throw new Error('Failed to create entity');
  }

  return entity;
}

export async function getEntityById(
  tenantId: string,
  id: string
): Promise<Entity | null> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, id), eq(entities.tenantId, tenantId)))
    .limit(1);

  return entity ?? null;
}
