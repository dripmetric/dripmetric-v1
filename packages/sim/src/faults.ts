import type { Rng } from './random.js';
import type { FaultName, SimMessage } from './types.js';

/**
 * Injected faults (brief section 10).
 *
 * Every one of these happens in the wild, and each is a thing that would quietly
 * corrupt the numbers if the pipeline got it wrong. They are applied to the generated
 * stream rather than built into the personas, so the same seeded journey can be run
 * clean or faulty and the two compared.
 */

export interface FaultOptions {
  faults: readonly FaultName[];
  rng: Rng;
  /** Which event to stop sending, for `missing-event`. */
  missingEventName?: string;
  /** Which event to rename, and to what, for `renamed-event`. */
  renameFrom?: string;
  renameTo?: string;
  /** The virtual time from which the fault starts, for the ones that begin partway. */
  faultsFrom?: Date;
}

export interface FaultResult {
  messages: SimMessage[];
  /** What each fault actually did, so a surprising count has an explanation. */
  applied: { fault: FaultName; detail: string }[];
}

export function injectFaults(input: readonly SimMessage[], options: FaultOptions): FaultResult {
  let messages = [...input];
  const applied: FaultResult['applied'] = [];
  const active = new Set(options.faults);
  const from = options.faultsFrom?.getTime() ?? 0;

  // --- A key event stops arriving ---------------------------------------------
  // Tracking broke. The dashboard must say so rather than reporting that users
  // vanished (brief section 9).
  if (active.has('missing-event') && options.missingEventName) {
    const name = options.missingEventName;
    const before = messages.length;
    messages = messages.filter(
      (m) => !(m.at.getTime() >= from && m.message.type === 'track' && m.message.event === name),
    );
    applied.push({
      fault: 'missing-event',
      detail: `dropped ${before - messages.length} "${name}" events after ${new Date(from).toISOString()}`,
    });
  }

  // --- An event name changes ---------------------------------------------------
  // A deploy renamed it. The old name keeps its mapping; the new one lands in the
  // Inbox and counts toward nothing until the founder maps it (brief section 7).
  if (active.has('renamed-event') && options.renameFrom && options.renameTo) {
    const { renameFrom, renameTo } = options;
    let renamed = 0;
    messages = messages.map((m) => {
      if (m.at.getTime() < from || m.message.type !== 'track' || m.message.event !== renameFrom)
        return m;
      renamed += 1;
      return { ...m, message: { ...m.message, event: renameTo } };
    });
    applied.push({
      fault: 'renamed-event',
      detail: `renamed ${renamed} "${renameFrom}" to "${renameTo}"`,
    });
  }

  // --- Duplicates --------------------------------------------------------------
  // A retry that already succeeded. The same messageId must land once.
  if (active.has('duplicates')) {
    const extra: SimMessage[] = [];
    for (const m of messages) {
      if (options.rng.chance(0.04)) extra.push({ ...m });
    }
    messages = [...messages, ...extra];
    applied.push({ fault: 'duplicates', detail: `re-sent ${extra.length} messages unchanged` });
  }

  // --- Late and out-of-order events --------------------------------------------
  // Accepted, flagged `late`, and they must never corrupt step state.
  if (active.has('late-events')) {
    let late = 0;
    messages = messages.map((m) => {
      if (!options.rng.chance(0.06)) return m;
      late += 1;
      // The event keeps its real timestamp; only its place in the stream moves.
      return { ...m, deliverAfterHours: options.rng.int(2, 30) } as SimMessage & {
        deliverAfterHours: number;
      };
    });
    applied.push({
      fault: 'late-events',
      detail: `delayed delivery of ${late} messages by 2-30 hours`,
    });
  }

  // --- Clock skew ---------------------------------------------------------------
  // A device hours out. `sentAt` against receipt time is what corrects it.
  if (active.has('clock-skew')) {
    const skewed = new Set<string>();
    messages = messages.map((m) => {
      if (!options.rng.chance(0.08)) return m;
      const skewHours = options.rng.pick([-3, -2, -1, 1, 2, 4]);
      skewed.add(m.message.messageId);
      const shifted = new Date(m.at.getTime() + skewHours * 3600 * 1000);
      return {
        ...m,
        message: {
          ...m.message,
          timestamp: shifted.toISOString(),
          // The same wrong clock stamps sentAt, which is how we detect the skew.
          sentAt: shifted.toISOString(),
        },
      };
    });
    applied.push({
      fault: 'clock-skew',
      detail: `shifted ${skewed.size} device clocks by up to 4 hours`,
    });
  }

  // --- A burst at 100 times normal volume ---------------------------------------
  // The rate limiter and the daily cap are what stand between this and a full disk.
  if (active.has('burst')) {
    const source = messages.filter((m) => m.message.type === 'track').slice(0, 20);
    const burst: SimMessage[] = [];
    for (const m of source) {
      for (let i = 0; i < 100; i++) {
        burst.push({
          ...m,
          message: { ...m.message, messageId: `${m.message.messageId}-burst-${i}` },
        });
      }
    }
    messages = [...messages, ...burst];
    applied.push({ fault: 'burst', detail: `added ${burst.length} messages in a burst` });
  }

  return { messages, applied };
}

/** The delivery order: by the time a message would actually reach us. */
export function deliveryOrder(messages: readonly SimMessage[]): SimMessage[] {
  return [...messages].sort((a, b) => {
    const delayA = (a as SimMessage & { deliverAfterHours?: number }).deliverAfterHours ?? 0;
    const delayB = (b as SimMessage & { deliverAfterHours?: number }).deliverAfterHours ?? 0;
    const deliveredA = a.at.getTime() + delayA * 3600 * 1000;
    const deliveredB = b.at.getTime() + delayB * 3600 * 1000;
    if (deliveredA !== deliveredB) return deliveredA - deliveredB;
    // A stable tiebreak, so the same seed gives the same order every run.
    return a.message.messageId < b.message.messageId ? -1 : 1;
  });
}

/** When a message is actually delivered, which is what `received_at` becomes. */
export function deliveredAt(message: SimMessage): Date {
  const delay = (message as SimMessage & { deliverAfterHours?: number }).deliverAfterHours ?? 0;
  return new Date(message.at.getTime() + delay * 3600 * 1000);
}
