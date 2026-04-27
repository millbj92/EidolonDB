'use client';

import Link from 'next/link';
import { useState } from 'react';

type PricingTab = 'eidolondb' | 'capabilities' | 'suite';

type Tier = {
  name: string;
  price: string;
  sub: string;
  highlight?: boolean;
  ctaHref: string;
  ctaLabel: string;
  features: string[];
};

const tiersByTab: Record<PricingTab, { subtitle: string; tiers: Tier[] }> = {
  eidolondb: {
    subtitle: 'Priced per memory operation - ingest, read, write, query, all count the same.',
    tiers: [
      {
        name: 'Free',
        price: '$0',
        sub: 'Self-hosted, forever.',
        ctaHref: '/sign-up',
        ctaLabel: 'Self-host free',
        features: ['10,000 memory ops/month', '1 API key', 'All core features', 'Community support'],
      },
      {
        name: 'Developer',
        price: '$19/mo',
        sub: 'For builders experimenting and integrating.',
        highlight: true,
        ctaHref: '/sign-up?plan=developer',
        ctaLabel: 'Start building',
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
        price: '$99/mo',
        sub: 'For production agents with real workloads.',
        ctaHref: '/sign-up?plan=growth',
        ctaLabel: 'Scale up',
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
        price: 'Custom',
        sub: 'High-throughput agents & reliability-critical systems.',
        ctaHref: '/contact',
        ctaLabel: 'Contact us',
        features: [
          'Unlimited memory ops',
          'Unlimited API keys',
          'Everything in Growth',
          'Internal copilots & agents',
          'Dedicated support & SLA',
          'Custom contracts',
        ],
      },
    ],
  },
  capabilities: {
    subtitle: 'Cloud approvals, auditability, and secrets metadata for production-safe capability execution.',
    tiers: [
      {
        name: 'Free (self-hosted)',
        price: '$0',
        sub: 'Open-source runtime and APIs.',
        ctaHref: 'https://github.com/millbj92/EidolonCapabilities',
        ctaLabel: 'Self-host free',
        features: [
          'Full engine, Apache 2.0',
          'All features self-hosted',
          'CLI + API',
          'Community support',
        ],
      },
      {
        name: 'Developer Cloud',
        price: '$39/mo',
        sub: 'Hosted control plane for solo builders.',
        ctaHref: '/sign-up?plan=capabilities-developer',
        ctaLabel: 'Start building',
        features: [
          'Hosted audit dashboard',
          '30-day audit log retention',
          'Managed secrets (encrypted, hosted)',
          'Hosted approvals UI',
          '1 project',
          '10k plans + 2k applies/mo',
          '$2 per 1k additional applies',
        ],
      },
      {
        name: 'Team',
        price: '$149/mo',
        sub: 'Collaborative workflows with approvals and governance.',
        highlight: true,
        ctaHref: '/sign-up?plan=capabilities-team',
        ctaLabel: 'Get started',
        features: [
          'Everything in Developer',
          'Team workspaces + RBAC',
          'Slack/email approval notifications',
          '90-day audit retention + compliance exports',
          '3 projects/environments',
          '50k plans + 10k applies/mo',
          '$1 per 1k additional applies',
        ],
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        sub: 'Managed controls for high-assurance environments.',
        ctaHref: '/contact',
        ctaLabel: 'Contact us',
        features: [
          'Everything in Team',
          'SSO/SAML',
          'VPC/on-prem deployment',
          'EidolonDB memory-aware policy (managed cloud stack)',
          'Behavioral anomaly detection',
          'Custom secret providers (AWS KMS, Vault)',
          'Dedicated support + SLA',
          'Unlimited usage',
        ],
      },
    ],
  },
  suite: {
    subtitle: 'Bundle EidolonDB + Capabilities together for lower total cost and unified operations.',
    tiers: [
      {
        name: 'Suite Starter',
        price: '$49/mo',
        sub: 'Launch both products with one plan.',
        ctaHref: '/sign-up?plan=suite-starter',
        ctaLabel: 'Get Suite Starter',
        features: [
          'EidolonDB Developer ($19 value)',
          'Capabilities Developer ($39 value)',
          'Save $9/mo vs buying separately',
        ],
      },
      {
        name: 'Suite Pro',
        price: '$199/mo',
        sub: 'Production tier for teams running both stacks.',
        highlight: true,
        ctaHref: '/sign-up?plan=suite-pro',
        ctaLabel: 'Get Suite Pro',
        features: [
          'EidolonDB Growth ($99 value)',
          'Capabilities Team ($149 value)',
          'Save $49/mo vs buying separately',
        ],
      },
      {
        name: 'Suite Enterprise',
        price: 'Custom',
        sub: 'Advanced control and deployment flexibility.',
        ctaHref: '/contact',
        ctaLabel: 'Contact us',
        features: [
          'EidolonDB Enterprise',
          'Capabilities Enterprise',
          'Memory-aware policy + managed stack',
        ],
      },
    ],
  },
};

const tabs: Array<{ key: PricingTab; label: string }> = [
  { key: 'eidolondb', label: 'EidolonDB' },
  { key: 'capabilities', label: 'Capabilities' },
  { key: 'suite', label: 'Suite' },
];

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<PricingTab>('eidolondb');
  const content = tiersByTab[activeTab];

  return (
    <section className="section container">
      <h1 style={{ fontSize: '2.6rem', marginBottom: '0.7rem' }}>Pricing</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: '2rem', fontSize: '0.9rem' }}>
        Start free. Upgrade as your workload, approvals, and environments grow.
      </p>

      <div className="pricing-tabs" role="tablist" aria-label="Pricing products">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`pricing-tab${activeTab === tab.key ? ' active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 0, marginBottom: '2rem' }}>{content.subtitle}</p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
        {content.tiers.map((tier) => (
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
              <h2 style={{ marginBottom: '0.2rem' }}>{tier.name}</h2>
              <p style={{ margin: '0 0 0.2rem', color: '#e2e8f0', fontWeight: 700, fontSize: '1.4rem' }}>
                {tier.price}
              </p>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.4 }}>{tier.sub}</p>
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
              target={tier.ctaHref.startsWith('http') ? '_blank' : undefined}
              rel={tier.ctaHref.startsWith('http') ? 'noreferrer' : undefined}
            >
              {tier.ctaLabel}
            </Link>
          </article>
        ))}
      </div>

      <p className="muted" style={{ marginTop: '2rem', fontSize: '0.82rem', textAlign: 'center' }}>
        Billing and plan limits are enforced per-tenant. Contact us for custom contracts and deployment support.
      </p>
    </section>
  );
}
