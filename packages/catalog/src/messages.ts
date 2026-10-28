import { z } from 'zod';
import { MAX_STRING_VALUE_CHARS } from './limits.js';
import { SOURCES } from './types.js';

/**
 * The wire format we accept (brief section 5). It is Segment-shaped on purpose, so
 * Segment's own open-source libraries work by pointing at our host, and so founders
 * already on Segment send the right names unchanged (settled decision 11).
 *
 * `z.object` in Zod 4 strips unknown keys, which is exactly the brief's rule:
 * "ignore unknown fields".
 */

const PropertyValue = z.unknown();

/** Arbitrary user-supplied bags. Depth and key counts are checked separately in
 *  packages/ingest, so a breach gets its own error code rather than a Zod message. */
const PropertyBag = z.record(z.string().max(128), PropertyValue);

/**
 * Segment's `context` object. We map what it carries onto our own context fields and
 * ignore the rest, so a founder's existing Segment setup needs no changes.
 */
const MessageContext = z
  .object({
    ip: z.string().max(64).optional(),
    locale: z.string().max(32).optional(),
    timezone: z.string().max(64).optional(),
    userAgent: z.string().max(MAX_STRING_VALUE_CHARS).optional(),
    // Low-entropy client hints only. No canvas, fonts or high-entropy hints (brief section 10).
    userAgentData: z
      .object({
        mobile: z.boolean().optional(),
        platform: z.string().max(64).optional(),
        brands: z
          .array(z.object({ brand: z.string().max(64), version: z.string().max(32) }))
          .max(16)
          .optional(),
      })
      .optional(),
    groupId: z.string().max(256).optional(),
    page: z
      .object({
        path: z.string().max(2048).optional(),
        title: z.string().max(512).optional(),
        url: z.string().max(2048).optional(),
        referrer: z.string().max(2048).optional(),
        search: z.string().max(2048).optional(),
      })
      .optional(),
    campaign: z
      .object({
        source: z.string().max(256).optional(),
        medium: z.string().max(256).optional(),
        name: z.string().max(256).optional(),
        term: z.string().max(256).optional(),
        content: z.string().max(256).optional(),
      })
      .optional(),
    screen: z.object({ width: z.number().optional(), height: z.number().optional() }).optional(),
    library: z.object({ name: z.string().max(64), version: z.string().max(32) }).optional(),
    // Our own additions, carried inside Segment's context so the shape stays compatible.
    consent: z
      .object({
        granted: z.boolean().optional(),
        globalPrivacyControl: z.boolean().optional(),
      })
      .optional(),
    /** The session id is client-generated; the session NUMBER is derived on the server. */
    sessionId: z.string().max(64).optional(),
    /** Identifies a single page view, so Page Left running totals can update one row. */
    pageViewId: z.string().max(64).optional(),
    /** Optional per-project identity verification: an HMAC of the user id (brief section 5). */
    userIdHmac: z.string().max(128).optional(),
  })
  .optional();

const Identifier = z.string().min(1).max(256);

const BaseMessage = {
  /** Client-generated, so a retry can never double-count (brief section 5). */
  messageId: z.string().min(1).max(128),
  timestamp: z.iso.datetime({ offset: true }).optional(),
  sentAt: z.iso.datetime({ offset: true }).optional(),
  originalTimestamp: z.iso.datetime({ offset: true }).optional(),
  userId: Identifier.optional(),
  anonymousId: Identifier.optional(),
  context: MessageContext,
  /** Set by our adapters, never trusted from the client body. */
  _source: z.enum(SOURCES).optional(),
};

export const TrackMessage = z.object({
  ...BaseMessage,
  type: z.literal('track'),
  event: z.string().min(1).max(256),
  properties: PropertyBag.optional(),
});

export const PageMessage = z.object({
  ...BaseMessage,
  type: z.literal('page'),
  name: z.string().max(256).optional(),
  properties: PropertyBag.optional(),
});

export const IdentifyMessage = z.object({
  ...BaseMessage,
  type: z.literal('identify'),
  traits: PropertyBag.optional(),
});

export const GroupMessage = z.object({
  ...BaseMessage,
  type: z.literal('group'),
  groupId: Identifier,
  traits: PropertyBag.optional(),
});

/** Segment also sends `screen` and `alias`; we accept and ignore them rather than erroring. */
export const IgnoredMessage = z.object({
  ...BaseMessage,
  type: z.enum(['screen', 'alias']),
});

export const Message = z.discriminatedUnion('type', [
  TrackMessage,
  PageMessage,
  IdentifyMessage,
  GroupMessage,
  IgnoredMessage,
]);

export type TrackMessageInput = z.infer<typeof TrackMessage>;
export type PageMessageInput = z.infer<typeof PageMessage>;
export type IdentifyMessageInput = z.infer<typeof IdentifyMessage>;
export type GroupMessageInput = z.infer<typeof GroupMessage>;
export type MessageInput = z.infer<typeof Message>;
export type MessageContextInput = z.infer<typeof MessageContext>;

/** The request body of POST /v1/batch and POST /v1/import. */
export const BatchBody = z.object({
  batch: z.array(z.unknown()),
  sentAt: z.iso.datetime({ offset: true }).optional(),
  /** `sendBeacon` cannot set headers, so the key may travel in the body (brief section 5). */
  writeKey: z.string().max(128).optional(),
  context: MessageContext,
});

export type BatchBodyInput = z.infer<typeof BatchBody>;

/**
 * Per-message result codes returned by /v1/batch. The reply is always a 200 with one
 * result per message unless the whole request is malformed, unauthorised or too large.
 */
export const MESSAGE_RESULT_CODES = [
  'ok',
  'duplicate',
  'invalid_message',
  'unknown_type',
  'message_too_large',
  'too_many_properties',
  'properties_too_deep',
  'timestamp_too_far_future',
  'timestamp_too_old',
  'missing_identity',
  'server_only_event',
  'server_only_trait',
  'bot_filtered',
  'internal_filtered',
  'opted_out',
  'daily_cap_reached',
] as const;

export type MessageResultCode = (typeof MESSAGE_RESULT_CODES)[number];

export interface MessageResult {
  messageId: string;
  status: 'ok' | 'duplicate' | 'error' | 'filtered';
  code: MessageResultCode;
  /** Plain language, for the founder reading a debug log (CLAUDE.md rule 7). */
  message?: string;
}
