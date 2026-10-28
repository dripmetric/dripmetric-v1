/** Internal barrel: lets projects.ts pull crypto and key helpers without importing
 *  index.ts, which re-exports projects.ts and would be a cycle. */
export { encrypt, decrypt, newProjectMaskingSecret } from './crypto.js';
export { generateKey, keyLookupHash, lastFour } from './keys.js';
