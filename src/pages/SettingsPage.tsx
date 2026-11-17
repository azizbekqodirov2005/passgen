import { useEffect, useRef, useState } from 'react';
import {
  IconAlert,
  IconDownload,
  IconLock,
  IconShield,
  IconTrash,
  IconUpload,
} from '@/components/icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Switch } from '@/components/ui/Switch';
import { StrengthMeter } from '@/components/ui/StrengthMeter';
import { AUTO_LOCK_CHOICES } from '@/services/authenticationService';
import { checkMasterPassword } from '@/services/cryptoService';
import { databaseService } from '@/services/databaseService';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/state/ThemeProvider';
import { useToast } from '@/state/ToastProvider';
import type { AppSettings, ThemePreference, VaultMetaRecord } from '@/lib/types';

interface SettingsPageProps {
  settings: AppSettings;
  credentialCount: number;
  onUpdateSettings: (changes: Partial<AppSettings>) => Promise<void>;
  onExport: () => void;
  onRestoreFile: (file: File) => void;
  onChangeMasterPassword: (current: string, next: string) => Promise<void>;
  onDestroy: () => Promise<void>;
}

const CLIPBOARD_CHOICES = [10, 30, 60, 0];

const THEME_CHOICES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Tizim bo‘yicha' },
  { value: 'dark', label: 'Tungi' },
  { value: 'light', label: 'Yorug‘' },
];

export function SettingsPage({
  settings,
  credentialCount,
  onUpdateSettings,
  onExport,
  onRestoreFile,
  onChangeMasterPassword,
  onDestroy,
}: SettingsPageProps) {
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [meta, setMeta] = useState<VaultMetaRecord | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [confirmDestroy, setConfirmDestroy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void databaseService
      .getMeta()
      .then((value) => {
        if (!cancelled) setMeta(value);
      })
      .catch(() => {
        /* informational only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const policy = checkMasterPassword(next);
  const canChange =
    current.length > 0 && policy.ok && next === confirmation && !changing;

  const submitChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canChange) return;
    setChanging(true);
    setChangeError(null);
    try {
      await onChangeMasterPassword(current, next);
      setCurrent('');
      setNext('');
      setConfirmation('');
      const refreshed = await databaseService.getMeta();
      setMeta(refreshed);
      toast.success(
        'Master parol almashtirildi',
        'Butun ombor yangi kalit bilan qayta shifrlandi.',
      );
    } catch (caught) {
      setChangeError(
        caught instanceof Error ? caught.message : 'Master parolni almashtirib bo‘lmadi.',
      );
    } finally {
      setChanging(false);
    }
  };

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">Sozlamalar</h1>
          <p className="page__subtitle">
            Qulflash, clipboard va ko‘rinish sozlamalari shu brauzerda saqlanadi.
          </p>
        </div>
      </div>

      <div className="u-stack">
        {/* ------------------------------ appearance ----------------------- */}
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Ko‘rinish</h2>
          </div>
          <div className="card__body u-stack">
            <div className="field">
              <span className="field__label">
                <span>Mavzu</span>
              </span>
              <div className="u-row" style={{ flexWrap: 'wrap' }}>
                {THEME_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={`btn${preference === choice.value ? ' btn--primary' : ''}`}
                    onClick={() => {
                      setPreference(choice.value);
                      void onUpdateSettings({ theme: choice.value });
                    }}
                    aria-pressed={preference === choice.value}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              <span className="field__hint">
                Birinchi tashrifda tizim sozlamasi qo‘llanadi; tanlovingiz
                saqlanadi va sahifa yangilanganda tiklanadi.
              </span>
            </div>
          </div>
        </section>

        {/* ------------------------------- security ------------------------ */}
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Xavfsizlik</h2>
          </div>
          <div className="card__body u-stack">
            <div className="field">
              <span className="field__label">
                <span>Avtomatik qulflash</span>
              </span>
              <div className="u-row" style={{ flexWrap: 'wrap' }}>
                {AUTO_LOCK_CHOICES.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`btn btn--sm${
                      settings.autoLockMinutes === minutes ? ' btn--primary' : ''
                    }`}
                    onClick={() => void onUpdateSettings({ autoLockMinutes: minutes })}
                    aria-pressed={settings.autoLockMinutes === minutes}
                  >
                    {minutes === 0 ? 'Hech qachon' : `${minutes} daqiqa`}
                  </button>
                ))}
              </div>
              <span className="field__hint">
                Harakatsizlik vaqti o‘tganda kalit xotiradan o‘chiriladi.
                "Hech qachon" ni faqat ishonchli qurilmada tanlang.
              </span>
            </div>

            <div className="field">
              <span className="field__label">
                <span>Clipboardni tozalash</span>
              </span>
              <div className="u-row" style={{ flexWrap: 'wrap' }}>
                {CLIPBOARD_CHOICES.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    className={`btn btn--sm${
                      settings.clearClipboardSeconds === seconds ? ' btn--primary' : ''
                    }`}
                    onClick={() => void onUpdateSettings({ clearClipboardSeconds: seconds })}
                    aria-pressed={settings.clearClipboardSeconds === seconds}
                  >
                    {seconds === 0 ? 'Tozalamaslik' : `${seconds} soniya`}
                  </button>
                ))}
              </div>
              <span className="field__hint">
                Brauzer clipboardni o‘qishga ruxsat bermaydi, shuning uchun
                PassGen belgilangan vaqtdan keyin uning ustiga bo‘sh qiymat
                yozadi. Boshqa ilova nusxa olsa, bu amal bajarilmasligi mumkin.
              </span>
            </div>

            <Switch
              checked={settings.revealRequiresMasterPassword}
              onChange={(checked) =>
                void onUpdateSettings({ revealRequiresMasterPassword: checked })
              }
              title="Parolni ko‘rsatishdan oldin master parolni so‘rash"
              hint="Tasdiqlangandan keyin 2 daqiqa davomida qayta so‘ralmaydi."
            />
          </div>
        </section>

        {/* -------------------------- master password ---------------------- */}
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Master parolni almashtirish</h2>
          </div>
          <div className="card__body">
            <form className="u-stack" onSubmit={(event) => void submitChange(event)}>
              <div className="field">
                <label className="field__label" htmlFor="current-master">
                  <span>Hozirgi master parol</span>
                </label>
                <input
                  id="current-master"
                  className="input input--mono"
                  type="password"
                  value={current}
                  autoComplete="current-password"
                  onChange={(event) => setCurrent(event.target.value)}
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="next-master">
                    <span>Yangi master parol</span>
                  </label>
                  <input
                    id="next-master"
                    className="input input--mono"
                    type="password"
                    value={next}
                    autoComplete="new-password"
                    onChange={(event) => setNext(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="next-master-confirm">
                    <span>Tasdiqlash</span>
                  </label>
                  <input
                    id="next-master-confirm"
                    className="input input--mono"
                    type="password"
                    value={confirmation}
                    autoComplete="new-password"
                    aria-invalid={confirmation.length > 0 && confirmation !== next}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
              </div>

              {next.length > 0 ? <StrengthMeter password={next} showNotes /> : null}

              {!policy.ok && next.length > 0 ? (
                <span className="field__error">{policy.problems.join(' ')}</span>
              ) : null}
              {changeError ? <span className="field__error">{changeError}</span> : null}

              <div className="notice notice--warning">
                <IconAlert size={16} />
                <div>
                  Almashtirishda barcha yozuvlar yangi kalit bilan qayta
                  shifrlanadi va yangi tuz (salt) hosil qilinadi. Avval olingan
                  zaxira nusxalar eski parol bilan ochiladi — yangi nusxa olib
                  qo‘ying.
                </div>
              </div>

              <button type="submit" className="btn btn--primary" disabled={!canChange}>
                {changing ? <span className="spinner" /> : <IconLock size={15} />}
                Master parolni almashtirish
              </button>
            </form>
          </div>
        </section>

        {/* ------------------------------- backup -------------------------- */}
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Zaxira nusxa</h2>
          </div>
          <div className="card__body u-stack">
            <p className="u-muted" style={{ fontSize: 'var(--text-sm)' }}>
              Zaxira nusxa shifrlangan holida eksport qilinadi: faylda ochiq
              matndagi parol yo‘q, uni faqat shu ombor master paroli bilan ochish
              mumkin.
            </p>

            <div className="u-row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onExport}
                disabled={credentialCount === 0}
              >
                <IconDownload size={16} />
                Shifrlangan nusxani yuklab olish
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => fileInput.current?.click()}
              >
                <IconUpload size={16} />
                Nusxadan tiklash
              </button>

              <input
                ref={fileInput}
                type="file"
                accept=".json,.passgen.json,application/json"
                className="u-visually-hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onRestoreFile(file);
                  event.target.value = '';
                }}
              />
            </div>

            <div className="notice notice--danger">
              <IconAlert size={16} />
              <div>
                Tiklash hozirgi ombordagi barcha yozuvlarni{' '}
                <strong>butunlay almashtiradi</strong>. Davom etishdan oldin
                tasdiqlash so‘raladi.
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------- vault details ---------------------- */}
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Ombor haqida</h2>
          </div>
          <div className="card__body">
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr>
                    <td>Shifrlash</td>
                    <td className="u-mono">AES-256-GCM</td>
                  </tr>
                  <tr>
                    <td>Kalit hosil qilish</td>
                    <td className="u-mono">
                      {meta ? `PBKDF2-${meta.kdf.hash}` : 'PBKDF2-SHA-256'}
                    </td>
                  </tr>
                  <tr>
                    <td>Iteratsiyalar</td>
                    <td className="u-mono">
                      {meta ? meta.kdf.iterations.toLocaleString('uz-UZ') : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>Format versiyasi</td>
                    <td className="u-mono">v{meta?.formatVersion ?? 1}</td>
                  </tr>
                  <tr>
                    <td>Ombor yaratilgan</td>
                    <td>{meta ? formatDateTime(meta.createdAt) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Saqlash joyi</td>
                    <td>IndexedDB — faqat shu brauzerda</td>
                  </tr>
                  <tr>
                    <td>Yozuvlar soni</td>
                    <td className="u-mono">{credentialCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="notice notice--info" style={{ marginTop: 'var(--space-4)' }}>
              <IconShield size={16} />
              <div>
                Master parol va shifrlash kaliti hech qachon diskka yozilmaydi:
                kalit faqat ombor ochiq turgan vaqtda xotirada bo‘ladi va
                qulflanganda o‘chiriladi.
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------- danger -------------------------- */}
        <section className="card" style={{ borderColor: 'var(--danger)' }}>
          <div className="card__head">
            <h2 className="card__title" style={{ color: 'var(--danger)' }}>
              Xavfli zona
            </h2>
          </div>
          <div className="card__body u-stack">
            <p className="u-muted" style={{ fontSize: 'var(--text-sm)' }}>
              Omborni o‘chirish shu brauzerdagi barcha shifrlangan yozuvlarni va
              ombor sozlamalarini butunlay yo‘q qiladi. Bu amalni qaytarish
              mumkin emas.
            </p>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setConfirmDestroy(true)}
            >
              <IconTrash size={16} />
              Omborni butunlay o‘chirish
            </button>
          </div>
        </section>
      </div>

      {confirmDestroy ? (
        <ConfirmDialog
          title="Omborni o‘chirish"
          description="Bu amal qaytarilmaydi."
          confirmLabel="Butunlay o‘chirish"
          tone="danger"
          typeToConfirm="OCHIRISH"
          body={
            <div className="notice notice--danger">
              <IconAlert size={16} />
              <div>
                {credentialCount} yozuv, kategoriyalar va shifrlash metama’lumotlari
                o‘chiriladi. Agar zaxira nusxangiz bo‘lmasa, ma’lumotlarni
                tiklash imkonsiz.
              </div>
            </div>
          }
          onConfirm={async () => {
            await onDestroy();
            setConfirmDestroy(false);
          }}
          onCancel={() => setConfirmDestroy(false)}
        />
      ) : null}
    </>
  );
}
