/**
 * vaultService — owns the vault key for the lifetime of an unlocked session.
 *
 * The derived CryptoKey lives in a module-scoped variable and nowhere else:
 * not in localStorage, not in sessionStorage, not in IndexedDB, not in React
 * state (components hold only decrypted values they are already displaying).
 * `lock()` drops the reference, after which nothing in the app can decrypt.
 */

import {
  CRYPTO_FORMAT_VERSION,
  type CategoriesRecord,
  type Credential,
  type CredentialInput,
  type CredentialRecord,
  type CredentialSecret,
  type CustomCategory,
  type VaultMetaRecord,
} from '@/lib/types';
import {
  calibrateIterations,
  checkMasterPassword,
  createSalt,
  createVerifier,
  CryptoError,
  decryptJson,
  deriveVaultKey,
  encryptJson,
  verifyKey,
} from '@/services/cryptoService';
import { databaseService } from '@/services/databaseService';

export class VaultError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'locked'
      | 'already-initialised'
      | 'not-initialised'
      | 'wrong-master-password'
      | 'weak-master-password'
      | 'not-found'
      | 'invalid-input',
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

let vaultKey: CryptoKey | null = null;

function requireKey(): CryptoKey {
  if (!vaultKey) {
    throw new VaultError('Ombor qulflangan.', 'locked');
  }
  return vaultKey;
}

function newId(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitiseInput(input: CredentialInput): CredentialSecret {
  const name = input.name?.trim() ?? '';
  if (name.length === 0) {
    throw new VaultError('Platforma yoki sayt nomi kerak.', 'invalid-input');
  }
  return {
    name,
    username: input.username?.trim() ?? '',
    password: input.password ?? '',
    url: input.url?.trim() ?? '',
    category: input.category ?? 'other',
    notes: input.notes ?? '',
    favorite: input.favorite ?? false,
  };
}

async function toCredential(
  key: CryptoKey,
  record: CredentialRecord,
): Promise<Credential> {
  const secret = await decryptJson<CredentialSecret>(key, record.data);
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    name: secret.name ?? '',
    username: secret.username ?? '',
    password: secret.password ?? '',
    url: secret.url ?? '',
    category: secret.category ?? 'other',
    notes: secret.notes ?? '',
    favorite: Boolean(secret.favorite),
  };
}

export const vaultService = {
  isUnlocked(): boolean {
    return vaultKey !== null;
  },

  async isInitialised(): Promise<boolean> {
    return (await databaseService.getMeta()) !== null;
  },

  async getMeta(): Promise<VaultMetaRecord | null> {
    return databaseService.getMeta();
  },

  /**
   * Create a brand-new vault. Calibrates PBKDF2 for this device, stores the
   * salt, iteration count and a verifier blob — never the master password.
   */
  async initialise(masterPassword: string): Promise<void> {
    if (await this.isInitialised()) {
      throw new VaultError('Ombor allaqachon yaratilgan.', 'already-initialised');
    }
    const policy = checkMasterPassword(masterPassword);
    if (!policy.ok) {
      throw new VaultError(policy.problems.join(' '), 'weak-master-password');
    }

    const iterations = await calibrateIterations();
    const kdf = {
      name: 'PBKDF2' as const,
      hash: 'SHA-256' as const,
      iterations,
      salt: createSalt(),
    };
    const key = await deriveVaultKey(masterPassword, kdf);
    const now = Date.now();

    await databaseService.putMeta({
      id: 'vault-meta',
      formatVersion: CRYPTO_FORMAT_VERSION,
      kdf,
      verifier: await createVerifier(key),
      createdAt: now,
      updatedAt: now,
    });

    vaultKey = key;
  },

  /** Derive the key and check it against the verifier. */
  async unlock(masterPassword: string): Promise<void> {
    const meta = await databaseService.getMeta();
    if (!meta) {
      throw new VaultError('Ombor hali yaratilmagan.', 'not-initialised');
    }
    const key = await deriveVaultKey(masterPassword, meta.kdf);
    if (!(await verifyKey(key, meta.verifier))) {
      throw new VaultError("Master parol noto'g'ri.", 'wrong-master-password');
    }
    vaultKey = key;
  },

  /** Check a master password without changing the lock state (re-auth). */
  async verifyMasterPassword(masterPassword: string): Promise<boolean> {
    const meta = await databaseService.getMeta();
    if (!meta) return false;
    try {
      const key = await deriveVaultKey(masterPassword, meta.kdf);
      return await verifyKey(key, meta.verifier);
    } catch (error) {
      if (error instanceof CryptoError) return false;
      throw error;
    }
  },

  /** Drop the key. After this call the vault cannot be read. */
  lock(): void {
    vaultKey = null;
  },

  /* ---------------------------------------------------------------- *
   * Credentials
   * ---------------------------------------------------------------- */

  async listCredentials(): Promise<Credential[]> {
    const key = requireKey();
    const records = await databaseService.listCredentials();
    const credentials = await Promise.all(records.map((record) => toCredential(key, record)));
    return credentials.sort((a, b) => a.name.localeCompare(b.name, 'uz'));
  },

  async createCredential(input: CredentialInput): Promise<Credential> {
    const key = requireKey();
    const secret = sanitiseInput(input);
    const now = Date.now();
    const record: CredentialRecord = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      data: await encryptJson(key, secret),
    };
    await databaseService.putCredential(record);
    return { id: record.id, createdAt: now, updatedAt: now, ...secret };
  },

  async updateCredential(
    id: string,
    changes: Partial<CredentialSecret>,
  ): Promise<Credential> {
    const key = requireKey();
    const records = await databaseService.listCredentials();
    const existing = records.find((record) => record.id === id);
    if (!existing) {
      throw new VaultError('Bunday yozuv topilmadi.', 'not-found');
    }

    const current = await decryptJson<CredentialSecret>(key, existing.data);
    const merged = sanitiseInput({ ...current, ...changes });
    const updatedAt = Date.now();

    await databaseService.putCredential({
      id,
      createdAt: existing.createdAt,
      updatedAt,
      // A new envelope means a fresh IV: IVs are never reused with this key.
      data: await encryptJson(key, merged),
    });

    return { id, createdAt: existing.createdAt, updatedAt, ...merged };
  },

  async deleteCredential(id: string): Promise<void> {
    requireKey();
    await databaseService.deleteCredential(id);
  },

  /* ---------------------------------------------------------------- *
   * Custom categories (stored encrypted — category names can be personal)
   * ---------------------------------------------------------------- */

  async listCustomCategories(): Promise<CustomCategory[]> {
    const key = requireKey();
    const record = await databaseService.getCategories();
    if (!record) return [];
    return decryptJson<CustomCategory[]>(key, record.data);
  },

  async saveCustomCategories(categories: CustomCategory[]): Promise<void> {
    const key = requireKey();
    const record: CategoriesRecord = {
      id: 'categories',
      data: await encryptJson(key, categories),
      updatedAt: Date.now(),
    };
    await databaseService.putCategories(record);
  },

  /* ---------------------------------------------------------------- *
   * Maintenance
   * ---------------------------------------------------------------- */

  /** Re-encrypt the whole vault under a new master password. */
  async changeMasterPassword(
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    const meta = await databaseService.getMeta();
    if (!meta) throw new VaultError('Ombor hali yaratilmagan.', 'not-initialised');

    const currentKey = await deriveVaultKey(currentPassword, meta.kdf);
    if (!(await verifyKey(currentKey, meta.verifier))) {
      throw new VaultError("Hozirgi master parol noto'g'ri.", 'wrong-master-password');
    }
    const policy = checkMasterPassword(nextPassword);
    if (!policy.ok) {
      throw new VaultError(policy.problems.join(' '), 'weak-master-password');
    }

    const records = await databaseService.listCredentials();
    const secrets = await Promise.all(
      records.map(async (record) => ({
        record,
        secret: await decryptJson<CredentialSecret>(currentKey, record.data),
      })),
    );
    const categoriesRecord = await databaseService.getCategories();
    const categories = categoriesRecord
      ? await decryptJson<CustomCategory[]>(currentKey, categoriesRecord.data)
      : null;

    const kdf = {
      name: 'PBKDF2' as const,
      hash: 'SHA-256' as const,
      iterations: await calibrateIterations(),
      salt: createSalt(),
    };
    const nextKey = await deriveVaultKey(nextPassword, kdf);

    const reEncrypted: CredentialRecord[] = await Promise.all(
      secrets.map(async ({ record, secret }) => ({
        id: record.id,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        data: await encryptJson(nextKey, secret),
      })),
    );

    await databaseService.replaceVault({
      meta: {
        id: 'vault-meta',
        formatVersion: CRYPTO_FORMAT_VERSION,
        kdf,
        verifier: await createVerifier(nextKey),
        createdAt: meta.createdAt,
        updatedAt: Date.now(),
      },
      credentials: reEncrypted,
      categories: categories
        ? { id: 'categories', data: await encryptJson(nextKey, categories), updatedAt: Date.now() }
        : null,
    });

    vaultKey = nextKey;
  },

  /** Delete everything. Used by Settings → "Omborni o'chirish". */
  async destroy(): Promise<void> {
    await databaseService.destroyVault();
    vaultKey = null;
  },

  /** Internal: hand the live key to another service in this module graph. */
  _key(): CryptoKey {
    return requireKey();
  },

  /** Internal: adopt a key after a restore re-created the vault. */
  _adoptKey(key: CryptoKey): void {
    vaultKey = key;
  },
};

export type VaultService = typeof vaultService;
