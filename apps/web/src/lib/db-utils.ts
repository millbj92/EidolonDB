import crypto from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { apiKeys, tenants, usage, users } from '@/db/schema';
import { PLAN_LIMITS, toPlanName } from '@/lib/plans';

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  tenantPlan: string;
  opsCapOverride: number | null;
  userEmail: string;
};

export async function getTenantContextFromAuth(): Promise<TenantContext | null> {
  if (!db) {
    return null;
  }

  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      tenantPlan: tenants.plan,
      opsCapOverride: tenants.opsCapOverride,
      userEmail: users.email,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.userId, users.id))
    .where(eq(users.clerkId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCurrentUsage(
  tenantId: string,
  month: string
): Promise<{ opsTotal: number; month: string } | null> {
  if (!db) {
    return null;
  }

  const rows = await db
    .select({ opsTotal: usage.opsTotal, month: usage.month })
    .from(usage)
    .where(and(eq(usage.tenantId, tenantId), eq(usage.month, month)))
    .limit(1);

  return rows[0] ?? null;
}

export async function incrementOps(tenantId: string, month: string, count = 1): Promise<void> {
  if (!db) return;
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

export async function getApiKeySummary(tenantId: string) {
  if (!db) {
    return { count: 0, lastUsedAt: null as Date | null };
  }

  const keyRows = await db
    .select({ lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.lastUsedAt));

  return {
    count: keyRows.length,
    lastUsedAt: keyRows[0]?.lastUsedAt ?? null,
  };
}

export function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getOpsCap(plan: string, opsCapOverride?: number | null): number {
  if (typeof opsCapOverride === 'number' && Number.isFinite(opsCapOverride) && opsCapOverride >= 0) {
    return opsCapOverride;
  }
  const normalized = toPlanName(plan);
  return PLAN_LIMITS[normalized].opsPerMonth;
}

export async function ensureTenantSlugIsUnique(baseSlug: string): Promise<string> {
  if (!db) {
    return baseSlug;
  }

  const existing = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(sql`${tenants.slug} LIKE ${`${baseSlug}%`}`);

  if (existing.length === 0) {
    return baseSlug;
  }

  let attempt = 1;
  const taken = new Set(existing.map((row) => row.slug));
  while (attempt <= 2000) {
    const candidate = `${baseSlug}-${attempt}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    attempt += 1;
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}
