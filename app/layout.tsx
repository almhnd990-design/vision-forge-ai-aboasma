import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GhostOps AI — Autonomous Business Operations',
  description: 'Your autonomous AI operations and recovery agent for online business.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
