import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { RootProvider } from 'fumadocs-ui/provider';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Eidolon — The control plane for reliable AI agents',
  description:
    'Eidolon is the control plane for reliable AI agents, with memory, permissions, and governance for production workflows.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'];

  return (
    <html lang="en">
      <body className={`${manrope.variable} ${jetbrains.variable}`}>
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <RootProvider>
          {publishableKey ? <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider> : children}
        </RootProvider>
      </body>
    </html>
  );
}
