import Link from 'next/link';

export default function MarketingPage() {
  return (
    <>
      <section className="hero container">
        <p className="eyebrow">Self-managing memory for AI agents</p>
        <h1>EidolonDB</h1>
        <p className="lead">Self-managing memory for AI agents.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/sign-up">
            Get Started →
          </Link>
          <a className="btn" href="/eidolondb/demo">
            Live Demo →
          </a>
          <a className="btn" href="/docs/eidolondb/quickstart">
            View Docs →
          </a>
          <a className="btn" href="https://github.com/millbj92/eidolondb" target="_blank" rel="noreferrer">
            GitHub →
          </a>
        </div>
        <p className="sub">Memory that extracts itself. Evolves itself. Stays useful.</p>
      </section>

      <section className="section container" id="problem">
        <h2>The problem</h2>
        <div className="problem-list">
          <p>Vector DBs store whatever you give them. You have to figure out what matters.</p>
          <p>Agents forget everything between sessions. Context window isn&apos;t memory.</p>
          <p>Memory bloat is real. Low-signal storage degrades retrieval quality.</p>
        </div>
      </section>

      <section className="section container" id="how">
        <h2>How it works</h2>
        <div className="steps">
          <article className="step">
            <span>Step 1</span>
            <h3>Ingest</h3>
            <p>Feed raw text. EidolonDB extracts what is worth remembering.</p>
          </article>
          <article className="step">
            <span>Step 2</span>
            <h3>Evolve</h3>
            <p>short_term becomes episodic, episodic distills to semantic. Noise decays.</p>
          </article>
          <article className="step">
            <span>Step 3</span>
            <h3>Recall</h3>
            <p>Hybrid search surfaces the right memories at the right time.</p>
          </article>
        </div>
      </section>

      <section className="section container" id="code">
        <h2>Code</h2>
        <pre className="code-block">
          <code>
            <span className="k">import</span> <span className="p">{'{'}</span> <span className="t">EidolonDB</span>{' '}
            <span className="p">{'}'}</span> <span className="k">from</span>{' '}
            <span className="s">&apos;@eidolondb/client&apos;</span>
            <span className="p">;</span>
            {'\n\n'}
            <span className="k">const</span> <span className="v">db</span> <span className="p">=</span>{' '}
            <span className="k">new</span> <span className="t">EidolonDB</span>
            <span className="p">({'{'}</span> <span className="v">url</span>
            <span className="p">:</span> <span className="s">&apos;http://localhost:3000&apos;</span>
            <span className="p">,</span> <span className="v">tenant</span>
            <span className="p">:</span> <span className="s">&apos;my-app&apos;</span> <span className="p">{'}'});</span>
            {'\n\n'}
            <span className="c">// Memory that extracts itself</span>
            {'\n'}
            <span className="k">await</span> <span className="v">db</span>
            <span className="p">.</span>
            <span className="v">ingest</span>
            <span className="p">(</span>
            <span className="s">
              &quot;We use Fastify on port 4000. Jordan leads backend.&quot;
            </span>
            <span className="p">);</span>
            {'\n\n'}
            <span className="c">// Recall across sessions</span>
            {'\n'}
            <span className="k">const</span> <span className="v">context</span> <span className="p">=</span>{' '}
            <span className="k">await</span> <span className="v">db</span>
            <span className="p">.</span>
            <span className="v">recall</span>
            <span className="p">(</span>
            <span className="s">&quot;project decisions&quot;</span>
            <span className="p">);</span>
            {'\n'}
            <span className="c">
              // → [&quot;We&apos;re using Fastify on port 4000&quot;, &quot;Jordan leads backend&quot;]
            </span>
            {'\n\n'}
            <span className="c">// Validate a claim against memory</span>
            {'\n'}
            <span className="k">const</span> <span className="v">result</span> <span className="p">=</span>{' '}
            <span className="k">await</span> <span className="v">db</span>
            <span className="p">.</span>
            <span className="v">validate</span>
            <span className="p">(</span>
            <span className="s">&quot;Jordan leads the backend team&quot;</span>
            <span className="p">);</span>
            {'\n'}
            <span className="c">
              // → {'{'} verdict: &quot;supported&quot;, confidence: 0.94, reasoning: &quot;...&quot; {'}'}
            </span>
          </code>
        </pre>
      </section>

      <section className="section container" id="evals">
        <h2>Eval results</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.9rem' }}>
          16 multi-session scenarios · 3 sessions each · held-out LLM judge scoring recall quality and hallucination rejection.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>System</th>
                <th>Recall</th>
                <th>Hallucination</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>No memory baseline</td>
                <td>22%</td>
                <td>0%</td>
                <td>15.8%</td>
              </tr>
              <tr>
                <td>RAG baseline *</td>
                <td>93%</td>
                <td>93%</td>
                <td>93.3%</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>EidolonDB</td>
                <td className="good">100%</td>
                <td className="good">100%</td>
                <td className="good" style={{ fontWeight: 700 }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
          * RAG baseline uses the same false-premise rejection prompt as EidolonDB for a fair retrieval comparison. Naive RAG without this prompt scores ~65%. EidolonDB&apos;s advantage grows significantly over longer session horizons.
        </p>
      </section>

      <section className="section container" id="features">
        <h2>Features</h2>
        <div className="grid">
          <article className="card">
            <h3>Auto-Extraction</h3>
            <p>LLM extracts structured memories from raw text.</p>
          </article>
          <article className="card">
            <h3>Tier System</h3>
            <p>short_term / episodic / semantic with automatic lifecycle.</p>
          </article>
          <article className="card">
            <h3>LLM Distillation</h3>
            <p>Episodic memories condense into lasting semantic knowledge.</p>
          </article>
          <article className="card">
            <h3>Hybrid Search</h3>
            <p>Vector + recency + importance scoring.</p>
          </article>
          <article className="card">
            <h3>Claim Validation</h3>
            <p>Check any statement against stored memories. Verdict: supported, contradicted, or unverified.</p>
          </article>
          <article className="card">
            <h3>Multi-Agent RBAC</h3>
            <p>Share memories across agents with scoped read/write grants.</p>
          </article>
          <article className="card">
            <h3>Conflict Resolution</h3>
            <p>Automatically detect and surface contradictory memories.</p>
          </article>
          <article className="card">
            <h3>MCP Support</h3>
            <p>Native Model Context Protocol server. Works with Claude, Cursor, Windsurf.</p>
          </article>
          <article className="card">
            <h3>Full API + SDKs</h3>
            <p>REST API, TypeScript + Python SDKs, zero dependencies.</p>
          </article>
        </div>
      </section>

      <section className="section container" id="pricing">
        <h2>Simple, usage-based pricing</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          Start free. Pay as you grow. No per-seat nonsense.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/pricing">
            See pricing →
          </Link>
        </div>
      </section>

      <section className="section container cta" id="start">
        <h2>Get started</h2>
        <pre className="install">
          <code>npm install @eidolondb/client</code>
        </pre>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/docs">
            Read the docs →
          </a>
          <a className="btn" href="/self-hosting">
            Self-host →
          </a>
        </div>
      </section>
    </>
  );
}
