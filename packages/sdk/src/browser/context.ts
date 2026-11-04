import { LIBRARY_NAME, LIBRARY_VERSION } from '../shared/constants.js';
import type { MessageContext } from '../shared/types.js';
import { campaignFrom, normalisePath, referrerDomain } from './paths.js';

/**
 * The 18 context fields (brief Appendix A, section A).
 *
 * Low-entropy client hints only. Deliberately NOT collected: canvas, font or
 * high-entropy client-hint fingerprints, exact screen pixels, full IP addresses, the
 * ad-click id itself, or any query parameter but a campaign tag (brief section 10).
 *
 * The country comes from the platform's IP header at ingest, and the IP is then
 * discarded, so it is not here at all.
 */

export interface ContextOptions {
  sessionId: string;
  pageViewId: string;
  consentGranted: boolean;
  /** Page titles are sent only on marketing hosts and pages that match a rule. */
  titleAllowed: boolean;
}

export function collectContext(options: ContextOptions): MessageContext {
  const context: MessageContext = {
    library: { name: LIBRARY_NAME, version: LIBRARY_VERSION },
    sessionId: options.sessionId,
    pageViewId: options.pageViewId,
  };

  try {
    context.userAgent = navigator.userAgent;
    context.locale = navigator.language;
  } catch {
    // Nothing to do; the server falls back to the request header.
  }

  // Low-entropy hints, which browsers keep accurate while they freeze the string.
  try {
    const data = (
      navigator as Navigator & { userAgentData?: ContextOptions & Record<string, unknown> }
    ).userAgentData as
      | { mobile?: boolean; platform?: string; brands?: { brand: string; version: string }[] }
      | undefined;
    if (data) {
      context.userAgentData = {
        ...(typeof data.mobile === 'boolean' ? { mobile: data.mobile } : {}),
        ...(data.platform ? { platform: data.platform } : {}),
        ...(data.brands ? { brands: data.brands.slice(0, 8) } : {}),
      };
    }
  } catch {
    // Not supported in this browser: the user-agent string is the fallback.
  }

  try {
    context.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Not resolvable: the work-hours signal degrades, nothing breaks.
  }

  try {
    // The server reduces this to one of three buckets; exact pixels are never stored.
    context.screen = { width: window.innerWidth, height: window.innerHeight };
  } catch {
    // Not in a window.
  }

  try {
    const path = normalisePath(location.pathname, location.hash);
    const campaign = campaignFrom(location.search);
    const referrer = referrerDomain(document.referrer);
    context.page = {
      path,
      ...(options.titleAllowed && document.title ? { title: document.title.slice(0, 512) } : {}),
      ...(referrer ? { referrer } : {}),
    };
    if (Object.keys(campaign).length > 0) context.campaign = campaign;
  } catch {
    // Not in a document.
  }

  try {
    context.consent = {
      granted: options.consentGranted,
      // The Global Privacy Control signal, recorded with the consent state.
      globalPrivacyControl:
        (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    };
  } catch {
    context.consent = { granted: options.consentGranted };
  }

  return context;
}

/** Whether the ad-click parameters say this was a paid click, and from where. */
export function paidClick(): { paid: boolean; network?: string } {
  try {
    const params = new URLSearchParams(location.search);
    if (params.has('gclid')) return { paid: true, network: 'google' };
    if (params.has('msclkid')) return { paid: true, network: 'microsoft' };
    // fbclid only counts as paid alongside a paid medium: Facebook adds it to
    // organic links too (brief Appendix A).
    if (params.has('fbclid') && /cpc|ppc|paid/i.test(params.get('utm_medium') ?? '')) {
      return { paid: true, network: 'meta' };
    }
  } catch {
    // No location: not a paid click as far as we know.
  }
  return { paid: false };
}
