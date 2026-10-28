import { createHash } from 'node:crypto';
import {
  LATE_EVENT_THRESHOLD_MS,
  MAX_FUTURE_SKEW_MS,
  MAX_MESSAGE_BYTES,
  MAX_PROPERTY_DEPTH,
  MAX_PROPERTY_KEYS,
  Message,
  type MessageInput,
  type MessageResult,
} from '@dripmetric/catalog';
import type { PreparedMessage } from './types.js';

/**
 * Per-message validation (brief section 5, "Never trust the client").
 *
 * One bad message never fails the batch: it comes back as one error result beside the
 * others, so a founder with one broken call does not lose the rest of their traffic.
 */

export type Prepared =
  { ok: true; message: PreparedMessage } | { ok: false; result: MessageResult };

export interface PrepareContext {
  receivedAt: Date;
  /** The batch's own `sentAt`, used to correct a wrong device clock. */
  batchSentAt: Date | null;
  /** How far back events may be accepted. The project's retention window. */
  retentionDays: number;
}

/** The dedupe key: the first 16 bytes of sha256(messageId), formatted as a uuid. */
export function messageHash(messageId: string): string {
  const digest = createHash('sha256').update(messageId, 'utf8').digest('hex').slice(0, 32);
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20, 32),
  ].join('-');
}

export function prepareMessage(raw: unknown, context: PrepareContext): Prepared {
  // The message id is read before validation, so even a rejected message can be
  // reported back against the id the client knows it by.
  const claimedId =
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as { messageId?: unknown }).messageId === 'string'
      ? (raw as { messageId: string }).messageId
      : '';

  const size = Buffer.byteLength(JSON.stringify(raw ?? null), 'utf8');
  if (size > MAX_MESSAGE_BYTES) {
    return error(
      claimedId,
      'message_too_large',
      `This message is ${size} bytes; the limit is ${MAX_MESSAGE_BYTES}.`,
    );
  }

  const parsed = Message.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return error(
      claimedId,
      'invalid_message',
      first
        ? `${first.path.join('.') || 'message'}: ${first.message}`
        : 'This message is not in the right shape.',
    );
  }
  const message = parsed.data;

  // Property and trait bags: capped so one message cannot carry a document.
  const bag = bagOf(message);
  if (bag) {
    const keys = Object.keys(bag).length;
    if (keys > MAX_PROPERTY_KEYS) {
      return error(
        message.messageId,
        'too_many_properties',
        `${keys} properties; the limit is ${MAX_PROPERTY_KEYS}.`,
      );
    }
    if (depthOf(bag) > MAX_PROPERTY_DEPTH) {
      return error(
        message.messageId,
        'properties_too_deep',
        `Properties nest deeper than ${MAX_PROPERTY_DEPTH} levels.`,
      );
    }
  }

  // Every message needs someone to belong to.
  if (!message.userId && !message.anonymousId) {
    return error(
      message.messageId,
      'missing_identity',
      'A message needs a userId or an anonymousId.',
    );
  }

  const timing = correctClock(message, context);
  if (timing.kind === 'too_future') {
    return error(
      message.messageId,
      'timestamp_too_far_future',
      'That timestamp is more than 24 hours in the future, so the device clock is wrong.',
    );
  }
  if (timing.kind === 'too_old') {
    return error(
      message.messageId,
      'timestamp_too_old',
      `That event is older than the ${context.retentionDays} days we keep, so it would be deleted straight away.`,
    );
  }

  return {
    ok: true,
    message: {
      input: message,
      messageId: message.messageId,
      messageHash: messageHash(message.messageId),
      occurredAt: timing.occurredAt,
      late: context.receivedAt.getTime() - timing.occurredAt.getTime() > LATE_EVENT_THRESHOLD_MS,
    },
  };
}

type Timing = { kind: 'ok'; occurredAt: Date } | { kind: 'too_future' } | { kind: 'too_old' };

/**
 * Device clock correction (brief section 5, step 5).
 *
 * A phone whose clock is two hours slow would otherwise scatter its events through
 * the funnel. `sentAt` is stamped by the same wrong clock as `timestamp`, so the gap
 * between `sentAt` and when we actually received the batch IS that clock's error, and
 * subtracting it puts the event back where it belongs.
 */
function correctClock(message: MessageInput, context: PrepareContext): Timing {
  const stated = message.timestamp ?? message.originalTimestamp;
  if (!stated) return { kind: 'ok', occurredAt: context.receivedAt };

  const statedAt = new Date(stated);
  if (Number.isNaN(statedAt.getTime())) return { kind: 'ok', occurredAt: context.receivedAt };

  const sentAt = message.sentAt ? new Date(message.sentAt) : context.batchSentAt;
  let occurredAt = statedAt;
  if (sentAt && !Number.isNaN(sentAt.getTime())) {
    const skew = context.receivedAt.getTime() - sentAt.getTime();
    // Only correct a real skew. A second or two is network time, not a wrong clock.
    if (Math.abs(skew) > 5_000) {
      occurredAt = new Date(statedAt.getTime() + skew);
    }
  }

  if (occurredAt.getTime() - context.receivedAt.getTime() > MAX_FUTURE_SKEW_MS)
    return { kind: 'too_future' };

  const oldest = context.receivedAt.getTime() - context.retentionDays * 24 * 60 * 60 * 1000;
  if (occurredAt.getTime() < oldest) return { kind: 'too_old' };

  // An event cannot have happened after we received it; clamp rather than reject,
  // because a few seconds of drift is normal and harmless.
  if (occurredAt.getTime() > context.receivedAt.getTime()) occurredAt = context.receivedAt;

  return { kind: 'ok', occurredAt };
}

function bagOf(message: MessageInput): Record<string, unknown> | null {
  if (message.type === 'track' || message.type === 'page') return message.properties ?? null;
  if (message.type === 'identify' || message.type === 'group') return message.traits ?? null;
  return null;
}

function depthOf(value: unknown, level = 1): number {
  if (level > MAX_PROPERTY_DEPTH + 1) return level;
  if (Array.isArray(value)) {
    return value.reduce<number>((max, item) => Math.max(max, depthOf(item, level + 1)), level);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).reduce<number>(
      (max, item) => Math.max(max, depthOf(item, level + 1)),
      level,
    );
  }
  return level;
}

function error(messageId: string, code: MessageResult['code'], message: string): Prepared {
  return { ok: false, result: { messageId, status: 'error', code, message } };
}
