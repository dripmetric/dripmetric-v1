/**
 * What a visitor reads after pressing "Join the waitlist", in one place: the form shows
 * these with JavaScript, and /api/waitlist renders the same words as a page without it.
 */

export type WaitlistOutcome =
  | 'joined'
  | 'waitlist_closed'
  | 'waitlist_unavailable'
  | 'email_invalid'
  | 'email_disposable'
  | 'rate_limited'
  | 'request_refused';

export interface WaitlistMessage {
  title: string;
  body: string;
}

export function waitlistMessage(outcome: WaitlistOutcome, contactEmail: string): WaitlistMessage {
  switch (outcome) {
    case 'joined':
      return {
        title: 'You’re on the list.',
        body: 'We invite founders weekly, in small cohorts. Your invite and project keys will come to the address you gave us.',
      };
    case 'waitlist_closed':
      return {
        title: 'The waitlist isn’t open yet.',
        body: `Write to ${contactEmail} and we’ll add you by hand.`,
      };
    case 'email_invalid':
      return {
        title: 'That address doesn’t look right.',
        body: 'Check it and try again. It should look like you@yourcompany.com.',
      };
    case 'email_disposable':
      return {
        title: 'Please use an address you’ll keep.',
        body: 'Your invite goes to this address, possibly weeks from now, so a temporary inbox would miss it.',
      };
    case 'rate_limited':
      return {
        title: 'Too many tries from here.',
        body: `Wait a few minutes and try again, or write to ${contactEmail}.`,
      };
    case 'waitlist_unavailable':
    case 'request_refused':
      return {
        title: 'That didn’t go through.',
        body: `Please try again, or write to ${contactEmail}.`,
      };
  }
}
