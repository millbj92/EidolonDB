import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { apiKeys } from '@/db/schema';
import { getTenantContextFromAuth } from '@/lib/db-utils';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Tenant not found.' }, { status: 404 });
  }
  if (!db) {
    return Response.json({ message: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const { id } = await context.params;

  const updated = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenant.tenantId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });

  if (!updated[0]) {
    return Response.json({ message: 'API key not found or already revoked.' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
