import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { IconAlert, IconUpload } from '@/components/icons';
import { restoreBackup, summariseBackup } from '@/services/backupService';
import { formatDateTime } from '@/lib/format';
import type { BackupFile } from '@/lib/types';

interface RestoreDialogProps {
  file: BackupFile;
  /** Number of records that will be replaced (0 when the vault is locked). */
  existingCount: number;
  onDone: (credentialCount: number) => void | Promise<void>;
  onCancel: () => void;
}

const CONFIRM_WORD = 'TIKLASH';

export function RestoreDialog({
  file,
  existingCount,
  onDone,
  onCancel,
}: RestoreDialogProps) {
  const summary = summariseBackup(file);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = password.length > 0 && typed.trim() === CONFIRM_WORD && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const result = await restoreBackup(file, password);
      setPassword('');
      await onDone(result.credentialCount);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Zaxira nusxani tiklab bo‘lmadi.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Zaxira nusxadan tiklash"
      description="Fayl tekshirildi. Tiklash uchun shu nusxaga tegishli master parolni kiriting."
      onClose={onCancel}
    >
      <form className="u-stack" onSubmit={(event) => void submit(event)}>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <td>Nusxa olingan sana</td>
                <td>{formatDateTime(summary.createdAt)}</td>
              </tr>
              <tr>
                <td>Fayldagi yozuvlar</td>
                <td className="u-mono">{summary.credentialCount}</td>
              </tr>
              <tr>
                <td>Kategoriyalar</td>
                <td>{summary.hasCategories ? 'Mavjud' : 'Yo‘q'}</td>
              </tr>
              <tr>
                <td>PBKDF2 iteratsiyalari</td>
                <td className="u-mono">{summary.iterations.toLocaleString('uz-UZ')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="notice notice--danger">
          <IconAlert size={16} />
          <div>
            {existingCount > 0 ? (
              <>
                Hozirgi ombordagi <strong>{existingCount} yozuv butunlay
                almashtiriladi</strong> va qaytarilmaydi.
              </>
            ) : (
              <>
                Bu brauzerdagi mavjud ombor ma’lumotlari fayldagi nusxa bilan
                almashtiriladi.
              </>
            )}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="restore-password">
            <span>Nusxaning master paroli</span>
          </label>
          <input
            id="restore-password"
            className="input input--mono"
            type="password"
            value={password}
            autoComplete="current-password"
            autoFocus
            spellCheck={false}
            aria-invalid={error !== null}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="field__hint">
            Agar nusxa boshqa master parol bilan olingan bo‘lsa, shu paroldan
            foydalaning — tiklangandan keyin ombor shu parol bilan ochiladi.
          </span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="restore-confirm">
            <span>
              Tasdiqlash uchun <code className="u-mono">{CONFIRM_WORD}</code> deb yozing
            </span>
          </label>
          <input
            id="restore-confirm"
            className="input input--mono"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>

        {error ? <span className="field__error">{error}</span> : null}

        <div className="u-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Bekor qilish
          </button>
          <button type="submit" className="btn btn--danger-solid" disabled={!ready}>
            {busy ? <span className="spinner" /> : <IconUpload size={15} />}
            Omborni tiklash
          </button>
        </div>
      </form>
    </Modal>
  );
}
