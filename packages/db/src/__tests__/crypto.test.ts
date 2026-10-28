import { describe, expect, it } from 'vitest';
import { decrypt, decryptText, encrypt, lookupHash, maskTag, newProjectMaskingSecret, resetKeyringCache } from '../crypto.js';
import { resetDbEnvCache } from '../env.js';
import { displayKey, generateKey, parseKey } from '../keys.js';

describe('envelope encryption (settled decision D4)', () => {
  it('round-trips and records which key was used', () => {
    const { bytes, keyId } = encrypt('alice@example.com');
    expect(keyId).toBe('k1');
    expect(decryptText(bytes, keyId)).toBe('alice@example.com');
  });

  it('produces a different ciphertext every time, so equal emails are not equal rows', () => {
    const a = encrypt('alice@example.com');
    const b = encrypt('alice@example.com');
    expect(a.bytes.equals(b.bytes)).toBe(false);
  });

  it('refuses a tampered ciphertext rather than returning wrong plaintext', () => {
    const { bytes, keyId } = encrypt('alice@example.com');
    const tampered = Buffer.from(bytes);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decrypt(tampered, keyId)).toThrow();
  });

  it('decrypts with an older key while new rows use the newest one', () => {
    const original = process.env['ENCRYPTION_KEYS'];
    const old = encrypt('alice@example.com');
    try {
      // A rotation puts the new key first; the old one must stay in the list.
      process.env['ENCRYPTION_KEYS'] = `k2:${Buffer.alloc(32, 7).toString('base64')},${original}`;
      resetDbEnvCache();
      resetKeyringCache();
      expect(encrypt('bob@example.com').keyId).toBe('k2');
      expect(decryptText(old.bytes, old.keyId)).toBe('alice@example.com');
    } finally {
      process.env['ENCRYPTION_KEYS'] = original;
      resetDbEnvCache();
      resetDbEnvCache();
      resetKeyringCache();
    }
  });

  it('names the missing key when an old ciphertext can no longer be read', () => {
    expect(() => decrypt(Buffer.alloc(40), 'k9')).toThrow(/No encryption key "k9"/);
  });
});

describe('masking tag (settled decision 6)', () => {
  const secret = newProjectMaskingSecret();

  it('is 6 uppercase hex characters, so it reads as "User A7F2C1"', () => {
    expect(maskTag(secret, 'user_123')).toMatch(/^[0-9A-F]{6}$/);
  });

  it('is stable for the same user', () => {
    expect(maskTag(secret, 'user_123')).toBe(maskTag(secret, 'user_123'));
  });

  it('differs between users and between projects, so tags cannot be matched up', () => {
    const other = newProjectMaskingSecret();
    expect(maskTag(secret, 'user_123')).not.toBe(maskTag(secret, 'user_124'));
    expect(maskTag(secret, 'user_123')).not.toBe(maskTag(other, 'user_123'));
  });
});

describe('api keys (brief section 5)', () => {
  it('generates keys with the documented prefixes', () => {
    expect(generateKey('publishable', 'live')).toMatch(/^pk_live_/);
    expect(generateKey('publishable', 'test')).toMatch(/^pk_test_/);
    expect(generateKey('secret', 'live')).toMatch(/^sk_live_/);
    expect(generateKey('secret', 'test')).toMatch(/^sk_test_/);
  });

  it('reads a key’s shape without a database round trip', () => {
    const token = generateKey('secret', 'live');
    expect(parseKey(token)).toEqual({ kind: 'secret', mode: 'live' });
    expect(parseKey('not-a-key')).toBeNull();
    expect(parseKey('pk_live_short')).toBeNull();
  });

  it('shows a key as a prefix and its last four, never in full', () => {
    const token = generateKey('secret', 'live');
    const shown = displayKey(token);
    expect(shown).toBe(`sk_live_…${token.slice(-4)}`);
    expect(shown).not.toContain(token.slice(8, 20));
  });

  it('hashes a key to a fixed-length lookup value', () => {
    expect(lookupHash('pk_live_abc')).toHaveLength(32);
    expect(lookupHash('pk_live_abc').equals(lookupHash('pk_live_abc'))).toBe(true);
    expect(lookupHash('pk_live_abc').equals(lookupHash('pk_live_abd'))).toBe(false);
  });
});
