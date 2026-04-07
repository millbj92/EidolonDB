import { index, integer, pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('users_email_idx').on(table.email)]
);

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    plan: text('plan').notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('tenants_user_id_idx').on(table.userId), index('tenants_slug_idx').on(table.slug)]
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name'),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    revoked: boolean('revoked').notNull().default(false),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('api_keys_tenant_id_idx').on(table.tenantId),
    index('api_keys_prefix_idx').on(table.keyPrefix),
    index('api_keys_revoked_idx').on(table.revoked),
  ]
);

export const usage = pgTable(
  'usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    month: text('month').notNull(),
    memoriesCreated: integer('memories_created').notNull().default(0),
    queries: integer('queries').notNull().default(0),
    ingestCalls: integer('ingest_calls').notNull().default(0),
    lifecycleRuns: integer('lifecycle_runs').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('usage_tenant_month_idx').on(table.tenantId, table.month)]
);
