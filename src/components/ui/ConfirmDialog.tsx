import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';

interface ConfirmDialogProps {
  title: string;
  description?: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** When set, the user must type this exact text before confirming. */
  typeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  body,
  confirmLabel,
  cancelLabel = 'Bekor qilish',
  tone = 'default',
  typeToConfirm,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm;

  const confirm = async () => {
    if (blocked || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      {...(description ? { description } : {})}
      size="narrow"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--danger-solid' : 'btn--primary'}`}
            onClick={() => void confirm()}
            disabled={blocked || busy}
          >
            {busy ? <span className="spinner" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="u-stack">
        {body}
        {typeToConfirm !== undefined ? (
          <label className="field">
            <span className="field__label">
              Tasdiqlash uchun <code className="u-mono">{typeToConfirm}</code> deb yozing
            </span>
            <input
              className="input input--mono"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
