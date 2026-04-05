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
} from 'drizzle-orm/pg-core';

// Enums
export const memoryTierEnum = pgEnum('memory_tier', ['short_term', 'episodic', 'semantic']);
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
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('memories_tenant_id_idx').on(table.tenantId),
  index('memories_owner_entity_id_idx').on(table.ownerEntityId),
  index('memories_tier_idx').on(table.tier),
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

// Type exports for use in application code
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

export type Relation = typeof relations.$inferSelect;
export type NewRelation = typeof relations.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
