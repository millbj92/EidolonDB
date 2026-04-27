import { getCapAuditEvents, getTenantContextFromAuth } from '@/lib/db-utils';

export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.max(1, Math.min(Number.parseInt(searchParams.get('pageSize') ?? '50', 10) || 50, 100));

  const result = await getCapAuditEvents(tenant.tenantId, {
    capability: searchParams.get('capability') ?? undefined,
    eventType: searchParams.get('eventType') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    page,
    pageSize,
  });

  return Response.json(result);
}
