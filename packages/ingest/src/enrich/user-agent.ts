import type { DeviceType } from '@dripmetric/catalog';

/**
 * A small user-agent parser.
 *
 * We do NOT use `ua-parser-js`: version 2.x is AGPL-3.0-or-later, which cannot ship
 * in the web app (CLAUDE.md rule 8, docs/decisions.md). We only need three facts, and
 * the low-entropy client hints give them to us directly whenever the browser sends
 * them — the user-agent string is the fallback.
 *
 * Deliberately NOT done here: canvas, font or high-entropy client-hint
 * fingerprinting, or anything beyond these three fields (brief section 10).
 */

export interface UserAgentFacts {
  deviceType: DeviceType;
  os: string | null;
  browser: string | null;
  browserMajor: string | null;
}

/** Low-entropy client hints, as the browser sends them. Preferred over the string. */
export interface ClientHints {
  mobile?: boolean | undefined;
  platform?: string | undefined;
  brands?: readonly { brand: string; version: string }[] | undefined;
}

const BOT_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /headless/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /lighthouse/i,
  /pingdom/i,
  /uptimerobot/i,
  /semrush/i,
  /ahrefs/i,
  /facebookexternalhit/i,
  /applebot/i,
  /bingpreview/i,
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /go-http-client/i,
  /okhttp/i,
  /axios\//i,
  /node-fetch/i,
];

/** Known crawler user agents, dropped at ingest (brief section 5, step 4). */
export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

/**
 * Whose user agent describes the VISITOR.
 *
 * The message's own `context.userAgent` wins over the request header, and the
 * difference is not cosmetic. A browser sending its own events supplies the same
 * string in both places. But a server-side batch, or a Segment or RudderStack feed,
 * carries ONE HTTP user agent — the forwarding server's — and a per-message context
 * describing each real visitor. Preferring the header there meant every forwarded
 * batch evaded the bot filter, because the header was some server's and never
 * matched a crawler pattern. The simulator caught it: Node's fetch sends
 * `user-agent: node`, so not one crawler in a 300-person run was dropped.
 */
export function visitorUserAgent(
  messageUserAgent: string | undefined,
  requestUserAgent: string | undefined,
): string | undefined {
  return messageUserAgent ?? requestUserAgent;
}

// Order matters: a browser's string often also matches a more generic one, so the
// more specific engine has to be tried first.
const BROWSERS: readonly [name: string, pattern: RegExp][] = [
  ['Edge', /\bEdg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /\bOPR\/(\d+)/],
  ['Samsung Internet', /\bSamsungBrowser\/(\d+)/],
  ['Firefox', /\bFirefox\/(\d+)/],
  ['Chrome', /\bChrome\/(\d+)/],
  // Safari reports its version separately from the WebKit build number.
  ['Safari', /\bVersion\/(\d+).*\bSafari\//],
];

const PLATFORMS: readonly [name: string, pattern: RegExp][] = [
  ['iOS', /\b(?:iPhone|iPad|iPod)\b/],
  ['Android', /\bAndroid\b/],
  ['macOS', /\bMac OS X\b|\bMacintosh\b/],
  ['Windows', /\bWindows NT\b/],
  ['Chrome OS', /\bCrOS\b/],
  ['Linux', /\bLinux\b/],
];

/** The three facts, from hints where available and from the string otherwise. */
export function parseUserAgent(
  userAgent: string | undefined,
  hints: ClientHints | undefined,
): UserAgentFacts {
  const ua = userAgent ?? '';

  let browser: string | null = null;
  let browserMajor: string | null = null;
  for (const [name, pattern] of BROWSERS) {
    const match = pattern.exec(ua);
    if (match) {
      browser = name;
      browserMajor = match[1] ?? null;
      break;
    }
  }

  // A brand list is more reliable than the string, which browsers deliberately freeze.
  if (hints?.brands) {
    const real = hints.brands.find(
      (b) => !/not.?a.?brand/i.test(b.brand) && !/^Chromium$/i.test(b.brand),
    );
    if (real) {
      browser = real.brand;
      browserMajor = real.version.split('.')[0] ?? null;
    }
  }

  let os: string | null = hints?.platform ?? null;
  if (!os) {
    for (const [name, pattern] of PLATFORMS) {
      if (pattern.test(ua)) {
        os = name;
        break;
      }
    }
  }

  return { deviceType: deviceTypeOf(ua, hints), os, browser, browserMajor };
}

function deviceTypeOf(ua: string, hints: ClientHints | undefined): DeviceType {
  // A tablet is not "mobile" to the hint, so the string still decides that one.
  if (/\biPad\b/.test(ua) || (/\bAndroid\b/.test(ua) && !/\bMobile\b/.test(ua))) return 'tablet';
  if (/\bTablet\b/i.test(ua)) return 'tablet';
  if (hints?.mobile === true) return 'mobile';
  if (hints?.mobile === false) return 'desktop';
  if (/\bMobi|iPhone|iPod|Android\b/i.test(ua)) return 'mobile';
  return 'desktop';
}
