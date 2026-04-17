'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type MemoryTier = 'short_term' | 'episodic' | 'semantic';

type Memory = {
  id: string;
  tier: MemoryTier;
  content: string;
  importanceScore: number | null;
  createdAt: string;
};

type RecallResult = {
  memory: Memory;
  score: number;
};

type ValidateEvidence = {
  memoryId: string;
  content: string;
  similarity: number;
  tier: MemoryTier;
  createdAt: string;
};

type ValidateResult = {
  verdict: 'supported' | 'contradicted' | 'unverified';
  confidence: number;
  claim: string;
  supporting: ValidateEvidence[];
  contradicting: ValidateEvidence[];
  reasoning: string;
};

type DemoResponse = {
  message?: string;
  memories?: Memory[];
  results?: RecallResult[];
  extracted?: number;
  opsUsed?: number;
  opsLimit?: number;
  limitReached?: boolean;
  verdict?: ValidateResult['verdict'];
  confidence?: number;
  claim?: string;
  supporting?: ValidateEvidence[];
  contradicting?: ValidateEvidence[];
  reasoning?: string;
};

const STORAGE_KEY = 'eidolon_demo_tenant';
const DEFAULT_OPS_LIMIT = 20;

const SUGGESTED_QUERIES = [
  'What database are we using?',
  'Who leads backend?',
  "What's our deployment setup?",
  "What's the monthly infrastructure budget?",
];

const SUGGESTED_CLAIMS = [
  'Sarah leads the backend team',
  "We're using Express, not Fastify",
  'The project uses npm workspaces',
  'We have venture capital funding',
];

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function tierColor(tier: MemoryTier): string {
  if (tier === 'short_term') return '#fbbf24';
  if (tier === 'episodic') return '#60a5fa';
  return '#a78bfa';
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function parseValidateResult(payload: DemoResponse): ValidateResult | null {
  if (!payload.verdict || typeof payload.reasoning !== 'string') {
    return null;
  }

  return {
    verdict: payload.verdict,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : 0,
    claim: typeof payload.claim === 'string' ? payload.claim : '',
    supporting: Array.isArray(payload.supporting) ? payload.supporting : [],
    contradicting: Array.isArray(payload.contradicting) ? payload.contradicting : [],
    reasoning: payload.reasoning,
  };
}

export default function DemoPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [opsUsed, setOpsUsed] = useState(0);
  const [opsLimit, setOpsLimit] = useState(DEFAULT_OPS_LIMIT);

  const [initLoading, setInitLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [validating, setValidating] = useState(false);

  const [ingestText, setIngestText] = useState('');
  const [recallQuery, setRecallQuery] = useState('');
  const [claim, setClaim] = useState('');

  const [recallResults, setRecallResults] = useState<RecallResult[]>([]);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const opCounterStyle = useMemo(
    () => ({ color: opsUsed >= opsLimit - 2 ? '#ef4444' : undefined }),
    [opsLimit, opsUsed]
  );

  async function callDemo(body: Record<string, unknown>): Promise<DemoResponse> {
    const response = await fetch('/api/demo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = (await response.json()) as DemoResponse;

    if (typeof payload.opsLimit === 'number') setOpsLimit(payload.opsLimit);
    if (typeof payload.opsUsed === 'number') setOpsUsed(payload.opsUsed);

    if (response.status === 429 || payload.limitReached) {
      setLimitReached(true);
    }

    if (!response.ok) {
      throw new Error(payload.message ?? 'Demo request failed.');
    }

    return payload;
  }

  async function refreshMemories(activeTenantId: string): Promise<void> {
    const payload = await callDemo({ action: 'list', tenantId: activeTenantId });
    setMemories(Array.isArray(payload.memories) ? payload.memories : []);
  }

  useEffect(() => {
    let cancelled = false;

    async function runInit(): Promise<void> {
      setInitLoading(true);
      setError(null);

      try {
        const existing = window.sessionStorage.getItem(STORAGE_KEY);
        const currentTenantId = existing ?? `demo_${crypto.randomUUID()}`;

        if (!existing) {
          window.sessionStorage.setItem(STORAGE_KEY, currentTenantId);
        }

        if (cancelled) return;
        setTenantId(currentTenantId);

        const payload = await callDemo({ action: 'init', tenantId: currentTenantId });
        if (cancelled) return;

        setMemories(Array.isArray(payload.memories) ? payload.memories : []);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : 'Failed to initialize demo.');
      } finally {
        if (!cancelled) {
          setInitLoading(false);
        }
      }
    }

    void runInit();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleIngest(): Promise<void> {
    if (!tenantId || !ingestText.trim() || ingesting) return;

    setIngesting(true);
    setError(null);

    try {
      const payload = await callDemo({ action: 'ingest', tenantId, text: ingestText.trim() });
      const extracted = typeof payload.extracted === 'number' ? payload.extracted : 0;

      setIngestText('');
      setToast(`✓ ${extracted} memories extracted`);
      await refreshMemories(tenantId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ingest failed.');
    } finally {
      setIngesting(false);
    }
  }

  async function handleRecall(): Promise<void> {
    if (!tenantId || !recallQuery.trim() || recalling) return;

    setRecalling(true);
    setError(null);

    try {
      const payload = await callDemo({ action: 'recall', tenantId, query: recallQuery.trim() });
      setRecallResults(Array.isArray(payload.results) ? payload.results.slice(0, 5) : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Recall failed.');
    } finally {
      setRecalling(false);
    }
  }

  async function handleValidate(): Promise<void> {
    if (!tenantId || !claim.trim() || validating) return;

    setValidating(true);
    setError(null);

    try {
      const payload = await callDemo({ action: 'validate', tenantId, claim: claim.trim() });
      setValidateResult(parseValidateResult(payload));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Validate failed.');
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="container section">
      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠 EidolonDB Live Demo</h1>
        <p className="muted" style={{ margin: 0 }}>
          Try it - no signup required.
        </p>
      </section>

      {limitReached || opsUsed >= opsLimit ? (
        <section className="panel" style={{ borderColor: '#7f1d1d', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: '#fecaca' }}>
            Demo limit reached ({opsLimit} ops).{' '}
            <Link href="/sign-up" style={{ color: '#fca5a5', textDecoration: 'underline' }}>
              Sign up for unlimited access →
            </Link>
          </p>
        </section>
      ) : null}

      {error ? (
        <section className="panel" style={{ borderColor: '#7f1d1d', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: '#fecaca' }}>{error}</p>
        </section>
      ) : null}

      <div className="demo-panels">
        <section className="panel demo-panel">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Memory Store</h2>

          <div className="stack" style={{ marginBottom: '1rem' }}>
            {initLoading ? <div className="empty">Loading demo memories...</div> : null}
            {!initLoading && memories.length === 0 ? <div className="empty">No memories yet.</div> : null}
            {!initLoading
              ? memories.map((memory) => (
                  <article key={memory.id} className="card demo-memory-card">
                    <p style={{ marginTop: 0, marginBottom: '0.55rem' }}>{truncate(memory.content)}</p>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="badge" style={{ borderColor: tierColor(memory.tier), color: tierColor(memory.tier) }}>
                        {memory.tier}
                      </span>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        Importance {typeof memory.importanceScore === 'number' ? memory.importanceScore.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </article>
                ))
              : null}
          </div>

          <div className="panel" style={{ padding: '0.75rem' }}>
            <p style={{ marginTop: 0, marginBottom: '0.5rem', fontWeight: 700 }}>Add a memory</p>
            <textarea
              className="input"
              value={ingestText}
              rows={4}
              onChange={(event) => setIngestText(event.target.value)}
              placeholder="Type a memory to ingest"
              disabled={ingesting || initLoading || limitReached}
              style={{ resize: 'vertical' }}
            />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.6rem' }}>
              <button className="btn btn-primary" type="button" onClick={() => void handleIngest()} disabled={ingesting || !ingestText.trim() || limitReached}>
                {ingesting ? (
                  <span className="row" style={{ gap: '0.45rem' }}>
                    <span className="demo-spinner" /> Ingesting...
                  </span>
                ) : (
                  'Ingest →'
                )}
              </button>
              <span className="muted" style={{ fontSize: '0.85rem', ...opCounterStyle }}>
                {opsUsed} / {opsLimit} ops used
              </span>
            </div>
            {toast ? (
              <p style={{ marginBottom: 0, marginTop: '0.6rem', color: '#86efac', fontSize: '0.88rem' }}>{toast}</p>
            ) : null}
          </div>
        </section>

        <section className="panel demo-panel">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Recall</h2>
          <div className="row" style={{ marginBottom: '0.8rem' }}>
            <input
              className="input"
              value={recallQuery}
              onChange={(event) => setRecallQuery(event.target.value)}
              placeholder="What do you want to know?"
              disabled={recalling || initLoading || limitReached}
            />
            <button className="btn btn-primary" type="button" onClick={() => void handleRecall()} disabled={recalling || !recallQuery.trim() || limitReached}>
              {recalling ? 'Asking...' : 'Ask →'}
            </button>
          </div>

          <div className="demo-chip-wrap" style={{ marginBottom: '1rem' }}>
            {SUGGESTED_QUERIES.map((item) => (
              <button key={item} className="demo-chip" type="button" onClick={() => setRecallQuery(item)} disabled={recalling || limitReached}>
                {item}
              </button>
            ))}
          </div>

          <div className="stack">
            {recallResults.length === 0 ? <div className="empty">Run a recall query to see matched memories.</div> : null}
            {recallResults.map((result) => (
              <article className="card" key={`${result.memory.id}-${result.score}`}>
                <p style={{ marginTop: 0, marginBottom: '0.45rem' }}>{result.memory.content}</p>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="badge" style={{ borderColor: tierColor(result.memory.tier), color: tierColor(result.memory.tier) }}>
                    {result.memory.tier}
                  </span>
                  <span className="muted" style={{ fontSize: '0.82rem' }}>
                    Similarity {formatPercent(result.score)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel demo-panel">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Validate</h2>
          <div className="row" style={{ marginBottom: '0.8rem' }}>
            <input
              className="input"
              value={claim}
              onChange={(event) => setClaim(event.target.value)}
              placeholder="Enter a claim to fact-check"
              disabled={validating || initLoading || limitReached}
            />
            <button className="btn btn-primary" type="button" onClick={() => void handleValidate()} disabled={validating || !claim.trim() || limitReached}>
              {validating ? 'Checking...' : 'Check →'}
            </button>
          </div>

          <div className="demo-chip-wrap" style={{ marginBottom: '1rem' }}>
            {SUGGESTED_CLAIMS.map((item) => (
              <button key={item} className="demo-chip" type="button" onClick={() => setClaim(item)} disabled={validating || limitReached}>
                {item}
              </button>
            ))}
          </div>

          {validateResult ? (
            <article className="card">
              <p
                style={{
                  marginTop: 0,
                  marginBottom: '0.55rem',
                  color:
                    validateResult.verdict === 'supported'
                      ? '#4ade80'
                      : validateResult.verdict === 'contradicted'
                        ? '#f87171'
                        : '#cbd5e1',
                  fontWeight: 800,
                }}
              >
                {validateResult.verdict === 'supported' ? '✅ supported' : null}
                {validateResult.verdict === 'contradicted' ? '❌ contradicted' : null}
                {validateResult.verdict === 'unverified' ? '❓ unverified' : null}
              </p>
              {validateResult.verdict !== 'unverified' ? (
                <p className="muted" style={{ marginTop: 0, marginBottom: '0.6rem' }}>
                  Confidence {formatPercent(validateResult.confidence)}
                </p>
              ) : null}
              <p style={{ marginTop: 0 }}>{validateResult.reasoning}</p>
              {validateResult.verdict === 'contradicted' && validateResult.contradicting.length > 0 ? (
                <div>
                  <p className="muted" style={{ marginBottom: '0.45rem' }}>
                    Contradicting evidence
                  </p>
                  <div className="stack">
                    {validateResult.contradicting.slice(0, 3).map((evidence) => (
                      <div key={evidence.memoryId} className="panel" style={{ padding: '0.6rem' }}>
                        <p style={{ margin: 0 }}>{truncate(evidence.content, 140)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ) : (
            <div className="empty">Check a claim to see whether it is supported by memory.</div>
          )}
        </section>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="muted"
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
          onClick={() => {
            window.sessionStorage.removeItem(STORAGE_KEY);
            window.location.reload();
          }}
        >
          Reset session
        </button>
      </div>

      <style jsx>{`
        .demo-panels {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          align-items: start;
        }

        .demo-panel {
          min-height: 540px;
        }

        .demo-memory-card {
          padding: 0.85rem;
        }

        .demo-chip-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .demo-chip {
          border: 1px solid var(--border);
          background: rgba(99, 102, 241, 0.1);
          color: #c7d2e8;
          border-radius: 999px;
          padding: 0.35rem 0.6rem;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .demo-chip:hover {
          border-color: #32324a;
        }

        .demo-spinner {
          display: inline-block;
          width: 0.9rem;
          height: 0.9rem;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.4);
          border-top-color: #ffffff;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 980px) {
          .demo-panels {
            grid-template-columns: 1fr;
          }

          .demo-panel {
            min-height: 0;
          }
        }
      `}</style>
    </div>
  );
}
