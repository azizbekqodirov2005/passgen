/**
 * Local password strength estimation.
 *
 * Entropy is estimated as length × log2(poolSize), then reduced for patterns
 * that make a password far easier to guess than its raw length suggests
 * (repeats, keyboard runs, dictionary-ish words, dates). This runs entirely in
 * the browser: no password is ever sent anywhere for analysis.
 */

import { charsetSizeOf } from '@/services/passwordGenerator';
import type { StrengthLevel, StrengthResult } from '@/lib/types';

/**
 * A deliberately small list of the passwords that show up at the top of every
 * published breach corpus. Kept short on purpose: a real dictionary belongs in
 * a downloadable data file, not in the main bundle.
 */
const COMMON_PASSWORDS = new Set([
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'passw0rd',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'abc123',
  'iloveyou',
  'admin',
  'admin123',
  'welcome',
  'welcome1',
  'letmein',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'sunshine',
  'princess',
  'master',
  'login',
  'starwars',
  'superman',
  'trustno1',
  'zaq12wsx',
  'parol',
  'parol123',
  'salom',
  'salom123',
  'toshkent',
  'uzbekistan',
]);

const KEYBOARD_RUNS = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '1234567890',
  'abcdefghijklmnopqrstuvwxyz',
];

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  empty: 'Parol kiritilmagan',
  weak: 'Kuchsiz',
  fair: "O'rtacha",
  good: 'Yaxshi',
  strong: 'Kuchli',
};

function hasRepeatedCharacters(password: string): boolean {
  return /(.)\1{2,}/u.test(password);
}

function hasKeyboardRun(password: string): boolean {
  const lower = password.toLowerCase();
  for (const run of KEYBOARD_RUNS) {
    for (let i = 0; i + 4 <= run.length; i += 1) {
      const slice = run.slice(i, i + 4);
      const reversed = [...slice].reverse().join('');
      if (lower.includes(slice) || lower.includes(reversed)) {
        return true;
      }
    }
  }
  return false;
}

function looksLikeDate(password: string): boolean {
  return /(19|20)\d{2}/u.test(password);
}

function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  // "password2024!" style variants: strip trailing digits/symbols and re-check.
  const stripped = lower.replace(/[^a-z]/gu, '');
  return stripped.length >= 4 && COMMON_PASSWORDS.has(stripped);
}

/** Number of distinct characters relative to length — catches "aaabbbccc". */
function varietyRatio(password: string): number {
  if (password.length === 0) return 0;
  return new Set(password).size / password.length;
}

/**
 * Length of the shortest block the password is a whole repetition of.
 * "abcabcabc" → 3, "0000" → 1, "Xk4$mQ9z" → 8 (not periodic).
 */
export function smallestPeriod(password: string): number {
  const n = password.length;
  for (let period = 1; period * 2 <= n; period += 1) {
    if (n % period !== 0) continue;
    if (password.slice(0, period).repeat(n / period) === password) {
      return period;
    }
  }
  return n;
}

/**
 * Upper bounds on how much guessing work a password really costs.
 *
 * `length × log2(poolSize)` assumes every position was chosen independently at
 * random. That assumption collapses for structured passwords: 63 zeros is not
 * a 209-bit secret, because an attacker only has to guess one character and a
 * length. These bounds model the two cheapest structures:
 *
 *  - **repetition** — the password is one block repeated: the attacker guesses
 *    the block plus how many times it repeats.
 *  - **small alphabet** — the password uses few distinct characters: the
 *    attacker guesses which characters appear, then their arrangement.
 *
 * Both are generous (they overestimate rather than underestimate), but either
 * one is far below the naive figure when the password is degenerate.
 */
function structuralCeiling(password: string, poolBits: number): {
  entropy: number;
  note: string | null;
} {
  const length = password.length;
  const lengthBits = Math.log2(length + 1);
  const unique = new Set(password).size;
  let note: string | null = null;

  // Choosing which characters appear, then arranging them.
  const alphabetBound = unique * poolBits + length * Math.log2(Math.max(unique, 1)) + lengthBits;

  const period = smallestPeriod(password);
  const repetitionBound =
    period < length
      ? period * poolBits + Math.log2(length / period) + lengthBits
      : Number.POSITIVE_INFINITY;

  const ceiling = Math.min(alphabetBound, repetitionBound);

  if (period === 1 && length > 1) {
    note = 'Parol bitta belgining takroridan iborat — uzunligi unga kuch qo‘shmaydi.';
  } else if (period < length && repetitionBound <= alphabetBound) {
    note = 'Parol bir xil blokning takroridan iborat.';
  } else if (unique <= 4 && length > unique * 2) {
    note = `Parolda atigi ${String(unique)} xil belgi ishlatilgan.`;
  }

  return { entropy: ceiling, note };
}

export function levelFromEntropy(entropy: number): StrengthLevel {
  if (entropy < 36) return 'weak';
  if (entropy < 60) return 'fair';
  if (entropy < 80) return 'good';
  return 'strong';
}

export function estimateStrength(password: string): StrengthResult {
  if (password.length === 0) {
    return { entropy: 0, level: 'empty', score: 0, notes: ['Parol kiritilmagan.'] };
  }

  const poolSize = Math.max(charsetSizeOf(password), 2);
  const poolBits = Math.log2(poolSize);
  let entropy = password.length * poolBits;
  const notes: string[] = [];

  // Structure first: a repeated or tiny-alphabet password can never be worth
  // its raw length, however long it is.
  const ceiling = structuralCeiling(password, poolBits);
  if (ceiling.entropy < entropy) {
    entropy = ceiling.entropy;
    if (ceiling.note) notes.push(ceiling.note);
  }

  if (isCommon(password)) {
    entropy = Math.min(entropy, 14);
    notes.push("Bu parol ommabop parollar ro'yxatiga juda yaqin.");
  }
  if (hasKeyboardRun(password)) {
    entropy *= 0.6;
    notes.push('Klaviatura ketma-ketligi (qwerty, 1234) ishlatilgan.');
  }
  if (hasRepeatedCharacters(password)) {
    entropy *= 0.8;
    notes.push('Bir xil belgi ketma-ket takrorlangan.');
  }
  if (looksLikeDate(password)) {
    entropy *= 0.85;
    notes.push("Parol ichida yil ko'rinishidagi son bor.");
  }

  const variety = varietyRatio(password);
  if (variety < 0.5) {
    entropy *= 0.85;
    notes.push('Belgilar xilma-xilligi past.');
  }

  if (password.length < 12) {
    notes.push('12 belgidan uzun parol ancha xavfsizroq.');
  }
  if (!/[A-Z]/u.test(password) || !/[a-z]/u.test(password)) {
    notes.push('Katta va kichik harflarni aralashtiring.');
  }
  if (!/[0-9]/u.test(password)) {
    notes.push("Raqam qo'shish parolni kuchaytiradi.");
  }
  if (!/[^A-Za-z0-9]/u.test(password)) {
    notes.push("Maxsus belgi qo'shish parolni kuchaytiradi.");
  }

  entropy = Math.round(entropy * 10) / 10;
  const level = levelFromEntropy(entropy);
  // 128 bits of entropy is treated as a full score.
  const score = Math.max(0, Math.min(100, Math.round((entropy / 128) * 100)));

  if (notes.length === 0) {
    notes.push("Parol mustahkam ko'rinadi.");
  }

  return { entropy, level, score, notes };
}

/** How long a 10^12 guesses/second attacker would need, as readable Uzbek. */
export function crackTimeLabel(entropy: number): string {
  if (entropy <= 0) return '—';
  const guessesPerSecond = 1e12;
  const seconds = Math.pow(2, entropy - 1) / guessesPerSecond;

  if (seconds < 1) return 'bir lahzada';
  if (seconds < 60) return `${Math.round(seconds)} soniya`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} daqiqa`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} soat`;
  if (seconds < 2.6e6) return `${Math.round(seconds / 86400)} kun`;
  if (seconds < 3.15e7) return `${Math.round(seconds / 2.6e6)} oy`;

  const years = seconds / 3.15e7;
  if (years < 1000) return `${Math.round(years)} yil`;
  if (years < 1e6) return `${Math.round(years / 1000)} ming yil`;
  if (years < 1e9) return `${Math.round(years / 1e6)} million yil`;
  return 'amalda cheksiz';
}
