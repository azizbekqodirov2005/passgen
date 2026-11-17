/**
 * passwordGenerator — cryptographically secure password generation.
 *
 * All randomness comes from crypto.getRandomValues(). Math.random() is never
 * used here, and rejection sampling removes the modulo bias that a naive
 * `random % charset.length` would introduce.
 */

import type { GeneratorOptions } from '@/lib/types';

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 64;

export const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
} as const;

/** Characters that are easy to confuse when read or typed by hand. */
export const AMBIGUOUS_CHARACTERS = 'Il1O0o|`\'"{}[]()/\\~,;:.<>';

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

export class GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorError';
  }
}

export interface GeneratorValidation {
  ok: boolean;
  problems: string[];
}

/** Reject impossible configurations before any randomness is consumed. */
export function validateOptions(options: GeneratorOptions): GeneratorValidation {
  const problems: string[] = [];

  if (!Number.isInteger(options.length)) {
    problems.push("Uzunlik butun son bo'lishi kerak.");
  }
  if (options.length < MIN_LENGTH || options.length > MAX_LENGTH) {
    problems.push(`Uzunlik ${MIN_LENGTH} va ${MAX_LENGTH} orasida bo'lishi kerak.`);
  }
  const anySelected =
    options.uppercase || options.lowercase || options.numbers || options.symbols;
  if (!anySelected) {
    problems.push('Kamida bitta belgi turini tanlang.');
  }
  if (anySelected && buildCharset(options).length === 0) {
    problems.push(
      "Tanlangan turlar va “chalkash belgilarsiz” sozlamasi birga ishlamaydi — boshqa tur qo'shing.",
    );
  }
  const selectedCount = [
    options.uppercase,
    options.lowercase,
    options.numbers,
    options.symbols,
  ].filter(Boolean).length;
  if (selectedCount > options.length) {
    problems.push("Uzunlik tanlangan turlar sonidan kichik bo'lmasligi kerak.");
  }

  return { ok: problems.length === 0, problems };
}

export function buildCharset(options: GeneratorOptions): string {
  let pool = '';
  if (options.uppercase) pool += CHARSETS.uppercase;
  if (options.lowercase) pool += CHARSETS.lowercase;
  if (options.numbers) pool += CHARSETS.numbers;
  if (options.symbols) pool += CHARSETS.symbols;

  if (options.excludeAmbiguous) {
    pool = [...pool].filter((char) => !AMBIGUOUS_CHARACTERS.includes(char)).join('');
  }
  return pool;
}

/**
 * Uniform random integer in [0, max) using rejection sampling, so every
 * character in the pool is equally likely.
 */
export function randomInt(max: number): number {
  if (max <= 0 || !Number.isInteger(max)) {
    throw new GeneratorError('randomInt: chegara musbat butun son bo‘lishi kerak.');
  }
  if (max === 1) return 0;

  const limit = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buffer);
    const value = buffer[0] as number;
    if (value < limit) {
      return value % max;
    }
    // Out of the uniform window — draw again rather than skew the distribution.
  }
}

/** Fisher–Yates shuffle driven by secure randomness. */
export function secureShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

function pick(pool: string): string {
  return pool.charAt(randomInt(pool.length));
}

function poolsFor(options: GeneratorOptions): string[] {
  const pools: string[] = [];
  const filter = (set: string) =>
    options.excludeAmbiguous
      ? [...set].filter((c) => !AMBIGUOUS_CHARACTERS.includes(c)).join('')
      : set;

  if (options.uppercase) pools.push(filter(CHARSETS.uppercase));
  if (options.lowercase) pools.push(filter(CHARSETS.lowercase));
  if (options.numbers) pools.push(filter(CHARSETS.numbers));
  if (options.symbols) pools.push(filter(CHARSETS.symbols));

  return pools.filter((pool) => pool.length > 0);
}

/**
 * Generate one password. Every selected character type is guaranteed to appear
 * at least once, and the result is shuffled so the guaranteed characters are
 * not predictably positioned.
 */
export function generatePassword(options: GeneratorOptions): string {
  const validation = validateOptions(options);
  if (!validation.ok) {
    throw new GeneratorError(validation.problems.join(' '));
  }

  const pool = buildCharset(options);
  const guaranteedPools = poolsFor(options);
  const characters: string[] = guaranteedPools.map((set) => pick(set));

  while (characters.length < options.length) {
    characters.push(pick(pool));
  }

  return secureShuffle(characters).join('');
}

/** Generate several independent variations in one go. */
export function generateVariations(options: GeneratorOptions, count: number): string[] {
  const safeCount = Math.min(Math.max(Math.trunc(count), 1), 10);
  return Array.from({ length: safeCount }, () => generatePassword(options));
}

/** Size of the pool a given password could have come from — used for entropy. */
export function charsetSizeOf(password: string): number {
  let size = 0;
  if (/[a-z]/u.test(password)) size += 26;
  if (/[A-Z]/u.test(password)) size += 26;
  if (/[0-9]/u.test(password)) size += 10;
  if (/[^A-Za-z0-9]/u.test(password)) size += 25;
  return size;
}
