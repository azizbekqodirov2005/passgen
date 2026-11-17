/**
 * Re-authentication gate.
 *
 * Revealing a password, exporting a backup and restoring one all ask for the
 * master password again. A successful confirmation is remembered for a short
 * window (see REAUTH_WINDOW_MS) so the user is not prompted on every click.
 */

import { useCallback, useState } from 'react';
import { authenticationService } from '@/services/authenticationService';
import { useVault } from '@/state/VaultProvider';

export type ReauthPurpose = 'reveal' | 'export' | 'restore' | 'danger';

interface PendingRequest {
  purpose: ReauthPurpose;
  resolve: (ok: boolean) => void;
}

export interface ReauthState {
  /** Non-null while the dialog should be shown. */
  pending: PendingRequest | null;
  /**
   * Ask for confirmation. Resolves true when the user is authorised — either
   * because a fresh confirmation already exists, or because they just typed
   * the master password correctly.
   */
  require: (purpose: ReauthPurpose, options?: { force?: boolean }) => Promise<boolean>;
  submit: (masterPassword: string) => Promise<boolean>;
  cancel: () => void;
}

export function useReauth(): ReauthState {
  const { verifyMasterPassword, settings } = useVault();
  const [pending, setPending] = useState<PendingRequest | null>(null);

  const require = useCallback(
    (purpose: ReauthPurpose, options: { force?: boolean } = {}) => {
      const force = options.force ?? false;

      // Revealing can be made frictionless by the user; destructive and
      // export actions always ask, whatever the settings say.
      if (
        !force &&
        purpose === 'reveal' &&
        (!settings.revealRequiresMasterPassword || authenticationService.hasFreshReauth())
      ) {
        return Promise.resolve(true);
      }
      if (!force && purpose !== 'reveal' && authenticationService.hasFreshReauth()) {
        return Promise.resolve(true);
      }

      return new Promise<boolean>((resolve) => {
        setPending({ purpose, resolve });
      });
    },
    [settings.revealRequiresMasterPassword],
  );

  const submit = useCallback(
    async (masterPassword: string) => {
      const ok = await verifyMasterPassword(masterPassword);
      if (ok) {
        setPending((current) => {
          current?.resolve(true);
          return null;
        });
      }
      return ok;
    },
    [verifyMasterPassword],
  );

  const cancel = useCallback(() => {
    setPending((current) => {
      current?.resolve(false);
      return null;
    });
  }, []);

  return { pending, require, submit, cancel };
}

export const REAUTH_COPY: Record<ReauthPurpose, { title: string; description: string }> = {
  reveal: {
    title: 'Master parolni tasdiqlang',
    description: "Parolni ko'rsatish uchun master parolni qayta kiriting.",
  },
  export: {
    title: 'Zaxira nusxa olish',
    description: 'Zaxira nusxani yuklab olishdan oldin master parolni tasdiqlang.',
  },
  restore: {
    title: 'Zaxiradan tiklash',
    description: 'Tiklashni boshlashdan oldin master parolni tasdiqlang.',
  },
  danger: {
    title: 'Xavfli amalni tasdiqlang',
    description: 'Davom etish uchun master parolni kiriting.',
  },
};
