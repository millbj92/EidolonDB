import Link from 'next/link';

const osQuestions = [
  { question: 'Who am I?', answer: 'Agent Registry' },
  { question: 'What do I know?', answer: 'EidolonDB' },
  { question: 'What can I do?', answer: 'Capabilities' },
  { question: 'What happened?', answer: 'Audit' },
] as const;

export default function MarketingPage() {
  return (
    <>
      <section className="hero container">
        <p className="eyebrow">The control plane for reliable AI agents</p>
        <h1>Eidolon</h1>
        <p className="lead">The control plane for reliable AI agents.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/sign-up">
            Get started free
          </Link>
          <Link className="btn" href="/docs">
            View docs
          </Link>
        </div>
      </section>

      <section className="section container" id="products">
        <h2>Products</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <article className="card">
            <h3>EidolonDB</h3>
            <p>Memory for AI agents. Automatic extraction, tiered lifecycle, and hybrid recall.</p>
            <div className="hero-actions" style={{ marginTop: '1rem' }}>
              <Link className="btn" href="/eidolondb">
                Learn more -&gt;
              </Link>
            </div>
          </article>
          <article className="card">
            <h3>Capabilities</h3>
            <p>Permissions for AI agents. Define actions in YAML, enforce policy, and audit every decision.</p>
            <div className="hero-actions" style={{ marginTop: '1rem' }}>
              <Link className="btn" href="/capabilities">
                Learn more -&gt;
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section container" id="vision">
        <h2>The OS vision</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Together they answer every question an agent needs.
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {osQuestions.map((item) => (
            <article className="card" key={item.question}>
              <h3 style={{ marginBottom: '0.25rem' }}>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container cta" id="start">
        <h2>Build with Eidolon</h2>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/sign-up">
            Get started free
          </Link>
          <Link className="btn" href="/docs">
            View docs
          </Link>
        </div>
      </section>
    </>
  );
}
