import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS_CHARACTERS,
  CHARSETS,
  DEFAULT_GENERATOR_OPTIONS,
  GeneratorError,
  MAX_LENGTH,
  MIN_LENGTH,
  buildCharset,
  charsetSizeOf,
  generatePassword,
  generateVariations,
  randomInt,
  secureShuffle,
  validateOptions,
} from './passwordGenerator';
import type { GeneratorOptions } from '@/lib/types';

const base: GeneratorOptions = { ...DEFAULT_GENERATOR_OPTIONS };

describe('validateOptions', () => {
  it('accepts the defaults', () => {
    expect(validateOptions(base).ok).toBe(true);
  });

  it('rejects a length outside 8–64', () => {
    expect(validateOptions({ ...base, length: MIN_LENGTH - 1 }).ok).toBe(false);
    expect(validateOptions({ ...base, length: MAX_LENGTH + 1 }).ok).toBe(false);
    expect(validateOptions({ ...base, length: 12.5 }).ok).toBe(false);
  });

  it('rejects a configuration with no character types', () => {
    const result = validateOptions({
      ...base,
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('Kamida bitta belgi turini');
  });

  it('rejects a length smaller than the number of required types', () => {
    expect(validateOptions({ ...base, length: 3 }).ok).toBe(false);
  });
});

describe('generatePassword', () => {
  it('honours the requested length across the whole range', () => {
    for (const length of [MIN_LENGTH, 16, 32, MAX_LENGTH]) {
      expect(generatePassword({ ...base, length })).toHaveLength(length);
    }
  });

  it('includes every selected character type at least once', () => {
    for (let i = 0; i < 50; i += 1) {
      const password = generatePassword({ ...base, length: 12 });
      expect(/[A-Z]/u.test(password)).toBe(true);
      expect(/[a-z]/u.test(password)).toBe(true);
      expect(/[0-9]/u.test(password)).toBe(true);
      expect(/[^A-Za-z0-9]/u.test(password)).toBe(true);
    }
  });

  it('uses only the selected character types', () => {
    const digitsOnly = generatePassword({
      ...base,
      uppercase: false,
      lowercase: false,
      symbols: false,
      length: 20,
    });
    expect(digitsOnly).toMatch(/^[0-9]{20}$/u);
  });

  it('excludes ambiguous characters when asked', () => {
    for (let i = 0; i < 40; i += 1) {
      const password = generatePassword({ ...base, excludeAmbiguous: true, length: 40 });
      for (const char of password) {
        expect(AMBIGUOUS_CHARACTERS).not.toContain(char);
      }
    }
  });

  it('throws on an invalid configuration instead of guessing', () => {
    expect(() =>
      generatePassword({
        ...base,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
      }),
    ).toThrow(GeneratorError);
  });

  it('does not repeat itself', () => {
    const generated = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      generated.add(generatePassword({ ...base, length: 16 }));
    }
    expect(generated.size).toBe(500);
  });

  it('spreads characters across the pool rather than favouring a few', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 200; i += 1) {
      for (const char of generatePassword({ ...base, length: 32 })) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }
    const pool = buildCharset(base);
    // Every character in the pool should show up in 6,400 samples.
    expect(counts.size).toBeGreaterThan(pool.length * 0.9);
  });
});

describe('generateVariations', () => {
  it('returns the requested number of distinct passwords', () => {
    const variations = generateVariations(base, 5);
    expect(variations).toHaveLength(5);
    expect(new Set(variations).size).toBe(5);
  });

  it('clamps the count into 1–10', () => {
    expect(generateVariations(base, 0)).toHaveLength(1);
    expect(generateVariations(base, 99)).toHaveLength(10);
  });
});

describe('randomInt', () => {
  it('stays inside the bounds and covers them', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const value = randomInt(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
      seen.add(value);
    }
    expect(seen.size).toBe(5);
  });

  it('is roughly uniform (no modulo bias)', () => {
    const buckets = new Array<number>(10).fill(0);
    const draws = 20_000;
    for (let i = 0; i < draws; i += 1) {
      const index = randomInt(10);
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
    for (const count of buckets) {
      // Expected 2,000 per bucket; allow a generous ±20% band.
      expect(count).toBeGreaterThan(draws / 10 * 0.8);
      expect(count).toBeLessThan(draws / 10 * 1.2);
    }
  });

  it('rejects a non-positive bound', () => {
    expect(() => randomInt(0)).toThrow(GeneratorError);
  });
});

describe('secureShuffle', () => {
  it('keeps every element exactly once', () => {
    const input = [...'abcdefghij'];
    const shuffled = secureShuffle(input);
    expect([...shuffled].sort()).toEqual([...input].sort());
    expect(input.join('')).toBe('abcdefghij'); // input not mutated
  });
});

describe('charsetSizeOf', () => {
  it('reflects which classes a password uses', () => {
    expect(charsetSizeOf('abcdef')).toBe(26);
    expect(charsetSizeOf('abcDEF')).toBe(52);
    expect(charsetSizeOf('abcDEF123')).toBe(62);
    expect(charsetSizeOf('abcDEF123!')).toBe(87);
  });
});

describe('buildCharset', () => {
  it('matches the selected sets', () => {
    expect(buildCharset({ ...base, numbers: false, symbols: false })).toBe(
      CHARSETS.uppercase + CHARSETS.lowercase,
    );
  });
});
