import type { ProductDefinition, ProductKey } from '../types.js';

/**
 * The three dummy products (brief section 10).
 *
 * Each exists to exercise a different part of the system, so between them they cover
 * every rule the engines implement. Their event names are deliberately the founder's
 * own in places ("Invoice Sent", "Board Created"), because that is the case the event
 * dictionary and the Inbox exist to handle — a product whose names are already
 * canonical would never exercise the mapping at all.
 */

/**
 * Self-serve app with a 14-day trial. Five onboarding steps, single users.
 * Tests stalls, last-moment drops and trials ending unpaid.
 */
const SELF_SERVE: ProductDefinition = {
  key: 'selfserve',
  name: 'Ledgerly',
  description: 'Invoicing for freelancers. Single users, 14-day trial, card at checkout.',
  steps: [
    { label: 'Create account', eventName: 'Signed Up', urlPattern: null },
    { label: 'Verify email', eventName: 'Email Verified', urlPattern: null },
    { label: 'Add your details', eventName: null, urlPattern: '/onboarding/details' },
    { label: 'Connect a bank', eventName: null, urlPattern: '/onboarding/bank' },
    { label: 'Send first invoice', eventName: 'Activated', urlPattern: null },
  ],
  activationEvent: 'Activated',
  // The founder's own name for their core action: mapped to Core Action at setup.
  coreActionName: 'Invoice Sent',
  listPriceAmount: 1900,
  listPriceCurrency: 'usd',
  trialDays: 14,
  hasAccounts: false,
  hasPlanLimits: false,
  personaMix: [
    { value: 'converter', weight: 14 },
    { value: 'staller', weight: 30 },
    { value: 'intent-then-leaves', weight: 22 },
    { value: 'payer-gone-quiet', weight: 6 },
    { value: 'tourist', weight: 22 },
    { value: 'bot', weight: 4 },
    { value: 'internal', weight: 2 },
  ],
};

/**
 * B2B team tool: workspaces, invites, monthly and annual plans.
 * Tests accounts, group() and account-level intent.
 */
const B2B: ProductDefinition = {
  key: 'b2b',
  name: 'Loomwork',
  description: 'Shared project boards for teams. Workspaces, invites, seat-based plans.',
  steps: [
    { label: 'Create account', eventName: 'Signed Up', urlPattern: null },
    { label: 'Create workspace', eventName: 'Account Created', urlPattern: null },
    { label: 'Invite the team', eventName: 'Invite Sent', urlPattern: null },
    { label: 'Created first board', eventName: 'Activated', urlPattern: null },
  ],
  activationEvent: 'Activated',
  coreActionName: 'Board Created',
  listPriceAmount: 4900,
  listPriceCurrency: 'usd',
  trialDays: 14,
  hasAccounts: true,
  hasPlanLimits: false,
  personaMix: [
    { value: 'converter', weight: 18 },
    { value: 'staller', weight: 26 },
    { value: 'intent-then-leaves', weight: 24 },
    { value: 'payer-gone-quiet', weight: 8 },
    { value: 'tourist', weight: 16 },
    { value: 'bot', weight: 5 },
    { value: 'internal', weight: 3 },
  ],
};

/**
 * Freemium developer tool: usage limits, no trial.
 * Tests plan-limit signals and intent without a trial.
 */
const DEVTOOL: ProductDefinition = {
  key: 'devtool',
  name: 'Hookrelay',
  description: 'Webhook delivery and replay. Free up to 10,000 events a month, then paid.',
  steps: [
    { label: 'Create account', eventName: 'Signed Up', urlPattern: null },
    { label: 'Create an API key', eventName: 'API Key Created', urlPattern: null },
    { label: 'First API call', eventName: 'Activated', urlPattern: null },
  ],
  activationEvent: 'Activated',
  coreActionName: 'Webhook Delivered',
  listPriceAmount: 2900,
  listPriceCurrency: 'usd',
  // No trial: the free tier IS the trial, and a plan limit is the upgrade moment.
  trialDays: null,
  hasAccounts: false,
  hasPlanLimits: true,
  personaMix: [
    { value: 'converter', weight: 10 },
    { value: 'staller', weight: 22 },
    { value: 'intent-then-leaves', weight: 30 },
    { value: 'payer-gone-quiet', weight: 6 },
    { value: 'tourist', weight: 25 },
    { value: 'bot', weight: 5 },
    { value: 'internal', weight: 2 },
  ],
};

export const PRODUCTS: Record<ProductKey, ProductDefinition> = {
  selfserve: SELF_SERVE,
  b2b: B2B,
  devtool: DEVTOOL,
};

export const PRODUCT_KEYS = Object.keys(PRODUCTS) as ProductKey[];

export function product(key: ProductKey): ProductDefinition {
  return PRODUCTS[key];
}
