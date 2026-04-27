import Link from 'next/link';
import { headers } from 'next/headers';
import type { CSSProperties } from 'react';

type AuditItem = {
  id: string;
  createdAt: string;
  capability: string | null;
  actor: string | null;
  eventType: string;
  status: string | null;
  riskLevel: string | null;
  durationMs: number | null;
};

type AuditResponse = {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 25;

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

function statusStyle(status: string | null): CSSProperties {
  if (status === 'approved' || status === 'ok' || status === 'success' || status === 'executed') {
    return { borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.08)' };
  }
  if (status === 'rejected' || status === 'failed' || status === 'error' || status === 'denied') {
    return { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' };
  }
  return {};
}

function eventStyle(eventType: string): CSSProperties {
  if (eventType.toLowerCase().includes('apply')) {
    return { borderColor: '#3b82f6', color: '#3b82f6', background: 'rgba(59,130,246,0.08)' };
  }
  if (eventType.toLowerCase().includes('plan')) {
    return { borderColor: '#a855f7', color: '#c084fc', background: 'rgba(168,85,247,0.08)' };
  }
  return {};
}

function riskStyle(riskLevel: string | null): CSSProperties {
  if (riskLevel === 'critical' || riskLevel === 'high') {
    return { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' };
  }
  if (riskLevel === 'medium') {
    return { borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' };
  }
  if (riskLevel === 'low') {
    return { borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.08)' };
  }
  return {};
}

export default async function CapabilitiesAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawOffset = params['offset'];
  const offsetValue = Array.isArray(rawOffset) ? rawOffset[0] : rawOffset;
  const offset = Math.max(0, Number.parseInt(offsetValue ?? '0', 10) || 0);
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  const baseUrl = await getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/dashboard/capabilities/audit?offset=${offset}&page=${page}&pageSize=${PAGE_SIZE}`,
    { cache: 'no-store' }
  );

  const payload = (response.ok ? ((await response.json()) as AuditResponse) : null) ?? {
    items: [],
    total: 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  };

  const hasPrev = offset > 0;
  const hasNext = offset + payload.items.length < payload.total;
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>Capability Audit</h1>
            <p className="muted" style={{ margin: 0 }}>
              {payload.total.toLocaleString()} total events.
            </p>
          </div>
          <Link href="/cap" className="btn">
            Back to overview
          </Link>
        </div>
      </section>

      <section className="panel">
        {payload.items.length === 0 ? (
          <div className="empty">No audit events yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Capability</th>
                  <th>Actor</th>
                  <th>Event Type</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Duration (ms)</th>
                </tr>
              </thead>
              <tbody>
                {payload.items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.capability ?? 'n/a'}</td>
                    <td>{item.actor ?? 'n/a'}</td>
                    <td>
                      <span className="badge" style={eventStyle(item.eventType)}>
                        {item.eventType}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={statusStyle(item.status)}>
                        {item.status ?? 'n/a'}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={riskStyle(item.riskLevel)}>
                        {item.riskLevel ?? 'unknown'}
                      </span>
                    </td>
                    <td>{item.durationMs ?? 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="row" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
          <Link
            href={`/cap/audit?offset=${prevOffset}`}
            className="btn"
            aria-disabled={!hasPrev}
            style={!hasPrev ? { opacity: 0.5, pointerEvents: 'none' } : {}}
          >
            Previous
          </Link>
          <Link
            href={`/cap/audit?offset=${nextOffset}`}
            className="btn"
            aria-disabled={!hasNext}
            style={!hasNext ? { opacity: 0.5, pointerEvents: 'none' } : {}}
          >
            Next
          </Link>
        </div>
      </section>
    </div>
  );
}
