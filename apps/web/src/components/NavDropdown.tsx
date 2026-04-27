'use client';

import Link from 'next/link';
import { useState, useRef, useCallback } from 'react';

export function NavDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    // Only close if the mouse is truly leaving the entire dropdown wrapper
    const related = e.relatedTarget as Node | null;
    if (ref.current && related && ref.current.contains(related)) return;
    setOpen(false);
  }, []);

  return (
    <div
      ref={ref}
      className="nav-dropdown"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={handleMouseLeave}
    >
      <span className="nav-dropdown-trigger">Products ▾</span>
      <div
        className="nav-dropdown-menu"
        style={{
          visibility: open ? 'visible' : 'hidden',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
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
