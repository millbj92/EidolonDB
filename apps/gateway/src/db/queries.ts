import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './client.js';
import { apiKeys, tenants, usage } from './schema.js';
import { getCached, setCached } from '../cache.js';

const PLAN_LIMITS = {
  free: {
    opsPerMonth: 10_000,
    requestsPerMinute: 100,
  },
  developer: {
    opsPerMonth: 200_000,
    requestsPerMinute: 1_000,
  },
  growth: {
    opsPerMonth: 1_000_000,
    requestsPerMinute: 2_000,
  },
  enterprise: {
    opsPerMonth: Number.POSITIVE_INFINITY,
    requestsPerMinute: 10_000,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export type ApiKeyLookup = {
  tenantId: string;
  plan: string;
  tenantSlug: string;
};

export function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function normalizePlan(plan: string): PlanName {
  if (plan === 'developer' || plan === 'growth' || plan === 'enterprise') {
    return plan;
  }
  // Backward compatibility for older plan values.
  if (plan === 'pro') {
    return 'developer';
  }
  if (plan === 'team') {
    return 'growth';
  }
  return 'free';
}

export function getPlanRpm(plan: string): number {
  return PLAN_LIMITS[normalizePlan(plan)].requestsPerMinute;
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

export async function incrementOps(tenantId: string, month: string, count = 1): Promise<void> {
  if (!db) {
    return;
  }

  await db
    .insert(usage)
    .values({ tenantId, month, opsTotal: count })
    .onConflictDoUpdate({
      target: [usage.tenantId, usage.month],
      set: {
        opsTotal: sql`${usage.opsTotal} + ${count}`,
        updatedAt: new Date(),
      },
    });
}

export async function checkQuota(tenantId: string, plan: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!db) {
    return { allowed: false, reason: 'billing_db_unavailable' };
  }

  const month = currentMonthKey();
  const normalizedPlan = normalizePlan(plan);

  const rows = await db
    .select({
      opsTotal: usage.opsTotal,
      opsCapOverride: tenants.opsCapOverride,
    })
    .from(tenants)
    .leftJoin(usage, and(eq(usage.tenantId, tenants.id), eq(usage.month, month)))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { allowed: true };
  }

  const cap =
    typeof row.opsCapOverride === 'number' && Number.isFinite(row.opsCapOverride) && row.opsCapOverride >= 0
      ? row.opsCapOverride
      : PLAN_LIMITS[normalizedPlan].opsPerMonth;

  if (Number.isFinite(cap) && (row.opsTotal ?? 0) >= cap) {
    return { allowed: false, reason: 'ops_limit_exceeded' };
  }

  return { allowed: true };
}
