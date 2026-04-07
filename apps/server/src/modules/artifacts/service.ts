import { eq, and, inArray } from 'drizzle-orm';
import { db, artifacts, memories, embeddings, type Artifact, type NewArtifact } from '../../common/db/index.js';
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

export interface DeleteArtifactResult {
  deleted: boolean;
  memoriesDeleted: number;
}

export async function deleteArtifactCascade(
  tenantId: string,
  id: string
): Promise<DeleteArtifactResult> {
  return db.transaction(async (tx) => {
    const [artifact] = await tx
      .select({ id: artifacts.id })
      .from(artifacts)
      .where(and(eq(artifacts.id, id), eq(artifacts.tenantId, tenantId)))
      .limit(1);

    if (!artifact) {
      return { deleted: false, memoriesDeleted: 0 };
    }

    const artifactMemories = await tx
      .select({
        id: memories.id,
        embeddingId: memories.embeddingId,
      })
      .from(memories)
      .where(and(eq(memories.tenantId, tenantId), eq(memories.sourceArtifactId, id)));

    const memoriesDeleted = artifactMemories.length;
    const embeddingIds = artifactMemories
      .map((memory) => memory.embeddingId)
      .filter((embeddingId): embeddingId is string => typeof embeddingId === 'string');

    await tx
      .delete(memories)
      .where(and(eq(memories.tenantId, tenantId), eq(memories.sourceArtifactId, id)));

    if (embeddingIds.length > 0) {
      await tx
        .delete(embeddings)
        .where(and(eq(embeddings.tenantId, tenantId), inArray(embeddings.id, embeddingIds)));
    }

    await tx
      .delete(artifacts)
      .where(and(eq(artifacts.id, id), eq(artifacts.tenantId, tenantId)));

    return { deleted: true, memoriesDeleted };
  });
}
