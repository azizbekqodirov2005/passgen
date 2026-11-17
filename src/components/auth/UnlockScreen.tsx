import { useState } from 'react';
import { AzbekDevLogo, PassGenMark } from '@/components/layout/Logo';
import { IconEye, IconEyeOff, IconLock, IconUpload } from '@/components/icons';
import { useVault } from '@/state/VaultProvider';

interface UnlockScreenProps {
  onRestoreRequest: () => void;
}

export function UnlockScreen({ onRestoreRequest }: UnlockScreenProps) {
  const { unlock, busy } = useVault();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length === 0 || busy) return;
    setError(null);
    try {
      await unlock(password);
      setPassword('');
      setAttempts(0);
    } catch (caught) {
      setAttempts((count) => count + 1);
      setError(caught instanceof Error ? caught.message : 'Omborni ochib bo‘lmadi.');
      setPassword('');
    }
  };

  return (
    <div className="gate">
      <div className="gate__panel">
        <div className="gate__brand">
          <PassGenMark size={34} />
          <div>
            <h1 className="gate__title">Ombor qulflangan</h1>
            <p className="u-label">PassGen</p>
          </div>
        </div>

        <p className="gate__lead">
          Davom etish uchun master parolni kiriting. Kalit brauzeringizda qayta
          hosil qilinadi — bu bir necha yuz ming iteratsiya, shuning uchun
          ochilish bir lahza vaqt olishi normal.
        </p>

        <form className="gate__form" onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label className="field__label" htmlFor="unlock-password">
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
              id="unlock-password"
              className="input input--mono"
              type={visible ? 'text' : 'password'}
              value={password}
              autoComplete="current-password"
              autoFocus
              spellCheck={false}
              aria-invalid={error !== null}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? <span className="field__error">{error}</span> : null}
          </div>

          {attempts >= 3 ? (
            <div className="notice notice--info">
              <IconLock size={16} />
              <div>
                Master parolni eslay olmayapsizmi? Afsuski tiklash yo‘li yo‘q —
                shifrlash kaliti faqat shu paroldan hosil bo‘ladi. Agar
                zaxira nusxangiz bo‘lsa, uni tiklab ko‘rishingiz mumkin.
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--block"
            disabled={password.length === 0 || busy}
          >
            {busy ? <span className="spinner" /> : null}
            Omborni ochish
          </button>

          <button type="button" className="btn btn--ghost btn--block" onClick={onRestoreRequest}>
            <IconUpload size={15} />
            Zaxira nusxadan tiklash
          </button>
        </form>

        <div className="gate__foot">
          <div className="u-row" style={{ justifyContent: 'space-between' }}>
            <span>Shifrlash va ochish brauzeringizda bajariladi.</span>
            <AzbekDevLogo size={22} variant="mark" />
          </div>
        </div>
      </div>
    </div>
  );
}
