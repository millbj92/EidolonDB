import Link from 'next/link';

const tiers = [
  {
    name: 'Free',
    emoji: '',
    price: '$0',
    sub: 'Self-hosted, forever.',
    highlight: false,
    ctaHref: '/sign-up',
    ctaLabel: 'Self-host free',
    ops: '10k ops/mo',
    overage: null,
    features: [
      '10,000 memory ops/month',
      '1 API key',
      'All core features',
      'Community support',
    ],
  },
  {
    name: 'Developer',
    emoji: '🔵',
    price: '$19/mo',
    sub: 'For builders experimenting and integrating.',
    highlight: true,
    ctaHref: '/sign-up?plan=developer',
    ctaLabel: 'Start building',
    ops: '200k ops/mo',
    overage: '$0.25 per 100k ops',
    features: [
      '200,000 memory ops/month',
      '10 API keys',
      'Temporal retrieval',
      'Claim validation (POST /validate)',
      'Memory decay & lifecycle',
      'Higher rate limits',
      '$0.25 per 100k ops overage',
    ],
  },
  {
    name: 'Growth',
    emoji: '🟣',
    price: '$99/mo',
    sub: 'For production agents with real workloads.',
    highlight: false,
    ctaHref: '/sign-up?plan=growth',
    ctaLabel: 'Scale up',
    ops: '1M ops/mo',
    overage: '$0.10 per 100k ops',
    features: [
      '1,000,000 memory ops/month',
      '50 API keys',
      'Everything in Developer',
      'Higher throughput',
      'Priority support',
      '$0.10 per 100k ops overage',
    ],
  },
  {
    name: 'Enterprise',
    emoji: '🏢',
    price: 'Custom',
    sub: 'High-throughput agents & reliability-critical systems.',
    highlight: false,
    ctaHref: 'mailto:hello@eidolondb.com',
    ctaLabel: 'Contact us',
    ops: 'Unlimited',
    overage: null,
    features: [
      'Unlimited memory ops',
      'Unlimited API keys',
      'Everything in Growth',
      'Internal copilots & agents',
      'Dedicated support & SLA',
      'Custom contracts',
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <section className="section container">
      <h1 style={{ fontSize: '2.6rem', marginBottom: '0.7rem' }}>Pricing</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
        Priced per memory operation — ingest, read, write, query, all count the same.
      </p>
      <p className="muted" style={{ marginTop: 0, marginBottom: '2rem', fontSize: '0.9rem' }}>
        Start free. Upgrade when you need more.
      </p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
              ...(tier.highlight ? { border: '1px solid #6366f1', boxShadow: '0 0 0 1px #6366f1' } : {}),
            }}
          >
            <div>
              <h2 style={{ marginBottom: '0.2rem' }}>
                {tier.emoji ? `${tier.emoji} ` : ''}{tier.name}
              </h2>
              <p style={{ margin: '0 0 0.2rem', color: '#e2e8f0', fontWeight: 700, fontSize: '1.4rem' }}>
                {tier.price}
              </p>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.4 }}>
                {tier.sub}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#c7d2e8', lineHeight: 1.7, fontSize: '0.9rem' }}>
                {tier.features.map((feature) => (
                  <li key={`${tier.name}-${feature}`}>{feature}</li>
                ))}
              </ul>
            </div>
            <Link
              href={tier.ctaHref}
              className={`btn${tier.highlight ? ' btn-primary' : ''}`}
              style={{ textAlign: 'center' }}
            >
              {tier.ctaLabel}
            </Link>
          </article>
        ))}
      </div>
      <p className="muted" style={{ marginTop: '2rem', fontSize: '0.82rem', textAlign: 'center' }}>
        A memory operation is any call to ingest, read, write, query, or update a memory.
        Overages are billed at the end of each billing cycle.
      </p>
    </section>
  );
}
