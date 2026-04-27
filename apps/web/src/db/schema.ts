// Users/billing schema — Neon DB (USERS_DATABASE_URL)
import { boolean, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('free'),
  opsCapOverride: integer('ops_cap_override'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  label: text('label'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const usage = pgTable(
  'usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    opsTotal: integer('ops_total').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('usage_tenant_month_unique').on(table.tenantId, table.month)]
);

export const capConfigs = pgTable(
  'cap_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    version: text('version').notNull().default('0.1.0'),
    yamlContent: text('yaml_content').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    riskLevel: text('risk_level').notNull().default('medium'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('cap_configs_tenant_name').on(table.tenantId, table.name)]
);

export const capActors = pgTable(
  'cap_actors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role').notNull().default('agent'),
    trustLevel: text('trust_level').notNull().default('low'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('cap_actors_tenant_name').on(table.tenantId, table.name)]
);

export const capApprovals = pgTable('cap_approvals', {
  id: text('id').primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  capability: text('capability').notNull(),
  actor: text('actor').notNull(),
  environment: text('environment').notNull().default('default'),
  status: text('status').notNull().default('pending'),
  riskScore: integer('risk_score'),
  riskLevel: text('risk_level'),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const capAuditEvents = pgTable('cap_audit_events', {
  id: text('id').primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  capability: text('capability'),
  actor: text('actor'),
  environment: text('environment').notNull().default('default'),
  eventType: text('event_type').notNull(),
  status: text('status'),
  riskScore: integer('risk_score'),
  riskLevel: text('risk_level'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const capSecretsMetadata = pgTable(
  'cap_secrets_metadata',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    environment: text('environment').notNull().default('default'),
    provider: text('provider').notNull().default('managed'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    rotationDueAt: timestamp('rotation_due_at', { withTimezone: true }),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('cap_secrets_tenant_name_env').on(table.tenantId, table.name, table.environment)]
);

export const capUsage = pgTable(
  'cap_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    plansTotal: integer('plans_total').notNull().default(0),
    appliesTotal: integer('applies_total').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('cap_usage_tenant_month').on(table.tenantId, table.month)]
);

export type User = typeof users.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type UsageRow = typeof usage.$inferSelect;
export type CapConfig = typeof capConfigs.$inferSelect;
export type CapActor = typeof capActors.$inferSelect;
export type CapApproval = typeof capApprovals.$inferSelect;
export type CapAuditEvent = typeof capAuditEvents.$inferSelect;
export type CapSecretMetadata = typeof capSecretsMetadata.$inferSelect;
export type CapUsage = typeof capUsage.$inferSelect;
