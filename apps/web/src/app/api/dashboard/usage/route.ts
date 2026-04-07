import { getTenantContextFromAuth, currentMonthKey, getCurrentUsage } from '@/lib/db-utils';

export async function GET(): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json(
      {
        message:
          'No tenant found for this account. Configure DATABASE_URL and ensure the Clerk webhook has run.',
      },
      { status: 404 }
    );
  }

  const usage = await getCurrentUsage(tenant.tenantId, currentMonthKey());
  return Response.json({
    month: currentMonthKey(),
    usage: usage ?? {
      memoriesCreated: 0,
      queries: 0,
      ingestCalls: 0,
      lifecycleRuns: 0,
    },
  });
}
