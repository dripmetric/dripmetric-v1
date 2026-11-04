import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A tiny static server that also stands in for our ingest API.
 *
 * It exists so the tests can assert on exactly what left the browser: every
 * `/v1/batch` body is recorded, so "nothing was sent before consent" is a fact about
 * requests rather than a guess about internal state.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
};

export interface RecordedRequest {
  path: string;
  body: unknown;
  contentType: string | undefined;
  at: number;
}

export interface TestServer {
  url: string;
  requests: RecordedRequest[];
  /** Every message across every recorded batch, in arrival order. */
  messages: () => {
    type: string;
    event?: string;
    name?: string;
    properties?: Record<string, unknown>;
    timestamp: string;
  }[];
  /** Makes /v1/batch fail, to prove the page stays responsive anyway. */
  breakIngest: (broken: boolean) => void;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const requests: RecordedRequest[] = [];
  let broken = false;

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };

    if (request.method === 'OPTIONS') {
      response.writeHead(204, cors);
      response.end();
      return;
    }

    if (url.pathname === '/v1/batch' && request.method === 'POST') {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        let parsed: unknown = body;
        try {
          parsed = JSON.parse(body);
        } catch {
          // Keep the raw text: a malformed body is itself worth asserting on.
        }
        requests.push({
          path: url.pathname,
          body: parsed,
          contentType: request.headers['content-type'],
          at: Date.now(),
        });
        if (broken) {
          response.writeHead(500, cors);
          response.end('{}');
          return;
        }
        response.writeHead(200, { ...cors, 'content-type': 'application/json' });
        response.end(JSON.stringify({ results: [], accepted: 0 }));
      });
      return;
    }

    if (url.pathname === '/v1/settings') {
      requests.push({ path: url.pathname, body: null, contentType: undefined, at: Date.now() });
      response.writeHead(200, { ...cors, 'content-type': 'application/json' });
      // Every page is a key page here, so the lazy chunk loads and can be tested.
      response.end(JSON.stringify({ keyPages: ['*'], rulePaths: ['/pricing'] }));
      return;
    }

    // Static files. Anything unknown serves the app shell, so the SPA's own routes
    // resolve on a full reload too.
    void (async () => {
      const requested = url.pathname === '/' ? '/e2e/fixtures/app.html' : url.pathname;
      const path = join(root, normalize(requested).replace(/^(\.\.[/\\])+/, ''));
      try {
        const file = await readFile(path);
        response.writeHead(200, {
          'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
        });
        response.end(file);
      } catch {
        const shell = await readFile(join(root, 'e2e/fixtures/app.html'));
        response.writeHead(200, { 'content-type': TYPES['.html']! });
        response.end(shell);
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    messages: () =>
      requests
        .filter((r) => r.path === '/v1/batch')
        .flatMap((r) => (r.body as { batch?: unknown[] })?.batch ?? [])
        .map((m) => m as ReturnType<TestServer['messages']>[number]),
    breakIngest: (value: boolean) => {
      broken = value;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
