import { STRENGTH_LABELS, crackTimeLabel, estimateStrength } from '@/lib/strength';
import type { StrengthLevel } from '@/lib/types';

export const STRENGTH_COLOR_VAR: Record<StrengthLevel, string> = {
  empty: 'var(--text-muted)',
  weak: 'var(--strength-weak)',
  fair: 'var(--strength-fair)',
  good: 'var(--strength-good)',
  strong: 'var(--strength-strong)',
};

const FILLED_BARS: Record<StrengthLevel, number> = {
  empty: 0,
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

interface StrengthMeterProps {
  password: string;
  /** Show the per-password hints under the meter. */
  showNotes?: boolean;
  showCrackTime?: boolean;
}

export function StrengthMeter({
  password,
  showNotes = false,
  showCrackTime = false,
}: StrengthMeterProps) {
  const strength = estimateStrength(password);
  const filled = FILLED_BARS[strength.level];
  const color = STRENGTH_COLOR_VAR[strength.level];

  return (
    <div className="strength" style={{ ['--strength-color' as string]: color }}>
      <div className="strength__bars" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={`strength__bar${index < filled ? ' is-on' : ''}`} />
        ))}
      </div>

      <div className="strength__row">
        <span className="strength__level">{STRENGTH_LABELS[strength.level]}</span>
        <span className="u-dim u-mono">
          {strength.level === 'empty' ? '—' : `${String(strength.entropy)} bit`}
        </span>
      </div>

      {showCrackTime && strength.level !== 'empty' ? (
        <p className="field__hint">
          Taxminiy buzish vaqti: {crackTimeLabel(strength.entropy)}
        </p>
      ) : null}

      {showNotes ? (
        <ul className="strength__notes">
          {strength.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <span className="u-visually-hidden" role="status">
        Parol kuchi: {STRENGTH_LABELS[strength.level]}
      </span>
    </div>
  );
}

export function StrengthBadge({ password }: { password: string }) {
  const { level } = estimateStrength(password);
  return <span className={`badge badge--${level}`}>{STRENGTH_LABELS[level]}</span>;
}
