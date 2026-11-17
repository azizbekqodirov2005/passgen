/**
 * databaseService — the only module that talks to IndexedDB.
 *
 * Everything written here is either already encrypted (credentials, categories,
 * verifier) or non-sensitive (theme, auto-lock duration, KDF parameters).
 * Decrypted credentials are never passed to this module.
 */

import type {
  AppSettings,
  CategoriesRecord,
  CredentialRecord,
  VaultMetaRecord,
} from '@/lib/types';

const DB_NAME = 'passgen';
const DB_VERSION = 1;

export const STORE_META = 'meta';
export const STORE_CREDENTIALS = 'credentials';
export const STORE_SETTINGS = 'settings';

export const META_KEY = 'vault-meta';
export const CATEGORIES_KEY = 'categories';

export class DatabaseError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

interface SettingsRow {
  key: 'app-settings';
  value: AppSettings;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new DatabaseError(
          "Bu brauzerda IndexedDB mavjud emas, shuning uchun ombor saqlanmaydi. Shaxsiy (private) rejimni o'chirib ko'ring.",
        ),
      );
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(new DatabaseError("Ma'lumotlar bazasini ochib bo'lmadi.", error));
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Schema migrations are additive and idempotent: each version block only
      // creates what that version introduced, so upgrading never loses data.
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CREDENTIALS)) {
          const store = db.createObjectStore(STORE_CREDENTIALS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        // Another tab is upgrading the schema: release our handle so it can.
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () =>
      reject(new DatabaseError("Ma'lumotlar bazasiga ulanib bo'lmadi.", request.error));

    request.onblocked = () =>
      reject(
        new DatabaseError(
          "Ma'lumotlar bazasi boshqa oynada ochiq. Boshqa PassGen oynalarini yopib qayta urinib ko'ring.",
        ),
      );
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

async function run<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(storeNames, mode);
    } catch (error) {
      reject(new DatabaseError('Tranzaksiyani boshlab bo‘lmadi.', error));
      return;
    }

    let result: T;
    let workDone = false;
    let txDone = false;
    let settled = false;

    const settle = () => {
      if (!settled && workDone && txDone) {
        settled = true;
        resolve(result);
      }
    };

    tx.oncomplete = () => {
      txDone = true;
      settle();
    };
    tx.onerror = () => {
      if (!settled) {
        settled = true;
        reject(new DatabaseError("Ma'lumotni yozib bo'lmadi.", tx.error));
      }
    };
    tx.onabort = () => {
      if (!settled) {
        settled = true;
        reject(new DatabaseError('Tranzaksiya bekor qilindi.', tx.error));
      }
    };

    Promise.resolve(work(tx))
      .then((value) => {
        result = value;
        workDone = true;
        settle();
      })
      .catch((error: unknown) => {
        settled = true;
        try {
          tx.abort();
        } catch {
          /* already finished */
        }
        reject(error instanceof Error ? error : new DatabaseError(String(error)));
      });
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new DatabaseError('Bazaga so‘rov muvaffaqiyatsiz.', req.error));
  });
}

/* ------------------------------------------------------------------ *
 * Vault metadata
 * ------------------------------------------------------------------ */

export const databaseService = {
  async getMeta(): Promise<VaultMetaRecord | null> {
    return run(STORE_META, 'readonly', async (tx) => {
      const value = await request(
        tx.objectStore(STORE_META).get(META_KEY) as IDBRequest<VaultMetaRecord | undefined>,
      );
      return value ?? null;
    });
  },

  async putMeta(meta: VaultMetaRecord): Promise<void> {
    await run(STORE_META, 'readwrite', (tx) => request(tx.objectStore(STORE_META).put(meta)));
  },

  async getCategories(): Promise<CategoriesRecord | null> {
    return run(STORE_META, 'readonly', async (tx) => {
      const value = await request(
        tx.objectStore(STORE_META).get(CATEGORIES_KEY) as IDBRequest<CategoriesRecord | undefined>,
      );
      return value ?? null;
    });
  },

  async putCategories(record: CategoriesRecord): Promise<void> {
    await run(STORE_META, 'readwrite', (tx) => request(tx.objectStore(STORE_META).put(record)));
  },

  /* ---------------------------------------------------------------- *
   * Credentials
   * ---------------------------------------------------------------- */

  async listCredentials(): Promise<CredentialRecord[]> {
    return run(STORE_CREDENTIALS, 'readonly', async (tx) => {
      const rows = await request(
        tx.objectStore(STORE_CREDENTIALS).getAll() as IDBRequest<CredentialRecord[]>,
      );
      return rows;
    });
  },

  async putCredential(record: CredentialRecord): Promise<void> {
    await run(STORE_CREDENTIALS, 'readwrite', (tx) =>
      request(tx.objectStore(STORE_CREDENTIALS).put(record)),
    );
  },

  async deleteCredential(id: string): Promise<void> {
    await run(STORE_CREDENTIALS, 'readwrite', (tx) =>
      request(tx.objectStore(STORE_CREDENTIALS).delete(id)),
    );
  },

  /**
   * Replace the whole vault in a single transaction. Used by restore, so a
   * failure half-way through can never leave a mixed-key vault behind.
   */
  async replaceVault(payload: {
    meta: VaultMetaRecord;
    credentials: CredentialRecord[];
    categories: CategoriesRecord | null;
  }): Promise<void> {
    await run([STORE_META, STORE_CREDENTIALS], 'readwrite', async (tx) => {
      const metaStore = tx.objectStore(STORE_META);
      const credStore = tx.objectStore(STORE_CREDENTIALS);
      await request(metaStore.clear());
      await request(credStore.clear());
      await request(metaStore.put(payload.meta));
      if (payload.categories) {
        await request(metaStore.put(payload.categories));
      }
      for (const record of payload.credentials) {
        await request(credStore.put(record));
      }
    });
  },

  /** Wipe every trace of the vault. Irreversible. */
  async destroyVault(): Promise<void> {
    await run([STORE_META, STORE_CREDENTIALS], 'readwrite', async (tx) => {
      await request(tx.objectStore(STORE_META).clear());
      await request(tx.objectStore(STORE_CREDENTIALS).clear());
    });
  },

  /* ---------------------------------------------------------------- *
   * Settings (non-sensitive)
   * ---------------------------------------------------------------- */

  async getSettings(): Promise<AppSettings | null> {
    return run(STORE_SETTINGS, 'readonly', async (tx) => {
      const row = await request(
        tx.objectStore(STORE_SETTINGS).get('app-settings') as IDBRequest<SettingsRow | undefined>,
      );
      return row?.value ?? null;
    });
  },

  async putSettings(value: AppSettings): Promise<void> {
    const row: SettingsRow = { key: 'app-settings', value };
    await run(STORE_SETTINGS, 'readwrite', (tx) =>
      request(tx.objectStore(STORE_SETTINGS).put(row)),
    );
  },

  /** Test helper: drop the cached connection so a fresh DB can be opened. */
  _resetConnection(): void {
    dbPromise = null;
  },
};

export type DatabaseService = typeof databaseService;
