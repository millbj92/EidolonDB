import { getCapabilitiesStats, getTenantContextFromAuth } from '@/lib/db-utils';

export async function GET(): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const stats = await getCapabilitiesStats(tenant.tenantId);
  return Response.json(stats);
}
