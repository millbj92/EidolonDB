'use client';

import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

export function NavAuth() {
  return (
    <>
      <SignedOut>
        <Link href="/sign-in">Sign in</Link>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard" style={{ fontWeight: 500 }}>
          Dashboard
        </Link>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
