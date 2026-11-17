/**
 * VaultProvider — the single source of truth for vault state in the UI.
 *
 * What lives here: the decrypted credential list for the current session, the
 * custom categories, the app settings and an in-session activity log.
 * What does NOT live here: the master password or the derived key. Those stay
 * inside vaultService, which hands out no copy of either.
 *
 * Locking clears the credential list, so nothing sensitive stays in React
 * memory once the vault is closed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  ActivityEntry,
  AppSettings,
  Credential,
  CredentialInput,
  CredentialSecret,
  CustomCategory,
  VaultStatus,
} from '@/lib/types';
import { databaseService } from '@/services/databaseService';
import { vaultService } from '@/services/vaultService';
import { authenticationService } from '@/services/authenticationService';
import { cancelScheduledClears } from '@/services/clipboardService';
import { readStoredPreference } from '@/state/ThemeProvider';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  autoLockMinutes: 15,
  clearClipboardSeconds: 30,
  revealRequiresMasterPassword: true,
};

interface State {
  status: VaultStatus;
  credentials: Credential[];
  categories: CustomCategory[];
  settings: AppSettings;
  activity: ActivityEntry[];
  busy: boolean;
  lastError: string | null;
}

type Action =
  | { type: 'status'; status: VaultStatus }
  | { type: 'loaded'; credentials: Credential[]; categories: CustomCategory[] }
  | { type: 'credentials'; credentials: Credential[] }
  | { type: 'categories'; categories: CustomCategory[] }
  | { type: 'settings'; settings: AppSettings }
  | { type: 'activity'; entry: ActivityEntry }
  | { type: 'busy'; busy: boolean }
  | { type: 'error'; message: string | null }
  | { type: 'locked' };

const initialState: State = {
  status: 'loading',
  credentials: [],
  categories: [],
  settings: DEFAULT_SETTINGS,
  activity: [],
  busy: false,
  lastError: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'status':
      return { ...state, status: action.status };
    case 'loaded':
      return {
        ...state,
        status: 'unlocked',
        credentials: action.credentials,
        categories: action.categories,
        lastError: null,
      };
    case 'credentials':
      return { ...state, credentials: action.credentials };
    case 'categories':
      return { ...state, categories: action.categories };
    case 'settings':
      return { ...state, settings: action.settings };
    case 'activity':
      return { ...state, activity: [action.entry, ...state.activity].slice(0, 25) };
    case 'busy':
      return { ...state, busy: action.busy };
    case 'error':
      return { ...state, lastError: action.message };
    case 'locked':
      // Drop every decrypted value from memory.
      return { ...state, status: 'locked', credentials: [], categories: [], activity: [] };
    default:
      return state;
  }
}

interface VaultContextValue extends State {
  initialise: (masterPassword: string) => Promise<void>;
  unlock: (masterPassword: string) => Promise<void>;
  lock: () => void;
  reload: () => Promise<void>;
  createCredential: (input: CredentialInput) => Promise<Credential>;
  updateCredential: (id: string, changes: Partial<CredentialSecret>) => Promise<Credential>;
  deleteCredential: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  saveCategories: (categories: CustomCategory[]) => Promise<void>;
  updateSettings: (changes: Partial<AppSettings>) => Promise<void>;
  logActivity: (kind: ActivityEntry['kind'], label: string) => void;
  verifyMasterPassword: (masterPassword: string) => Promise<boolean>;
  changeMasterPassword: (current: string, next: string) => Promise<void>;
  adoptRestoredVault: (credentialCount: number) => Promise<void>;
  destroyVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

function activityId(): string {
  return `${String(Date.now())}-${Math.random().toString(36).slice(2, 7)}`;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const settingsRef = useRef(state.settings);
  settingsRef.current = state.settings;

  const logActivity = useCallback((kind: ActivityEntry['kind'], label: string) => {
    dispatch({ type: 'activity', entry: { id: activityId(), at: Date.now(), kind, label } });
  }, []);

  /* ------------------------------------------------------------------ *
   * Boot: load settings, then decide whether a vault exists.
   * ------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await databaseService.getSettings();
        if (!cancelled) {
          const settings: AppSettings = {
            ...DEFAULT_SETTINGS,
            ...(stored ?? {}),
            // The theme preference in localStorage wins: it is what was applied
            // before React mounted, so the two cannot disagree on screen.
            theme: readStoredPreference(),
          };
          dispatch({ type: 'settings', settings });
          authenticationService.setAutoLockMinutes(settings.autoLockMinutes);
        }
      } catch {
        /* settings are optional — defaults are fine */
      }

      try {
        const initialised = await vaultService.isInitialised();
        if (!cancelled) {
          dispatch({ type: 'status', status: initialised ? 'locked' : 'uninitialised' });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : "Ombor holatini aniqlab bo'lmadi.",
          });
          dispatch({ type: 'status', status: 'locked' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------ *
   * Auto-lock wiring
   * ------------------------------------------------------------------ */

  useEffect(() => {
    const stopWatching = authenticationService.start();
    const unsubscribe = authenticationService.onAutoLock(() => {
      cancelScheduledClears();
      dispatch({ type: 'locked' });
    });
    return () => {
      stopWatching();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    authenticationService.setAutoLockMinutes(state.settings.autoLockMinutes);
  }, [state.settings.autoLockMinutes]);

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  const loadVault = useCallback(async () => {
    const [credentials, categories] = await Promise.all([
      vaultService.listCredentials(),
      vaultService.listCustomCategories(),
    ]);
    dispatch({ type: 'loaded', credentials, categories });
  }, []);

  const initialise = useCallback(
    async (masterPassword: string) => {
      dispatch({ type: 'busy', busy: true });
      try {
        await vaultService.initialise(masterPassword);
        // Deliberately NOT a re-authentication: unlocking opens the vault, it
        // does not authorise revealing individual passwords. The first reveal
        // still asks for the master password.
        authenticationService.touch();
        await loadVault();
        logActivity('unlocked', 'Ombor yaratildi');
      } finally {
        dispatch({ type: 'busy', busy: false });
      }
    },
    [loadVault, logActivity],
  );

  const unlock = useCallback(
    async (masterPassword: string) => {
      dispatch({ type: 'busy', busy: true });
      try {
        await vaultService.unlock(masterPassword);
        // See initialise(): opening the vault is not a reveal authorisation.
        authenticationService.clearReauth();
        authenticationService.touch();
        await loadVault();
        logActivity('unlocked', 'Ombor ochildi');
      } finally {
        dispatch({ type: 'busy', busy: false });
      }
    },
    [loadVault, logActivity],
  );

  const lock = useCallback(() => {
    cancelScheduledClears();
    authenticationService.lockNow();
    dispatch({ type: 'locked' });
  }, []);

  const reload = useCallback(async () => {
    if (!vaultService.isUnlocked()) return;
    await loadVault();
  }, [loadVault]);

  const createCredential = useCallback(
    async (input: CredentialInput) => {
      const created = await vaultService.createCredential(input);
      await loadVault();
      logActivity('created', `"${created.name}" qo‘shildi`);
      return created;
    },
    [loadVault, logActivity],
  );

  const updateCredential = useCallback(
    async (id: string, changes: Partial<CredentialSecret>) => {
      const updated = await vaultService.updateCredential(id, changes);
      await loadVault();
      logActivity('updated', `"${updated.name}" yangilandi`);
      return updated;
    },
    [loadVault, logActivity],
  );

  const deleteCredential = useCallback(
    async (id: string) => {
      const target = state.credentials.find((credential) => credential.id === id);
      await vaultService.deleteCredential(id);
      await loadVault();
      logActivity('deleted', `"${target?.name ?? 'Yozuv'}" o‘chirildi`);
    },
    [loadVault, logActivity, state.credentials],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const target = state.credentials.find((credential) => credential.id === id);
      if (!target) return;
      const updated = await vaultService.updateCredential(id, { favorite: !target.favorite });
      await loadVault();
      logActivity(
        'favorite',
        updated.favorite
          ? `"${updated.name}" sevimlilarga qo‘shildi`
          : `"${updated.name}" sevimlilardan olindi`,
      );
    },
    [loadVault, logActivity, state.credentials],
  );

  const saveCategories = useCallback(async (categories: CustomCategory[]) => {
    await vaultService.saveCustomCategories(categories);
    dispatch({ type: 'categories', categories });
  }, []);

  const updateSettings = useCallback(async (changes: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...changes };
    dispatch({ type: 'settings', settings: next });
    try {
      await databaseService.putSettings(next);
    } catch {
      /* the setting still applies to this session */
    }
  }, []);

  const verifyMasterPassword = useCallback(async (masterPassword: string) => {
    const ok = await vaultService.verifyMasterPassword(masterPassword);
    if (ok) authenticationService.markReauthenticated();
    return ok;
  }, []);

  const changeMasterPassword = useCallback(
    async (current: string, next: string) => {
      await vaultService.changeMasterPassword(current, next);
      authenticationService.markReauthenticated();
      await loadVault();
      logActivity('updated', 'Master parol almashtirildi');
    },
    [loadVault, logActivity],
  );

  /**
   * Called after a backup restore re-created the vault with the backup's key.
   * The key already lives in vaultService, so the UI only needs to load it.
   */
  const adoptRestoredVault = useCallback(
    async (credentialCount: number) => {
      await loadVault();
      logActivity('restored', `Zaxiradan ${String(credentialCount)} yozuv tiklandi`);
    },
    [loadVault, logActivity],
  );

  const destroyVault = useCallback(async () => {
    await vaultService.destroy();
    cancelScheduledClears();
    dispatch({ type: 'locked' });
    dispatch({ type: 'status', status: 'uninitialised' });
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      ...state,
      initialise,
      unlock,
      lock,
      reload,
      createCredential,
      updateCredential,
      deleteCredential,
      toggleFavorite,
      saveCategories,
      updateSettings,
      logActivity,
      verifyMasterPassword,
      changeMasterPassword,
      adoptRestoredVault,
      destroyVault,
    }),
    [
      state,
      initialise,
      unlock,
      lock,
      reload,
      createCredential,
      updateCredential,
      deleteCredential,
      toggleFavorite,
      saveCategories,
      updateSettings,
      logActivity,
      verifyMasterPassword,
      changeMasterPassword,
      adoptRestoredVault,
      destroyVault,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used inside VaultProvider');
  return context;
}
