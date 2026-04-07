import Link from 'next/link';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    ctaHref: '/sign-up',
    ctaLabel: 'Get started free',
    features: [
      'Self-hosted forever',
      '10k memories',
      '1k queries/mo',
      '1 API key',
      'Community support',
      '—',
      '—',
      '—',
    ],
  },
  {
    name: 'Pro',
    price: '$29/mo',
    ctaHref: '/sign-up?plan=pro',
    ctaLabel: 'Choose Pro',
    features: [
      'Cloud hosted',
      '500k memories',
      '100k queries/mo',
      '10 API keys',
      'Priority support',
      'Auto-extraction',
      'Lifecycle management',
      'Observability',
    ],
  },
  {
    name: 'Team',
    price: '$99/mo',
    ctaHref: '/sign-up?plan=team',
    ctaLabel: 'Choose Team',
    features: [
      'Cloud hosted',
      'Unlimited memories',
      '1M queries/mo',
      '50 API keys',
      'SLA + priority',
      'Auto-extraction',
      'Lifecycle management',
      'Observability + analytics',
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <section className="section container">
      <h1 style={{ fontSize: '2.6rem', marginBottom: '0.7rem' }}>Pricing</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: '1.4rem' }}>
        Start free. Upgrade as your agent workloads grow.
      </p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {tiers.map((tier) => (
          <article key={tier.name} className="card" style={{ display: 'grid', gap: '0.9rem' }}>
            <div>
              <h2 style={{ marginBottom: '0.35rem' }}>{tier.name}</h2>
              <p style={{ margin: 0, color: '#c7d2e8', fontWeight: 700 }}>{tier.price}</p>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#c7d2e8', lineHeight: 1.6 }}>
              {tier.features.map((feature) => (
                <li key={`${tier.name}-${feature}`}>{feature}</li>
              ))}
            </ul>
            <Link
              href={tier.ctaHref}
              className={`btn ${tier.name === 'Free' ? 'btn-primary' : ''}`}
              style={{ textAlign: 'center' }}
            >
              {tier.ctaLabel}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
