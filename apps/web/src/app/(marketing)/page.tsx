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
          <a className="btn" href="/docs">
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
              &quot;Today we decided on Fastify for the API. Port 4000. Jordan leads backend.&quot;
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
              // → [&quot;We&apos;re using Fastify on port 4000&quot;, &quot;Jordan leads backend development&quot;]
            </span>
          </code>
        </pre>
      </section>

      <section className="section container" id="evals">
        <h2>Eval results</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Without EidolonDB</th>
                <th>With EidolonDB</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Recall accuracy</td>
                <td>10%</td>
                <td className="good">100%</td>
              </tr>
              <tr>
                <td>Hallucinations</td>
                <td>1</td>
                <td className="good">0</td>
              </tr>
              <tr>
                <td>Overall score</td>
                <td>6%</td>
                <td className="good">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
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
            <h3>Deduplication</h3>
            <p>First-pass Jaccard + vector similarity dedup.</p>
          </article>
          <article className="card">
            <h3>Full API + SDK</h3>
            <p>REST API, TypeScript SDK, zero-dependency.</p>
          </article>
        </div>
      </section>

      <section className="section container" id="pricing">
        <h2>Pricing</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          Priced per memory operation. Every ingest, read, write, and query counts the same.
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <article className="card">
            <h3 style={{ marginBottom: '0.25rem' }}>🔵 Developer</h3>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '1.3rem', color: '#e2e8f0' }}>$19/mo</p>
            <p style={{ margin: '0 0 0.75rem', color: '#94a3b8', fontSize: '0.85rem' }}>200k ops/mo · all features · $0.25/100k overage</p>
            <a className="btn btn-primary" href="/sign-up?plan=developer" style={{ textAlign: 'center', display: 'block' }}>Start building →</a>
          </article>
          <article className="card">
            <h3 style={{ marginBottom: '0.25rem' }}>🟣 Growth</h3>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '1.3rem', color: '#e2e8f0' }}>$99/mo</p>
            <p style={{ margin: '0 0 0.75rem', color: '#94a3b8', fontSize: '0.85rem' }}>1M ops/mo · priority support · $0.10/100k overage</p>
            <a className="btn" href="/sign-up?plan=growth" style={{ textAlign: 'center', display: 'block' }}>Scale up →</a>
          </article>
          <article className="card">
            <h3 style={{ marginBottom: '0.25rem' }}>🏢 Enterprise</h3>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '1.3rem', color: '#e2e8f0' }}>Custom</p>
            <p style={{ margin: '0 0 0.75rem', color: '#94a3b8', fontSize: '0.85rem' }}>Unlimited ops · SLA · dedicated support</p>
            <a className="btn" href="mailto:hello@eidolondb.com" style={{ textAlign: 'center', display: 'block' }}>Contact us →</a>
          </article>
        </div>
        <p className="muted" style={{ fontSize: '0.82rem', textAlign: 'center' }}>
          Free tier available for self-hosted. <a href="/pricing">See full pricing →</a>
        </p>
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
