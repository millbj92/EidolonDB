import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { capApprovals } from '@/db/schema';
import { getTenantContextFromAuth } from '@/lib/db-utils';

type DecisionBody = {
  decision?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Tenant not found.' }, { status: 404 });
  }

  if (!db) {
    return Response.json({ message: 'USERS_DATABASE_URL is not configured.' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as DecisionBody;
  const decision = body.decision === 'approved' || body.decision === 'rejected' ? body.decision : null;
  if (!decision) {
    return Response.json({ message: 'Invalid decision. Use approved or rejected.' }, { status: 400 });
  }

  const { id } = await context.params;

  const updated = await db
    .update(capApprovals)
    .set({
      status: decision,
      decidedBy: tenant.userEmail,
      decidedAt: new Date(),
    })
    .where(and(eq(capApprovals.id, id), eq(capApprovals.tenantId, tenant.tenantId), eq(capApprovals.status, 'pending')))
    .returning({ id: capApprovals.id, status: capApprovals.status });

  if (!updated[0]) {
    return Response.json({ message: 'Approval not found or already decided.' }, { status: 404 });
  }

  return Response.json({ ok: true, approval: updated[0] });
}
