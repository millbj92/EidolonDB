'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Tier = 'short_term' | 'episodic' | 'semantic';
type DateFilter = '7d' | '30d' | '90d' | 'all';

type Memory = {
  id: string;
  content: string;
  tier: Tier;
  tags?: string[];
  importanceScore?: number;
  recencyScore?: number;
  accessCount?: number;
  createdAt?: string;
  metadata?: Record<string, unknown> | null;
};

type MemoryResult = {
  memory: Memory;
  score: number;
};

type StatsResponse = {
  totalMemories: number;
  tierCounts: Record<Tier, number>;
  mostRecentMemoryAt: string | null;
  timeline?: Array<{ date: string; count: number }>;
};

type ProvenanceResponse = {
  memory: Memory;
  relations: Array<{
    id?: string;
    type: string;
    fromType: string;
    fromId: string;
    toType: string;
    toId: string;
  }>;
  distilledFrom: Memory | null;
  distilledInto: Memory | null;
};

const ALL_TIERS: Tier[] = ['short_term', 'episodic', 'semantic'];
const DATE_OPTIONS: DateFilter[] = ['7d', '30d', '90d', 'all'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTier(value: unknown): Tier {
  if (value === 'short_term' || value === 'episodic' || value === 'semantic') {
    return value;
  }
  return 'episodic';
}

function parseMemory(value: unknown): Memory | null {
  if (!isRecord(value)) return null;
  if (typeof value['id'] !== 'string' || typeof value['content'] !== 'string') return null;

  const tags = Array.isArray(value['tags'])
    ? value['tags'].filter((tag): tag is string => typeof tag === 'string')
    : undefined;

  return {
    id: value['id'],
    content: value['content'],
    tier: parseTier(value['tier']),
    tags,
    importanceScore: typeof value['importanceScore'] === 'number' ? value['importanceScore'] : undefined,
    recencyScore: typeof value['recencyScore'] === 'number' ? value['recencyScore'] : undefined,
    accessCount: typeof value['accessCount'] === 'number' ? value['accessCount'] : undefined,
    createdAt: typeof value['createdAt'] === 'string' ? value['createdAt'] : undefined,
    metadata: isRecord(value['metadata']) ? value['metadata'] : null,
  };
}

function parseMemoryResults(payload: unknown): MemoryResult[] {
  if (!isRecord(payload)) return [];
  const raw = payload['results'];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const memory = parseMemory(isRecord(item['memory']) ? item['memory'] : item);
    if (!memory) return [];
    return [{ memory, score: typeof item['score'] === 'number' ? item['score'] : 1 }];
  });
}

function normalizeStats(payload: unknown): StatsResponse | null {
  if (!isRecord(payload)) return null;

  const totalFromV2 = typeof payload['totalMemories'] === 'number' ? payload['totalMemories'] : null;
  const tierCountsFromV2 = isRecord(payload['tierCounts']) ? payload['tierCounts'] : null;

  if (totalFromV2 !== null && tierCountsFromV2) {
    return {
      totalMemories: totalFromV2,
      tierCounts: {
        short_term: typeof tierCountsFromV2['short_term'] === 'number' ? tierCountsFromV2['short_term'] : 0,
        episodic: typeof tierCountsFromV2['episodic'] === 'number' ? tierCountsFromV2['episodic'] : 0,
        semantic: typeof tierCountsFromV2['semantic'] === 'number' ? tierCountsFromV2['semantic'] : 0,
      },
      mostRecentMemoryAt: typeof payload['mostRecentMemoryAt'] === 'string' ? payload['mostRecentMemoryAt'] : null,
      timeline: Array.isArray(payload['timeline'])
        ? payload['timeline']
            .filter(isRecord)
            .flatMap((row) =>
              typeof row['date'] === 'string' && typeof row['count'] === 'number'
                ? [{ date: row['date'], count: row['count'] }]
                : []
            )
        : undefined,
    };
  }

  const total = typeof payload['total'] === 'number' ? payload['total'] : null;
  const byTier = isRecord(payload['byTier']) ? payload['byTier'] : null;
  if (total === null || !byTier) return null;

  const timeline = Array.isArray(payload['byDay'])
    ? payload['byDay']
        .filter(isRecord)
        .flatMap((row) =>
          typeof row['date'] === 'string' && typeof row['count'] === 'number'
            ? [{ date: row['date'], count: row['count'] }]
            : []
        )
    : undefined;

  return {
    totalMemories: total,
    tierCounts: {
      short_term: typeof byTier['short_term'] === 'number' ? byTier['short_term'] : 0,
      episodic: typeof byTier['episodic'] === 'number' ? byTier['episodic'] : 0,
      semantic: typeof byTier['semantic'] === 'number' ? byTier['semantic'] : 0,
    },
    mostRecentMemoryAt: null,
    timeline,
  };
}

function parseProvenance(payload: unknown): ProvenanceResponse | null {
  if (!isRecord(payload)) return null;
  const memory = parseMemory(payload['memory']);
  if (!memory) return null;

  const relations = Array.isArray(payload['relations'])
    ? payload['relations'].flatMap((relation) => {
        if (!isRecord(relation)) return [];
        if (
          typeof relation['type'] !== 'string' ||
          typeof relation['fromType'] !== 'string' ||
          typeof relation['fromId'] !== 'string' ||
          typeof relation['toType'] !== 'string' ||
          typeof relation['toId'] !== 'string'
        ) {
          return [];
        }

        return [{
          id: typeof relation['id'] === 'string' ? relation['id'] : undefined,
          type: relation['type'],
          fromType: relation['fromType'],
          fromId: relation['fromId'],
          toType: relation['toType'],
          toId: relation['toId'],
        }];
      })
    : [];

  return {
    memory,
    relations,
    distilledFrom: parseMemory(payload['distilledFrom']),
    distilledInto: parseMemory(payload['distilledInto']),
  };
}

function formatRelative(value?: string): string {
  if (!value) return 'Unknown';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'Unknown';

  const diffMs = Date.now() - ts;
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diffMs < minute) return 'just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < day * 30) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(value).toLocaleDateString();
}

function normalizeImportance(score?: number): number {
  if (score == null || Number.isNaN(score)) return 0;
  if (score <= 1) return Math.max(0, Math.min(100, score * 100));
  return Math.max(0, Math.min(100, score));
}

function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function tierColor(tier: Tier): string {
  if (tier === 'short_term') return '#f59e0b';
  if (tier === 'semantic') return '#a78bfa';
  return '#60a5fa';
}

function daysForFilter(filter: DateFilter): number | null {
  if (filter === '7d') return 7;
  if (filter === '30d') return 30;
  if (filter === '90d') return 90;
  return null;
}

function LineageCard({ memory, label }: { memory: Memory; label: string }) {
  return (
    <div className="card" style={{ padding: '0.75rem' }}>
      <p className="muted" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase' }}>{label}</p>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <span className="badge" style={{ borderColor: tierColor(memory.tier), color: tierColor(memory.tier) }}>
          {memory.tier}
        </span>
        <span className="muted" style={{ fontSize: '0.8rem' }}>{formatRelative(memory.createdAt)}</span>
      </div>
      <p style={{ marginBottom: 0, marginTop: '0.5rem' }}>
        {memory.content.length > 180 ? `${memory.content.slice(0, 180)}...` : memory.content}
      </p>
    </div>
  );
}

function ProvenanceMiniGraph({
  data,
  memoryLookup,
  onSelectMemory,
}: {
  data: ProvenanceResponse;
  memoryLookup: Map<string, Memory>;
  onSelectMemory: (id: string) => void;
}) {
  const connectedIds = Array.from(
    new Set(
      data.relations
        .flatMap((relation) => {
          if (relation.fromType !== 'memory' || relation.toType !== 'memory') return [];
          if (relation.fromId === data.memory.id) return [relation.toId];
          if (relation.toId === data.memory.id) return [relation.fromId];
          return [];
        })
        .filter((id) => id !== data.memory.id)
    )
  ).slice(0, 6);

  const center = { x: 220, y: 120 };
  const radius = 85;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(data.memory.id, center);

  connectedIds.forEach((id, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(connectedIds.length, 1) - Math.PI / 2;
    positions.set(id, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  });

  const edges = data.relations
    .filter((relation) => relation.fromType === 'memory' && relation.toType === 'memory')
    .filter((relation) => positions.has(relation.fromId) && positions.has(relation.toId));

  return (
    <div className="card" style={{ padding: '0.5rem' }}>
      <svg viewBox="0 0 440 240" style={{ width: '100%', height: '220px' }}>
        {edges.map((edge) => {
          const from = positions.get(edge.fromId);
          const to = positions.get(edge.toId);
          if (!from || !to) return null;

          return (
            <line
              key={edge.id ?? `${edge.type}-${edge.fromId}-${edge.toId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={edge.type === 'DISTILLED_FROM' ? '#a78bfa' : '#64748b'}
              strokeWidth="1.5"
            />
          );
        })}

        {Array.from(positions.entries()).map(([id, pos]) => {
          const memory = id === data.memory.id
            ? data.memory
            : memoryLookup.get(id) ?? (data.distilledFrom?.id === id ? data.distilledFrom : data.distilledInto?.id === id ? data.distilledInto : undefined);
          const isSelected = id === data.memory.id;
          const tierLetter = memory?.tier ? memory.tier.charAt(0).toUpperCase() : '?';

          return (
            <g key={id} onClick={() => onSelectMemory(id)} style={{ cursor: 'pointer' }}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={27}
                fill={isSelected ? '#1d4ed8' : '#0f172a'}
                stroke={memory?.tier ? tierColor(memory.tier) : '#64748b'}
                strokeWidth="2"
              />
              <text x={pos.x} y={pos.y - 2} fill="#e2e8f0" fontSize="10" textAnchor="middle">
                {truncateId(id)}
              </text>
              <text x={pos.x} y={pos.y + 11} fill="#94a3b8" fontSize="9" textAnchor="middle">
                {tierLetter}
              </text>
            </g>
          );
        })}
      </svg>
      {connectedIds.length === 0 ? (
        <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
          No connected memories in 1-hop graph.
        </p>
      ) : null}
    </div>
  );
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryResult[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTiers, setActiveTiers] = useState<Tier[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [provenanceMemoryId, setProvenanceMemoryId] = useState<string | null>(null);
  const [provenanceData, setProvenanceData] = useState<ProvenanceResponse | null>(null);
  const [provenanceLoading, setProvenanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const firstSearchPass = useRef(true);

  const memoryLookup = useMemo(() => {
    const map = new Map<string, Memory>();
    for (const result of memories) {
      map.set(result.memory.id, result.memory);
    }
    return map;
  }, [memories]);

  const mostRecentFromMemories = useMemo(() => {
    const created = memories
      .map((result) => result.memory.createdAt)
      .filter((value): value is string => typeof value === 'string')
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return created[0] ?? null;
  }, [memories]);

  const filteredMemories = useMemo(() => {
    let rows = memories;

    if (activeTiers.length > 0) {
      rows = rows.filter((result) => activeTiers.includes(result.memory.tier));
    }

    const days = daysForFilter(dateFilter);
    if (days !== null) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      rows = rows.filter((result) => {
        const createdAt = result.memory.createdAt;
        if (!createdAt) return false;
        const ts = new Date(createdAt).getTime();
        return !Number.isNaN(ts) && ts >= cutoff;
      });
    }

    return rows;
  }, [activeTiers, dateFilter, memories]);

  async function loadStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await fetch('/api/dashboard/memories/stats', { cache: 'no-store' });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error('Failed to load stats.');
      }
      setStats(normalizeStats(payload));
    } catch (loadError) {
      setStats(null);
      setStatsError(loadError instanceof Error ? loadError.message : 'Failed to load stats.');
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadMemories(query: string) {
    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/dashboard/memories', window.location.origin);
      url.searchParams.set('limit', query ? '50' : '100');
      url.searchParams.set('sortBy', 'createdAt');
      url.searchParams.set('sortOrder', 'desc');
      if (query) {
        url.searchParams.set('q', query);
      }

      const response = await fetch(url.toString(), { cache: 'no-store' });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error('Failed to load memories.');
      }
      setMemories(parseMemoryResults(payload));
      setExpandedIds(new Set());
    } catch (loadError) {
      setMemories([]);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load memories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
    void loadMemories('');
  }, []);

  useEffect(() => {
    if (firstSearchPass.current) {
      firstSearchPass.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void loadMemories(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!provenanceMemoryId) {
      setProvenanceData(null);
      setProvenanceLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchProvenance(id: string) {
      setProvenanceLoading(true);
      try {
        const response = await fetch(`/api/dashboard/memories/${encodeURIComponent(id)}/provenance`, { cache: 'no-store' });
        const payload = (await response.json()) as unknown;
        if (!response.ok) {
          throw new Error('Failed to load provenance.');
        }
        if (!cancelled) {
          setProvenanceData(parseProvenance(payload));
        }
      } catch {
        if (!cancelled) {
          setProvenanceData(null);
        }
      } finally {
        if (!cancelled) {
          setProvenanceLoading(false);
        }
      }
    }

    void fetchProvenance(provenanceMemoryId);

    return () => {
      cancelled = true;
    };
  }, [provenanceMemoryId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProvenanceMemoryId(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function toggleTier(tier: Tier) {
    setActiveTiers((current) =>
      current.includes(tier) ? current.filter((value) => value !== tier) : [...current, tier]
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const totalMemories = stats?.totalMemories ?? memories.length;
  const tierCounts = stats?.tierCounts ?? {
    short_term: memories.filter((result) => result.memory.tier === 'short_term').length,
    episodic: memories.filter((result) => result.memory.tier === 'episodic').length,
    semantic: memories.filter((result) => result.memory.tier === 'semantic').length,
  };
  const mostRecentAt = stats?.mostRecentMemoryAt ?? mostRecentFromMemories;
  const timeline = stats?.timeline ?? [];
  const timelineMax = timeline.length > 0 ? Math.max(...timeline.map((point) => point.count), 1) : 1;

  return (
    <div className="stack">
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
        }}
      >
        <article className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.4rem' }}>Total Memories</p>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{statsLoading ? '...' : totalMemories}</p>
        </article>

        <article className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.4rem' }}>Tier Breakdown</p>
          <div className="row">
            {ALL_TIERS.map((tier) => (
              <span key={tier} className="badge" style={{ borderColor: tierColor(tier), color: tierColor(tier) }}>
                {tier}: {tierCounts[tier] ?? 0}
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.4rem' }}>Most Recent Memory</p>
          <p style={{ marginTop: 0, marginBottom: '0.6rem', fontWeight: 700 }}>{formatRelative(mostRecentAt ?? undefined)}</p>
          {timeline.length > 0 ? (
            <div className="row" style={{ alignItems: 'flex-end', gap: '0.35rem' }}>
              {timeline.slice(-12).map((point) => (
                <div
                  key={point.date}
                  title={`${point.date}: ${point.count}`}
                  style={{
                    width: '12px',
                    height: `${Math.max(6, Math.round((point.count / timelineMax) * 42))}px`,
                    borderRadius: '4px',
                    background: 'linear-gradient(180deg, #60a5fa, #1d4ed8)',
                  }}
                />
              ))}
            </div>
          ) : null}
        </article>
      </section>

      {statsError ? (
        <section className="panel" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
          {statsError}
        </section>
      ) : null}

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: '0.35rem' }}>Memories</h1>
            <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>Memory explorer with filters, search, and provenance.</p>
          </div>
          <span className="badge">{filteredMemories.length} shown</span>
        </div>

        <div className="stack" style={{ gap: '0.75rem' }}>
          <input
            className="input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search memory content semantically"
          />

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row">
              {ALL_TIERS.map((tier) => {
                const active = activeTiers.includes(tier);
                return (
                  <button
                    key={tier}
                    className="btn"
                    type="button"
                    onClick={() => toggleTier(tier)}
                    style={active ? { borderColor: tierColor(tier), color: tierColor(tier) } : undefined}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>

            <div className="row">
              {DATE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="btn"
                  onClick={() => setDateFilter(option)}
                  style={dateFilter === option ? { fontWeight: 800 } : undefined}
                >
                  {option === 'all' ? 'All' : option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <section className="panel" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
            {error}
          </section>
        ) : null}

        <section style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <div className="stack">
            {loading ? <div className="empty">Loading memories...</div> : null}
            {!loading && filteredMemories.length === 0 ? <div className="empty">No memories found.</div> : null}

            {!loading && filteredMemories.map((result) => {
              const memory = result.memory;
              const expanded = expandedIds.has(memory.id);
              const contentPreview = memory.content.length > 200 && !expanded
                ? `${memory.content.slice(0, 200)}...`
                : memory.content;
              const importance = normalizeImportance(memory.importanceScore);

              return (
                <article key={memory.id} className="card">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="badge" style={{ borderColor: tierColor(memory.tier), color: tierColor(memory.tier) }}>
                      {memory.tier}
                    </span>
                    <span className="muted" style={{ fontSize: '0.82rem' }}>{formatRelative(memory.createdAt)}</span>
                  </div>

                  <p style={{ margin: '0.6rem 0' }}>{contentPreview}</p>

                  <div style={{ height: '4px', borderRadius: '999px', background: '#0f172a', border: '1px solid #1e293b', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${importance}%`,
                        background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                      }}
                    />
                  </div>

                  {memory.tags && memory.tags.length > 0 ? (
                    <div className="row" style={{ marginTop: '0.6rem' }}>
                      {memory.tags.map((tag) => (
                        <span key={tag} className="badge" style={{ fontSize: '0.68rem' }}>{tag}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.7rem' }}>
                    <div className="row" style={{ gap: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(memory.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#93c5fd',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {expanded ? 'Collapse' : 'Expand'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProvenanceMemoryId(memory.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#c4b5fd',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Provenance →
                      </button>
                    </div>

                    <span className="muted" style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.75rem' }}>
                      {truncateId(memory.id)}
                    </span>
                  </div>

                  {expanded ? (
                    <div className="panel" style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
                      <div className="row" style={{ gap: '1rem' }}>
                        <span className="muted" style={{ fontSize: '0.82rem' }}>
                          Access count: {memory.accessCount ?? 0}
                        </span>
                        <span className="muted" style={{ fontSize: '0.82rem' }}>
                          Recency score: {memory.recencyScore?.toFixed(3) ?? '0.000'}
                        </span>
                        <span className="muted" style={{ fontSize: '0.82rem' }}>
                          Search score: {result.score.toFixed(3)}
                        </span>
                      </div>
                      <pre
                        style={{
                          marginTop: '0.6rem',
                          marginBottom: 0,
                          overflowX: 'auto',
                          fontSize: '0.76rem',
                          lineHeight: 1.4,
                          color: '#cbd5e1',
                        }}
                      >
                        {JSON.stringify(memory.metadata ?? {}, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </section>

      {provenanceMemoryId ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.7)' }}
            onClick={() => setProvenanceMemoryId(null)}
          />

          <aside
            className="panel"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: '480px',
              maxWidth: '100vw',
              overflowY: 'auto',
              padding: '1.5rem',
              borderRadius: 0,
              borderLeft: '1px solid #1e293b',
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Memory Provenance</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {truncateId(provenanceData?.memory.id ?? provenanceMemoryId)}
                </p>
              </div>
              <button className="btn" type="button" onClick={() => setProvenanceMemoryId(null)}>
                Close
              </button>
            </div>

            {provenanceLoading ? <div className="empty" style={{ marginTop: '1rem' }}>Loading provenance...</div> : null}
            {!provenanceLoading && !provenanceData ? <div className="empty" style={{ marginTop: '1rem' }}>No provenance data found.</div> : null}

            {!provenanceLoading && provenanceData ? (
              <div className="stack" style={{ marginTop: '1rem' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="badge" style={{ borderColor: tierColor(provenanceData.memory.tier), color: tierColor(provenanceData.memory.tier) }}>
                    {provenanceData.memory.tier}
                  </span>
                  <span className="muted">{formatRelative(provenanceData.memory.createdAt)}</span>
                </div>

                <section className="stack" style={{ gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Lineage</h3>
                  {provenanceData.distilledFrom ? (
                    <LineageCard memory={provenanceData.distilledFrom} label="Source episodic memory" />
                  ) : null}
                  {provenanceData.distilledFrom ? (
                    <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: '0.8rem' }}>↓ DISTILLED_FROM</p>
                  ) : null}
                  <LineageCard memory={provenanceData.memory} label="Selected memory" />
                  {provenanceData.distilledInto ? (
                    <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: '0.8rem' }}>↓ DISTILLED_INTO</p>
                  ) : null}
                  {provenanceData.distilledInto ? (
                    <LineageCard memory={provenanceData.distilledInto} label="Semantic memory" />
                  ) : null}
                  {!provenanceData.distilledFrom && !provenanceData.distilledInto ? (
                    <p className="muted" style={{ margin: 0 }}>No distillation history</p>
                  ) : null}
                </section>

                <section className="stack" style={{ gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Relations</h3>
                  {provenanceData.relations.length === 0 ? (
                    <div className="empty">No relations found for this memory.</div>
                  ) : (
                    provenanceData.relations.map((relation) => {
                      const highlighted = relation.type === 'DISTILLED_FROM';
                      return (
                        <article
                          key={relation.id ?? `${relation.type}-${relation.fromId}-${relation.toId}`}
                          className="card"
                          style={highlighted ? { borderColor: '#a78bfa' } : undefined}
                        >
                          <p style={{ marginTop: 0, marginBottom: '0.35rem', color: highlighted ? '#c4b5fd' : undefined }}>
                            {relation.type}
                          </p>
                          <p
                            className="muted"
                            style={{
                              margin: 0,
                              fontFamily: 'var(--font-jetbrains), monospace',
                              fontSize: '0.75rem',
                              wordBreak: 'break-all',
                            }}
                          >
                            {relation.fromType}:{truncateId(relation.fromId)} → {relation.toType}:{truncateId(relation.toId)}
                          </p>
                        </article>
                      );
                    })
                  )}
                </section>

                <section className="stack" style={{ gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Graph (1 hop)</h3>
                  <ProvenanceMiniGraph
                    data={provenanceData}
                    memoryLookup={memoryLookup}
                    onSelectMemory={setProvenanceMemoryId}
                  />
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
