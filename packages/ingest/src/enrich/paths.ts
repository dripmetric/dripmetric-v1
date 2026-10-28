import { AD_CLICK_PARAMS, CAMPAIGN_PARAMS, type ScreenBucket } from '@dripmetric/catalog';

/**
 * Path normalisation and campaign extraction (brief Appendix A, section A).
 *
 * The browser SDK normalises before sending, but a server call or a Segment feed may
 * not have, so ingest normalises again. Doing it twice is harmless; doing it never
 * would give the `paths` dictionary a row per customer id.
 */

/** Segments that look like an id, replaced with `:id`. */
const NUMERIC = /^\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_TOKEN = /^[A-Za-z0-9_-]{21,}$/;
const HEX_ID = /^[0-9a-f]{16,}$/i;
/** Mixed letters-and-digits ids like `inv_8sKd21` or `cus_Nf8x`. */
const PREFIXED_ID = /^[a-z]{2,8}_[A-Za-z0-9]{6,}$/;

export function normalisePathSegment(segment: string): string {
  if (segment.length === 0) return segment;
  if (NUMERIC.test(segment)) return ':id';
  if (UUID.test(segment)) return ':id';
  if (HEX_ID.test(segment)) return ':id';
  if (PREFIXED_ID.test(segment)) return ':id';
  if (LONG_TOKEN.test(segment)) return ':id';
  return segment;
}

export interface NormalisedPath {
  path: string;
  /** Campaign tags only. Every other query parameter is dropped (brief section 10). */
  campaign: Partial<Record<(typeof CAMPAIGN_PARAMS)[number], string>>;
  paidClick: boolean;
  paidNetwork: string | null;
}

/**
 * Normalises a path or full URL:
 *   - ids become `:id`
 *   - the query string is dropped except campaign tags
 *   - the fragment is dropped, except a hash route (`#/something`), which is kept
 *   - an ad-click id becomes "paid click: yes, and the network"; the id is discarded
 */
export function normalisePath(input: string): NormalisedPath {
  let pathname = input;
  let search = '';
  let hash = '';

  try {
    // A relative path needs a base; the base is thrown away straight after.
    const url = new URL(input, 'https://x.invalid');
    pathname = url.pathname;
    search = url.search;
    hash = url.hash;
  } catch {
    const q = input.indexOf('?');
    const h = input.indexOf('#');
    if (q >= 0) {
      pathname = input.slice(0, q);
      search = h > q ? input.slice(q, h) : input.slice(q);
      hash = h > q ? input.slice(h) : '';
    } else if (h >= 0) {
      pathname = input.slice(0, h);
      hash = input.slice(h);
    }
  }

  const segments = pathname.split('/').map(normalisePathSegment);
  let path = segments.join('/') || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  // Fragments are dropped except hash routes, which ARE the path in a hash-router app.
  if (hash.startsWith('#/')) {
    path += '#' + hash.slice(2).split('/').map(normalisePathSegment).join('/');
  }

  const params = new URLSearchParams(search);
  const campaign: NormalisedPath['campaign'] = {};
  for (const key of CAMPAIGN_PARAMS) {
    const value = params.get(key);
    if (value) campaign[key] = value.slice(0, 256);
  }

  let paidClick = false;
  let paidNetwork: string | null = null;
  for (const [param, network] of Object.entries(AD_CLICK_PARAMS)) {
    if (!params.has(param)) continue;
    // fbclid only counts as a paid click alongside a paid utm_medium: Facebook adds
    // it to organic links too.
    if (param === 'fbclid' && !/cpc|ppc|paid/i.test(campaign.utm_medium ?? '')) continue;
    paidClick = true;
    paidNetwork = network;
    break;
  }

  return { path: path.slice(0, 1024), campaign, paidClick, paidNetwork };
}

/** The referrer, reduced to a domain. We never store a full referrer URL. */
export function referrerDomain(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').slice(0, 255) || null;
  } catch {
    return null;
  }
}

/** Three buckets, never exact pixels (brief section 10). */
export function screenBucket(width: number | undefined): ScreenBucket | null {
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return null;
  if (width < 768) return 'small';
  if (width < 1280) return 'medium';
  return 'large';
}
