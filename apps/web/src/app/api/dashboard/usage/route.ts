import { currentMonthKey, getCurrentUsage, getOpsCap, getTenantContextFromAuth } from '@/lib/db-utils';
import { toPlanName } from '@/lib/plans';

export async function GET(): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'No tenant found.' }, { status: 404 });
  }

  const month = currentMonthKey();
  const usage = await getCurrentUsage(tenant.tenantId, month);
  const plan = toPlanName(tenant.tenantPlan);
  const cap = getOpsCap(plan, tenant.opsCapOverride);

  return Response.json({
    month,
    opsTotal: usage?.opsTotal ?? 0,
    opsCap: Number.isFinite(cap) ? cap : null,
    plan,
  });
}
