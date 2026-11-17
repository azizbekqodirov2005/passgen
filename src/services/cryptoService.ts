/**
 * cryptoService — the single place where cryptography happens.
 *
 * Design rules (do not relax these):
 *  - AES-256-GCM for all payloads (authenticated encryption).
 *  - A fresh, cryptographically random 12-byte IV for every encryption call.
 *    IVs are never reused with the same key.
 *  - PBKDF2-SHA-256 for key derivation, with a calibrated iteration count that
 *    is stored alongside the ciphertext so it can be raised in the future.
 *  - The derived key is non-extractable: it cannot leave the browser's crypto
 *    engine, not even through a bug in our own code.
 *  - No key, no master password and no plaintext ever reaches localStorage,
 *    sessionStorage, IndexedDB, the network or the console.
 *
 * Nothing in this module imports React or touches the DOM, so it can be
 * unit-tested exactly as it runs in the browser.
 */

import { CRYPTO_FORMAT_VERSION, type EncryptedEnvelope, type KdfParams } from '@/lib/types';

const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_BYTES = 12; // 96 bits — the size recommended for GCM.
const SALT_BYTES = 16;
const VERIFIER_TOKEN = 'passgen.vault.verifier.v1';

/** Floor for PBKDF2 iterations (OWASP guidance for PBKDF2-HMAC-SHA256). */
export const MIN_PBKDF2_ITERATIONS = 310_000;
/** Ceiling, so a fast machine does not create a vault a slow phone cannot open. */
export const MAX_PBKDF2_ITERATIONS = 1_200_000;
/** Target wall-clock cost of one derivation, in milliseconds. */
export const TARGET_DERIVATION_MS = 450;

export class CryptoError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported'
      | 'decrypt-failed'
      | 'bad-envelope'
      | 'weak-master-password',
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle || typeof c.getRandomValues !== 'function') {
    throw new CryptoError(
      "Bu brauzer Web Crypto API'ni qo'llab-quvvatlamaydi. PassGen HTTPS yoki localhost ustida ishlashi kerak.",
      'unsupported',
    );
  }
  return c.subtle;
}

/** Cryptographically secure random bytes. Never Math.random(). */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function isWebCryptoAvailable(): boolean {
  return Boolean(globalThis.crypto?.subtle && globalThis.isSecureContext !== false);
}

/* ------------------------------------------------------------------ *
 * Encoding helpers
 * ------------------------------------------------------------------ */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** SHA-256 of a string, base64-encoded. Used for integrity + local reuse checks. */
export async function sha256Base64(value: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', textEncoder.encode(value));
  return toBase64(new Uint8Array(digest));
}

/* ------------------------------------------------------------------ *
 * Key derivation
 * ------------------------------------------------------------------ */

export function createSalt(): string {
  return toBase64(randomBytes(SALT_BYTES));
}

/**
 * Measure how many PBKDF2 iterations this device can afford and clamp the
 * result into a safe range. Calibration keeps the vault strong on a desktop
 * without making it unusable on a slow phone.
 */
export async function calibrateIterations(
  targetMs: number = TARGET_DERIVATION_MS,
): Promise<number> {
  const probeIterations = 50_000;
  const probeSalt = randomBytes(SALT_BYTES);
  const material = await importMasterPasswordMaterial('calibration-probe');

  const started = performance.now();
  await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: probeSalt, iterations: probeIterations },
    material,
    256,
  );
  const elapsed = Math.max(performance.now() - started, 1);

  const scaled = Math.round((probeIterations * targetMs) / elapsed);
  const rounded = Math.round(scaled / 10_000) * 10_000;
  return Math.min(MAX_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, rounded));
}

async function importMasterPasswordMaterial(masterPassword: string): Promise<CryptoKey> {
  return subtle().importKey(
    'raw',
    textEncoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );
}

/**
 * Derive the vault key from the master password.
 * The returned CryptoKey is non-extractable and only valid for AES-GCM.
 */
export async function deriveVaultKey(
  masterPassword: string,
  kdf: KdfParams,
): Promise<CryptoKey> {
  if (kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') {
    throw new CryptoError("Kalit hosil qilish formati noto'g'ri.", 'bad-envelope');
  }
  if (kdf.iterations < MIN_PBKDF2_ITERATIONS) {
    throw new CryptoError(
      'Saqlangan iteratsiya soni xavfsizlik chegarasidan past.',
      'bad-envelope',
    );
  }
  const material = await importMasterPasswordMaterial(masterPassword);
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      hash: kdf.hash,
      salt: fromBase64(kdf.salt),
      iterations: kdf.iterations,
    },
    material,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    /* extractable */ false,
    ['encrypt', 'decrypt'],
  );
}

/* ------------------------------------------------------------------ *
 * Encryption / decryption
 * ------------------------------------------------------------------ */

export async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedEnvelope> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await subtle().encrypt(
    { name: AES_ALGORITHM, iv },
    key,
    textEncoder.encode(plaintext),
  );
  return {
    v: CRYPTO_FORMAT_VERSION,
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptString(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<string> {
  assertEnvelope(envelope);
  try {
    const plaintext = await subtle().decrypt(
      { name: AES_ALGORITHM, iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ct),
    );
    return textDecoder.decode(plaintext);
  } catch {
    // A GCM tag mismatch means a wrong key or tampered data. Both are the same
    // answer to the caller, and the underlying error is never surfaced.
    throw new CryptoError(
      "Ma'lumotni ochib bo'lmadi: master parol xato yoki ma'lumot buzilgan.",
      'decrypt-failed',
    );
  }
}

export async function encryptJson<T>(key: CryptoKey, value: T): Promise<EncryptedEnvelope> {
  return encryptString(key, JSON.stringify(value));
}

export async function decryptJson<T>(key: CryptoKey, envelope: EncryptedEnvelope): Promise<T> {
  return JSON.parse(await decryptString(key, envelope)) as T;
}

export function assertEnvelope(value: unknown): asserts value is EncryptedEnvelope {
  const env = value as Partial<EncryptedEnvelope> | null;
  if (
    !env ||
    typeof env.iv !== 'string' ||
    typeof env.ct !== 'string' ||
    env.iv.length === 0 ||
    env.ct.length === 0
  ) {
    throw new CryptoError("Shifrlangan ma'lumot formati buzilgan.", 'bad-envelope');
  }
  if (env.v !== CRYPTO_FORMAT_VERSION) {
    throw new CryptoError(
      `Shifrlash formati (v${String(env.v)}) bu versiyada qo'llab-quvvatlanmaydi.`,
      'bad-envelope',
    );
  }
}

/* ------------------------------------------------------------------ *
 * Verifier — lets us check a master password without reading credentials
 * ------------------------------------------------------------------ */

export async function createVerifier(key: CryptoKey): Promise<EncryptedEnvelope> {
  return encryptString(key, VERIFIER_TOKEN);
}

export async function verifyKey(
  key: CryptoKey,
  verifier: EncryptedEnvelope,
): Promise<boolean> {
  try {
    return (await decryptString(key, verifier)) === VERIFIER_TOKEN;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Master password policy
 * ------------------------------------------------------------------ */

export interface MasterPasswordCheck {
  ok: boolean;
  problems: string[];
}

/**
 * The master password is the only thing standing between an attacker with the
 * device and the whole vault, so it is held to a stricter standard than the
 * passwords stored inside.
 */
export function checkMasterPassword(masterPassword: string): MasterPasswordCheck {
  const problems: string[] = [];
  if (masterPassword.length < 12) {
    problems.push("Kamida 12 belgi bo'lishi kerak.");
  }
  if (!/[a-z]/u.test(masterPassword) || !/[A-Z]/u.test(masterPassword)) {
    problems.push('Kichik va katta harflar aralash kelishi kerak.');
  }
  if (!/[0-9]/u.test(masterPassword)) {
    problems.push('Kamida bitta raqam kerak.');
  }
  if (!/[^A-Za-z0-9]/u.test(masterPassword)) {
    problems.push('Kamida bitta maxsus belgi kerak.');
  }
  if (/^(.)\1+$/u.test(masterPassword)) {
    problems.push('Bir xil belgidan iborat parol ishlamaydi.');
  }
  return { ok: problems.length === 0, problems };
}
