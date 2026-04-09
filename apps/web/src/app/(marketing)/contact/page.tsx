'use client';

import { useState } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Something went wrong.');
      setState('success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setState('error');
    }
  }

  return (
    <section className="section container" style={{ maxWidth: '600px' }}>
      <h1 style={{ marginBottom: '0.4rem' }}>Contact</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: '2rem' }}>
        Questions, feedback, or support? We read everything.
      </p>

      {state === 'success' ? (
        <div
          className="panel"
          style={{
            borderColor: '#22c55e',
            background: 'rgba(34,197,94,0.05)',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>✓ Message sent</p>
          <p className="muted" style={{ margin: 0 }}>
            We'll get back to you at {email}.
          </p>
          <button className="btn" style={{ marginTop: '1.25rem' }} onClick={() => setState('idle')}>
            Send another
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="name"
              className="muted"
              style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}
            >
              Name *
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="muted"
              style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}
            >
              Email *
            </label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="subject"
              className="muted"
              style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}
            >
              Subject
            </label>
            <input
              id="subject"
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Question about pricing"
            />
          </div>
          <div>
            <label
              htmlFor="message"
              className="muted"
              style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}
            >
              Message *
            </label>
            <textarea
              id="message"
              className="input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="How can we help?"
              rows={5}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {state === 'error' && <p style={{ color: '#fca5a5', margin: 0, fontSize: '0.875rem' }}>{errorMsg}</p>}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={state === 'submitting'}
            style={{ alignSelf: 'flex-start' }}
          >
            {state === 'submitting' ? 'Sending...' : 'Send message'}
          </button>
        </form>
      )}
    </section>
  );
}
