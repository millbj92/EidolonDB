import { eq, and } from 'drizzle-orm';
import { db, artifacts, type Artifact, type NewArtifact } from '../../common/db/index.js';
import type { CreateArtifactInput } from './schemas.js';

export async function createArtifact(
  tenantId: string,
  input: Omit<CreateArtifactInput, 'autoProcess'>
): Promise<Artifact> {
  const newArtifact: NewArtifact = {
    tenantId,
    kind: input.kind,
    mimeType: input.mimeType,
    content: input.content,
    metadata: input.metadata,
    tags: input.tags,
  };

  const [artifact] = await db.insert(artifacts).values(newArtifact).returning();

  if (!artifact) {
    throw new Error('Failed to create artifact');
  }

  return artifact;
}

export async function getArtifactById(
  tenantId: string,
  id: string
): Promise<Artifact | null> {
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.tenantId, tenantId)))
    .limit(1);

  return artifact ?? null;
}
