import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './client.js';
import { apiKeys, tenants, usage } from './schema.js';
import { getCached, setCached } from '../cache.js';

const PLAN_LIMITS = {
  free: {
    memoriesPerMonth: 10_000,
    queriesPerMonth: 1_000,
    requestsPerMinute: 100,
  },
  pro: {
    memoriesPerMonth: 500_000,
    queriesPerMonth: 100_000,
    requestsPerMinute: 1_000,
  },
  team: {
    memoriesPerMonth: Number.POSITIVE_INFINITY,
    queriesPerMonth: 1_000_000,
    requestsPerMinute: 2_000,
  },
  enterprise: {
    memoriesPerMonth: Number.POSITIVE_INFINITY,
    queriesPerMonth: Number.POSITIVE_INFINITY,
    requestsPerMinute: 10_000,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export type ApiKeyLookup = {
  tenantId: string;
  plan: string;
  tenantSlug: string;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function isPlanName(plan: string): plan is PlanName {
  return plan in PLAN_LIMITS;
}

export function getPlanRpm(plan: string): number {
  if (!isPlanName(plan)) {
    return PLAN_LIMITS.free.requestsPerMinute;
  }
  return PLAN_LIMITS[plan].requestsPerMinute;
}

export async function lookupApiKey(rawKey: string): Promise<ApiKeyLookup | null> {
  if (!db) {
    return null;
  }

  const keyPrefix = rawKey.slice(0, 16);
  const cached = getCached(keyPrefix);
  if (cached) {
    return {
      tenantId: cached.tenantId,
      tenantSlug: cached.tenantSlug,
      plan: cached.plan,
    };
  }

  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      plan: tenants.plan,
      keyHash: apiKeys.keyHash,
      apiKeyId: apiKeys.id,
    })
    .from(apiKeys)
    .innerJoin(tenants, eq(apiKeys.tenantId, tenants.id))
    .where(
      and(
        eq(apiKeys.keyPrefix, keyPrefix),
        eq(apiKeys.revoked, false),
        sql`${apiKeys.expiresAt} IS NULL OR ${apiKeys.expiresAt} > NOW()`
      )
    );

  for (const row of rows) {
    const matches = await bcrypt.compare(rawKey, row.keyHash);
    if (!matches) {
      continue;
    }

    setCached(keyPrefix, {
      tenantId: row.tenantId,
      tenantSlug: row.tenantSlug,
      plan: row.plan,
    });

    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.apiKeyId)).catch(() => {
      // Non-blocking best effort.
    });

    return {
      tenantId: row.tenantId,
      tenantSlug: row.tenantSlug,
      plan: row.plan,
    };
  }

  return null;
}

export async function incrementUsage(
  tenantSlug: string,
  field: 'memoriesCreated' | 'queries' | 'ingestCalls' | 'lifecycleRuns'
): Promise<void> {
  if (!db) {
    return;
  }

  const month = currentMonth();

  const tenant = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  const tenantId = tenant[0]?.id;

  if (!tenantId) {
    return;
  }

  const existing = await db
    .select({ id: usage.id })
    .from(usage)
    .where(and(eq(usage.tenantId, tenantId), eq(usage.month, month)))
    .limit(1);

  if (!existing.length) {
    await db.insert(usage).values({
      tenantId,
      month,
      memoriesCreated: 0,
      queries: 0,
      ingestCalls: 0,
      lifecycleRuns: 0,
    });
  }

  await db
    .update(usage)
    .set({
      [field]: sql`${usage[field]} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(usage.tenantId, tenantId), eq(usage.month, month)));
}

export async function checkQuota(tenantSlug: string, plan: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!db) {
    return { allowed: false, reason: 'billing_db_unavailable' };
  }

  const normalizedPlan: PlanName = isPlanName(plan) ? plan : 'free';
  const limits = PLAN_LIMITS[normalizedPlan];

  const month = currentMonth();

  const rows = await db
    .select({
      memoriesCreated: usage.memoriesCreated,
      queries: usage.queries,
    })
    .from(usage)
    .innerJoin(tenants, eq(usage.tenantId, tenants.id))
    .where(and(eq(tenants.slug, tenantSlug), eq(usage.month, month)))
    .limit(1);

  const current = rows[0] ?? { memoriesCreated: 0, queries: 0 };

  if (current.memoriesCreated >= limits.memoriesPerMonth) {
    return { allowed: false, reason: 'memories_limit_exceeded' };
  }

  if (current.queries >= limits.queriesPerMonth) {
    return { allowed: false, reason: 'queries_limit_exceeded' };
  }

  return { allowed: true };
}
