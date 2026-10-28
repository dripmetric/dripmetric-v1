import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { dbEnv } from './env.js';

/**
 * App-level envelope encryption (settled decision D4): AES-256-GCM, with the key id
 * stored beside each ciphertext so a key rotates without a backfill. Not Supabase
 * Vault, not pgsodium, so the data stays portable (settled decision 1).
 *
 * What is encrypted: Slack and Discord webhook URLs and tokens, end-user emails and
 * name-like traits, and each project's masking secret (brief section 10).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM's standard nonce length
const TAG_BYTES = 16;

export interface Ciphertext {
  /** `<iv><tag><ciphertext>`, stored in a bytea column. */
  bytes: Buffer;
  /** Which key encrypted it. Stored in the sibling `*_key_id` column. */
  keyId: string;
}

interface KeyRing {
  /** The key new ciphertexts are written with: the first in ENCRYPTION_KEYS. */
  primary: { id: string; key: Buffer };
  /** Every key, so older ciphertexts still decrypt. */
  byId: Map<string, Buffer>;
}

let ring: KeyRing | undefined;

function keyring(): KeyRing {
  if (ring) return ring;
  const entries = dbEnv()
    .ENCRYPTION_KEYS.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(':');
      if (separator < 1) {
        throw new Error('ENCRYPTION_KEYS entries must look like `<keyId>:<base64 32-byte key>`.');
      }
      const id = part.slice(0, separator);
      const key = Buffer.from(part.slice(separator + 1), 'base64');
      if (key.length !== 32) {
        throw new Error(`Encryption key "${id}" is ${key.length} bytes; AES-256 needs 32.`);
      }
      return [id, key] as const;
    });

  const first = entries[0];
  if (!first) throw new Error('ENCRYPTION_KEYS is empty.');
  ring = { primary: { id: first[0], key: first[1] }, byId: new Map(entries) };
  return ring;
}

export function resetKeyringCache(): void {
  ring = undefined;
}

export function encrypt(plaintext: string | Buffer): Ciphertext {
  const { primary } = keyring();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, primary.key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  return { bytes: Buffer.concat([iv, cipher.getAuthTag(), body]), keyId: primary.id };
}

export function decrypt(bytes: Buffer, keyId: string): Buffer {
  const key = keyring().byId.get(keyId);
  if (!key) throw new Error(`No encryption key "${keyId}". It must stay in ENCRYPTION_KEYS to decrypt old rows.`);
  if (bytes.length < IV_BYTES + TAG_BYTES) throw new Error('Ciphertext is too short to be valid.');
  const iv = bytes.subarray(0, IV_BYTES);
  const tag = bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

export function decryptText(bytes: Buffer, keyId: string): string {
  return decrypt(bytes, keyId).toString('utf8');
}

/** API keys are looked up by this, never by the token itself. */
export function lookupHash(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Constant-time compare, for anything a caller supplies. */
export function sameSecret(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The masking tag (settled decision 6): the first 6 hex characters, uppercased, of an
 * HMAC-SHA256 of the user id under a per-project secret. Stable per user, and it
 * cannot be reversed, so "User A7F2C1" is safe to show a free project.
 */
export function maskTag(projectSecret: Buffer, userId: string): string {
  return createHmac('sha256', projectSecret).update(userId, 'utf8').digest('hex').slice(0, 6).toUpperCase();
}

export function newProjectMaskingSecret(): Buffer {
  return randomBytes(32);
}
