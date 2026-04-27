import Link from 'next/link';
import { headers } from 'next/headers';
import type { CSSProperties } from 'react';

type CapStats = {
  capabilities: number;
  actors: number;
  pendingApprovals: number;
  auditEvents30d: number;
};

type AuditEvent = {
  id: string;
  capability: string | null;
  actor: string | null;
  eventType: string;
  status: string | null;
  createdAt: string;
};

type AuditResponse = {
  items: AuditEvent[];
  total: number;
};

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

function pendingBadgeStyle(count: number): CSSProperties {
  if (count > 0) {
    return {
      borderColor: '#f59e0b',
      color: '#f59e0b',
      background: 'rgba(245,158,11,0.08)',
    };
  }
  return {};
}

function statusStyle(status: string | null): CSSProperties {
  if (status === 'approved' || status === 'ok' || status === 'success') {
    return { borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.08)' };
  }
  if (status === 'rejected' || status === 'failed' || status === 'error') {
    return { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' };
  }
  return {};
}

export default async function CapabilitiesOverviewPage() {
  const baseUrl = await getBaseUrl();
  const [statsRes, auditRes] = await Promise.all([
    fetch(`${baseUrl}/api/dashboard/capabilities/stats`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/dashboard/capabilities/audit?page=1&pageSize=10`, { cache: 'no-store' }),
  ]);

  const stats = (statsRes.ok ? ((await statsRes.json()) as CapStats) : null) ?? {
    capabilities: 0,
    actors: 0,
    pendingApprovals: 0,
    auditEvents30d: 0,
  };

  const audit = (auditRes.ok ? ((await auditRes.json()) as AuditResponse) : null) ?? { items: [], total: 0 };

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>Capabilities</h1>
            <p className="muted" style={{ margin: 0 }}>
              Monitor capability activity, approvals, and security posture.
            </p>
          </div>
          <div className="row">
            <Link href="/capabilities/approvals" className="btn">
              Approvals
            </Link>
            <Link href="/capabilities/audit" className="btn">
              Audit
            </Link>
            <Link href="/capabilities/secrets" className="btn">
              Secrets
            </Link>
          </div>
        </div>
      </section>

      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <article className="panel">
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.4rem' }}>
            Capabilities
          </p>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{stats.capabilities.toLocaleString()}</p>
        </article>
        <article className="panel">
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.4rem' }}>
            Active Actors
          </p>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{stats.actors.toLocaleString()}</p>
        </article>
        <article className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="muted" style={{ marginTop: 0, marginBottom: '0.4rem' }}>
              Pending Approvals
            </p>
            <span className="badge" style={pendingBadgeStyle(stats.pendingApprovals)}>
              {stats.pendingApprovals > 0 ? 'Action needed' : 'Clear'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{stats.pendingApprovals.toLocaleString()}</p>
        </article>
        <article className="panel">
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.4rem' }}>
            Audit Events (30d)
          </p>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{stats.auditEvents30d.toLocaleString()}</p>
        </article>
      </section>

      {stats.capabilities === 0 ? (
        <section className="panel empty">
          <p style={{ marginTop: 0, marginBottom: '0.7rem' }}>No capabilities configured yet.</p>
          <a className="btn" href="/docs/capabilities/quickstart">
            Read quickstart
          </a>
        </section>
      ) : null}

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.8rem' }}>Recent Audit Events</h2>
          <Link href="/capabilities/audit" className="muted" style={{ fontSize: '0.9rem' }}>
            View all
          </Link>
        </div>

        {audit.items.length === 0 ? (
          <div className="empty">No audit events yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Actor</th>
                  <th>Event Type</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {audit.items.slice(0, 10).map((event) => (
                  <tr key={event.id}>
                    <td>{event.capability ?? 'n/a'}</td>
                    <td>{event.actor ?? 'n/a'}</td>
                    <td>
                      <span className="badge">{event.eventType}</span>
                    </td>
                    <td>
                      <span className="badge" style={statusStyle(event.status)}>
                        {event.status ?? 'n/a'}
                      </span>
                    </td>
                    <td>{new Date(event.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
