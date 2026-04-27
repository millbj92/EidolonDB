'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type ApprovalItem = {
  id: string;
  capability: string;
  actor: string;
  status: string;
  riskLevel: string | null;
  expiresAt: string;
  createdAt: string;
};

type ApprovalsResponse = {
  approvals: ApprovalItem[];
  message?: string;
};

type Tab = 'pending' | 'history';
type Decision = 'approved' | 'rejected';

function riskStyle(level: string | null): CSSProperties {
  if (level === 'critical' || level === 'high') {
    return { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' };
  }
  if (level === 'medium') {
    return { borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' };
  }
  if (level === 'low') {
    return { borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.08)' };
  }
  return {};
}

function historyStatusStyle(status: string): CSSProperties {
  if (status === 'approved') {
    return { borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.08)' };
  }
  if (status === 'rejected') {
    return { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' };
  }
  if (status === 'executed') {
    return { borderColor: '#3b82f6', color: '#3b82f6', background: 'rgba(59,130,246,0.08)' };
  }
  if (status === 'expired') {
    return { borderColor: '#64748b', color: '#94a3b8', background: 'rgba(100,116,139,0.12)' };
  }
  return {};
}

export default function CapabilitiesApprovalsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ApprovalItem[]>([]);
  const [history, setHistory] = useState<ApprovalItem[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetch('/api/dashboard/capabilities/approvals', { cache: 'no-store' }),
        fetch('/api/dashboard/capabilities/approvals?status=history', { cache: 'no-store' }),
      ]);

      const pendingPayload = (await pendingRes.json()) as ApprovalsResponse;
      const historyPayload = (await historyRes.json()) as ApprovalsResponse;

      if (!pendingRes.ok) {
        throw new Error(pendingPayload.message ?? 'Failed to load pending approvals.');
      }
      if (!historyRes.ok) {
        throw new Error(historyPayload.message ?? 'Failed to load approval history.');
      }

      setPending(pendingPayload.approvals ?? []);
      setHistory(historyPayload.approvals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function decide(approvalId: string, decision: Decision) {
    setDecidingId(approvalId);
    setError(null);

    try {
      const response = await fetch(`/api/dashboard/capabilities/approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Failed to update approval decision.');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDecidingId(null);
    }
  }

  const rows = useMemo(() => (tab === 'pending' ? pending : history), [tab, pending, history]);

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>Capability Approvals</h1>
            <p className="muted" style={{ margin: 0 }}>
              Review pending decisions and prior approval outcomes.
            </p>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => setTab('pending')}
              style={tab === 'pending' ? { borderColor: '#6366f1', color: '#eef2ff' } : {}}
            >
              Pending
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setTab('history')}
              style={tab === 'history' ? { borderColor: '#6366f1', color: '#eef2ff' } : {}}
            >
              History
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="panel" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
          {error}
        </section>
      ) : null}

      <section className="panel">
        {loading ? <p className="muted">Loading approvals...</p> : null}

        {!loading && tab === 'pending' && rows.length === 0 ? (
          <div className="empty">No pending approvals.</div>
        ) : null}

        {!loading && tab === 'history' && rows.length === 0 ? (
          <div className="empty">No approval history yet.</div>
        ) : null}

        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                {tab === 'pending' ? (
                  <tr>
                    <th>Capability</th>
                    <th>Actor</th>
                    <th>Risk</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Capability</th>
                    <th>Actor</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th>Created</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((approval) => (
                  <tr key={approval.id}>
                    <td>{approval.capability}</td>
                    <td>{approval.actor}</td>
                    {tab === 'pending' ? (
                      <>
                        <td>
                          <span className="badge" style={riskStyle(approval.riskLevel)}>
                            {approval.riskLevel ?? 'unknown'}
                          </span>
                        </td>
                        <td>{new Date(approval.expiresAt).toLocaleString()}</td>
                        <td>
                          <div className="row">
                            <button
                              type="button"
                              className="btn"
                              style={{ borderColor: '#22c55e', color: '#22c55e' }}
                              disabled={decidingId === approval.id}
                              onClick={() => void decide(approval.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn"
                              style={{ borderColor: '#ef4444', color: '#ef4444' }}
                              disabled={decidingId === approval.id}
                              onClick={() => void decide(approval.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <span className="badge" style={historyStatusStyle(approval.status)}>
                            {approval.status}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={riskStyle(approval.riskLevel)}>
                            {approval.riskLevel ?? 'unknown'}
                          </span>
                        </td>
                        <td>{new Date(approval.createdAt).toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
