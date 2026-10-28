import { z } from 'zod';

/**
 * Project settings (brief section 4). Validated here, stored as JSONB, and every
 * change goes to the audit log. The defaults are the brief's own assumptions, each
 * flagged to the founder in the first milestone report (brief section 12).
 */
export const ProjectSettings = z.object({
  /** The founder's list price. Minor units plus a currency code, like Stripe. */
  listPriceAmount: z.number().int().nonnegative().nullable().default(null),
  listPriceCurrency: z.string().length(3).default('usd'),
  listPriceInterval: z.enum(['month', 'year']).default('month'),

  /** Trial length in days, or null for "no trial". */
  trialDays: z.number().int().nonnegative().nullable().default(null),

  /**
   * The "intent but didn't pay" window, in days (settled decision 7).
   * A manual per-project setting. Do not build trial-aware logic.
   */
  didntPayWindowDays: z.number().int().positive().default(14),

  /** The founder's own team, kept out of every number. */
  internalDomains: z.array(z.string()).default([]),
  internalEmails: z.array(z.string()).default([]),

  /** Settled decision 13. When true the browser SDK stores and sends nothing until consent. */
  consentRequired: z.boolean().default(true),

  /** Publishable keys are refused from any other origin (brief section 5). */
  allowedOrigins: z.array(z.string()).default([]),

  /** Shapes a few defaults: the desktop fit point is off for a mobile-first product. */
  productKind: z.enum(['self-serve', 'team', 'developer']).default('self-serve'),
  mobileFirst: z.boolean().default(false),

  /** Brief section 12 assumption: Mon–Fri 09:00–18:00 local. */
  workingHours: z
    .object({
      startHour: z.number().int().min(0).max(23).default(9),
      endHour: z.number().int().min(1).max(24).default(18),
      days: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    })
    .default({ startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] }),

  /** Brief section 12 assumption: 22:00–08:00 local. Held alerts go out in the morning. */
  quietHours: z
    .object({
      startHour: z.number().int().min(0).max(23).default(22),
      endHour: z.number().int().min(0).max(23).default(8),
    })
    .default({ startHour: 22, endHour: 8 }),

  /** Matched against utm_term to approximate brand search (brief section 8.2). */
  brandTerms: z.array(z.string()).default([]),

  /** How many names a free project may reveal. The switch for a later offer of
   *  100 free names; the offer itself is not built (brief section 2). */
  revealAllowance: z.number().int().nonnegative().default(0),

  /** Volume guard: rows per user, per event type, per day before we count instead
   *  of storing (brief section 4). */
  dailyRowsPerUserPerEvent: z.number().int().positive().default(200),

  /** The founder's chosen instant-alert channel (settled decision 5). */
  alertChannel: z.enum(['slack', 'discord', 'email-digest', 'none']).default('none'),

  /** One line about the product, used by the AI mapping prompt (brief section 7). */
  productDescription: z.string().max(500).default(''),
});

export type ProjectSettingsInput = z.input<typeof ProjectSettings>;
export type ProjectSettingsValue = z.output<typeof ProjectSettings>;

export function parseSettings(raw: unknown): ProjectSettingsValue {
  return ProjectSettings.parse(raw ?? {});
}

export function defaultSettings(): ProjectSettingsValue {
  return ProjectSettings.parse({});
}
