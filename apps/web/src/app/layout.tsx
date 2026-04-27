import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${manrope.variable} ${jetbrains.variable}`}>
          <div className="bg-orb orb-1" />
          <div className="bg-orb orb-2" />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
