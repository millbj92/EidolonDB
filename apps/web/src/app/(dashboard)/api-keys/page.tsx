'use client';

import { useEffect, useMemo, useState } from 'react';

type ApiKeyRecord = {
  id: string;
  keyPrefix: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type ApiKeysGetResponse = { keys: ApiKeyRecord[]; message?: string };
type ApiKeysPostResponse = { key: ApiKeyRecord; apiKey: string };

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const activeKeys = useMemo(() => keys.filter((key) => !key.revokedAt), [keys]);

  async function loadKeys() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/api-keys', { cache: 'no-store' });
      const payload = (await response.json()) as ApiKeysGetResponse;
      if (!response.ok) {
        throw new Error(payload.message ?? 'Failed to load API keys.');
      }
      setKeys(payload.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKeys();
  }, []);

  useEffect(() => {
    if (!loading && keys.length === 0) {
      const timer = setTimeout(() => setModalOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, keys.length]);

  async function createKey() {
    setCreating(true);
    setError(null);
    setCreatedKey(null);
    try {
      const response = await fetch('/api/dashboard/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || null }),
      });
      const payload = (await response.json()) as ApiKeysPostResponse | { message?: string };
      if (!response.ok || !('apiKey' in payload) || !('key' in payload)) {
        const message = 'message' in payload ? payload.message : 'Failed to create API key.';
        throw new Error(message ?? 'Failed to create API key.');
      }
      setCreatedKey(payload.apiKey);
      setKeys((prev) => [payload.key, ...prev]);
      setLabel('');
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    const approved = window.confirm('Revoke this API key? This action cannot be undone.');
    if (!approved) return;

    try {
      const response = await fetch(`/api/dashboard/api-keys/${id}`, { method: 'DELETE' });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Failed to revoke key.');
      }
      setKeys((prev) =>
        prev.map((key) =>
          key.id === id
            ? {
                ...key,
                revokedAt: new Date().toISOString(),
              }
            : key
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>API keys</h1>
            <p className="muted" style={{ margin: 0 }}>
              Create and revoke tenant keys for SDK and API access.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}>
            Create new key
          </button>
        </div>
      </section>

      {error ? (
        <section className="panel" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
          {error}
        </section>
      ) : null}

      {createdKey ? (
        <section className="panel" style={{ borderColor: '#22c55e', background: 'rgba(34,197,94,0.05)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#22c55e' }}>✓ API key created — save it now</p>
            <button
              className="btn"
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}
              type="button"
              onClick={() => void navigator.clipboard.writeText(createdKey)}
            >
              Copy
            </button>
          </div>
          <pre className="install" style={{ marginBottom: '0.7rem', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            <code>{createdKey}</code>
          </pre>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            This is the only time the full key will be shown. Store it in your environment variables or a secrets manager.
          </p>
          <button
            className="btn"
            style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}
            type="button"
            onClick={() => setCreatedKey(null)}
          >
            I&apos;ve saved it — dismiss
          </button>
        </section>
      ) : null}

      <section className="panel">
        {loading ? <p className="muted">Loading keys...</p> : null}
        {!loading && keys.length === 0 ? (
          <div className="empty" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Create your first API key</p>
            <p className="muted" style={{ marginBottom: '1.25rem' }}>
              You&apos;ll need an API key to use EidolonDB from your app or the SDK. The full key is only shown once
              — save it somewhere safe.
            </p>
            <button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}>
              Create API key →
            </button>
          </div>
        ) : null}
        {!loading && activeKeys.length > 0 ? (
          <div className="stack">
            {activeKeys.map((key) => (
              <article key={key.id} className="panel">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ marginTop: 0, marginBottom: '0.35rem', fontWeight: 700 }}>{key.keyPrefix}</p>
                    <p className="muted" style={{ margin: 0 }}>
                      {key.label || 'Untitled key'}
                    </p>
                    <p className="muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                      Created: {new Date(key.createdAt).toLocaleString()} | Last used:{' '}
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <button className="btn" type="button" onClick={() => void revokeKey(key.id)}>
                    Revoke
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {modalOpen ? (
        <div className="modal-backdrop">
          <div className="panel modal">
            <h2 style={{ marginTop: 0 }}>Create API key</h2>
            <p className="muted" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.88rem' }}>
              The full key is shown once immediately after creation. Copy it to a safe place — it cannot be recovered.
            </p>
            <label htmlFor="key-label" className="muted" style={{ display: 'block', marginBottom: '0.45rem' }}>
              Label
            </label>
            <input
              id="key-label"
              className="input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Production key"
            />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn" type="button" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={creating} onClick={() => void createKey()}>
                {creating ? 'Creating...' : 'Create key'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
