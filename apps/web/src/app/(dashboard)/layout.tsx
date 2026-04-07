import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/api-keys', label: 'API keys' },
  { href: '/memories', label: 'Memories' },
  { href: '/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            EidolonDB Cloud
          </Link>
          <div className="row">
            <Link className="btn" href="/docs">
              Docs
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <section className="dashboard-shell">
        <aside className="sidebar">
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Dashboard
          </div>
          <nav className="sidebar-links">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="sidebar-link">
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="dashboard-main">{children}</div>
      </section>
    </>
  );
}
