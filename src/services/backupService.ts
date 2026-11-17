/**
 * backupService — export and restore the vault **without ever decrypting it**.
 *
 * A backup file is a copy of the encrypted records plus the KDF parameters
 * needed to derive the key again. There is no plaintext password anywhere in
 * the file, and PassGen cannot read a backup without the master password that
 * created it.
 *
 * Integrity is checked two ways:
 *  1. a SHA-256 checksum over the canonical payload detects corruption;
 *  2. the verifier blob proves the supplied master password matches the file.
 */

import {
  BACKUP_FORMAT_VERSION,
  CRYPTO_FORMAT_VERSION,
  type BackupFile,
  type CredentialRecord,
  type EncryptedEnvelope,
  type KdfParams,
} from '@/lib/types';
import {
  assertEnvelope,
  deriveVaultKey,
  sha256Base64,
  verifyKey,
} from '@/services/cryptoService';
import { databaseService } from '@/services/databaseService';
import { vaultService } from '@/services/vaultService';

export class BackupError extends Error {
  constructor(
    message: string,
    readonly code: 'not-initialised' | 'invalid-file' | 'corrupted' | 'wrong-master-password' | 'unsupported-version',
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Everything the checksum covers, in a fixed order so it is reproducible. */
function canonicalPayload(file: Omit<BackupFile, 'checksum'>): string {
  return JSON.stringify({
    app: file.app,
    backupVersion: file.backupVersion,
    createdAt: file.createdAt,
    formatVersion: file.formatVersion,
    kdf: file.kdf,
    verifier: file.verifier,
    credentials: file.credentials.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      data: { v: record.data.v, iv: record.data.iv, ct: record.data.ct },
    })),
    categories: file.categories,
  });
}

export async function createBackup(): Promise<BackupFile> {
  const meta = await databaseService.getMeta();
  if (!meta) {
    throw new BackupError('Ombor hali yaratilmagan.', 'not-initialised');
  }

  const credentials = await databaseService.listCredentials();
  const categoriesRecord = await databaseService.getCategories();

  const withoutChecksum: Omit<BackupFile, 'checksum'> = {
    app: 'PassGen',
    backupVersion: BACKUP_FORMAT_VERSION,
    createdAt: Date.now(),
    formatVersion: meta.formatVersion,
    kdf: meta.kdf,
    verifier: meta.verifier,
    credentials,
    categories: categoriesRecord?.data ?? null,
  };

  return {
    ...withoutChecksum,
    checksum: await sha256Base64(canonicalPayload(withoutChecksum)),
  };
}

export function serialiseBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

export function backupFileName(at: number = Date.now()): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `passgen-backup-${String(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.passgen.json`;
}

/* ------------------------------------------------------------------ *
 * Parsing and validation
 * ------------------------------------------------------------------ */

function isKdf(value: unknown): value is KdfParams {
  const kdf = value as Partial<KdfParams> | null;
  return (
    !!kdf &&
    kdf.name === 'PBKDF2' &&
    kdf.hash === 'SHA-256' &&
    typeof kdf.iterations === 'number' &&
    kdf.iterations > 0 &&
    typeof kdf.salt === 'string' &&
    kdf.salt.length > 0
  );
}

function isCredentialRecord(value: unknown): value is CredentialRecord {
  const record = value as Partial<CredentialRecord> | null;
  if (
    !record ||
    typeof record.id !== 'string' ||
    typeof record.createdAt !== 'number' ||
    typeof record.updatedAt !== 'number'
  ) {
    return false;
  }
  try {
    assertEnvelope(record.data);
    return true;
  } catch {
    return false;
  }
}

/** Parse and structurally validate a backup file, then verify its checksum. */
export async function parseBackup(raw: string): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupError("Fayl JSON formatida emas yoki buzilgan.", 'invalid-file');
  }

  const file = parsed as Partial<BackupFile> | null;
  if (!file || file.app !== 'PassGen') {
    throw new BackupError('Bu fayl PassGen zaxira nusxasi emas.', 'invalid-file');
  }
  if (file.backupVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      `Zaxira nusxa versiyasi (v${String(file.backupVersion)}) qo'llab-quvvatlanmaydi.`,
      'unsupported-version',
    );
  }
  if (file.formatVersion !== CRYPTO_FORMAT_VERSION) {
    throw new BackupError(
      `Shifrlash formati (v${String(file.formatVersion)}) qo'llab-quvvatlanmaydi.`,
      'unsupported-version',
    );
  }
  if (!isKdf(file.kdf)) {
    throw new BackupError("Kalit hosil qilish parametrlari yo'q yoki buzilgan.", 'corrupted');
  }
  try {
    assertEnvelope(file.verifier);
  } catch {
    throw new BackupError('Tekshiruv bloki buzilgan.', 'corrupted');
  }
  if (!Array.isArray(file.credentials) || !file.credentials.every(isCredentialRecord)) {
    throw new BackupError("Yozuvlar ro'yxati buzilgan.", 'corrupted');
  }
  if (file.categories !== null && file.categories !== undefined) {
    try {
      assertEnvelope(file.categories);
    } catch {
      throw new BackupError('Kategoriyalar bloki buzilgan.', 'corrupted');
    }
  }
  if (typeof file.checksum !== 'string' || file.checksum.length === 0) {
    throw new BackupError("Faylda tekshiruv summasi yo'q.", 'corrupted');
  }

  const complete: Omit<BackupFile, 'checksum'> = {
    app: 'PassGen',
    backupVersion: BACKUP_FORMAT_VERSION,
    createdAt: typeof file.createdAt === 'number' ? file.createdAt : 0,
    formatVersion: CRYPTO_FORMAT_VERSION,
    kdf: file.kdf,
    verifier: file.verifier as EncryptedEnvelope,
    credentials: file.credentials,
    categories: (file.categories as EncryptedEnvelope | null) ?? null,
  };

  const expected = await sha256Base64(canonicalPayload(complete));
  if (expected !== file.checksum) {
    throw new BackupError(
      "Tekshiruv summasi mos kelmadi — fayl buzilgan yoki o'zgartirilgan.",
      'corrupted',
    );
  }

  return { ...complete, checksum: file.checksum };
}

export interface BackupSummary {
  createdAt: number;
  credentialCount: number;
  hasCategories: boolean;
  iterations: number;
}

export function summariseBackup(file: BackupFile): BackupSummary {
  return {
    createdAt: file.createdAt,
    credentialCount: file.credentials.length,
    hasCategories: file.categories !== null,
    iterations: file.kdf.iterations,
  };
}

/**
 * Replace the current vault with the contents of a backup.
 *
 * The caller must have confirmed the destructive action first; this function
 * verifies the master password against the backup's own verifier before any
 * data is touched, so a wrong password can never wipe the existing vault.
 */
export async function restoreBackup(
  file: BackupFile,
  masterPassword: string,
): Promise<{ credentialCount: number }> {
  const key = await deriveVaultKey(masterPassword, file.kdf);
  if (!(await verifyKey(key, file.verifier))) {
    throw new BackupError(
      "Bu zaxira nusxa uchun master parol noto'g'ri.",
      'wrong-master-password',
    );
  }

  const now = Date.now();
  await databaseService.replaceVault({
    meta: {
      id: 'vault-meta',
      formatVersion: CRYPTO_FORMAT_VERSION,
      kdf: file.kdf,
      verifier: file.verifier,
      createdAt: file.createdAt || now,
      updatedAt: now,
    },
    credentials: file.credentials,
    categories: file.categories
      ? { id: 'categories', data: file.categories, updatedAt: now }
      : null,
  });

  // The restored vault uses the backup's key, so adopt it: the session stays
  // unlocked and consistent with what is now on disk.
  vaultService._adoptKey(key);

  return { credentialCount: file.credentials.length };
}
