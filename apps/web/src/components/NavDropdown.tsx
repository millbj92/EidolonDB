'use client';

import Link from 'next/link';
import { useState } from 'react';

export function NavDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="nav-dropdown"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="nav-dropdown-trigger">Products ▾</span>
      {open && (
        <div className="nav-dropdown-menu">
          <Link href="/eidolondb" className="nav-dropdown-item" onClick={() => setOpen(false)}>
            EidolonDB
          </Link>
          <Link href="/capabilities" className="nav-dropdown-item" onClick={() => setOpen(false)}>
            Capabilities
          </Link>
        </div>
      )}
    </div>
  );
}
