import { describe, expect, it } from 'vitest';
import { campaignFrom, normalisePath, referrerDomain } from '../browser/paths.js';

/**
 * Path normalisation happens in the BROWSER, before anything is sent
 * (brief section 6).
 *
 * Two reasons it cannot wait for the server: the `paths` dictionary would get a row
 * per customer id, and a URL carrying a password-reset token or an email address
 * would leave the device at all.
 */
describe('path normalisation', () => {
  it('replaces every shape of id with :id', () => {
    expect(normalisePath('/invoices/90210/edit', '')).toBe('/invoices/:id/edit');
    expect(normalisePath('/u/550e8400-e29b-41d4-a716-446655440000', '')).toBe('/u/:id');
    expect(normalisePath('/c/cus_Nf8xKd92La', '')).toBe('/c/:id');
    expect(normalisePath('/t/a3f91c2b8e7d4061', '')).toBe('/t/:id');
  });

  it('leaves real path segments alone', () => {
    expect(normalisePath('/settings/billing', '')).toBe('/settings/billing');
    expect(normalisePath('/pricing', '')).toBe('/pricing');
    expect(normalisePath('/', '')).toBe('/');
  });

  it('drops a trailing slash so one page is not two rows', () => {
    expect(normalisePath('/pricing/', '')).toBe('/pricing');
  });

  it('drops a fragment but keeps a hash route, which IS the path', () => {
    expect(normalisePath('/docs', '#section-two')).toBe('/docs');
    expect(normalisePath('/app', '#/projects/4821/settings')).toBe('/app#projects/:id/settings');
  });

  it('keeps campaign tags and nothing else from the query string', () => {
    const campaign = campaignFrom(
      '?utm_source=twitter&utm_medium=social&email=a@b.com&token=secret',
    );
    expect(campaign).toEqual({ source: 'twitter', medium: 'social' });
    // The email and the token are not in the result at all.
    expect(JSON.stringify(campaign)).not.toContain('a@b.com');
    expect(JSON.stringify(campaign)).not.toContain('secret');
  });

  it('reduces a referrer to a domain, never the full URL', () => {
    // A search URL carries the visitor's search terms, which we never collect.
    expect(referrerDomain('https://www.google.com/search?q=private+terms')).toBe('google.com');
    expect(referrerDomain('https://news.ycombinator.com/item?id=1')).toBe('news.ycombinator.com');
    expect(referrerDomain('')).toBeUndefined();
    expect(referrerDomain('not a url')).toBeUndefined();
  });
});
