/**
 * @dripmetric/sim — the simulator (brief section 10).
 *
 * It plays synthetic people through three dummy products and KNOWS IN ADVANCE who
 * will pay, stall or leave. That truth is stored beside the events, which is what
 * lets an engine be scored ("what share of stalled users did leak detection catch?")
 * instead of merely inspected.
 *
 * Deterministic by seed, and on a virtual clock, so a 30-day journey generates in
 * milliseconds and a 49-hour stall is a number rather than a wait.
 */
export { runSimulation } from './run.js';
export type { RunOptions, SimRun } from './run.js';
export { loadThroughApi } from './load.js';
export type { LoadOptions, LoadResult } from './load.js';
export { playPersona } from './personas.js';
export type { PersonaContext } from './personas.js';
export { PRODUCTS, PRODUCT_KEYS, product } from './products/index.js';
export { Rng } from './random.js';
export { VirtualClock } from './clock.js';
export { injectFaults, deliveryOrder, deliveredAt } from './faults.js';
export type { FaultOptions, FaultResult } from './faults.js';
export {
  toNativeBatch,
  toSegmentBatch,
  toRudderStackBatch,
  toPostHogEvents,
  postHogAutocaptureNoise,
} from './emitters.js';
export { configureProject } from './setup.js';
export { scoreIngest, formatScore, share } from './score.js';
export type { IngestScore } from './score.js';
export { FAULT_NAMES } from './types.js';
export type {
  FaultName,
  PersonaKey,
  ProductDefinition,
  ProductKey,
  SimMessage,
  TruthFile,
  UserTruth,
} from './types.js';
