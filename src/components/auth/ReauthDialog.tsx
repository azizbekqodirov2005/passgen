import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { IconLock } from '@/components/icons';
import { REAUTH_COPY, type ReauthPurpose } from '@/hooks/useReauth';

interface ReauthDialogProps {
  purpose: ReauthPurpose;
  onSubmit: (masterPassword: string) => Promise<boolean>;
  onCancel: () => void;
}

export function ReauthDialog({ purpose, onSubmit, onCancel }: ReauthDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = REAUTH_COPY[purpose];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await onSubmit(password);
      if (!ok) {
        setError('Master parol noto‘g‘ri.');
        setPassword('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={copy.title} description={copy.description} size="narrow" onClose={onCancel}>
      <form className="u-stack" onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label className="field__label" htmlFor="reauth-password">
            <span>Master parol</span>
          </label>
          <input
            id="reauth-password"
            className="input input--mono"
            type="password"
            value={password}
            autoComplete="current-password"
            autoFocus
            spellCheck={false}
            aria-invalid={error !== null}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <span className="field__error">{error}</span> : null}
        </div>

        <div className="u-row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Bekor qilish
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={password.length === 0 || busy}
          >
            {busy ? <span className="spinner" /> : <IconLock size={15} />}
            Tasdiqlash
          </button>
        </div>
      </form>
    </Modal>
  );
}
