import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { apiKeys } from '@/db/schema';
import { generateApiKey } from '@/lib/api-keys';
import { getTenantContextFromAuth } from '@/lib/db-utils';
import { PLAN_LIMITS, toPlanName } from '@/lib/plans';

export async function GET(): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Tenant not found.' }, { status: 404 });
  }
  if (!db) {
    return Response.json({ message: 'USERS_DATABASE_URL is not configured.' }, { status: 503 });
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      label: apiKeys.label,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenant.tenantId))
    .orderBy(desc(apiKeys.createdAt));

  return Response.json({ keys });
}

export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Tenant not found.' }, { status: 404 });
  }
  if (!db) {
    return Response.json({ message: 'USERS_DATABASE_URL is not configured.' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { label?: string | null };
  const label = typeof body.label === 'string' ? body.label.trim() : null;

  const activeKeyCount = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.tenantId, tenant.tenantId), isNull(apiKeys.revokedAt)));

  const limit = PLAN_LIMITS[toPlanName(tenant.tenantPlan)].apiKeys;
  if (Number.isFinite(limit) && activeKeyCount.length >= limit) {
    return Response.json({ message: `API key limit reached for ${tenant.tenantPlan} plan.` }, { status: 403 });
  }

  const generated = await generateApiKey();
  const inserted = await db
    .insert(apiKeys)
    .values({
      tenantId: tenant.tenantId,
      keyHash: generated.keyHash,
      keyPrefix: generated.keyPrefix,
      label: label || null,
    })
    .returning({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      label: apiKeys.label,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    });

  const key = inserted[0];
  if (!key) {
    return Response.json({ message: 'Failed to create API key.' }, { status: 500 });
  }

  return Response.json({
    key,
    apiKey: generated.fullKey,
  });
}
