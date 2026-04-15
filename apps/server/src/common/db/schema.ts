// Memory schema — EidolonDB internal DB (MEMORIES_DATABASE_URL)
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  real,
  integer,
  index,
  vector,
  boolean,
} from 'drizzle-orm/pg-core';

// Enums
export const memoryTierEnum = pgEnum('memory_tier', ['short_term', 'episodic', 'semantic']);
export const grantPermissionEnum = pgEnum('grant_permission', ['read', 'read-write']);
export const ownerTypeEnum = pgEnum('owner_type', ['memory', 'artifact', 'entity']);
export const nodeTypeEnum = pgEnum('node_type', ['entity', 'artifact', 'memory']);

// Entities table
export const entities = pgTable('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  properties: jsonb('properties').$type<Record<string, unknown>>().default({}),
  primaryArtifactId: uuid('primary_artifact_id'),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('entities_tenant_id_idx').on(table.tenantId),
  index('entities_type_idx').on(table.type),
]);

// Artifacts table
export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  kind: text('kind').notNull(),
  mimeType: text('mime_type').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('artifacts_tenant_id_idx').on(table.tenantId),
  index('artifacts_kind_idx').on(table.kind),
]);

// Embeddings table
export const embeddings = pgTable('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  ownerType: ownerTypeEnum('owner_type').notNull(),
  ownerId: uuid('owner_id').notNull(),
  model: text('model').notNull(),
  dim: integer('dim').notNull(),
  vector: vector('vector', { dimensions: 1536 }),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('embeddings_tenant_id_idx').on(table.tenantId),
  index('embeddings_owner_idx').on(table.ownerType, table.ownerId),
]);

// Memories table
export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  ownerEntityId: uuid('owner_entity_id').references(() => entities.id),
  tier: memoryTierEnum('tier').notNull(),
  content: text('content').notNull(),
  sourceArtifactId: uuid('source_artifact_id').references(() => artifacts.id),
  sourceEventId: uuid('source_event_id'),
  embeddingId: uuid('embedding_id').references(() => embeddings.id),
  importanceScore: real('importance_score').default(0.5),
  recencyScore: real('recency_score').default(1.0),
  accessCount: integer('access_count').default(0),
  retrievalCount: integer('retrieval_count').default(0),
  conflictStatus: text('conflict_status').$type<'none' | 'flagged' | 'resolved'>().default('none'),
  conflictGroupId: uuid('conflict_group_id'),
  conflictResolution: text('conflict_resolution'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  sessionNumber: integer('session_number'),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  lastRetrievedAt: timestamp('last_retrieved_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('memories_tenant_id_idx').on(table.tenantId),
  index('memories_owner_entity_id_idx').on(table.ownerEntityId),
  index('memories_tier_idx').on(table.tier),
  index('memories_tenant_session_number_idx').on(table.tenantId, table.sessionNumber),
  index('memories_conflict_status_idx').on(table.tenantId, table.conflictStatus),
]);

// Memory grants table
export const memoryGrants = pgTable('memory_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  ownerEntityId: uuid('owner_entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  granteeEntityId: uuid('grantee_entity_id').references(() => entities.id, { onDelete: 'cascade' }),
  permission: grantPermissionEnum('permission').notNull().default('read'),
  scopeTier: memoryTierEnum('scope_tier'),
  scopeTag: text('scope_tag'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('memory_grants_tenant_idx').on(table.tenantId),
  index('memory_grants_owner_idx').on(table.ownerEntityId),
  index('memory_grants_grantee_idx').on(table.granteeEntityId),
]);

// Retrieval events table
export const retrieval_events = pgTable('retrieval_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  memoryId: uuid('memory_id').notNull().references(() => memories.id, { onDelete: 'cascade' }),
  queryText: text('query_text'),
  retrievalScore: real('retrieval_score'),
  wasUsed: boolean('was_used').default(false),
  relevanceFeedback: real('relevance_feedback'),
  sessionId: text('session_id'),
  actorId: text('actor_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('retrieval_events_tenant_id_idx').on(table.tenantId),
  index('retrieval_events_memory_id_idx').on(table.memoryId),
  index('retrieval_events_created_at_idx').on(table.createdAt),
]);

// Relations table
export const relations = pgTable('relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  type: text('type').notNull(),
  fromType: nodeTypeEnum('from_type').notNull(),
  fromId: uuid('from_id').notNull(),
  toType: nodeTypeEnum('to_type').notNull(),
  toId: uuid('to_id').notNull(),
  weight: real('weight'),
  properties: jsonb('properties').$type<Record<string, unknown>>().default({}),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('relations_tenant_id_idx').on(table.tenantId),
  index('relations_from_idx').on(table.fromType, table.fromId),
  index('relations_to_idx').on(table.toType, table.toId),
  index('relations_type_idx').on(table.type),
]);

// Events table
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  actorEntityId: uuid('actor_entity_id').references(() => entities.id),
  eventType: text('event_type').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  tags: text('tags').array().default([]),
}, (table) => [
  index('events_tenant_id_idx').on(table.tenantId),
  index('events_actor_entity_id_idx').on(table.actorEntityId),
  index('events_event_type_idx').on(table.eventType),
  index('events_timestamp_idx').on(table.timestamp),
]);

// Ingest traces table
export const ingestTraces = pgTable('ingest_traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  traceId: uuid('trace_id').notNull().unique(),
  rawInput: text('raw_input').notNull(),
  normalizedInput: text('normalized_input').notNull(),
  source: text('source').notNull(),
  actorId: text('actor_id'),
  sessionId: text('session_id'),
  extractorVersion: text('extractor_version').notNull(),
  promptVersion: text('prompt_version').notNull(),
  candidateCount: integer('candidate_count').notNull().default(0),
  acceptedCount: integer('accepted_count').notNull().default(0),
  rejectedCount: integer('rejected_count').notNull().default(0),
  candidates: jsonb('candidates').$type<Record<string, unknown>[]>().default([]),
  warnings: text('warnings').array().default([]),
  errors: text('errors').array().default([]),
  durationMs: integer('duration_ms'),
  autoStore: boolean('auto_store').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ingest_traces_tenant_id_idx').on(table.tenantId),
  index('ingest_traces_trace_id_idx').on(table.traceId),
  index('ingest_traces_created_at_idx').on(table.createdAt),
]);

// Lifecycle runs table
export const lifecycleRuns = pgTable('lifecycle_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  triggeredBy: text('triggered_by').notNull().default('manual'),
  durationMs: integer('duration_ms'),
  expired: integer('expired').notNull().default(0),
  promoted: integer('promoted').notNull().default(0),
  distilled: integer('distilled').notNull().default(0),
  archived: integer('archived').notNull().default(0),
  unchanged: integer('unchanged').notNull().default(0),
  errors: text('errors').array().default([]),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('lifecycle_runs_tenant_id_idx').on(table.tenantId),
  index('lifecycle_runs_created_at_idx').on(table.createdAt),
]);

// Type exports for use in application code
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export type MemoryGrant = typeof memoryGrants.$inferSelect;
export type NewMemoryGrant = typeof memoryGrants.$inferInsert;

export type RetrievalEvent = typeof retrieval_events.$inferSelect;
export type NewRetrievalEvent = typeof retrieval_events.$inferInsert;

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

export type Relation = typeof relations.$inferSelect;
export type NewRelation = typeof relations.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type IngestTrace = typeof ingestTraces.$inferSelect;
export type NewIngestTrace = typeof ingestTraces.$inferInsert;

export type LifecycleRun = typeof lifecycleRuns.$inferSelect;
export type NewLifecycleRun = typeof lifecycleRuns.$inferInsert;
