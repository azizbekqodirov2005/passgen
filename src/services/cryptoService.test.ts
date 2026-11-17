import { describe, expect, it } from 'vitest';
import {
  calibrateIterations,
  checkMasterPassword,
  createSalt,
  createVerifier,
  CryptoError,
  decryptJson,
  decryptString,
  deriveVaultKey,
  encryptJson,
  encryptString,
  fromBase64,
  MAX_PBKDF2_ITERATIONS,
  MIN_PBKDF2_ITERATIONS,
  randomBytes,
  sha256Base64,
  toBase64,
  verifyKey,
} from './cryptoService';
import type { KdfParams } from '@/lib/types';

const kdf: KdfParams = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: MIN_PBKDF2_ITERATIONS,
  salt: createSalt(),
};

async function key(password = 'Master-Parol-2026!'): Promise<CryptoKey> {
  return deriveVaultKey(password, kdf);
}

describe('encoding helpers', () => {
  it('round-trips bytes through base64', () => {
    const bytes = randomBytes(64);
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
  });

  it('produces a stable SHA-256 digest', async () => {
    const a = await sha256Base64('salom');
    const b = await sha256Base64('salom');
    const c = await sha256Base64('salom!');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('randomBytes', () => {
  it('returns the requested length and does not repeat', () => {
    const a = toBase64(randomBytes(32));
    const b = toBase64(randomBytes(32));
    expect(randomBytes(32)).toHaveLength(32);
    expect(a).not.toBe(b);
  });
});

describe('deriveVaultKey', () => {
  it('derives a non-extractable AES-GCM key', async () => {
    const derived = await key();
    expect(derived.extractable).toBe(false);
    expect(derived.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect([...derived.usages].sort()).toEqual(['decrypt', 'encrypt']);
  });

  it('rejects an iteration count below the security floor', async () => {
    await expect(
      deriveVaultKey('Master-Parol-2026!', { ...kdf, iterations: 1000 }),
    ).rejects.toBeInstanceOf(CryptoError);
  });

  it('derives different keys from different salts', async () => {
    const a = await deriveVaultKey('same-password-123!', kdf);
    const b = await deriveVaultKey('same-password-123!', { ...kdf, salt: createSalt() });
    const envelope = await encryptString(a, 'secret');
    await expect(decryptString(b, envelope)).rejects.toBeInstanceOf(CryptoError);
  });
});

describe('AES-256-GCM encryption', () => {
  it('round-trips a string', async () => {
    const k = await key();
    const envelope = await encryptString(k, 'super-maxfiy-parol');
    expect(await decryptString(k, envelope)).toBe('super-maxfiy-parol');
  });

  it('round-trips JSON', async () => {
    const k = await key();
    const value = { name: 'Gmail', password: 'p@ss', favorite: true };
    expect(await decryptJson(k, await encryptJson(k, value))).toEqual(value);
  });

  it('never reuses an IV with the same key', async () => {
    const k = await key();
    const ivs = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      ivs.add((await encryptString(k, 'same plaintext')).iv);
    }
    expect(ivs.size).toBe(200);
  });

  it('produces different ciphertext for identical plaintext', async () => {
    const k = await key();
    const a = await encryptString(k, 'identical');
    const b = await encryptString(k, 'identical');
    expect(a.ct).not.toBe(b.ct);
  });

  it('does not leak the plaintext into the envelope', async () => {
    const k = await key();
    const envelope = await encryptString(k, 'Qwerty-Parol-123');
    expect(JSON.stringify(envelope)).not.toContain('Qwerty');
  });

  it('rejects the wrong master password', async () => {
    const right = await key('Master-Parol-2026!');
    const wrong = await key('Master-Parol-2027!');
    const envelope = await encryptString(right, 'secret');
    await expect(decryptString(wrong, envelope)).rejects.toMatchObject({
      code: 'decrypt-failed',
    });
  });

  it('detects tampered ciphertext through the GCM tag', async () => {
    const k = await key();
    const envelope = await encryptString(k, 'secret value');
    const bytes = fromBase64(envelope.ct);
    bytes[0] = (bytes[0]! ^ 0xff) & 0xff;
    await expect(
      decryptString(k, { ...envelope, ct: toBase64(bytes) }),
    ).rejects.toMatchObject({ code: 'decrypt-failed' });
  });

  it('detects a swapped IV', async () => {
    const k = await key();
    const a = await encryptString(k, 'first');
    const b = await encryptString(k, 'second');
    await expect(decryptString(k, { ...a, iv: b.iv })).rejects.toMatchObject({
      code: 'decrypt-failed',
    });
  });

  it('rejects a malformed or unknown-version envelope', async () => {
    const k = await key();
    await expect(
      decryptString(k, { v: 1, iv: '', ct: '' }),
    ).rejects.toMatchObject({ code: 'bad-envelope' });
    await expect(
      // @ts-expect-error — deliberately testing an unsupported format version.
      decryptString(k, { v: 99, iv: 'AAAA', ct: 'AAAA' }),
    ).rejects.toMatchObject({ code: 'bad-envelope' });
  });
});

describe('verifier', () => {
  it('accepts the correct key and rejects any other', async () => {
    const right = await key('Correct-Horse-7!');
    const wrong = await key('Wrong-Horse-7!');
    const verifier = await createVerifier(right);
    expect(await verifyKey(right, verifier)).toBe(true);
    expect(await verifyKey(wrong, verifier)).toBe(false);
  });
});

describe('calibrateIterations', () => {
  it('stays inside the safe range', async () => {
    const iterations = await calibrateIterations(50);
    expect(iterations).toBeGreaterThanOrEqual(MIN_PBKDF2_ITERATIONS);
    expect(iterations).toBeLessThanOrEqual(MAX_PBKDF2_ITERATIONS);
  });
});

describe('checkMasterPassword', () => {
  it('accepts a strong master password', () => {
    expect(checkMasterPassword('Toshkent-2026!xy').ok).toBe(true);
  });

  it('rejects short, single-case and all-same passwords', () => {
    expect(checkMasterPassword('short1!A').ok).toBe(false);
    expect(checkMasterPassword('alllowercase123!').problems.length).toBeGreaterThan(0);
    expect(checkMasterPassword('aaaaaaaaaaaaaaaa').ok).toBe(false);
    expect(checkMasterPassword('NoDigitsHere!!!!').ok).toBe(false);
    expect(checkMasterPassword('NoSymbols1234567').ok).toBe(false);
  });
});
