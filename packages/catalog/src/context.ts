import type { ContextField } from './types.js';

/**
 * The 18 context fields the browser snippet captures (brief Appendix A, section A).
 *
 * Most are stored once per session, not on every event: that is what keeps an event
 * near 215 bytes instead of 575 (brief section 4, volume guards).
 *
 * Deliberately NOT collected (brief section 10): canvas, font or high-entropy
 * client-hint fingerprints; exact screen pixels; full IP addresses or precise
 * location; ad-click ids; query strings beyond campaign tags.
 */
export const CONTEXT_FIELDS: readonly ContextField[] = [
  {
    key: 'deviceType',
    howCaptured: 'Sec-CH-UA-Mobile hint, else the user agent. desktop | mobile | tablet.',
    job: 'Desktop converts about 70% more often than mobile: intent and every split.',
    perSession: true,
  },
  {
    key: 'os',
    howCaptured: 'Sec-CH-UA-Platform hint, else the user agent.',
    job: 'Diagnosis; intent once calibrated.',
    perSession: true,
  },
  {
    key: 'browser',
    howCaptured: 'Sec-CH-UA hint, else the user agent. Name plus major version.',
    job: 'Flows break per browser, e.g. a sign-in popup blocked in Safari.',
    perSession: true,
  },
  {
    key: 'screenBucket',
    howCaptured: 'screen and innerWidth, reduced to three buckets. Never exact pixels.',
    job: 'Layout bugs on small screens.',
    perSession: true,
  },
  {
    key: 'language',
    howCaptured: 'navigator.language.',
    job: 'Diagnosis.',
    perSession: true,
  },
  {
    key: 'timezone',
    howCaptured: 'Intl.DateTimeFormat().resolvedOptions().timeZone. Gives local hour and weekday.',
    job: 'The work-hours intent signal; alert wording.',
    perSession: true,
  },
  {
    key: 'country',
    howCaptured: 'The platform IP-country header at ingest, then the IP is dropped.',
    job: 'Splits; consent rules.',
    perSession: true,
  },
  {
    key: 'referrerDomain',
    howCaptured: 'document.referrer, domain only.',
    job: 'Channel quality; intent.',
    perSession: true,
  },
  {
    key: 'campaign',
    howCaptured: 'utm_source, utm_medium, utm_campaign, utm_term, utm_content.',
    job: 'Leaks by campaign.',
    perSession: true,
  },
  {
    key: 'paidClick',
    howCaptured:
      'gclid or msclkid, or fbclid with a paid utm_medium. Yes/no plus the network; the id itself is discarded.',
    job: 'Splits.',
    perSession: true,
  },
  {
    key: 'landingPage',
    howCaptured: 'The first page of the session, normalised.',
    job: 'Splits; intent.',
    perSession: true,
  },
  {
    key: 'firstTouch',
    howCaptured: 'First referrer, campaign and landing page. Kept on the person, not the session.',
    job: 'Credits payers to the channel that found them.',
    perSession: false,
  },
  {
    key: 'visitsBeforeSignup',
    howCaptured: 'Anonymous sessions before identify(). Kept on the person.',
    job: 'Intent: +5 for 2 or more visits (inside the fit cap).',
    perSession: false,
  },
  {
    key: 'session',
    howCaptured:
      'Client-generated id; a new session after 30 minutes idle. The number is derived on the server.',
    job: 'Step timing; engagement.',
    perSession: true,
  },
  {
    key: 'path',
    howCaptured:
      'Page path and title, normalised: ids to :id; query strings dropped except campaign tags; fragments dropped except hash routes; titles only on marketing hosts and rule pages.',
    job: 'URL rules; journeys.',
    perSession: false,
  },
  {
    key: 'consent',
    howCaptured:
      'The founder’s consent tool or our banner hook, plus the Global Privacy Control flag.',
    job: 'Compliance.',
    perSession: true,
  },
  {
    key: 'library',
    howCaptured: 'Library name and version, set by the SDK.',
    job: 'Tracking health.',
    perSession: true,
  },
  {
    key: 'clock',
    howCaptured: 'Device time and receipt time, per event.',
    job: 'Corrects wrong device clocks; orders events.',
    perSession: false,
  },
];

/** Screen buckets. Brief Appendix A: three buckets, never exact pixels. */
export const SCREEN_BUCKETS = ['small', 'medium', 'large'] as const;
export type ScreenBucket = (typeof SCREEN_BUCKETS)[number];

export const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** The only campaign parameters we keep. Everything else in the query string is dropped. */
export const CAMPAIGN_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

/** Ad-click parameters: their presence is recorded as "paid click + network"; the id is discarded. */
export const AD_CLICK_PARAMS = { gclid: 'google', msclkid: 'microsoft', fbclid: 'meta' } as const;
