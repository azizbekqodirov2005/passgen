import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Footer } from '@/components/layout/Footer';
import { SetupScreen } from '@/components/auth/SetupScreen';
import { UnlockScreen } from '@/components/auth/UnlockScreen';
import { ReauthDialog } from '@/components/auth/ReauthDialog';
import { CredentialForm } from '@/components/vault/CredentialForm';
import { RestoreDialog } from '@/components/vault/RestoreDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/EmptyState';
import { IconAlert, IconShield } from '@/components/icons';
import { DashboardPage } from '@/pages/DashboardPage';
import { PasswordsPage } from '@/pages/PasswordsPage';
import { GeneratorPage } from '@/pages/GeneratorPage';
import { AuditPage } from '@/pages/AuditPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useRoute } from '@/hooks/useRoute';
import { useReauth } from '@/hooks/useReauth';
import { useAudit } from '@/hooks/useAudit';
import { DEFAULT_FILTERS, type FilterState } from '@/hooks/useFilteredCredentials';
import { useVault } from '@/state/VaultProvider';
import { useToast } from '@/state/ToastProvider';
import { isWebCryptoAvailable } from '@/services/cryptoService';
import {
  backupFileName,
  createBackup,
  parseBackup,
  serialiseBackup,
} from '@/services/backupService';
import type { BackupFile, Credential, CredentialSecret } from '@/lib/types';

type Dialog =
  | { kind: 'none' }
  | { kind: 'create'; password?: string }
  | { kind: 'edit'; credential: Credential }
  | { kind: 'delete'; credential: Credential }
  | { kind: 'restore'; file: BackupFile };

export default function App() {
  const vault = useVault();
  const toast = useToast();
  const [route, navigate] = useRoute();
  const reauth = useReauth();

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { report } = useAudit(vault.credentials);
  const cryptoReady = useMemo(() => isWebCryptoAvailable(), []);

  const favoritesCount = vault.credentials.filter((item) => item.favorite).length;

  /* ------------------------------------------------------------------ *
   * Keyboard shortcuts
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (vault.status !== 'unlocked') return undefined;

    const isTyping = (target: EventTarget | null): boolean => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        element.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K always focuses search, even from inside a field.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target) || dialog.kind !== 'none') return;

      switch (event.key) {
        case '/':
          event.preventDefault();
          searchRef.current?.focus();
          break;
        case 'n':
          event.preventDefault();
          setDialog({ kind: 'create' });
          break;
        case 'l':
          event.preventDefault();
          vault.lock();
          break;
        case 'g':
          event.preventDefault();
          navigate('generator');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog.kind, navigate, vault]);

  /* ------------------------------------------------------------------ *
   * Backup: export / restore
   * ------------------------------------------------------------------ */

  const exportBackup = useCallback(async () => {
    const authorised = await reauth.require('export');
    if (!authorised) return;

    try {
      const backup = await createBackup();
      const blob = new Blob([serialiseBackup(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName(backup.createdAt);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Release the blob once the download has been handed to the browser.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      vault.logActivity('exported', 'Shifrlangan zaxira nusxa olindi');
      toast.success(
        'Zaxira nusxa yuklab olindi',
        `${backup.credentials.length} yozuv shifrlangan holida saqlandi.`,
      );
    } catch (error) {
      toast.error(
        'Zaxira nusxa olinmadi',
        error instanceof Error ? error.message : undefined,
      );
    }
  }, [reauth, toast, vault]);

  const openRestore = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = await parseBackup(text);
        setDialog({ kind: 'restore', file: parsed });
      } catch (error) {
        toast.error(
          'Fayl qabul qilinmadi',
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [toast],
  );

  /* ------------------------------------------------------------------ *
   * Credential actions
   * ------------------------------------------------------------------ */

  const saveCredential = useCallback(
    async (values: CredentialSecret) => {
      if (dialog.kind === 'edit') {
        await vault.updateCredential(dialog.credential.id, values);
        toast.success('Yozuv yangilandi');
      } else {
        await vault.createCredential(values);
        toast.success('Yozuv omborga saqlandi');
      }
    },
    [dialog, toast, vault],
  );

  const requireRevealAuth = useCallback(() => reauth.require('reveal'), [reauth]);

  /* ------------------------------------------------------------------ *
   * Gates
   * ------------------------------------------------------------------ */

  if (!cryptoReady) {
    return (
      <div className="gate">
        <div className="gate__panel">
          <div className="notice notice--danger">
            <IconAlert size={18} />
            <div>
              <strong>Web Crypto API mavjud emas.</strong> PassGen shifrlash
              uchun brauzerning kriptografiya interfeysiga tayanadi, u esa
              faqat HTTPS yoki localhost ustida ishlaydi. Sahifani xavfsiz
              manzildan oching.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (vault.status === 'loading') {
    return (
      <div className="gate">
        <div className="gate__panel">
          <LoadingState label="Ombor tekshirilmoqda…" />
        </div>
      </div>
    );
  }

  if (vault.status === 'uninitialised') return <SetupScreen />;

  if (vault.status === 'locked') {
    return (
      <>
        <UnlockScreen
          onRestoreRequest={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.passgen.json,application/json';
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) void openRestore(file);
            };
            input.click();
          }}
        />
        {dialog.kind === 'restore' ? (
          <RestoreDialog
            file={dialog.file}
            existingCount={0}
            onCancel={() => setDialog({ kind: 'none' })}
            onDone={async (count) => {
              setDialog({ kind: 'none' });
              await vault.adoptRestoredVault(count);
              toast.success('Ombor tiklandi', `${count} yozuv qayta ochildi.`);
            }}
          />
        ) : null}
      </>
    );
  }

  /* ------------------------------------------------------------------ *
   * Unlocked application
   * ------------------------------------------------------------------ */

  const pages: Record<string, React.ReactNode> = {
    dashboard: (
      <DashboardPage
        credentials={vault.credentials}
        categories={vault.categories}
        activity={vault.activity}
        onNavigate={navigate}
        onAdd={() => setDialog({ kind: 'create' })}
        onEdit={(credential) => setDialog({ kind: 'edit', credential })}
      />
    ),
    passwords: (
      <PasswordsPage
        title="Barcha parollar"
        subtitle="Parollar sukut bo‘yicha yashirilgan; ko‘rsatish uchun tasdiqlash so‘raladi."
        credentials={vault.credentials}
        categories={vault.categories}
        filters={filters}
        onFiltersChange={setFilters}
        onAdd={() => setDialog({ kind: 'create' })}
        onEdit={(credential) => setDialog({ kind: 'edit', credential })}
        onDelete={(credential) => setDialog({ kind: 'delete', credential })}
        onToggleFavorite={(credential) => void vault.toggleFavorite(credential.id)}
        onBeforeReveal={requireRevealAuth}
      />
    ),
    favorites: (
      <PasswordsPage
        title="Sevimlilar"
        subtitle="Yulduzcha bilan belgilangan hisoblar."
        credentials={vault.credentials}
        categories={vault.categories}
        filters={filters}
        onFiltersChange={setFilters}
        onAdd={() => setDialog({ kind: 'create' })}
        onEdit={(credential) => setDialog({ kind: 'edit', credential })}
        onDelete={(credential) => setDialog({ kind: 'delete', credential })}
        onToggleFavorite={(credential) => void vault.toggleFavorite(credential.id)}
        onBeforeReveal={requireRevealAuth}
        favoritesOnly
      />
    ),
    generator: (
      <GeneratorPage
        onSave={(password) => setDialog({ kind: 'create', password })}
      />
    ),
    audit: (
      <AuditPage
        credentials={vault.credentials}
        onEdit={(credential) => setDialog({ kind: 'edit', credential })}
      />
    ),
    categories: (
      <CategoriesPage
        credentials={vault.credentials}
        categories={vault.categories}
        onSave={vault.saveCategories}
        onOpenCategory={(categoryId) => {
          setFilters({ ...DEFAULT_FILTERS, category: categoryId });
          navigate('passwords');
        }}
      />
    ),
    settings: (
      <SettingsPage
        settings={vault.settings}
        credentialCount={vault.credentials.length}
        onUpdateSettings={vault.updateSettings}
        onExport={() => void exportBackup()}
        onRestoreFile={(file) => void openRestore(file)}
        onChangeMasterPassword={vault.changeMasterPassword}
        onDestroy={async () => {
          await vault.destroyVault();
          toast.info('Ombor o‘chirildi', 'Yangi ombor yaratishingiz mumkin.');
        }}
      />
    ),
  };

  return (
    <div className="shell">
      <Sidebar
        route={route}
        onNavigate={navigate}
        counts={{
          all: vault.credentials.length,
          favorites: favoritesCount,
          categories: vault.categories.length,
        }}
        score={vault.credentials.length > 0 ? report.score : null}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLock={() => {
          setDrawerOpen(false);
          vault.lock();
        }}
      />

      {drawerOpen ? (
        <div
          className="scrim"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        />
      ) : null}

      <div className="shell__main">
        <Topbar
          query={filters.query}
          onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
          onNavigate={navigate}
          onOpenMenu={() => setDrawerOpen(true)}
          onAdd={() => setDialog({ kind: 'create' })}
          onLock={vault.lock}
          onExport={() => void exportBackup()}
          score={report.score}
          total={vault.credentials.length}
          searchRef={searchRef}
        />

        <main className="shell__content">
          {vault.lastError ? (
            <div className="notice notice--danger" style={{ marginBottom: 'var(--space-5)' }}>
              <IconAlert size={16} />
              <div>{vault.lastError}</div>
            </div>
          ) : null}

          {pages[route] ?? pages['dashboard']}
        </main>

        <Footer />
      </div>

      {/* --------------------------------- dialogs ------------------------- */}

      {dialog.kind === 'create' ? (
        <CredentialForm
          categories={vault.categories}
          initialPassword={dialog.password ?? ''}
          onSubmit={saveCredential}
          onClose={() => setDialog({ kind: 'none' })}
        />
      ) : null}

      {dialog.kind === 'edit' ? (
        <CredentialForm
          credential={dialog.credential}
          categories={vault.categories}
          onSubmit={saveCredential}
          onClose={() => setDialog({ kind: 'none' })}
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <ConfirmDialog
          title="Yozuvni o‘chirish"
          description={`"${dialog.credential.name}" ombordan o‘chiriladi.`}
          confirmLabel="O‘chirish"
          tone="danger"
          body={
            <div className="notice notice--danger">
              <IconAlert size={16} />
              <div>
                Bu amal qaytarilmaydi. Agar parol hali kerak bo‘lsa, avval
                nusxa olib qo‘ying.
              </div>
            </div>
          }
          onConfirm={async () => {
            await vault.deleteCredential(dialog.credential.id);
            setDialog({ kind: 'none' });
            toast.success('Yozuv o‘chirildi');
          }}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      ) : null}

      {dialog.kind === 'restore' ? (
        <RestoreDialog
          file={dialog.file}
          existingCount={vault.credentials.length}
          onCancel={() => setDialog({ kind: 'none' })}
          onDone={async (count) => {
            setDialog({ kind: 'none' });
            await vault.adoptRestoredVault(count);
            toast.success('Ombor tiklandi', `${count} yozuv tiklandi.`);
          }}
        />
      ) : null}

      {reauth.pending ? (
        <ReauthDialog
          purpose={reauth.pending.purpose}
          onSubmit={reauth.submit}
          onCancel={reauth.cancel}
        />
      ) : null}

      <span className="u-visually-hidden" role="status">
        <IconShield size={1} /> Ombor ochiq
      </span>
    </div>
  );
}
