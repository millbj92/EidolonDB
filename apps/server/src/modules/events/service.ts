import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db, events, type Event, type NewEvent } from '../../common/db/index.js';
import type { CreateEventInput, ListEventsQueryInput, TimelineQueryInput, TimelineRow } from './schemas.js';

export async function createEvent(
  tenantId: string,
  input: CreateEventInput
): Promise<Event> {
  const newEvent: NewEvent = {
    tenantId,
    actorEntityId: input.actorEntityId ?? null,
    eventType: input.eventType,
    timestamp: input.timestamp ?? new Date(),
    payload: input.payload,
    tags: input.tags,
  };

  const [event] = await db.insert(events).values(newEvent).returning();

  if (!event) {
    throw new Error('Failed to create event');
  }

  return event;
}

export async function getEventById(
  tenantId: string,
  id: string
): Promise<Event | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.tenantId, tenantId)))
    .limit(1);

  return event ?? null;
}

export interface ListEventsResult {
  events: Event[];
  total: number;
  offset: number;
  limit: number;
}

export async function listEvents(
  tenantId: string,
  input: ListEventsQueryInput
): Promise<ListEventsResult> {
  const { actorEntityId, eventType, after, before, limit, offset, sortOrder } = input;
  const conditions = [eq(events.tenantId, tenantId)];

  if (actorEntityId) {
    conditions.push(eq(events.actorEntityId, actorEntityId));
  }
  if (eventType) {
    conditions.push(eq(events.eventType, eventType));
  }
  if (after) {
    conditions.push(gte(events.timestamp, new Date(after)));
  }
  if (before) {
    conditions.push(lte(events.timestamp, new Date(before)));
  }

  const whereClause = and(...conditions);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(whereClause);

  const orderFn = sortOrder === 'asc' ? asc : desc;
  const rows = await db
    .select()
    .from(events)
    .where(whereClause)
    .orderBy(orderFn(events.timestamp))
    .limit(limit)
    .offset(offset);

  return {
    events: rows,
    total: Number(totalRow?.count ?? 0),
    offset,
    limit,
  };
}

export async function getTimeline(
  tenantId: string,
  input: TimelineQueryInput
): Promise<TimelineRow[]> {
  const { days, actorEntityId, eventType } = input;
  const whereParts = [sql`e.tenant_id = ${tenantId}`];

  if (actorEntityId) {
    whereParts.push(sql`e.actor_entity_id = ${actorEntityId}`);
  }
  if (eventType) {
    whereParts.push(sql`e.event_type = ${eventType}`);
  }

  const whereSql = sql.join(whereParts, sql` AND `);
  const dayOffset = days - 1;

  const result = await db.execute(sql`
    WITH days AS (
      SELECT generate_series(
        (CURRENT_DATE - ${dayOffset} * INTERVAL '1 day')::date,
        CURRENT_DATE::date,
        INTERVAL '1 day'
      ) AS day
    ),
    filtered AS (
      SELECT e.*
      FROM events e
      WHERE ${whereSql}
      AND e.timestamp >= (CURRENT_DATE - ${dayOffset} * INTERVAL '1 day')
      AND e.timestamp < (CURRENT_DATE + INTERVAL '1 day')
    ),
    day_counts AS (
      SELECT
        date_trunc('day', timestamp)::date AS day,
        COUNT(*)::int AS count
      FROM filtered
      GROUP BY date_trunc('day', timestamp)::date
    ),
    type_counts AS (
      SELECT
        date_trunc('day', timestamp)::date AS day,
        event_type,
        COUNT(*)::int AS count
      FROM filtered
      GROUP BY date_trunc('day', timestamp)::date, event_type
    )
    SELECT
      TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
      COALESCE(dc.count, 0)::int AS count,
      COALESCE((
        SELECT jsonb_object_agg(tc.event_type, tc.count)
        FROM type_counts tc
        WHERE tc.day = d.day
      ), '{}'::jsonb) AS types
    FROM days d
    LEFT JOIN day_counts dc ON dc.day = d.day
    ORDER BY d.day ASC
  `);

  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    date: String(row['date']),
    count: Number(row['count'] ?? 0),
    types: (row['types'] as Record<string, number>) ?? {},
  }));
}
