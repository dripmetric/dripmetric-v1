/**
 * The virtual clock (brief section 10: "runs on a virtual clock so days pass in
 * seconds").
 *
 * Nothing in the simulator reads the real clock. A persona's whole 30-day journey is
 * generated in milliseconds, with every event carrying the timestamp it would have
 * had in real time, which is what makes the leak and intent engines testable: a
 * 49-hour stall is a number, not a wait.
 */
export class VirtualClock {
  private current: number;

  constructor(start: Date) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  nowMs(): number {
    return this.current;
  }

  advanceSeconds(seconds: number): Date {
    this.current += Math.round(seconds * 1000);
    return this.now();
  }

  advanceMinutes(minutes: number): Date {
    return this.advanceSeconds(minutes * 60);
  }

  advanceHours(hours: number): Date {
    return this.advanceSeconds(hours * 3600);
  }

  advanceDays(days: number): Date {
    return this.advanceSeconds(days * 86400);
  }

  /** Moves to a given hour on the same or a later day, for "comes back on day 3". */
  advanceToHour(daysAhead: number, hour: number): Date {
    const date = new Date(this.current);
    date.setUTCDate(date.getUTCDate() + daysAhead);
    date.setUTCHours(hour, 0, 0, 0);
    this.current = Math.max(this.current, date.getTime());
    return this.now();
  }

  set(at: Date): void {
    this.current = at.getTime();
  }
}
