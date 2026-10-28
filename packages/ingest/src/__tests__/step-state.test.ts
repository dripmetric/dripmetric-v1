import { describe, expect, it } from 'vitest';
import {
  EMPTY_FUNNEL,
  matchSteps,
  matchesPattern,
  type FunnelConfig,
} from '../pipeline/step-state.js';

/**
 * Step matching is a pure function of the funnel and the event, which is what lets
 * M6's funnel engine and the `recompute` job call it with no database at all.
 */
const FUNNEL: FunnelConfig = {
  steps: [
    { stepId: 1, label: 'Create account', eventName: 'Signed Up', urlPattern: null },
    { stepId: 2, label: 'Invite the team', eventName: null, urlPattern: '/onboarding/invite' },
    { stepId: 3, label: 'Import your data', eventName: null, urlPattern: '/onboarding/import-*' },
    { stepId: 4, label: 'Created first board', eventName: 'Activated', urlPattern: null },
  ],
};

describe('step matching (brief section 8.1)', () => {
  it('matches a step defined by a canonical event', () => {
    expect(matchSteps(FUNNEL, 'Signed Up', null, null)).toEqual([{ stepId: 1, kind: 'completed' }]);
    expect(matchSteps(FUNNEL, 'Activated', null, null)).toEqual([{ stepId: 4, kind: 'completed' }]);
  });

  it('matches a step by its URL rule, and reaching the page enters the step', () => {
    expect(matchSteps(FUNNEL, 'Page Viewed', null, '/onboarding/invite')).toEqual([
      { stepId: 2, kind: 'entered' },
    ]);
  });

  it('matches a wildcard URL rule', () => {
    expect(matchSteps(FUNNEL, 'Page Viewed', null, '/onboarding/import-csv')).toEqual([
      { stepId: 3, kind: 'entered' },
    ]);
    expect(matchSteps(FUNNEL, 'Page Viewed', null, '/onboarding/something-else')).toEqual([]);
  });

  it('matches the founder’s own step events by the step name they carry', () => {
    expect(matchSteps(FUNNEL, 'Onboarding Step Completed', 'Invite the team', null)).toEqual([
      { stepId: 2, kind: 'completed' },
    ]);
    expect(matchSteps(FUNNEL, 'Onboarding Step Viewed', 'Invite the team', null)).toEqual([
      { stepId: 2, kind: 'entered' },
    ]);
  });

  it('matches nothing for a step name the funnel does not have', () => {
    expect(matchSteps(FUNNEL, 'Onboarding Step Completed', 'Some other step', null)).toEqual([]);
  });

  it('matches nothing at all before the founder has a funnel', () => {
    expect(matchSteps(EMPTY_FUNNEL, 'Signed Up', null, '/onboarding/invite')).toEqual([]);
  });

  it('matches nothing for an unmapped event, which is what the Inbox is for', () => {
    // canonical is null while a raw name waits in the Inbox, so it counts toward nothing.
    expect(matchSteps(FUNNEL, null, null, null)).toEqual([]);
  });
});

describe('URL rule patterns', () => {
  it('matches exactly when there is no wildcard', () => {
    expect(matchesPattern('/pricing', '/pricing')).toBe(true);
    expect(matchesPattern('/pricing/annual', '/pricing')).toBe(false);
  });

  it('treats * as "anything"', () => {
    expect(matchesPattern('/onboarding/step-2', '/onboarding/step-*')).toBe(true);
    expect(matchesPattern('/onboarding/step-2/detail', '/onboarding/step-*')).toBe(true);
    expect(matchesPattern('/settings', '/onboarding/step-*')).toBe(false);
  });

  it('does not let a pattern’s punctuation act as a regular expression', () => {
    // '.' in a pattern must mean a literal dot, not "any character".
    expect(matchesPattern('/aXjson', '/a.json')).toBe(false);
    expect(matchesPattern('/a.json', '/a.json')).toBe(true);
  });
});
