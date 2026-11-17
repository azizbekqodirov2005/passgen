/**
 * Shared domain types for PassGen.
 *
 * Naming convention used throughout the codebase:
 *  - `*Record`  — the shape that is persisted (always encrypted for secrets).
 *  - `*Payload` — the decrypted, in-memory shape. Never persisted.
 */

/** Version of the on-disk encryption envelope. Bump when the format changes. */
export const CRYPTO_FORMAT_VERSION = 1 as const;

/** Version of the exported backup file format. */
export const BACKUP_FORMAT_VERSION = 1 as const;

export type CategoryId =
  | 'social'
  | 'email'
  | 'banking'
  | 'work'
  | 'shopping'
  | 'entertainment'
  | 'development'
  | 'other'
  | (string & {});

/** An AES-GCM encrypted blob plus the metadata needed to decrypt it. */
export interface EncryptedEnvelope {
  /** Format version of this envelope. */
  v: typeof CRYPTO_FORMAT_VERSION;
  /** Base64 initialisation vector — unique per encryption operation. */
  iv: string;
  /** Base64 ciphertext (includes the GCM authentication tag). */
  ct: string;
}

/** Key-derivation parameters. Stored in the clear; they are not secrets. */
export interface KdfParams {
  name: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  /** Base64 salt, cryptographically random, 16 bytes. */
  salt: string;
}

/**
 * Vault metadata — the only record that must exist before unlocking.
 * Contains no secret material: just KDF parameters and a verifier blob that
 * lets us reject a wrong master password without touching credential data.
 */
export interface VaultMetaRecord {
  id: 'vault-meta';
  formatVersion: typeof CRYPTO_FORMAT_VERSION;
  kdf: KdfParams;
  /** Encryption of a fixed token; decrypts only with the correct master key. */
  verifier: EncryptedEnvelope;
  createdAt: number;
  updatedAt: number;
}

/** A credential as persisted: plaintext fields are limited to sort metadata. */
export interface CredentialRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Encrypted `CredentialSecret`. */
  data: EncryptedEnvelope;
}

/** The decrypted part of a credential. Lives in memory only. */
export interface CredentialSecret {
  name: string;
  username: string;
  password: string;
  url: string;
  category: CategoryId;
  notes: string;
  favorite: boolean;
}

/** A credential as the UI works with it: metadata + decrypted fields. */
export interface Credential extends CredentialSecret {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/** Fields accepted when creating or updating a credential. */
export type CredentialInput = Partial<CredentialSecret> &
  Pick<CredentialSecret, 'name' | 'password'>;

/** Encrypted blob holding the user's custom category list. */
export interface CategoriesRecord {
  id: 'categories';
  data: EncryptedEnvelope;
  updatedAt: number;
}

export interface CustomCategory {
  id: string;
  label: string;
}

/** Non-sensitive app settings. Safe to store unencrypted. */
export interface AppSettings {
  theme: ThemePreference;
  autoLockMinutes: number;
  clearClipboardSeconds: number;
  revealRequiresMasterPassword: boolean;
}

export type ThemePreference = 'dark' | 'light' | 'system';

export type VaultStatus = 'loading' | 'uninitialised' | 'locked' | 'unlocked';

export type SortKey = 'name' | 'created' | 'updated' | 'security';
export type SortDirection = 'asc' | 'desc';

/** A single entry in the in-session activity log. Never persisted. */
export interface ActivityEntry {
  id: string;
  at: number;
  kind:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'unlocked'
    | 'locked'
    | 'generated'
    | 'exported'
    | 'restored'
    | 'favorite';
  label: string;
}

export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface StrengthResult {
  /** Estimated entropy in bits. */
  entropy: number;
  level: StrengthLevel;
  /** 0–100, for meters and scores. */
  score: number;
  /** Short Uzbek hints on what weakens the password. */
  notes: string[];
}

export interface BackupFile {
  app: 'PassGen';
  backupVersion: typeof BACKUP_FORMAT_VERSION;
  createdAt: number;
  formatVersion: typeof CRYPTO_FORMAT_VERSION;
  kdf: KdfParams;
  verifier: EncryptedEnvelope;
  credentials: CredentialRecord[];
  categories: EncryptedEnvelope | null;
  /** SHA-256 (base64) of the canonical payload, for integrity checking. */
  checksum: string;
}
