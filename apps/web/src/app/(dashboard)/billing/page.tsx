import { currentMonthKey, getCurrentUsage, getTenantContextFromAuth } from '@/lib/db-utils';

export default async function BillingPage() {
  const tenant = await getTenantContextFromAuth();
  const usage = tenant ? await getCurrentUsage(tenant.tenantId, currentMonthKey()) : null;
  const plan = tenant?.tenantPlan ?? 'free';

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginBottom: '0.35rem' }}>Billing</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Current plan: <span className="badge">{plan}</span>
        </p>

        {plan === 'free' ? (
          <a href="/api/dashboard/billing/checkout?plan=pro" className="btn btn-primary">
            Upgrade to Pro
          </a>
        ) : (
          <a href="/api/dashboard/billing/portal" className="btn btn-primary">
            Manage billing
          </a>
        )}
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Usage this month</h3>
        <p className="muted" style={{ marginBottom: '0.25rem' }}>
          Memories: {usage?.memoriesCreated ?? 0}
        </p>
        <p className="muted" style={{ marginBottom: '0.25rem' }}>
          Queries: {usage?.queries ?? 0}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Ingest calls: {usage?.ingestCalls ?? 0}
        </p>
      </section>
    </div>
  );
}
