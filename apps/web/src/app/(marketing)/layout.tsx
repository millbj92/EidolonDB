import Link from 'next/link';
import { NavAuth } from '@/components/NavAuth';
import { NavDropdown } from '@/components/NavDropdown';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            Eidolon
          </Link>
          <nav className="nav">
            <NavDropdown />
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs/getting-started/introduction">Docs</Link>
            <Link href="/contact">Contact</Link>
            <NavAuth />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="container footer-inner">
          <p>Eidolon · The control plane for reliable AI agents.</p>
          <div className="footer-links">
            <a href="/eidolondb">EidolonDB</a>
            <a href="/capabilities">Capabilities</a>
            <a href="/docs/getting-started/introduction">Docs</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact">Contact</a>
            <a href="https://github.com/millbj92/EidolonCapabilities" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
