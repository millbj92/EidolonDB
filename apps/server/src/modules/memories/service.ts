import { eq, and, inArray, gte, lte, sql } from 'drizzle-orm';
import { db, memories, embeddings, type Memory, type NewMemory, type NewEmbedding } from '../../common/db/index.js';
import type { EmbeddingsProvider } from '../../common/embeddings/index.js';
import type { CreateMemoryInput, MemoryQueryInput, MemoryQueryResult, MemoryTier } from './schemas.js';

export interface CreateMemoryOptions {
  generateEmbedding?: boolean;
  embeddingsProvider?: EmbeddingsProvider;
}

export interface MemoryWithEmbedding {
  memory: Memory;
  embeddingId: string | null;
}

export async function createMemory(
  tenantId: string,
  input: CreateMemoryInput,
  options?: CreateMemoryOptions
): Promise<MemoryWithEmbedding> {
  const { generateEmbedding = false, embeddingsProvider } = options ?? {};

  let embeddingId: string | null = null;

  // Generate embedding if requested
  if (generateEmbedding && embeddingsProvider) {
    const result = await embeddingsProvider.embedText(input.content);

    const newEmbedding: NewEmbedding = {
      tenantId,
      ownerType: 'memory',
      ownerId: '00000000-0000-0000-0000-000000000000', // Placeholder, will update after memory creation
      model: result.model,
      dim: result.dim,
      vector: result.vector,
      tags: [],
    };

    const [embedding] = await db.insert(embeddings).values(newEmbedding).returning();
    if (embedding) {
      embeddingId = embedding.id;
    }
  }

  const newMemory: NewMemory = {
    tenantId,
    ownerEntityId: input.ownerEntityId ?? null,
    tier: input.tier,
    content: input.content,
    sourceArtifactId: input.sourceArtifactId ?? null,
    sourceEventId: input.sourceEventId ?? null,
    embeddingId,
    importanceScore: input.importanceScore,
    recencyScore: 1.0,
    accessCount: 0,
    metadata: input.metadata,
    tags: input.tags,
  };

  const [memory] = await db.insert(memories).values(newMemory).returning();

  if (!memory) {
    throw new Error('Failed to create memory');
  }

  // Update embedding's ownerId to point to the memory
  if (embeddingId) {
    await db
      .update(embeddings)
      .set({ ownerId: memory.id })
      .where(eq(embeddings.id, embeddingId));
  }

  return { memory, embeddingId };
}

export async function createMemoriesBatch(
  tenantId: string,
  inputs: CreateMemoryInput[],
  options?: CreateMemoryOptions
): Promise<MemoryWithEmbedding[]> {
  const { generateEmbedding = false, embeddingsProvider } = options ?? {};

  if (inputs.length === 0) {
    return [];
  }

  let embeddingResults: Array<{ vector: number[]; model: string; dim: number }> = [];

  // Batch generate embeddings if requested
  if (generateEmbedding && embeddingsProvider) {
    const texts = inputs.map((input) => input.content);
    embeddingResults = await embeddingsProvider.embedBatch(texts);
  }

  const results: MemoryWithEmbedding[] = [];

  // Create memories and embeddings one by one (for now, can optimize later with batch inserts)
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;
    let embeddingId: string | null = null;

    // Create embedding if we have results
    const embResult = embeddingResults[i];
    if (embResult) {
      const newEmbedding: NewEmbedding = {
        tenantId,
        ownerType: 'memory',
        ownerId: '00000000-0000-0000-0000-000000000000',
        model: embResult.model,
        dim: embResult.dim,
        vector: embResult.vector,
        tags: [],
      };

      const [embedding] = await db.insert(embeddings).values(newEmbedding).returning();
      if (embedding) {
        embeddingId = embedding.id;
      }
    }

    const newMemory: NewMemory = {
      tenantId,
      ownerEntityId: input.ownerEntityId ?? null,
      tier: input.tier,
      content: input.content,
      sourceArtifactId: input.sourceArtifactId ?? null,
      sourceEventId: input.sourceEventId ?? null,
      embeddingId,
      importanceScore: input.importanceScore,
      recencyScore: 1.0,
      accessCount: 0,
      metadata: input.metadata,
      tags: input.tags,
    };

    const [memory] = await db.insert(memories).values(newMemory).returning();

    if (!memory) {
      throw new Error('Failed to create memory');
    }

    // Update embedding's ownerId
    if (embeddingId) {
      await db
        .update(embeddings)
        .set({ ownerId: memory.id })
        .where(eq(embeddings.id, embeddingId));
    }

    results.push({ memory, embeddingId });
  }

  return results;
}

export async function getMemoryById(
  tenantId: string,
  id: string
): Promise<Memory | null> {
  const [memory] = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, id), eq(memories.tenantId, tenantId)))
    .limit(1);

  return memory ?? null;
}

export interface QueryMemoriesOptions {
  embeddingsProvider?: EmbeddingsProvider;
}

interface ScoredMemory {
  memory: Memory;
  semanticScore: number;
  recencyScore: number;
  importanceScore: number;
}

/**
 * Query memories using hybrid search (vector similarity + filters + scoring).
 *
 * Scoring combines:
 * - Semantic: cosine similarity from vector search (0-1)
 * - Recency: exponential decay based on age (0-1)
 * - Importance: stored importance_score (0-1)
 *
 * Final score = weights.semantic * semantic + weights.recency * recency + weights.importance * importance
 */
export async function queryMemories(
  tenantId: string,
  input: MemoryQueryInput,
  options?: QueryMemoriesOptions
): Promise<MemoryQueryResult[]> {
  const { embeddingsProvider } = options ?? {};
  const {
    text,
    k,
    ownerEntityId,
    tiers,
    tags,
    sourceArtifactId,
    createdAfter,
    createdBefore,
    weights,
    minScore,
  } = input;

  // Normalize weights
  const rawWeights = {
    semantic: weights?.semantic ?? 0.7,
    recency: weights?.recency ?? 0.2,
    importance: weights?.importance ?? 0.1,
  };
  const weightSum = rawWeights.semantic + rawWeights.recency + rawWeights.importance;
  const normalizedWeights = {
    semantic: rawWeights.semantic / weightSum,
    recency: rawWeights.recency / weightSum,
    importance: rawWeights.importance / weightSum,
  };

  let scoredMemories: ScoredMemory[] = [];

  if (text && embeddingsProvider) {
    // Vector search path
    const queryEmbedding = await embeddingsProvider.embedText(text);
    const vectorStr = `[${queryEmbedding.vector.join(',')}]`;

    // Build filter conditions for the query
    const conditions: string[] = [`m.tenant_id = '${tenantId}'`];

    if (ownerEntityId) {
      conditions.push(`m.owner_entity_id = '${ownerEntityId}'`);
    }
    if (tiers && tiers.length > 0) {
      const tierList = tiers.map((t) => `'${t}'`).join(',');
      conditions.push(`m.tier IN (${tierList})`);
    }
    if (sourceArtifactId) {
      conditions.push(`m.source_artifact_id = '${sourceArtifactId}'`);
    }
    if (createdAfter) {
      conditions.push(`m.created_at >= '${createdAfter}'`);
    }
    if (createdBefore) {
      conditions.push(`m.created_at <= '${createdBefore}'`);
    }

    const whereClause = conditions.join(' AND ');

    // Perform vector similarity search with filters
    // Using cosine distance: 1 - (a <=> b) gives similarity
    const results = await db.execute(sql.raw(`
      SELECT
        m.*,
        1 - (e.vector <=> '${vectorStr}'::vector) as similarity
      FROM memories m
      INNER JOIN embeddings e ON m.embedding_id = e.id
      WHERE ${whereClause}
      ORDER BY e.vector <=> '${vectorStr}'::vector
      LIMIT ${k * 2}
    `));

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const row of results.rows as Array<Record<string, unknown>>) {
      const memory = rowToMemory(row);
      const similarity = Number(row['similarity'] ?? 0);

      // Calculate recency score (exponential decay, half-life of 7 days)
      const ageMs = now - new Date(memory.createdAt).getTime();
      const ageDays = ageMs / dayMs;
      const recencyScore = Math.exp(-ageDays / 7);

      scoredMemories.push({
        memory,
        semanticScore: Math.max(0, Math.min(1, similarity)),
        recencyScore,
        importanceScore: memory.importanceScore ?? 0.5,
      });
    }

    // Apply tag filter in-memory (could be done in SQL but arrays are tricky)
    if (tags && tags.length > 0) {
      scoredMemories = scoredMemories.filter((sm) => {
        const memTags = sm.memory.tags ?? [];
        return tags.some((t) => memTags.includes(t));
      });
    }
  } else {
    // Non-vector search path (filter only)
    const conditions = [eq(memories.tenantId, tenantId)];

    if (ownerEntityId) {
      conditions.push(eq(memories.ownerEntityId, ownerEntityId));
    }
    if (tiers && tiers.length > 0) {
      conditions.push(inArray(memories.tier, tiers as [MemoryTier, ...MemoryTier[]]));
    }
    if (sourceArtifactId) {
      conditions.push(eq(memories.sourceArtifactId, sourceArtifactId));
    }
    if (createdAfter) {
      conditions.push(gte(memories.createdAt, new Date(createdAfter)));
    }
    if (createdBefore) {
      conditions.push(lte(memories.createdAt, new Date(createdBefore)));
    }

    const results = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .limit(k * 2);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const memory of results) {
      const ageMs = now - new Date(memory.createdAt).getTime();
      const ageDays = ageMs / dayMs;
      const recencyScore = Math.exp(-ageDays / 7);

      scoredMemories.push({
        memory,
        semanticScore: 0, // No semantic score without vector search
        recencyScore,
        importanceScore: memory.importanceScore ?? 0.5,
      });
    }

    // Apply tag filter
    if (tags && tags.length > 0) {
      scoredMemories = scoredMemories.filter((sm) => {
        const memTags = sm.memory.tags ?? [];
        return tags.some((t) => memTags.includes(t));
      });
    }
  }

  // Calculate final scores and sort
  const finalResults: MemoryQueryResult[] = scoredMemories
    .map((sm) => {
      const score =
        normalizedWeights.semantic * sm.semanticScore +
        normalizedWeights.recency * sm.recencyScore +
        normalizedWeights.importance * sm.importanceScore;

      return {
        memory: memoryToResponse(sm.memory),
        score,
        reasons: {
          semantic: sm.semanticScore,
          recency: sm.recencyScore,
          importance: sm.importanceScore,
        },
      };
    })
    .filter((r) => r.score >= (minScore ?? 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return finalResults;
}

function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row['id']),
    tenantId: String(row['tenant_id']),
    ownerEntityId: row['owner_entity_id'] ? String(row['owner_entity_id']) : null,
    tier: String(row['tier']) as 'short_term' | 'episodic' | 'semantic',
    content: String(row['content']),
    sourceArtifactId: row['source_artifact_id'] ? String(row['source_artifact_id']) : null,
    sourceEventId: row['source_event_id'] ? String(row['source_event_id']) : null,
    embeddingId: row['embedding_id'] ? String(row['embedding_id']) : null,
    importanceScore: row['importance_score'] != null ? Number(row['importance_score']) : null,
    recencyScore: row['recency_score'] != null ? Number(row['recency_score']) : null,
    accessCount: row['access_count'] != null ? Number(row['access_count']) : null,
    lastAccessedAt: row['last_accessed_at'] ? new Date(String(row['last_accessed_at'])) : null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    tags: (row['tags'] as string[]) ?? [],
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  };
}

function memoryToResponse(memory: Memory) {
  return {
    id: memory.id,
    tenantId: memory.tenantId,
    ownerEntityId: memory.ownerEntityId,
    tier: memory.tier,
    content: memory.content,
    sourceArtifactId: memory.sourceArtifactId,
    sourceEventId: memory.sourceEventId,
    embeddingId: memory.embeddingId,
    importanceScore: memory.importanceScore,
    recencyScore: memory.recencyScore,
    accessCount: memory.accessCount,
    lastAccessedAt: memory.lastAccessedAt?.toISOString() ?? null,
    metadata: memory.metadata ?? {},
    tags: memory.tags ?? [],
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}
