import { getCapSecretsMetadata, getTenantContextFromAuth } from '@/lib/db-utils';

export async function GET(): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const data = await getCapSecretsMetadata(tenant.tenantId);
  return Response.json(data);
}
