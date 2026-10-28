import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { closePools } from '@dripmetric/db';
import { MESSAGE_RESULT_CODES } from '@dripmetric/catalog';
import {
  ensureMigrated,
  newFixture,
  postBatch,
  postRaw,
  reply,
  resetData,
  type Fixture,
} from './helpers.js';

/**
 * OpenAPI conformance (brief section 5: "test the implementation against it in CI").
 *
 * The point is not to validate YAML — it is to catch the spec and the code drifting
 * apart, because a founder generating a client from the spec has no other way to
 * find out. So this checks the things a generated client would actually rely on:
 * the paths, the security schemes, the result codes and the real status codes.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(here, '..', '..', '..', '..', 'docs', 'openapi.yaml');

interface Spec {
  openapi: string;
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
  components: {
    securitySchemes: Record<string, { type: string; scheme: string }>;
    schemas: Record<string, unknown>;
  };
}

describe('OpenAPI spec', () => {
  let spec: Spec;
  let fx: Fixture;

  beforeAll(async () => {
    spec = parse(await readFile(SPEC_PATH, 'utf8')) as Spec;
    await ensureMigrated();
  });
  beforeEach(async () => {
    await resetData();
    fx = await newFixture();
  });
  afterAll(closePools);

  it('is valid OpenAPI 3.1 with the endpoints we actually serve', () => {
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(Object.keys(spec.paths).sort()).toEqual(['/v1/batch', '/v1/import']);
    expect(spec.paths['/v1/batch']?.['post']).toBeDefined();
    expect(spec.paths['/v1/import']?.['post']).toBeDefined();
  });

  it('documents all three ways a key may be sent', () => {
    // Bearer, Basic (Segment's libraries) and in the body (`sendBeacon`). The third
    // is the empty security requirement plus the `writeKey` field.
    expect(spec.components.securitySchemes['bearerAuth']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(spec.components.securitySchemes['basicAuth']).toMatchObject({
      type: 'http',
      scheme: 'basic',
    });
    expect(spec.components.schemas['Batch']).toHaveProperty('properties.writeKey');
  });

  it('lists every result code the implementation can return', () => {
    const schema = spec.components.schemas['MessageResult'] as {
      properties: { code: { enum: string[] } };
    };
    // If a new code is added in the catalog without being documented, a generated
    // client would reject the response it gets.
    expect([...schema.properties.code.enum].sort()).toEqual([...MESSAGE_RESULT_CODES].sort());
  });

  it('accepts both text/plain and application/json bodies, as the spec promises', () => {
    const content = (
      spec.paths['/v1/batch']?.['post'] as unknown as {
        requestBody: { content: Record<string, unknown> };
      }
    ).requestBody.content;
    expect(Object.keys(content).sort()).toEqual(['application/json', 'text/plain']);
  });

  it('returns each documented status code for the condition that documents it', async () => {
    const documented = Object.keys(spec.paths['/v1/batch']?.['post']?.responses ?? {});
    expect(documented.sort()).toEqual(['200', '400', '401', '413', '429']);

    // 200
    expect((await postBatch([], { key: fx.secretKey })).status).toBe(200);
    // 400
    expect((await postRaw('{', { key: fx.secretKey })).status).toBe(400);
    // 401
    expect((await postBatch([], {})).status).toBe(401);
    // 413
    expect(
      (await postRaw(JSON.stringify({ batch: [] }) + 'x'.repeat(600_000), { key: fx.secretKey }))
        .status,
    ).toBe(413);
    // 429 is covered in batch.test.ts, where the bucket is drained deliberately.
  });

  it('replies in the documented shape', async () => {
    const response = await postBatch(
      [{ type: 'track', messageId: 'shape-1', userId: 'u1', event: 'Signed Up' }],
      { key: fx.secretKey },
    );
    const body = reply(response);

    expect(body).toHaveProperty('accepted');
    expect(body).toHaveProperty('results');
    expect(typeof body.accepted).toBe('number');
    const first = body.results[0];
    expect(Object.keys(first ?? {}).sort()).toEqual(['code', 'messageId', 'status']);
    expect(['ok', 'duplicate', 'error', 'filtered']).toContain(first?.status);
  });

  it('documents a 429 with the Retry-After header a client must obey', () => {
    const response = spec.paths['/v1/batch']?.['post']?.responses?.['429'] as {
      headers: Record<string, unknown>;
    };
    expect(response.headers).toHaveProperty('Retry-After');
  });
});
