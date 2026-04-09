import Link from 'next/link';
import { NavAuth } from '@/components/NavAuth';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            EidolonDB
          </Link>
          <nav className="nav">
            <Link href="/#features">Features</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/#evals">Evals</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">Docs</Link>
            <NavAuth />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="container footer-inner">
          <p>EidolonDB - MIT License</p>
          <div className="footer-links">
            <a href="/docs">Docs</a>
            <a href="https://github.com/eidolondb/eidolondb" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="/self-hosting">Self-hosting</a>
          </div>
        </div>
      </footer>
    </>
  );
}
