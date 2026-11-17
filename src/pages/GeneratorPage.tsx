import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconCopy, IconPlus, IconRefresh } from '@/components/icons';
import { StrengthMeter } from '@/components/ui/StrengthMeter';
import { Switch } from '@/components/ui/Switch';
import {
  CHARSETS,
  DEFAULT_GENERATOR_OPTIONS,
  MAX_LENGTH,
  MIN_LENGTH,
  generatePassword,
  generateVariations,
  validateOptions,
} from '@/services/passwordGenerator';
import { useCopy } from '@/hooks/useCopy';
import type { GeneratorOptions } from '@/lib/types';

interface GeneratorPageProps {
  onSave: (password: string) => void;
}

const TYPE_TOGGLES: {
  key: keyof Pick<GeneratorOptions, 'uppercase' | 'lowercase' | 'numbers' | 'symbols'>;
  label: string;
  sample: string;
}[] = [
  { key: 'uppercase', label: 'Katta harflar', sample: CHARSETS.uppercase.slice(0, 6) },
  { key: 'lowercase', label: 'Kichik harflar', sample: CHARSETS.lowercase.slice(0, 6) },
  { key: 'numbers', label: 'Raqamlar', sample: CHARSETS.numbers.slice(0, 6) },
  { key: 'symbols', label: 'Maxsus belgilar', sample: CHARSETS.symbols.slice(0, 6) },
];

export function GeneratorPage({ onSave }: GeneratorPageProps) {
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  const [password, setPassword] = useState('');
  const [variations, setVariations] = useState<string[]>([]);
  const copy = useCopy();

  const validation = useMemo(() => validateOptions(options), [options]);

  const regenerate = useCallback(() => {
    if (!validation.ok) {
      setPassword('');
      setVariations([]);
      return;
    }
    setPassword(generatePassword(options));
    setVariations([]);
  }, [options, validation.ok]);

  // Regenerate whenever the configuration changes, so the readout always
  // reflects the current options rather than a stale password.
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const set = <K extends keyof GeneratorOptions>(key: K, value: GeneratorOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const progress = ((options.length - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH)) * 100;

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">Parol generatori</h1>
          <p className="page__subtitle">
            Barcha tasodifiylik <code className="u-mono">crypto.getRandomValues()</code> dan
            olinadi — <code className="u-mono">Math.random()</code> ishlatilmaydi.
          </p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn" onClick={regenerate} disabled={!validation.ok}>
            <IconRefresh size={16} />
            Qayta yaratish
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onSave(password)}
            disabled={password.length === 0}
          >
            <IconPlus size={16} />
            Omborga saqlash
          </button>
        </div>
      </div>

      <div className="generator">
        <div className="u-stack">
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Yaratilgan parol</h2>
              <span className="badge u-mono">{password.length} / {options.length}</span>
            </div>
            <div className="card__body u-stack">
              <div className="readout">
                <code className="readout__value">
                  {password.length > 0 ? password : 'Sozlamalarni to‘g‘rilang'}
                </code>
                <div className="readout__actions">
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={() => void copy(password, 'Parol', { sensitive: true })}
                    disabled={password.length === 0}
                    aria-label="Parolni nusxalash"
                    title="Nusxalash"
                  >
                    <IconCopy size={17} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={regenerate}
                    disabled={!validation.ok}
                    aria-label="Qayta yaratish"
                    title="Qayta yaratish"
                  >
                    <IconRefresh size={17} />
                  </button>
                </div>
              </div>

              <StrengthMeter password={password} showCrackTime showNotes />

              {!validation.ok ? (
                <div className="notice notice--danger">
                  <div>
                    <strong>Sozlamalar to‘g‘ri emas.</strong>
                    <ul style={{ marginTop: 'var(--space-2)' }}>
                      {validation.problems.map((problem) => (
                        <li key={problem}>• {problem}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Variantlar</h2>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setVariations(generateVariations(options, 5))}
                disabled={!validation.ok}
              >
                5 ta variant yaratish
              </button>
            </div>
            <div className="card__body card__body--flush">
              {variations.length === 0 ? (
                <div className="empty" style={{ padding: 'var(--space-8) var(--space-5)' }}>
                  <p className="empty__text">
                    Bir nechta variantdan birini tanlash uchun yuqoridagi tugmani bosing.
                  </p>
                </div>
              ) : (
                <ul>
                  {variations.map((variation) => (
                    <li key={variation} className="variation">
                      <code className="variation__value">{variation}</code>
                      <button
                        type="button"
                        className="btn btn--icon btn--sm"
                        onClick={() => void copy(variation, 'Parol', { sensitive: true })}
                        aria-label="Nusxalash"
                        title="Nusxalash"
                      >
                        <IconCopy size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setPassword(variation)}
                      >
                        Tanlash
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Sozlamalar</h2>
          </div>
          <div className="card__body u-stack">
            <div className="field">
              <label className="field__label" htmlFor="generator-length">
                <span>Uzunlik</span>
                <span className="u-mono" style={{ color: 'var(--accent)' }}>
                  {options.length}
                </span>
              </label>
              <input
                id="generator-length"
                className="range"
                style={{ ['--range-progress' as string]: `${String(progress)}%` }}
                type="range"
                min={MIN_LENGTH}
                max={MAX_LENGTH}
                value={options.length}
                onChange={(event) => set('length', Number(event.target.value))}
              />
              <div className="u-row" style={{ justifyContent: 'space-between' }}>
                <span className="field__hint u-mono">{MIN_LENGTH}</span>
                <span className="field__hint">
                  16 belgidan uzun parol tavsiya etiladi
                </span>
                <span className="field__hint u-mono">{MAX_LENGTH}</span>
              </div>
            </div>

            <div className="u-stack" style={{ gap: 'var(--space-2)' }}>
              <span className="u-label">Belgi turlari</span>
              {TYPE_TOGGLES.map((toggle) => (
                <label key={toggle.key} className="check">
                  <input
                    type="checkbox"
                    checked={options[toggle.key]}
                    onChange={(event) => set(toggle.key, event.target.checked)}
                  />
                  <span>{toggle.label}</span>
                  <code className="check__sample">{toggle.sample}</code>
                </label>
              ))}
            </div>

            <Switch
              checked={options.excludeAmbiguous}
              onChange={(checked) => set('excludeAmbiguous', checked)}
              title="Chalkash belgilarni chiqarib tashlash"
              hint="I, l, 1, O, 0 kabi belgilar qo‘lda kiritishda adashtiradi."
            />

            <div className="notice notice--info">
              <div>
                Tanlangan har bir belgi turi parolda kamida bir marta uchraydi,
                so‘ng natija tasodifiy aralashtiriladi.
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
