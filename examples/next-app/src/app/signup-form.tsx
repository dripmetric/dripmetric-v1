'use client';

import { useState } from 'react';
import * as dripmetric from 'dripmetric/browser';

export function SignupForm() {
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((previous) => [...previous, line]);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { sent?: string[] };
    note(`${path} → ${result.sent?.join(', ') ?? 'ok'}`);
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
      <button
        onClick={() => {
          // The browser half identifies; the server half sends Signed Up.
          dripmetric.identify('user_example_1', {
            email: 'sam@acme.com',
            createdAt: new Date().toISOString(),
          });
          void post('/api/signup', { userId: 'user_example_1', email: 'sam@acme.com' });
        }}
      >
        Sign up and activate
      </button>{' '}
      <button onClick={() => void post('/api/checkout', { userId: 'user_example_1' })}>
        Start checkout
      </button>
      <pre style={{ fontSize: '.85rem', whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
    </div>
  );
}
