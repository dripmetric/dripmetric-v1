import type { ComputedSignal } from './types.js';

/**
 * The 20 computed signals (brief Appendix A, section J).
 * `neededNow: false` marks the six the brief defers until calibration: store the facts
 * if they are cheap, but they add no intent points yet.
 */
export const COMPUTED_SIGNALS: readonly ComputedSignal[] = [
  {
    key: 'timeOnStep',
    neededNow: true,
    job: 'Elapsed and active time per step: step timing, stalls, the "stuck" rule.',
  },
  { key: 'gapBetweenSteps', neededNow: true, job: 'The cooling rule and stall risk.' },
  {
    key: 'timeToValue',
    neededNow: true,
    job: 'Activated minus Signed Up, elapsed and active. Intent +10 when faster than the median.',
  },
  {
    key: 'speedPercentile',
    neededNow: true,
    job: 'Where a user sits against the product’s own users: rushed, slow, stuck.',
  },
  {
    key: 'pricingPattern',
    neededNow: true,
    job: 'Quick exit, slow pricing page, deliberation or re-checking (brief section 8.2).',
  },
  {
    key: 'activeDays',
    neededNow: true,
    job: 'Last 7 and first 14 days. Intent +10 for 3 or more of the last 7.',
  },
  {
    key: 'recency',
    neededNow: true,
    job: 'Days since the last event: the intent decay term and the "went quiet" leak.',
  },
  {
    key: 'usageTrend',
    neededNow: true,
    job: 'Core actions and active days against the user’s own 4-week baseline: the payer-going-quiet leak.',
  },
  {
    key: 'emailType',
    neededNow: true,
    job: 'work | free | education | disposable. Intent +5 or -20.',
  },
  {
    key: 'workHoursShare',
    neededNow: true,
    job: 'Signed up in working hours on a weekday: a fit point.',
  },
  {
    key: 'visitsBeforeSignup',
    neededNow: true,
    job: 'Two or more visits before signup: a fit point.',
  },
  {
    key: 'activeMembersPerAccount',
    neededNow: true,
    job: 'Account score +10 when two or more members were active that week.',
  },
  {
    key: 'intentScore',
    neededNow: true,
    job: 'Current and peak. The peak drives "intent but didn’t pay".',
  },
  {
    key: 'trackingHealth',
    neededNow: true,
    job: 'Missing events, shape drift, coverage, browser/server share, double-sends, late events.',
  },
  { key: 'day1Return', neededNow: false, job: 'Stored as evidence. 0 points until calibration.' },
  { key: 'breadth', neededNow: false, job: 'Distinct features used. 0 points until calibration.' },
  {
    key: 'depthAgainstPayers',
    neededNow: false,
    job: 'How this user’s depth compares with payers. 0 points until calibration.',
  },
  { key: 'devicesUsed', neededNow: false, job: 'Stored as evidence. 0 points until calibration.' },
  {
    key: 'channelQuality',
    neededNow: false,
    job: 'Conversion by channel. 0 points until calibration.',
  },
  {
    key: 'ownerQuietTeamActive',
    neededNow: false,
    job: 'The buyer went quiet while the team kept working. 0 points until calibration.',
  },
];
