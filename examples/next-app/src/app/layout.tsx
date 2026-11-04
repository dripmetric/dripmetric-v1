import type { ReactNode } from 'react';
import { Analytics } from './analytics';

export const metadata = { title: 'Ledgerly', description: 'An example app using Dripmetric.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          font: '16px/1.6 system-ui, sans-serif',
          maxWidth: '40rem',
          margin: '3rem auto',
          padding: '0 1rem',
        }}
      >
        {/* The browser half: page views, time on page, sessions. */}
        <Analytics />
        {children}
      </body>
    </html>
  );
}
