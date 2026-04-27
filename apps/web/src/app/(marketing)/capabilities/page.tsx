'use client';

import Link from 'next/link';
import { useState } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const features = [
  {
    title: 'Policy engine',
    body: 'Actor allowlists, resource rules, rate limits, and risk scoring for every action.',
  },
  {
    title: 'Secret vault',
    body: 'Encrypted storage with env/local/AWS/Vault providers and rotation alerts.',
  },
  {
    title: 'Approval workflow',
    body: 'Human-in-the-loop approvals with Slack/Discord notifications and full audit trail.',
  },
  {
    title: 'MCP executor',
    body: 'A policy and audit layer for MCP tool calls before anything executes.',
  },
  {
    title: 'Capability packages',
    body: 'Versioned, signed packages like @eidolon/github and @eidolon/slack.',
  },
  {
    title: 'EidolonDB integration',
    body: 'Memory-aware policy, the moat that checks actions against what your system knows.',
  },
] as const;

export default function CapabilitiesPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  async function joinWaitlist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('submitting');
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, type: 'capabilities-waitlist' }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'Failed to submit waitlist request.');

      setState('success');
      setEmail('');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to submit waitlist request.');
    }
  }

  return (
    <>
      <section className="hero container">
        <p className="eyebrow">Agent permission control</p>
        <h1>Terraform for AI agent permissions</h1>
        <p className="lead">Define what your agents can do. Enforce it. Require approvals. Audit everything.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/sign-up">
            Get started free
          </Link>
          <Link className="btn" href="/docs/capabilities/quickstart">
            View docs
          </Link>
          <a className="btn" href="https://github.com/millbj92/EidolonCapabilities" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <p className="sub">Open source. Self-hostable. Apache 2.0.</p>
      </section>

      <section className="section container" id="problem">
        <h2>The problem with agent tool access</h2>
        <div className="problem-list">
          <p>Agents get raw API keys with no scoping or audit trail.</p>
          <p>Nothing stops an agent from taking dangerous production actions.</p>
          <p>When something goes wrong, you have no record of what happened or why.</p>
        </div>
      </section>

      <section className="section container" id="how">
        <h2>How it works</h2>
        <div className="steps">
          <article className="step">
            <span>Step 1</span>
            <h3>Define</h3>
            <p>Write a capability YAML. Declare inputs, executor, policy rules.</p>
          </article>
          <article className="step">
            <span>Step 2</span>
            <h3>Enforce</h3>
            <p>Every action goes through plan -&gt; policy check -&gt; apply. Nothing bypasses it.</p>
          </article>
          <article className="step">
            <span>Step 3</span>
            <h3>Audit</h3>
            <p>Full trace of every decision, policy check, risk score, and outcome.</p>
          </article>
        </div>
        <pre className="code-block" style={{ marginTop: '1rem' }}>
          <code>{`apiVersion: eidolon.dev/v1
kind: Capability
metadata:
  name: github.issue.create
spec:
  policy:
    allowedActors: [agent:dev]
    rules:
      - effect: require_approval
        when:
          environment: prod`}</code>
        </pre>
      </section>

      <section className="section container" id="memory-policy">
        <h2>Policy that knows what you already know</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Connect EidolonDB and Capabilities. Your agents can&apos;t take actions that contradict what you&apos;ve already told
          them.
        </p>
        <pre className="code-block">
          <code>{`Blocked pending approval.

Reason:
- Action references production environment.
- Project memory: deploy freeze active until Monday (confidence: 0.94).
- Policy: no-production-without-approval fired.
- GitHub token was not exposed.

To approve: eidolon approvals approve appr_xyz`}</code>
        </pre>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Memory-aware policy. The only system that checks &quot;should this agent be doing this?&quot; against what you actually
          know.
        </p>
      </section>

      <section className="section container" id="features">
        <h2>Features</h2>
        <div className="grid">
          {features.map((feature) => (
            <article className="card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container" id="pricing">
        <h2>Pricing</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Price</th>
                <th>For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Self-hosted</td>
                <td className="good">Free</td>
                <td>Full engine, Apache 2.0, runs on your machine.</td>
              </tr>
              <tr>
                <td>Developer Cloud</td>
                <td>$29-49/mo</td>
                <td>Hosted audit, managed secrets, approvals UI.</td>
              </tr>
              <tr>
                <td>Team</td>
                <td>$99-299/mo</td>
                <td>RBAC, Slack approvals, compliance exports.</td>
              </tr>
              <tr>
                <td>Enterprise</td>
                <td>$1k-10k+/mo</td>
                <td>SSO, VPC, managed stack + SLA.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          If it runs on your machine, it&apos;s free. Forever.
        </p>
      </section>

      <section className="section container cta" id="waitlist">
        <h2>Join the waitlist for Eidolon Cloud</h2>
        <form className="row" onSubmit={joinWaitlist} style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
            <label
              htmlFor="waitlist-email"
              className="muted"
              style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}
            >
              Email
            </label>
            <input
              id="waitlist-email"
              className="input"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Submitting...' : 'Join waitlist'}
          </button>
          <a className="btn" href="https://github.com/millbj92/EidolonCapabilities" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </form>
        {state === 'success' ? <p style={{ color: 'var(--good)', marginTop: '0.75rem' }}>You are on the list.</p> : null}
        {state === 'error' ? <p style={{ color: '#fca5a5', marginTop: '0.75rem' }}>{error}</p> : null}
      </section>
    </>
  );
}
