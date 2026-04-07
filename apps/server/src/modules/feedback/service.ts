import { and, eq, gt, sql } from 'drizzle-orm';
import { db, retrieval_events } from '../../common/db/index.js';
import { recordMemoryAccess } from '../memories/index.js';
import type { MarkUsedRequest, MarkUsedResponse, RetrievalStatsResponse } from './schemas.js';

interface RetrievalStatsRow {
  memory_id: string;
  retrieval_count: number;
  usage_count: number;
  avg_relevance_feedback: number | null;
  avg_retrieval_score: number | null;
  last_retrieved_at: Date | null;
}

function mapRetrievalStatsRow(row: RetrievalStatsRow): RetrievalStatsResponse {
  return {
    memoryId: row.memory_id,
    retrievalCount: Number(row.retrieval_count ?? 0),
    usageCount: Number(row.usage_count ?? 0),
    avgRelevanceFeedback: row.avg_relevance_feedback != null ? Number(row.avg_relevance_feedback) : null,
    avgRetrievalScore: row.avg_retrieval_score != null ? Number(row.avg_retrieval_score) : null,
    lastRetrievedAt: row.last_retrieved_at ? new Date(row.last_retrieved_at).toISOString() : null,
  };
}

export async function markUsed(tenantId: string, input: MarkUsedRequest): Promise<MarkUsedResponse> {
  const memoryIds = [...new Set(input.memoryIds)];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  let updated = 0;

  for (const memoryId of memoryIds) {
    const relevanceScore = input.relevanceFeedback?.[memoryId];
    const updatePayload: { wasUsed: boolean; relevanceFeedback?: number } = { wasUsed: true };
    if (relevanceScore != null) {
      updatePayload.relevanceFeedback = relevanceScore;
    }

    const updatedRows = await db
      .update(retrieval_events)
      .set(updatePayload)
      .where(
        and(
          eq(retrieval_events.tenantId, tenantId),
          eq(retrieval_events.memoryId, memoryId),
          eq(retrieval_events.wasUsed, false),
          gt(retrieval_events.createdAt, oneHourAgo)
        )
      )
      .returning({ id: retrieval_events.id });

    updated += updatedRows.length;

    await recordMemoryAccess(tenantId, memoryId);
  }

  return {
    updated,
    memoryIds,
  };
}

export async function getRetrievalStats(
  tenantId: string,
  memoryId: string
): Promise<RetrievalStatsResponse> {
  const result = await db.execute(sql`
    SELECT
      m.id AS memory_id,
      COALESCE(m.retrieval_count, 0)::int AS retrieval_count,
      COALESCE(COUNT(re.id) FILTER (WHERE re.was_used = true), 0)::int AS usage_count,
      AVG(re.relevance_feedback)::float8 AS avg_relevance_feedback,
      AVG(re.retrieval_score)::float8 AS avg_retrieval_score,
      m.last_retrieved_at
    FROM memories m
    LEFT JOIN retrieval_events re
      ON re.memory_id = m.id
      AND re.tenant_id = ${tenantId}
    WHERE m.tenant_id = ${tenantId}
      AND m.id = ${memoryId}
    GROUP BY m.id, m.retrieval_count, m.last_retrieved_at
    LIMIT 1
  `);

  const row = result.rows[0] as RetrievalStatsRow | undefined;
  if (!row) {
    throw new Error(`Memory with id ${memoryId} not found`);
  }

  return mapRetrievalStatsRow(row);
}

export async function listRetrievalStats(
  tenantId: string,
  options?: { limit?: number; sortBy?: 'retrievalCount' | 'usageCount' | 'lastRetrievedAt' }
): Promise<RetrievalStatsResponse[]> {
  const limit = options?.limit ?? 20;
  const sortBy = options?.sortBy ?? 'retrievalCount';

  const orderBy =
    sortBy === 'usageCount'
      ? sql`usage_count DESC, retrieval_count DESC, m.created_at DESC`
      : sortBy === 'lastRetrievedAt'
        ? sql`m.last_retrieved_at DESC NULLS LAST, retrieval_count DESC, m.created_at DESC`
        : sql`retrieval_count DESC, usage_count DESC, m.created_at DESC`;

  const result = await db.execute(sql`
    SELECT
      m.id AS memory_id,
      COALESCE(m.retrieval_count, 0)::int AS retrieval_count,
      COALESCE(COUNT(re.id) FILTER (WHERE re.was_used = true), 0)::int AS usage_count,
      AVG(re.relevance_feedback)::float8 AS avg_relevance_feedback,
      AVG(re.retrieval_score)::float8 AS avg_retrieval_score,
      m.last_retrieved_at
    FROM memories m
    LEFT JOIN retrieval_events re
      ON re.memory_id = m.id
      AND re.tenant_id = ${tenantId}
    WHERE m.tenant_id = ${tenantId}
    GROUP BY m.id, m.retrieval_count, m.last_retrieved_at, m.created_at
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `);

  return (result.rows as unknown as RetrievalStatsRow[]).map(mapRetrievalStatsRow);
}
