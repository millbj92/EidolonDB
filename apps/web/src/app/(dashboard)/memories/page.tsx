'use client';

import { useState } from 'react';

type MemoryResult = {
  id: string;
  tier: string;
  importance: number;
  content: string;
  createdAt: string;
};

type MemoriesResponse = {
  results: MemoryResult[];
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResults(payload: unknown): MemoryResult[] {
  if (!isRecord(payload)) return [];
  const raw = payload['results'];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];

    const memoryCandidate = isRecord(item['memory']) ? item['memory'] : item;
    const createdAt = memoryCandidate['createdAt'];
    const id = memoryCandidate['id'];
    const tier = memoryCandidate['tier'];
    const content = memoryCandidate['content'];
    const importance = memoryCandidate['importanceScore'];

    if (
      typeof id !== 'string' ||
      typeof tier !== 'string' ||
      typeof content !== 'string' ||
      typeof createdAt !== 'string'
    ) {
      return [];
    }

    return [
      {
        id,
        tier,
        content,
        createdAt,
        importance: typeof importance === 'number' ? importance : 0,
      },
    ];
  });
}

export default function MemoriesPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MemoryResult[]>([]);

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dashboard/memories?q=${encodeURIComponent(query)}&limit=20`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as MemoriesResponse;
      if (!response.ok) {
        throw new Error(payload.message ?? 'Failed to search memories.');
      }
      setResults(parseResults(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginBottom: '0.4rem' }}>Memories</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Search tenant memories and inspect semantic tiers.
        </p>
        <form className="row" onSubmit={runSearch}>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search project decisions"
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </section>

      {error ? (
        <section className="panel" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
          {error}
        </section>
      ) : null}

      <section className="stack">
        {results.length === 0 ? (
          <div className="empty">No memories yet. Run a search after ingesting data in your tenant.</div>
        ) : null}
        {results.map((memory) => (
          <article key={memory.id} className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="badge">{memory.tier}</span>
              <span className="muted">Importance: {memory.importance.toFixed(2)}</span>
            </div>
            <p style={{ marginBottom: '0.4rem' }}>{memory.content}</p>
            <p className="muted" style={{ marginBottom: 0 }}>
              {new Date(memory.createdAt).toLocaleString()}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
