import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Dripmetric',
  description: 'See where revenue leaks between a first visit and a first payment.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
