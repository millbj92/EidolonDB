import Link from 'next/link';
import { headers } from 'next/headers';
import type { CSSProperties } from 'react';

type SecretItem = {
  id: string;
  name: string;
  environment: string;
  provider: string;
  usageCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  rotationDueAt: string | null;
  status: 'healthy' | 'expiring-soon' | 'expired' | 'stale';
};

type SecretsResponse = {
  secrets: SecretItem[];
  alerts: {
    expiringSoon: SecretItem[];
    stale: SecretItem[];
  };
};

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

function statusStyle(status: SecretItem['status']): CSSProperties {
  if (status === 'healthy') {
    return { borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.08)' };
  }
  if (status === 'expiring-soon') {
    return { borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' };
  }
  if (status === 'expired') {
    return { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' };
  }
  return { borderColor: '#64748b', color: '#94a3b8', background: 'rgba(100,116,139,0.12)' };
}

function providerStyle(provider: string): CSSProperties {
  if (provider.toLowerCase().includes('aws')) {
    return { borderColor: '#f59e0b', color: '#f59e0b' };
  }
  if (provider.toLowerCase().includes('vault') || provider.toLowerCase().includes('hashicorp')) {
    return { borderColor: '#22d3ee', color: '#22d3ee' };
  }
  if (provider.toLowerCase().includes('gcp') || provider.toLowerCase().includes('google')) {
    return { borderColor: '#3b82f6', color: '#3b82f6' };
  }
  return {};
}

export default async function CapabilitiesSecretsPage() {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/dashboard/capabilities/secrets`, { cache: 'no-store' });

  const payload = (response.ok ? ((await response.json()) as SecretsResponse) : null) ?? {
    secrets: [],
    alerts: { expiringSoon: [], stale: [] },
  };

  const now = Date.now();
  const rotationWindow = now + 7 * 24 * 60 * 60 * 1000;
  const rotationDue = payload.secrets.filter((secret) => {
    if (!secret.rotationDueAt) {
      return false;
    }
    const ts = new Date(secret.rotationDueAt).getTime();
    return !Number.isNaN(ts) && ts <= rotationWindow;
  });

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>Secrets</h1>
            <p className="muted" style={{ margin: 0 }}>
              Secret values are never stored or displayed.
            </p>
          </div>
          <Link href="/capabilities" className="btn">
            Back to overview
          </Link>
        </div>
      </section>

      {(payload.alerts.expiringSoon.length > 0 || payload.alerts.stale.length > 0 || rotationDue.length > 0) && (
        <section className="stack" style={{ gap: '0.75rem' }}>
          {payload.alerts.expiringSoon.length > 0 && (
            <article className="panel" style={{ borderColor: '#f59e0b', background: 'rgba(245,158,11,0.05)' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#f59e0b' }}>
                {payload.alerts.expiringSoon.length} secret(s) expiring soon
              </p>
            </article>
          )}
          {rotationDue.length > 0 && (
            <article className="panel" style={{ borderColor: '#fb7185', background: 'rgba(251,113,133,0.05)' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#fb7185' }}>{rotationDue.length} secret(s) rotation due</p>
            </article>
          )}
          {payload.alerts.stale.length > 0 && (
            <article className="panel" style={{ borderColor: '#64748b', background: 'rgba(100,116,139,0.05)' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#94a3b8' }}>
                {payload.alerts.stale.length} secret(s) stale or unused
              </p>
            </article>
          )}
        </section>
      )}

      <section className="panel">
        {payload.secrets.length === 0 ? (
          <div className="empty">No secrets metadata found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Environment</th>
                  <th>Provider</th>
                  <th>Usage Count</th>
                  <th>Last Used</th>
                  <th>Expires At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payload.secrets.map((secret) => (
                  <tr key={secret.id}>
                    <td>{secret.name}</td>
                    <td>{secret.environment}</td>
                    <td>
                      <span className="badge" style={providerStyle(secret.provider)}>
                        {secret.provider}
                      </span>
                    </td>
                    <td>{secret.usageCount.toLocaleString()}</td>
                    <td>{secret.lastUsedAt ? new Date(secret.lastUsedAt).toLocaleString() : 'Never'}</td>
                    <td>{secret.expiresAt ? new Date(secret.expiresAt).toLocaleString() : 'n/a'}</td>
                    <td>
                      <span className="badge" style={statusStyle(secret.status)}>
                        {secret.status}
                      </span>
                    </td>
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
