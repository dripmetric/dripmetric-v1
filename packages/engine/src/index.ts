/**
 * Pure engines: funnel and timing (M6), intent (M7), leaks (M8).
 *
 * Every function here takes `now` as an argument and does no I/O (CLAUDE.md rule 9).
 * Workers load the facts, call the engine and store the result, so the simulator and
 * the time-travel tests can move the clock themselves. ESLint enforces the no-clock
 * rule for this package.
 */
export const ENGINE_PACKAGE_READY = true;
