import { describe, expect, it } from 'vitest';
import { isBot, parseUserAgent } from '../enrich/user-agent.js';
import {
  normalisePath,
  normalisePathSegment,
  referrerDomain,
  screenBucket,
} from '../enrich/paths.js';
import { classifyEmail, emailDomain, looksLikeEmail } from '../enrich/email.js';
import { messageHash } from '../validate.js';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/604.1';

describe('user agent (our own parser: ua-parser-js 2.x is AGPL)', () => {
  it('reads desktop Chrome', () => {
    expect(parseUserAgent(CHROME, undefined)).toEqual({
      deviceType: 'desktop',
      os: 'macOS',
      browser: 'Chrome',
      browserMajor: '131',
    });
  });

  it('reads Safari on an iPhone as mobile', () => {
    const facts = parseUserAgent(IPHONE_SAFARI, undefined);
    expect(facts.deviceType).toBe('mobile');
    expect(facts.browser).toBe('Safari');
    expect(facts.os).toBe('iOS');
  });

  it('calls an iPad a tablet, not a phone', () => {
    expect(parseUserAgent(IPAD, undefined).deviceType).toBe('tablet');
  });

  it('prefers the client hints over the string, because browsers freeze the string', () => {
    const facts = parseUserAgent(CHROME, {
      mobile: true,
      platform: 'Android',
      brands: [
        { brand: 'Not_A Brand', version: '8' },
        { brand: 'Chromium', version: '131' },
        { brand: 'Microsoft Edge', version: '131.0.2903.70' },
      ],
    });
    expect(facts).toEqual({
      deviceType: 'mobile',
      os: 'Android',
      browser: 'Microsoft Edge',
      browserMajor: '131',
    });
  });

  it('recognises crawlers and leaves real browsers alone', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('curl/8.4.0')).toBe(true);
    expect(isBot('HeadlessChrome/120.0.0.0')).toBe(true);
    expect(isBot(CHROME)).toBe(false);
    expect(isBot(undefined)).toBe(false);
  });
});

describe('path normalisation (brief Appendix A)', () => {
  it('replaces every shape of id with :id', () => {
    expect(normalisePathSegment('12345')).toBe(':id');
    expect(normalisePathSegment('550e8400-e29b-41d4-a716-446655440000')).toBe(':id');
    expect(normalisePathSegment('cus_Nf8xKd92La')).toBe(':id');
    expect(normalisePathSegment('a3f91c2b8e7d4061')).toBe(':id');
    expect(normalisePathSegment('settings')).toBe('settings');
    expect(normalisePathSegment('billing')).toBe('billing');
  });

  it('keeps campaign tags and drops everything else in the query string', () => {
    const result = normalisePath(
      '/pricing?utm_source=twitter&utm_medium=social&email=a@b.com&token=abc',
    );
    expect(result.path).toBe('/pricing');
    expect(result.campaign).toEqual({ utm_source: 'twitter', utm_medium: 'social' });
    // The email and the token are not anywhere in the result.
    expect(JSON.stringify(result)).not.toContain('a@b.com');
    expect(JSON.stringify(result)).not.toContain('abc');
  });

  it('records a paid click as yes-plus-network and throws the click id away', () => {
    const result = normalisePath('/?gclid=EAIaIQobChMI1234567890');
    expect(result.paidClick).toBe(true);
    expect(result.paidNetwork).toBe('google');
    expect(JSON.stringify(result)).not.toContain('EAIaIQ');
  });

  it('only counts fbclid as paid when the medium says so, since Facebook adds it to organic links', () => {
    expect(normalisePath('/?fbclid=abc123def456').paidClick).toBe(false);
    expect(normalisePath('/?fbclid=abc123def456&utm_medium=cpc').paidClick).toBe(true);
  });

  it('drops a fragment but keeps a hash route, which IS the path', () => {
    expect(normalisePath('/docs#section-two').path).toBe('/docs');
    expect(normalisePath('/app#/projects/4821/settings').path).toBe('/app#projects/:id/settings');
  });

  it('normalises ids inside a full URL too', () => {
    expect(normalisePath('https://acme.com/invoices/90210/edit').path).toBe('/invoices/:id/edit');
  });

  it('reduces a referrer to a domain and never keeps the full URL', () => {
    expect(referrerDomain('https://www.google.com/search?q=secret+terms')).toBe('google.com');
    expect(referrerDomain('https://news.ycombinator.com/item?id=1')).toBe('news.ycombinator.com');
    expect(referrerDomain(undefined)).toBeNull();
    expect(referrerDomain('not a url')).toBeNull();
  });

  it('buckets screen width instead of storing exact pixels', () => {
    expect(screenBucket(375)).toBe('small');
    expect(screenBucket(1024)).toBe('medium');
    expect(screenBucket(1920)).toBe('large');
    expect(screenBucket(undefined)).toBeNull();
  });
});

describe('email type (brief Appendix A, section B)', () => {
  it('tells work, free, education and disposable apart', () => {
    expect(classifyEmail('sam@acme.com')).toBe('work');
    expect(classifyEmail('sam@gmail.com')).toBe('free');
    expect(classifyEmail('sam@mit.edu')).toBe('education');
    expect(classifyEmail('sam@cam.ac.uk')).toBe('education');
    expect(classifyEmail('sam@mailinator.com')).toBe('disposable');
  });

  it('returns null rather than guessing on a malformed address', () => {
    expect(classifyEmail('not-an-email')).toBeNull();
    expect(emailDomain('nope')).toBeNull();
  });

  it('checks the shape without being strict enough to bounce real addresses', () => {
    expect(looksLikeEmail('sam+tag@acme.co.uk')).toBe(true);
    expect(looksLikeEmail('sam@acme')).toBe(false);
    expect(looksLikeEmail(42)).toBe(false);
  });
});

describe('dedupe key', () => {
  it('is a stable uuid for the same message id', () => {
    expect(messageHash('abc')).toBe(messageHash('abc'));
    expect(messageHash('abc')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(messageHash('abc')).not.toBe(messageHash('abd'));
  });
});
