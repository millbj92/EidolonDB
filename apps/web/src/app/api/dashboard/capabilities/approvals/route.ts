import { getCapApprovals, getTenantContextFromAuth } from '@/lib/db-utils';

export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const status = new URL(request.url).searchParams.get('status')?.trim() || undefined;
  const approvals = await getCapApprovals(tenant.tenantId, status);

  return Response.json({ approvals });
}
