import { currentMonthKey, getCurrentUsage, getTenantContextFromAuth } from '@/lib/db-utils';
import { PLAN_LIMITS, toPlanName } from '@/lib/plans';

const PLAN_FEATURES: Record<string, { label: string; emoji: string; features: string[]; price: string; subtext: string }> = {
  free: {
    label: 'Free',
    emoji: '',
    price: '$0',
    subtext: 'Self-hosted',
    features: ['10,000 ops/month', '1 API key', 'Community support'],
  },
  developer: {
    label: 'Developer',
    emoji: '🔵',
    price: '$19/mo',
    subtext: 'For builders',
    features: ['200,000 ops/month', '10 API keys', 'All features', '$0.25/100k ops overage'],
  },
  growth: {
    label: 'Growth',
    emoji: '🟣',
    price: '$99/mo',
    subtext: 'For production',
    features: ['1,000,000 ops/month', '50 API keys', 'Priority support', '$0.10/100k ops overage'],
  },
  enterprise: {
    label: 'Enterprise',
    emoji: '🏢',
    price: 'Custom',
    subtext: 'High-scale',
    features: ['Unlimited ops', 'Unlimited API keys', 'SLA + dedicated support'],
  },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const success = params['success'] === '1';
  const canceled = params['canceled'] === '1';

  const tenant = await getTenantContextFromAuth();
  const usageRow = tenant ? await getCurrentUsage(tenant.tenantId, currentMonthKey()) : null;
  const plan = toPlanName(tenant?.tenantPlan);
  const planMeta = PLAN_FEATURES[plan] ?? PLAN_FEATURES.free;
  const cap = PLAN_LIMITS[plan].opsPerMonth;
  const opsTotal = usageRow?.opsTotal ?? 0;
  const opsCap = Number.isFinite(cap) ? cap : null;
  const pctUsed = opsCap ? Math.min((opsTotal / opsCap) * 100, 100) : 0;

  return (
    <div className="stack">
      {success && (
        <section className="panel" style={{ borderColor: '#22c55e', background: 'rgba(34,197,94,0.05)' }}>
          <p style={{ margin: 0, color: '#22c55e', fontWeight: 600 }}>
            ✓ Subscription activated. Welcome to {planMeta.label}!
          </p>
        </section>
      )}
      {canceled && (
        <section className="panel" style={{ borderColor: '#94a3b8' }}>
          <p style={{ margin: 0, color: '#94a3b8' }}>Checkout canceled. No changes were made.</p>
        </section>
      )}

      <section className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <p
              className="muted"
              style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Current plan
            </p>
            <h1 style={{ margin: '0 0 0.25rem' }}>
              {planMeta.emoji ? `${planMeta.emoji} ` : ''}
              {planMeta.label}
            </h1>
            <p style={{ margin: '0 0 0.2rem', color: '#e2e8f0', fontWeight: 700 }}>{planMeta.price}</p>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {planMeta.subtext}
            </p>
          </div>
          <div>
            {plan === 'free' ? (
              <a href="/api/dashboard/billing/checkout?plan=growth" className="btn btn-primary">
                Upgrade to Growth →
              </a>
            ) : plan === 'developer' ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/api/dashboard/billing/checkout?plan=growth" className="btn btn-primary">
                  Upgrade to Growth →
                </a>
                <a href="/api/dashboard/billing/portal" className="btn">
                  Manage / Cancel
                </a>
              </div>
            ) : plan === 'growth' ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/api/dashboard/billing/portal" className="btn">
                  Manage subscription
                </a>
                <a href="mailto:hello@eidolondb.com" className="btn btn-primary">
                  Enterprise →
                </a>
              </div>
            ) : (
              <a href="mailto:hello@eidolondb.com" className="btn">
                Contact us
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Memory operations this month</h3>
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{opsTotal.toLocaleString('en-US')}</span>
          <span className="muted">
            {' / '}
            {opsCap !== null ? opsCap.toLocaleString('en-US') : '∞'} ops
          </span>
        </div>
        {opsCap !== null && (
          <>
            <div style={{ background: '#1e293b', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div
                style={{
                  background: pctUsed >= 90 ? '#ef4444' : pctUsed >= 70 ? '#f59e0b' : '#6366f1',
                  width: `${pctUsed}%`,
                  height: '100%',
                  borderRadius: 6,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem', marginBottom: 0 }}>
              {pctUsed.toFixed(1)}% used
              {pctUsed >= 80 && plan !== 'enterprise' && (
                <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>· Consider upgrading</span>
              )}
            </p>
          </>
        )}
      </section>

      {plan !== 'enterprise' && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Available plans</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {(['developer', 'growth', 'enterprise'] as const).map((p) => {
              const meta = PLAN_FEATURES[p]!;
              const isCurrent = p === plan;
              return (
                <div key={p} className="panel" style={isCurrent ? { border: '1px solid #6366f1' } : {}}>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 700 }}>
                    {meta.emoji ? `${meta.emoji} ` : ''}
                    {meta.label}
                  </p>
                  <p style={{ margin: '0 0 0.75rem', color: '#e2e8f0', fontWeight: 600 }}>{meta.price}</p>
                  <ul
                    style={{
                      margin: '0 0 1rem',
                      paddingLeft: '1rem',
                      color: '#94a3b8',
                      fontSize: '0.82rem',
                      lineHeight: 1.7,
                    }}
                  >
                    {meta.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <span className="badge">Current plan</span>
                  ) : p === 'enterprise' ? (
                    <a
                      href="mailto:hello@eidolondb.com"
                      className="btn"
                      style={{ display: 'block', textAlign: 'center', fontSize: '0.85rem' }}
                    >
                      Contact us
                    </a>
                  ) : (
                    <a
                      href={`/api/dashboard/billing/checkout?plan=${p}`}
                      className="btn btn-primary"
                      style={{ display: 'block', textAlign: 'center', fontSize: '0.85rem' }}
                    >
                      {plan === 'free' || (plan === 'developer' && p === 'growth') ? 'Upgrade' : 'Switch'} →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
