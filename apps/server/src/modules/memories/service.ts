import { eq, and, inArray, gte, lte, sql, desc, asc } from 'drizzle-orm';
import {
  db,
  memories,
  embeddings,
  retrieval_events,
  type Memory,
  type NewMemory,
  type NewEmbedding,
  type NewRetrievalEvent,
} from '../../common/db/index.js';
import type { EmbeddingsProvider } from '../../common/embeddings/index.js';
import type {
  CreateMemoryInput,
  MemoryQueryInput,
  MemoryQueryResult,
  MemoryTier,
  ListMemoriesQueryInput,
  UpdateMemoryInput,
  MemoryStatsResponse,
} from './schemas.js';

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

export interface ListMemoriesResult {
  memories: Memory[];
  total: number;
  offset: number;
  limit: number;
}

export async function listMemories(
  tenantId: string,
  input: ListMemoriesQueryInput
): Promise<ListMemoriesResult> {
  const { offset, limit, tier, tag, ownerEntityId, sortBy, sortOrder } = input;
  const conditions = [eq(memories.tenantId, tenantId)];

  if (tier) {
    conditions.push(eq(memories.tier, tier));
  }
  if (ownerEntityId) {
    conditions.push(eq(memories.ownerEntityId, ownerEntityId));
  }
  if (tag) {
    conditions.push(sql`array_position(${memories.tags}, ${tag}) IS NOT NULL`);
  }

  const whereClause = and(...conditions);
  const orderFn = sortOrder === 'asc' ? asc : desc;
  const sortColumn =
    sortBy === 'importanceScore'
      ? memories.importanceScore
      : sortBy === 'accessCount'
        ? memories.accessCount
        : memories.createdAt;

  const [totalRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(memories)
    .where(whereClause);

  const memoryRows = await db
    .select()
    .from(memories)
    .where(whereClause)
    .orderBy(orderFn(sortColumn), desc(memories.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    memories: memoryRows,
    total: Number(totalRow?.count ?? 0),
    offset,
    limit,
  };
}

export async function updateMemory(
  tenantId: string,
  id: string,
  input: UpdateMemoryInput
): Promise<Memory | null> {
  const [memory] = await db
    .update(memories)
    .set({
      content: input.content,
      tier: input.tier,
      importanceScore: input.importanceScore,
      tags: input.tags,
      metadata: input.metadata,
      updatedAt: new Date(),
    })
    .where(and(eq(memories.id, id), eq(memories.tenantId, tenantId)))
    .returning();

  return memory ?? null;
}

export async function deleteMemory(
  tenantId: string,
  id: string
): Promise<boolean> {
  const [memory] = await db
    .select({
      id: memories.id,
      embeddingId: memories.embeddingId,
    })
    .from(memories)
    .where(and(eq(memories.id, id), eq(memories.tenantId, tenantId)))
    .limit(1);

  if (!memory) {
    return false;
  }

  await db
    .delete(memories)
    .where(and(eq(memories.id, id), eq(memories.tenantId, tenantId)));

  if (memory.embeddingId) {
    await db
      .delete(embeddings)
      .where(and(eq(embeddings.id, memory.embeddingId), eq(embeddings.tenantId, tenantId)));
  }

  return true;
}

export async function recordMemoryAccess(
  tenantId: string,
  id: string
): Promise<Memory | null> {
  const [memory] = await db
    .update(memories)
    .set({
      accessCount: sql`${memories.accessCount} + 1`,
      lastAccessedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(memories.id, id), eq(memories.tenantId, tenantId)))
    .returning();

  return memory ?? null;
}

export interface RecordMemoryRetrievalInput {
  memoryId: string;
  retrievalScore: number;
}

export async function recordMemoryRetrievals(
  tenantId: string,
  input: {
    queryText?: string;
    sessionId?: string;
    actorId?: string;
    retrievals: RecordMemoryRetrievalInput[];
  }
): Promise<void> {
  if (input.retrievals.length === 0) {
    return;
  }

  const now = new Date();
  const events: NewRetrievalEvent[] = input.retrievals.map((retrieval) => ({
    tenantId,
    memoryId: retrieval.memoryId,
    queryText: input.queryText ?? null,
    retrievalScore: retrieval.retrievalScore,
    sessionId: input.sessionId ?? null,
    actorId: input.actorId ?? null,
    metadata: {},
  }));

  await db.insert(retrieval_events).values(events);

  const retrievalCountByMemoryId = new Map<string, number>();
  for (const retrieval of input.retrievals) {
    retrievalCountByMemoryId.set(
      retrieval.memoryId,
      (retrievalCountByMemoryId.get(retrieval.memoryId) ?? 0) + 1
    );
  }

  await Promise.all(
    [...retrievalCountByMemoryId.entries()].map(async ([memoryId, count]) => {
      await db
        .update(memories)
        .set({
          retrievalCount: sql`${memories.retrievalCount} + ${count}`,
          lastRetrievedAt: now,
          updatedAt: now,
        })
        .where(and(eq(memories.id, memoryId), eq(memories.tenantId, tenantId)));
    })
  );
}

export async function getMemoryStats(
  tenantId: string
): Promise<MemoryStatsResponse> {
  const totalResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM memories
    WHERE tenant_id = ${tenantId}
  `);
  const total = Number((totalResult.rows[0] as Record<string, unknown> | undefined)?.['total'] ?? 0);

  const byTierResult = await db.execute(sql`
    SELECT tier, COUNT(*)::int AS count
    FROM memories
    WHERE tenant_id = ${tenantId}
    GROUP BY tier
  `);

  const byTier: MemoryStatsResponse['byTier'] = {
    episodic: 0,
    semantic: 0,
    short_term: 0,
  };

  for (const row of byTierResult.rows as Array<Record<string, unknown>>) {
    const tier = String(row['tier']);
    const count = Number(row['count'] ?? 0);
    if (tier === 'episodic' || tier === 'semantic' || tier === 'short_term') {
      byTier[tier] = count;
    }
  }

  const byDayResult = await db.execute(sql`
    SELECT
      TO_CHAR(day_series.day, 'YYYY-MM-DD') AS date,
      COALESCE(COUNT(m.id), 0)::int AS count
    FROM generate_series(
      (CURRENT_DATE - INTERVAL '29 days')::date,
      CURRENT_DATE::date,
      INTERVAL '1 day'
    ) AS day_series(day)
    LEFT JOIN memories m
      ON m.tenant_id = ${tenantId}
      AND m.created_at >= day_series.day
      AND m.created_at < day_series.day + INTERVAL '1 day'
    GROUP BY day_series.day
    ORDER BY day_series.day ASC
  `);

  const byDay = (byDayResult.rows as Array<Record<string, unknown>>).map((row) => ({
    date: String(row['date']),
    count: Number(row['count'] ?? 0),
  }));

  return { total, byTier, byDay };
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
    retrievalCount: row['retrieval_count'] != null ? Number(row['retrieval_count']) : null,
    lastAccessedAt: row['last_accessed_at'] ? new Date(String(row['last_accessed_at'])) : null,
    lastRetrievedAt: row['last_retrieved_at'] ? new Date(String(row['last_retrieved_at'])) : null,
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
