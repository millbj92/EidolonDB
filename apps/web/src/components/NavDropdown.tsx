'use client';

import Link from 'next/link';
import { useState, useRef, useCallback } from 'react';

export function NavDropdown() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, [cancelClose]);

  const handleOpen = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  return (
    <div className="nav-dropdown">
      <span
        className="nav-dropdown-trigger"
        onMouseEnter={handleOpen}
        onMouseLeave={scheduleClose}
      >
        Products ▾
      </span>
      {open && (
        <div
          className="nav-dropdown-menu"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
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
