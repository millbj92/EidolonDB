'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';

export function NavDropdown() {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeout.current) clearTimeout(timeout.current);
    setOpen(true);
  };

  const hide = () => {
    timeout.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div className="nav-dropdown" onMouseEnter={show} onMouseLeave={hide}>
      <span className="nav-dropdown-trigger">Products ▾</span>
      {open && (
        <div className="nav-dropdown-menu">
          <div className="nav-dropdown-menu-inner">
            <Link href="/eidolondb" className="nav-dropdown-item" onClick={() => setOpen(false)}>
              EidolonDB
            </Link>
            <Link href="/capabilities" className="nav-dropdown-item" onClick={() => setOpen(false)}>
              Capabilities
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
