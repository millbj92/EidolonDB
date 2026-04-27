import bcrypt from 'bcryptjs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from './client.js';
import { apiKeys, capUsage, tenants } from './schema.js';
import { getCached, setCached } from '../cache.js';

const PLAN_RPM: Record<string, number> = {
  free: 100,
  'capabilities-developer': 1000,
  'capabilities-team': 2000,
  'suite-starter': 1000,
  'suite-pro': 2000,
  'capabilities-enterprise': 10000,
  'suite-enterprise': 10000,
};

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

export function getPlanRpm(plan: string): number {
  return PLAN_RPM[plan] ?? 500;
}

export function getPlanCapLimits(plan: string): { plansPerMonth: number; appliesPerMonth: number } {
  if (plan === 'free') {
    return { plansPerMonth: 0, appliesPerMonth: 0 };
  }
  if (plan === 'capabilities-developer') {
    return { plansPerMonth: 10000, appliesPerMonth: 2000 };
  }
  if (plan === 'capabilities-team') {
    return { plansPerMonth: 50000, appliesPerMonth: 10000 };
  }
  if (plan === 'suite-starter') {
    return { plansPerMonth: 10000, appliesPerMonth: 2000 };
  }
  if (plan === 'suite-pro') {
    return { plansPerMonth: 50000, appliesPerMonth: 10000 };
  }
  if (plan === 'capabilities-enterprise' || plan === 'suite-enterprise') {
    return { plansPerMonth: Number.POSITIVE_INFINITY, appliesPerMonth: Number.POSITIVE_INFINITY };
  }
  return { plansPerMonth: 1000, appliesPerMonth: 100 };
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
    .where(and(eq(apiKeys.keyPrefix, keyPrefix), isNull(apiKeys.revokedAt)));

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

export async function checkCapQuota(tenantId: string, month: string): Promise<{ plansOk: boolean; appliesOk: boolean }> {
  if (!db) {
    return { plansOk: false, appliesOk: false };
  }

  const rows = await db
    .select({
      plan: tenants.plan,
      plansTotal: capUsage.plansTotal,
      appliesTotal: capUsage.appliesTotal,
    })
    .from(tenants)
    .leftJoin(capUsage, and(eq(capUsage.tenantId, tenants.id), eq(capUsage.month, month)))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { plansOk: true, appliesOk: true };
  }

  const limits = getPlanCapLimits(row.plan);
  const plansUsed = row.plansTotal ?? 0;
  const appliesUsed = row.appliesTotal ?? 0;

  const plansOk = !Number.isFinite(limits.plansPerMonth) || plansUsed < limits.plansPerMonth;
  const appliesOk = !Number.isFinite(limits.appliesPerMonth) || appliesUsed < limits.appliesPerMonth;

  return { plansOk, appliesOk };
}

export async function incrementCapUsage(tenantId: string, month: string, type: 'plan' | 'apply'): Promise<void> {
  if (!db) {
    return;
  }

  const planIncrement = type === 'plan' ? 1 : 0;
  const applyIncrement = type === 'apply' ? 1 : 0;

  await db
    .insert(capUsage)
    .values({
      tenantId,
      month,
      plansTotal: planIncrement,
      appliesTotal: applyIncrement,
    })
    .onConflictDoUpdate({
      target: [capUsage.tenantId, capUsage.month],
      set: {
        plansTotal: sql`${capUsage.plansTotal} + ${planIncrement}`,
        appliesTotal: sql`${capUsage.appliesTotal} + ${applyIncrement}`,
        updatedAt: new Date(),
      },
    });
}
