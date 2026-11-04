import type { MessageInput } from '@dripmetric/catalog';
import type { SimMessage } from './types.js';

/**
 * Payload emitters for the no-code feeds (brief section 10: "every integration
 * path").
 *
 * M12 builds the adapters that read these. Generating the payloads here means the
 * adapters can be tested against the SAME journeys the native SDK path uses, so
 * "produces the same canonical events" is a real comparison rather than two
 * hand-written fixtures that happen to agree.
 */

/** Our own `/v1/batch` shape. */
export function toNativeBatch(messages: readonly SimMessage[]): { batch: MessageInput[] } {
  return { batch: messages.map((m) => m.message) };
}

/**
 * Segment's Webhooks (Actions) destination. It forwards a batched array of
 * Segment-shaped messages; verify the exact shape against Segment's docs at M12.
 */
export function toSegmentBatch(messages: readonly SimMessage[]): unknown {
  return messages.map((m) => ({
    type: m.message.type,
    messageId: m.message.messageId,
    timestamp: m.message.timestamp,
    sentAt: m.message.sentAt,
    userId: m.message.userId,
    anonymousId: m.message.anonymousId,
    ...(m.message.type === 'track'
      ? { event: m.message.event, properties: m.message.properties }
      : {}),
    ...(m.message.type === 'page'
      ? { name: m.message.name, properties: m.message.properties }
      : {}),
    ...(m.message.type === 'identify' ? { traits: m.message.traits } : {}),
    ...(m.message.type === 'group' ? { groupId: m.message.groupId, traits: m.message.traits } : {}),
    context: m.message.context,
    // Segment stamps its own write key and source id on forwarded payloads.
    writeKey: 'segment-source-write-key',
    receivedAt: m.at.toISOString(),
  }));
}

/**
 * RudderStack's HTTP Webhook destination. Nearly identical to Segment's, which is
 * why one parser with small differences serves both (brief section 5).
 */
export function toRudderStackBatch(messages: readonly SimMessage[]): unknown {
  return {
    batch: messages.map((m) => ({
      type: m.message.type,
      messageId: m.message.messageId,
      originalTimestamp: m.message.timestamp,
      sentAt: m.message.sentAt,
      userId: m.message.userId,
      anonymousId: m.message.anonymousId,
      ...(m.message.type === 'track'
        ? { event: m.message.event, properties: m.message.properties }
        : {}),
      ...(m.message.type === 'page'
        ? { name: m.message.name, properties: m.message.properties }
        : {}),
      ...(m.message.type === 'identify' ? { traits: m.message.traits } : {}),
      ...(m.message.type === 'group'
        ? { groupId: m.message.groupId, traits: m.message.traits }
        : {}),
      context: { ...m.message.context, library: { name: 'rudder-sdk-js', version: '3.0.0' } },
      channel: 'web',
    })),
  };
}

/**
 * PostHog's webhook destination, which has its own shape. An adapter must filter to
 * an allow-list, because autocapture would otherwise flood us (brief section 5).
 */
export function toPostHogEvents(messages: readonly SimMessage[]): unknown[] {
  return messages
    .filter((m) => m.message.type === 'track' || m.message.type === 'page')
    .map((m) => ({
      event:
        m.message.type === 'page'
          ? '$pageview'
          : m.message.type === 'track'
            ? m.message.event
            : 'unknown',
      distinct_id: m.message.userId ?? m.message.anonymousId,
      timestamp: m.message.timestamp,
      uuid: m.message.messageId,
      properties: {
        ...(m.message.type === 'track' || m.message.type === 'page' ? m.message.properties : {}),
        $current_url: `https://app.example.com${(m.message.context?.page?.path as string) ?? '/'}`,
        $browser: 'Chrome',
        $os: 'Mac OS X',
        $lib: 'posthog-js',
        $session_id: m.message.context?.sessionId,
        // Autocapture noise the allow-list must drop.
        ...(m.message.type === 'page' ? { $autocapture: false } : {}),
      },
    }));
}

/** Autocapture events PostHog would forward that we must drop and count (M12). */
export function postHogAutocaptureNoise(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    event: '$autocapture',
    distinct_id: `anon_noise_${i}`,
    timestamp: new Date(Date.UTC(2026, 5, 10, 12, 0, i % 60)).toISOString(),
    uuid: `posthog-noise-${i}`,
    properties: { $event_type: 'click', $el_text: 'Save', $lib: 'posthog-js' },
  }));
}
