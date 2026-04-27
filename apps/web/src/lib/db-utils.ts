import crypto from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, gte, ilike, isNull, lte, ne, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  apiKeys,
  capActors,
  capApprovals,
  capAuditEvents,
  capConfigs,
  capSecretsMetadata,
  tenants,
  usage,
  users,
} from '@/db/schema';
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

export type CapabilitiesStats = {
  capabilities: number;
  actors: number;
  pendingApprovals: number;
  auditEvents30d: number;
};

export type CapApprovalListItem = {
  id: string;
  capability: string;
  actor: string;
  environment: string;
  status: string;
  riskScore: number | null;
  riskLevel: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

export type CapAuditFilter = {
  capability?: string;
  eventType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type CapAuditListItem = {
  id: string;
  capability: string | null;
  actor: string | null;
  environment: string;
  eventType: string;
  status: string | null;
  riskScore: number | null;
  riskLevel: string | null;
  durationMs: number | null;
  createdAt: Date;
};

export type CapSecretListItem = {
  id: string;
  name: string;
  environment: string;
  provider: string;
  usageCount: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  rotationDueAt: Date | null;
  createdAt: Date;
  status: 'healthy' | 'expiring-soon' | 'expired' | 'stale';
};

export async function getCapabilitiesStats(tenantId: string): Promise<CapabilitiesStats> {
  if (!db) {
    return { capabilities: 0, actors: 0, pendingApprovals: 0, auditEvents30d: 0 };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [capabilityRow, actorRow, pendingRow, auditRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(capConfigs)
      .where(eq(capConfigs.tenantId, tenantId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(capActors)
      .where(eq(capActors.tenantId, tenantId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(capApprovals)
      .where(and(eq(capApprovals.tenantId, tenantId), eq(capApprovals.status, 'pending'))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(capAuditEvents)
      .where(and(eq(capAuditEvents.tenantId, tenantId), gte(capAuditEvents.createdAt, thirtyDaysAgo))),
  ]);

  return {
    capabilities: capabilityRow[0]?.count ?? 0,
    actors: actorRow[0]?.count ?? 0,
    pendingApprovals: pendingRow[0]?.count ?? 0,
    auditEvents30d: auditRow[0]?.count ?? 0,
  };
}

export async function getCapApprovals(tenantId: string, status?: string): Promise<CapApprovalListItem[]> {
  if (!db) {
    return [];
  }

  const rows = await db
    .select({
      id: capApprovals.id,
      capability: capApprovals.capability,
      actor: capApprovals.actor,
      environment: capApprovals.environment,
      status: capApprovals.status,
      riskScore: capApprovals.riskScore,
      riskLevel: capApprovals.riskLevel,
      decidedBy: capApprovals.decidedBy,
      decidedAt: capApprovals.decidedAt,
      expiresAt: capApprovals.expiresAt,
      createdAt: capApprovals.createdAt,
    })
    .from(capApprovals)
    .where(
      status === 'history'
        ? and(eq(capApprovals.tenantId, tenantId), ne(capApprovals.status, 'pending'))
        : status
          ? and(eq(capApprovals.tenantId, tenantId), eq(capApprovals.status, status))
          : eq(capApprovals.tenantId, tenantId)
    )
    .orderBy(desc(capApprovals.createdAt));

  return rows;
}

export async function getCapAuditEvents(tenantId: string, filters: CapAuditFilter) {
  if (!db) {
    return { items: [] as CapAuditListItem[], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 50, 100));
  const offset = (page - 1) * pageSize;
  const conditions = [eq(capAuditEvents.tenantId, tenantId)];

  if (filters.capability?.trim()) {
    conditions.push(ilike(capAuditEvents.capability, `%${filters.capability.trim()}%`));
  }
  if (filters.eventType?.trim()) {
    conditions.push(eq(capAuditEvents.eventType, filters.eventType.trim()));
  }
  if (filters.from) {
    const fromDate = new Date(filters.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(capAuditEvents.createdAt, fromDate));
    }
  }
  if (filters.to) {
    const toDate = new Date(filters.to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setUTCHours(23, 59, 59, 999);
      conditions.push(lte(capAuditEvents.createdAt, toDate));
    }
  }

  const where = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(capAuditEvents).where(where),
    db
      .select({
        id: capAuditEvents.id,
        capability: capAuditEvents.capability,
        actor: capAuditEvents.actor,
        environment: capAuditEvents.environment,
        eventType: capAuditEvents.eventType,
        status: capAuditEvents.status,
        riskScore: capAuditEvents.riskScore,
        riskLevel: capAuditEvents.riskLevel,
        durationMs: capAuditEvents.durationMs,
        createdAt: capAuditEvents.createdAt,
      })
      .from(capAuditEvents)
      .where(where)
      .orderBy(desc(capAuditEvents.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = countRows[0]?.count ?? 0;
  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function getCapSecretsMetadata(tenantId: string): Promise<{
  secrets: CapSecretListItem[];
  alerts: { expiringSoon: CapSecretListItem[]; stale: CapSecretListItem[] };
}> {
  if (!db) {
    return { secrets: [], alerts: { expiringSoon: [], stale: [] } };
  }

  const rows = await db
    .select({
      id: capSecretsMetadata.id,
      name: capSecretsMetadata.name,
      environment: capSecretsMetadata.environment,
      provider: capSecretsMetadata.provider,
      usageCount: capSecretsMetadata.usageCount,
      lastUsedAt: capSecretsMetadata.lastUsedAt,
      expiresAt: capSecretsMetadata.expiresAt,
      rotationDueAt: capSecretsMetadata.rotationDueAt,
      createdAt: capSecretsMetadata.createdAt,
    })
    .from(capSecretsMetadata)
    .where(eq(capSecretsMetadata.tenantId, tenantId))
    .orderBy(desc(capSecretsMetadata.createdAt));

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const secrets: CapSecretListItem[] = rows.map((row) => {
    const expired = row.expiresAt ? row.expiresAt <= now : false;
    const expiringSoon = row.expiresAt ? row.expiresAt > now && row.expiresAt <= soon : false;
    const stale = row.lastUsedAt ? row.lastUsedAt <= staleCutoff : true;

    return {
      ...row,
      status: expired ? 'expired' : expiringSoon ? 'expiring-soon' : stale ? 'stale' : 'healthy',
    };
  });

  return {
    secrets,
    alerts: {
      expiringSoon: secrets.filter((secret) => secret.status === 'expiring-soon' || secret.status === 'expired'),
      stale: secrets.filter((secret) => secret.status === 'stale'),
    },
  };
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
