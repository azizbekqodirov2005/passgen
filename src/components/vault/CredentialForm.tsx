import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PasswordField } from '@/components/vault/PasswordField';
import { Switch } from '@/components/ui/Switch';
import { allCategories } from '@/lib/categories';
import type { Credential, CredentialSecret, CustomCategory } from '@/lib/types';

interface CredentialFormProps {
  /** Omit for a new record. */
  credential?: Credential;
  categories: CustomCategory[];
  initialPassword?: string;
  onSubmit: (values: CredentialSecret) => Promise<void>;
  onClose: () => void;
}

export function CredentialForm({
  credential,
  categories,
  initialPassword = '',
  onSubmit,
  onClose,
}: CredentialFormProps) {
  const [values, setValues] = useState<CredentialSecret>({
    name: credential?.name ?? '',
    username: credential?.username ?? '',
    password: credential?.password ?? initialPassword,
    url: credential?.url ?? '',
    category: credential?.category ?? 'other',
    notes: credential?.notes ?? '',
    favorite: credential?.favorite ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof CredentialSecret>(key: K, value: CredentialSecret[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (values.name.trim().length === 0) {
      setError('Platforma yoki sayt nomini kiriting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Saqlab bo‘lmadi.');
    } finally {
      setBusy(false);
    }
  };

  const isEdit = credential !== undefined;

  return (
    <Modal
      title={isEdit ? 'Yozuvni tahrirlash' : 'Yangi yozuv'}
      description={
        isEdit
          ? 'O‘zgarishlar saqlanganda yozuv yangi IV bilan qayta shifrlanadi.'
          : 'Yozuv saqlanishdan oldin brauzeringizda shifrlanadi.'
      }
      size="wide"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Bekor qilish
          </button>
          <button
            type="submit"
            form="credential-form"
            className="btn btn--primary"
            disabled={busy}
          >
            {busy ? <span className="spinner" /> : null}
            {isEdit ? 'O‘zgarishlarni saqlash' : 'Omborga saqlash'}
          </button>
        </>
      }
    >
      <form id="credential-form" className="u-stack" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor="credential-name">
              <span>Platforma yoki sayt nomi</span>
            </label>
            <input
              id="credential-name"
              className="input"
              value={values.name}
              autoFocus
              placeholder="Masalan: Gmail"
              onChange={(event) => set('name', event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="credential-username">
              <span>Foydalanuvchi nomi yoki e-mail</span>
              <span className="field__optional">majburiy emas</span>
            </label>
            <input
              id="credential-username"
              className="input"
              value={values.username}
              autoComplete="off"
              placeholder="azizbek@example.com"
              onChange={(event) => set('username', event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="credential-url">
              <span>Sayt manzili</span>
              <span className="field__optional">majburiy emas</span>
            </label>
            <input
              id="credential-url"
              className="input"
              value={values.url}
              inputMode="url"
              placeholder="https://..."
              onChange={(event) => set('url', event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="credential-category">
              <span>Kategoriya</span>
            </label>
            <select
              id="credential-category"
              className="select"
              value={values.category}
              onChange={(event) => set('category', event.target.value)}
            >
              {allCategories(categories).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <PasswordField
          value={values.password}
          onChange={(value) => set('password', value)}
          label="Parol"
        />

        <div className="field">
          <label className="field__label" htmlFor="credential-notes">
            <span>Qo‘shimcha izoh</span>
            <span className="field__optional">majburiy emas</span>
          </label>
          <textarea
            id="credential-notes"
            className="textarea"
            value={values.notes}
            placeholder="Tiklash kodlari, savol-javoblar yoki boshqa eslatmalar"
            onChange={(event) => set('notes', event.target.value)}
          />
          <span className="field__hint">
            Izoh ham parol bilan birga shifrlanadi.
          </span>
        </div>

        <Switch
          checked={values.favorite}
          onChange={(checked) => set('favorite', checked)}
          title="Sevimlilarga qo‘shish"
          hint="Sevimli yozuvlar boshqaruv panelida va alohida bo‘limda ko‘rinadi."
        />

        {error ? <span className="field__error">{error}</span> : null}
      </form>
    </Modal>
  );
}
