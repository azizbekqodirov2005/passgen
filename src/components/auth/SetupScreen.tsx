import { useMemo, useState } from 'react';
import { PassGenMark } from '@/components/layout/Logo';
import { AzbekDevLogo } from '@/components/layout/Logo';
import { IconAlert, IconCheck, IconEye, IconEyeOff } from '@/components/icons';
import { StrengthMeter } from '@/components/ui/StrengthMeter';
import { checkMasterPassword } from '@/services/cryptoService';
import { useVault } from '@/state/VaultProvider';
import { useToast } from '@/state/ToastProvider';

const RULES = [
  { test: (value: string) => value.length >= 12, label: 'Kamida 12 belgi' },
  {
    test: (value: string) => /[a-z]/u.test(value) && /[A-Z]/u.test(value),
    label: 'Kichik va katta harf',
  },
  { test: (value: string) => /[0-9]/u.test(value), label: 'Kamida bitta raqam' },
  { test: (value: string) => /[^A-Za-z0-9]/u.test(value), label: 'Kamida bitta maxsus belgi' },
];

export function SetupScreen() {
  const { initialise, busy } = useVault();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const policy = useMemo(() => checkMasterPassword(password), [password]);
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit =
    policy.ok && !mismatch && confirmation.length > 0 && acknowledged && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await initialise(password);
      setPassword('');
      setConfirmation('');
      toast.success('Ombor yaratildi', 'Endi parollaringizni saqlashni boshlashingiz mumkin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Omborni yaratib bo‘lmadi.');
    }
  };

  return (
    <div className="gate">
      <div className="gate__panel">
        <div className="gate__brand">
          <PassGenMark size={34} />
          <div>
            <h1 className="gate__title">PassGen</h1>
            <p className="u-label">Mahalliy, shifrlangan parol ombori</p>
          </div>
        </div>

        <p className="gate__lead">
          Boshlash uchun master parol yarating. Ombor shu parol asosida
          AES-256-GCM bilan brauzeringizda shifrlanadi — parol hech qayerga
          yuborilmaydi va saqlanmaydi.
        </p>

        <form className="gate__form" onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label className="field__label" htmlFor="master-password">
              <span>Master parol</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setVisible((current) => !current)}
              >
                {visible ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                {visible ? 'Yashirish' : 'Ko‘rsatish'}
              </button>
            </label>
            <input
              id="master-password"
              className="input input--mono"
              type={visible ? 'text' : 'password'}
              value={password}
              autoComplete="new-password"
              autoFocus
              spellCheck={false}
              onChange={(event) => setPassword(event.target.value)}
            />
            <StrengthMeter password={password} showCrackTime />
          </div>

          <ul className="checklist">
            {RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.label} className={`checklist__item${ok ? ' is-ok' : ''}`}>
                  {ok ? <IconCheck size={13} /> : <IconAlert size={13} />}
                  {rule.label}
                </li>
              );
            })}
          </ul>

          <div className="field">
            <label className="field__label" htmlFor="master-password-confirm">
              <span>Master parolni tasdiqlang</span>
            </label>
            <input
              id="master-password-confirm"
              className="input input--mono"
              type={visible ? 'text' : 'password'}
              value={confirmation}
              autoComplete="new-password"
              spellCheck={false}
              aria-invalid={mismatch}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            {mismatch ? <span className="field__error">Parollar mos kelmadi.</span> : null}
          </div>

          <div className="notice notice--warning">
            <IconAlert size={16} />
            <div>
              <strong>Master parolni tiklash imkoni yo‘q.</strong> PassGen uni
              saqlamaydi, shuning uchun parolni yo‘qotsangiz ombordagi
              ma’lumotlarni ochishning hech qanday yo‘li qolmaydi. Parolni
              ishonchli joyda saqlang.
            </div>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>Tushundim: master parolni yo‘qotsam, ma’lumotlar tiklanmaydi.</span>
          </label>

          {error ? <span className="field__error">{error}</span> : null}

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!canSubmit}>
            {busy ? <span className="spinner" /> : null}
            Omborni yaratish
          </button>
        </form>

        <div className="gate__foot">
          <div className="u-row" style={{ justifyContent: 'space-between' }}>
            <span>Ma’lumotlar faqat shu brauzerda saqlanadi.</span>
            <AzbekDevLogo size={22} variant="mark" />
          </div>
        </div>
      </div>
    </div>
  );
}
