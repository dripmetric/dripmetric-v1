'use client';

import { useEffect } from 'react';
import * as dripmetric from 'dripmetric/browser';

/**
 * The browser half, mounted once in the layout.
 *
 * Two things worth copying: `init` runs in an effect so it only ever runs in the
 * browser, and consent is granted explicitly. In a real app that second call would
 * be wired to your cookie banner, not to a timer — until it happens, the library
 * stores nothing on the device and sends nothing.
 */
export function Analytics() {
  useEffect(() => {
    dripmetric.init(process.env['NEXT_PUBLIC_DRIPMETRIC_KEY'] ?? 'pk_test_example', {
      host: process.env['NEXT_PUBLIC_DRIPMETRIC_HOST'] ?? 'http://localhost:3000',
      marketingHosts: ['localhost'],
      debug: true,
    });

    // Stand-in for a cookie banner's "accept".
    dripmetric.consent(true);

    return () => dripmetric.stop();
  }, []);

  return null;
}
