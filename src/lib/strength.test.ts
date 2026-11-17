import { describe, expect, it } from 'vitest';
import {
  crackTimeLabel,
  estimateStrength,
  levelFromEntropy,
  smallestPeriod,
} from './strength';
import { generatePassword } from '@/services/passwordGenerator';
import { DEFAULT_GENERATOR_OPTIONS } from '@/services/passwordGenerator';

describe('estimateStrength', () => {
  it('reports an empty password distinctly', () => {
    const result = estimateStrength('');
    expect(result.level).toBe('empty');
    expect(result.score).toBe(0);
  });

  it('marks well-known passwords as weak', () => {
    for (const password of ['123456', 'password', 'qwerty', 'parol123', 'admin']) {
      expect(estimateStrength(password).level).toBe('weak');
    }
  });

  it('marks generated 20-character passwords as strong', () => {
    for (let i = 0; i < 20; i += 1) {
      const password = generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length: 20 });
      expect(estimateStrength(password).level).toBe('strong');
    }
  });

  it('penalises keyboard runs and repeats', () => {
    const plain = estimateStrength('Hj7#pQ2!vLz9');
    const run = estimateStrength('Hqwerty7#pQ2');
    const repeat = estimateStrength('Haaaa7#pQ2!v');
    expect(run.entropy).toBeLessThan(plain.entropy);
    expect(repeat.entropy).toBeLessThan(plain.entropy);
  });

  it('keeps the score inside 0–100', () => {
    for (const password of ['a', 'password', generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length: 64 })]) {
      const { score } = estimateStrength(password);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('explains what is wrong without echoing the password', () => {
    const result = estimateStrength('salom');
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes.join(' ')).not.toContain('salom');
  });

  it('rewards extra length monotonically for random passwords', () => {
    const short = estimateStrength('Xk4$mQ9z');
    const long = estimateStrength('Xk4$mQ9zTr6&wBn2');
    expect(long.entropy).toBeGreaterThan(short.entropy);
  });
});

describe('levelFromEntropy', () => {
  it('maps bands in order', () => {
    expect(levelFromEntropy(20)).toBe('weak');
    expect(levelFromEntropy(45)).toBe('fair');
    expect(levelFromEntropy(70)).toBe('good');
    expect(levelFromEntropy(120)).toBe('strong');
  });
});

describe('crackTimeLabel', () => {
  it('scales from instant to effectively infinite', () => {
    expect(crackTimeLabel(0)).toBe('—');
    expect(crackTimeLabel(20)).toBe('bir lahzada');
    expect(crackTimeLabel(128)).toBe('amalda cheksiz');
  });
});

describe('degenerate passwords (structure beats raw length)', () => {
  it('does not credit a long run of one character', () => {
    const result = estimateStrength('0'.repeat(63));
    expect(result.level).toBe('weak');
    expect(result.entropy).toBeLessThan(20);
    expect(result.notes.join(' ')).toContain('takrorid');
  });

  it('treats repeated blocks as the block, not the whole string', () => {
    expect(estimateStrength('abcabcabcabcabcabcabcabc').level).toBe('weak');
    expect(estimateStrength('ab'.repeat(20)).level).toBe('weak');
    expect(estimateStrength('Xk4$'.repeat(8)).entropy).toBeLessThan(40);
  });

  it('penalises a tiny alphabet even without exact repetition', () => {
    const twoChars = estimateStrength('aababbaabbababbaabab');
    const manyChars = estimateStrength('r8#Kp2$wQz!7mTv4Lx9B');
    expect(twoChars.entropy).toBeLessThan(manyChars.entropy);
  });

  it('never rates a long degenerate password above a short random one', () => {
    expect(estimateStrength('1'.repeat(64)).entropy).toBeLessThan(
      estimateStrength('Xk4$mQ9z').entropy,
    );
  });

  it('leaves genuinely random passwords untouched', () => {
    for (let i = 0; i < 30; i += 1) {
      const password = generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length: 20 });
      const result = estimateStrength(password);
      expect(result.level).toBe('strong');
      expect(result.entropy).toBeGreaterThan(100);
    }
  });
});

describe('smallestPeriod', () => {
  it('finds the repeating unit', () => {
    expect(smallestPeriod('0000')).toBe(1);
    expect(smallestPeriod('abcabc')).toBe(3);
    expect(smallestPeriod('abcd')).toBe(4);
    expect(smallestPeriod('a')).toBe(1);
  });
});
