import { useId, useState } from 'react';
import { IconCopy, IconEye, IconEyeOff, IconRefresh } from '@/components/icons';
import { StrengthMeter } from '@/components/ui/StrengthMeter';
import { generatePassword, DEFAULT_GENERATOR_OPTIONS } from '@/services/passwordGenerator';
import { useCopy } from '@/hooks/useCopy';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  autoFocus?: boolean;
  showStrength?: boolean;
  showGenerate?: boolean;
  /** Called before revealing; return false to keep the value hidden. */
  onBeforeReveal?: () => Promise<boolean> | boolean;
}

export function PasswordField({
  value,
  onChange,
  label = 'Parol',
  autoFocus = false,
  showStrength = true,
  showGenerate = true,
  onBeforeReveal,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const copy = useCopy();
  const id = useId();

  const toggleVisible = async () => {
    if (!visible && onBeforeReveal) {
      const allowed = await onBeforeReveal();
      if (!allowed) return;
    }
    setVisible((current) => !current);
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
        <span className="field__optional u-mono">{value.length} belgi</span>
      </label>

      <div className="input-group">
        <input
          id={id}
          className="input input--mono"
          type={visible ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete="new-password"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />

        <button
          type="button"
          className="btn btn--icon"
          onClick={() => void toggleVisible()}
          aria-label={visible ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
          title={visible ? 'Yashirish' : 'Ko‘rsatish'}
        >
          {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>

        <button
          type="button"
          className="btn btn--icon"
          onClick={() => void copy(value, 'Parol', { sensitive: true })}
          aria-label="Parolni nusxalash"
          title="Nusxalash"
        >
          <IconCopy size={16} />
        </button>

        {showGenerate ? (
          <button
            type="button"
            className="btn btn--icon"
            onClick={() => onChange(generatePassword(DEFAULT_GENERATOR_OPTIONS))}
            aria-label="Yangi parol yaratish"
            title="Generator bilan yaratish"
          >
            <IconRefresh size={16} />
          </button>
        ) : null}
      </div>

      {showStrength ? <StrengthMeter password={value} showCrackTime /> : null}
    </div>
  );
}
