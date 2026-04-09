import { currentMonthKey, getCurrentUsage, getOpsCap, getTenantContextFromAuth } from '@/lib/db-utils';
import { toPlanName } from '@/lib/plans';

export default async function BillingPage() {
  const tenant = await getTenantContextFromAuth();
  const usage = tenant ? await getCurrentUsage(tenant.tenantId, currentMonthKey()) : null;
  const plan = toPlanName(tenant?.tenantPlan);
  const opsCapValue = getOpsCap(plan, tenant?.opsCapOverride);
  const opsCap = Number.isFinite(opsCapValue) ? opsCapValue : null;
  const pctUsed = opsCap && opsCap > 0 ? ((usage?.opsTotal ?? 0) / opsCap) * 100 : 0;

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginBottom: '0.35rem' }}>Billing</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Current plan: <span className="badge">{plan}</span>
        </p>

        {plan === 'free' ? (
          <a href="/api/dashboard/billing/checkout?plan=developer" className="btn btn-primary">
            Upgrade to Developer
          </a>
        ) : (
          <a href="/api/dashboard/billing/portal" className="btn btn-primary">
            Manage billing
          </a>
        )}
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Memory operations this month</h3>
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>
            {(usage?.opsTotal ?? 0).toLocaleString('en-US')}
          </span>
          <span className="muted">
            {' / '}
            {opsCap !== null ? opsCap.toLocaleString('en-US') : '∞'} ops
          </span>
        </div>
        {opsCap !== null && (
          <div style={{ background: '#1e293b', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div
              style={{
                background: pctUsed >= 90 ? '#ef4444' : pctUsed >= 70 ? '#f59e0b' : '#6366f1',
                width: `${Math.min(pctUsed, 100)}%`,
                height: '100%',
                borderRadius: 6,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
        {opsCap !== null && (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem', marginBottom: 0 }}>
            {pctUsed.toFixed(1)}% of monthly limit used
            {pctUsed >= 80 && plan !== 'enterprise' && (
              <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>
                · Consider upgrading
              </span>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
