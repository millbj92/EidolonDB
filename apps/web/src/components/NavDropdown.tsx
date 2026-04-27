'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';

export function NavDropdown() {
  const [open, setOpen] = useState(false);

  const handleMouseEnter = useCallback(() => setOpen(true), []);
  const handleMouseLeave = useCallback(() => setOpen(false), []);

  return (
    <div
      className="nav-dropdown"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="nav-dropdown-trigger" aria-haspopup="true" aria-expanded={open}>
        Products ▾
      </span>
      <div className="nav-dropdown-menu" aria-hidden={!open} style={{ pointerEvents: open ? 'auto' : 'none', opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden' }}>
        <Link href="/eidolondb" className="nav-dropdown-item" onClick={() => setOpen(false)}>
          EidolonDB
        </Link>
        <Link href="/capabilities" className="nav-dropdown-item" onClick={() => setOpen(false)}>
          Capabilities
        </Link>
      </div>
    </div>
  );
}
