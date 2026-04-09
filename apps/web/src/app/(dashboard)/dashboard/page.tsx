import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import {
  currentMonthKey,
  getApiKeySummary,
  getCurrentUsage,
  getOpsCap,
  getTenantContextFromAuth,
} from '@/lib/db-utils';
import { formatLimit, PLAN_LIMITS, toPlanName } from '@/lib/plans';

function usagePct(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export default async function DashboardPage() {
  const user = await currentUser();
  const tenant = await getTenantContextFromAuth();
  const month = currentMonthKey();
  const usage = tenant ? await getCurrentUsage(tenant.tenantId, month) : null;
  const keySummary = tenant ? await getApiKeySummary(tenant.tenantId) : { count: 0, lastUsedAt: null };

  const opsUsed = usage?.opsTotal ?? 0;

  const planName = toPlanName(tenant?.tenantPlan);
  const limits = PLAN_LIMITS[planName];
  const opsCapValue = getOpsCap(planName, tenant?.opsCapOverride);
  const opsCap = Number.isFinite(opsCapValue) ? opsCapValue : null;
  const opsPct = opsCap && opsCap > 0 ? usagePct(opsUsed, opsCap) : 0;

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.9rem', marginBottom: '0.25rem' }}>
              Welcome{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              {tenant?.userEmail ?? user?.primaryEmailAddress?.emailAddress ?? 'No user email available'}
            </p>
          </div>
          <span className="badge">Plan: {planName}</span>
        </div>
      </section>

      {!tenant ? (
        <section className="panel empty">
          <p style={{ margin: 0 }}>
            Database is not configured yet. Add <code>USERS_DATABASE_URL</code>, run webhooks once, and tenant usage
            will appear here.
          </p>
        </section>
      ) : null}

      <section className="stat-grid">
        <article className="panel">
          <h3 style={{ marginTop: 0 }}>Operations this month</h3>
          <p style={{ marginBottom: 0, fontSize: '1.8rem', fontWeight: 800 }}>{opsUsed.toLocaleString()}</p>
          <div className="progress">
            <span style={{ width: `${opsPct}%` }} />
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            {opsUsed.toLocaleString()} / {opsCap !== null ? formatLimit(opsCap) : 'Unlimited'} ops
          </p>
        </article>
        <article className="panel">
          <h3 style={{ marginTop: 0 }}>Monthly cap</h3>
          <p style={{ marginBottom: 0, fontSize: '1.8rem', fontWeight: 800 }}>
            {opsCap !== null ? formatLimit(opsCap) : 'Unlimited'}
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            {limits.overagePer100kCents > 0
              ? `$${(limits.overagePer100kCents / 100).toFixed(2)} per 100k overage ops`
              : 'No overage billing on this plan'}
          </p>
        </article>
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>API key summary</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Active keys: {keySummary.count} / {formatLimit(limits.apiKeys)}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Last used: {keySummary.lastUsedAt ? new Date(keySummary.lastUsedAt).toLocaleString() : 'No usage yet'}
        </p>
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Quick links</h3>
        <div className="row">
          <Link className="btn btn-primary" href="/api-keys">
            Create API key
          </Link>
          <Link className="btn" href="/memories">
            Browse memories
          </Link>
          <a className="btn" href="/docs">
            View docs
          </a>
        </div>
      </section>
    </div>
  );
}
