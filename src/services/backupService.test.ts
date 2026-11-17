import { beforeEach, describe, expect, it } from 'vitest';
import {
  BackupError,
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  serialiseBackup,
  summariseBackup,
} from './backupService';
import { databaseService } from './databaseService';
import { vaultService } from './vaultService';

const MASTER = 'Toshkent-2026!xy';
const SECRET = 'Juda-Maxfiy-Parol-9!';

async function seedVault(): Promise<void> {
  await databaseService.destroyVault();
  vaultService.lock();
  await vaultService.initialise(MASTER);
  await vaultService.createCredential({
    name: 'Gmail',
    username: 'azizbek@example.com',
    password: SECRET,
    category: 'email',
  });
  await vaultService.createCredential({
    name: 'Bank',
    password: 'bank-parol-3!Qz',
    category: 'banking',
  });
  await vaultService.saveCustomCategories([{ id: 'custom-x', label: 'Loyihalar' }]);
}

describe('createBackup', () => {
  beforeEach(seedVault);

  it('exports encrypted records only — no plaintext anywhere', async () => {
    const raw = serialiseBackup(await createBackup());
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain('Maxfiy');
    expect(raw).not.toContain('Gmail');
    expect(raw).not.toContain('azizbek@example.com');
    expect(raw).not.toContain(MASTER);
    expect(raw).not.toContain('Loyihalar');
  });

  it('includes the metadata needed to decrypt later', async () => {
    const backup = await createBackup();
    expect(backup.app).toBe('PassGen');
    expect(backup.backupVersion).toBe(1);
    expect(backup.formatVersion).toBe(1);
    expect(backup.kdf.name).toBe('PBKDF2');
    expect(backup.kdf.salt).toBeTruthy();
    expect(backup.verifier.iv).toBeTruthy();
    expect(backup.credentials).toHaveLength(2);
    expect(backup.categories).not.toBeNull();
    expect(backup.checksum).toBeTruthy();
  });

  it('summarises itself for the confirmation dialog', async () => {
    const summary = summariseBackup(await createBackup());
    expect(summary.credentialCount).toBe(2);
    expect(summary.hasCategories).toBe(true);
    expect(summary.iterations).toBeGreaterThan(0);
  });

  it('builds a dated file name', () => {
    expect(backupFileName(Date.UTC(2026, 10, 17, 9, 35))).toMatch(
      /^passgen-backup-\d{8}-\d{4}\.passgen\.json$/u,
    );
  });

  it('fails when there is no vault', async () => {
    await databaseService.destroyVault();
    await expect(createBackup()).rejects.toMatchObject({ code: 'not-initialised' });
  });
});

describe('parseBackup', () => {
  beforeEach(seedVault);

  it('accepts a file it produced', async () => {
    const backup = await createBackup();
    const parsed = await parseBackup(serialiseBackup(backup));
    expect(parsed.credentials).toHaveLength(2);
    expect(parsed.checksum).toBe(backup.checksum);
  });

  it('rejects non-JSON and foreign files', async () => {
    await expect(parseBackup('not json at all')).rejects.toMatchObject({
      code: 'invalid-file',
    });
    await expect(parseBackup('{"app":"SomethingElse"}')).rejects.toMatchObject({
      code: 'invalid-file',
    });
  });

  it('rejects an unsupported version', async () => {
    const backup = await createBackup();
    const raw = JSON.stringify({ ...backup, backupVersion: 99 });
    await expect(parseBackup(raw)).rejects.toMatchObject({ code: 'unsupported-version' });
  });

  it('detects a tampered credential through the checksum', async () => {
    const backup = await createBackup();
    const tampered = structuredClone(backup);
    const target = tampered.credentials[0];
    if (!target) throw new Error('fixture missing');
    target.data.ct = `${target.data.ct.slice(0, -4)}AAAA`;
    await expect(parseBackup(JSON.stringify(tampered))).rejects.toMatchObject({
      code: 'corrupted',
    });
  });

  it('detects a removed record through the checksum', async () => {
    const backup = await createBackup();
    const tampered = { ...backup, credentials: backup.credentials.slice(0, 1) };
    await expect(parseBackup(JSON.stringify(tampered))).rejects.toMatchObject({
      code: 'corrupted',
    });
  });

  it('detects a missing checksum and broken structure', async () => {
    const backup = await createBackup();
    const { checksum: _checksum, ...withoutChecksum } = backup;
    await expect(parseBackup(JSON.stringify(withoutChecksum))).rejects.toMatchObject({
      code: 'corrupted',
    });
    await expect(
      parseBackup(JSON.stringify({ ...backup, credentials: [{ id: 'x' }] })),
    ).rejects.toMatchObject({ code: 'corrupted' });
  });

  it('rejects a swapped KDF (which would silently break decryption)', async () => {
    const backup = await createBackup();
    const tampered = {
      ...backup,
      kdf: { ...backup.kdf, iterations: backup.kdf.iterations + 1 },
    };
    await expect(parseBackup(JSON.stringify(tampered))).rejects.toMatchObject({
      code: 'corrupted',
    });
  });
});

describe('restoreBackup', () => {
  beforeEach(seedVault);

  it('restores every credential and keeps the session usable', async () => {
    const backup = await parseBackup(serialiseBackup(await createBackup()));

    // Wipe and re-create a different vault to prove the restore really replaces it.
    await databaseService.destroyVault();
    vaultService.lock();
    await vaultService.initialise('Boshqa-Master-1!xy');
    await vaultService.createCredential({ name: 'Keraksiz', password: 'x' });

    const result = await restoreBackup(backup, MASTER);
    expect(result.credentialCount).toBe(2);

    const list = await vaultService.listCredentials();
    expect(list.map((c) => c.name).sort()).toEqual(['Bank', 'Gmail']);
    expect(list.find((c) => c.name === 'Gmail')?.password).toBe(SECRET);
    expect(list.some((c) => c.name === 'Keraksiz')).toBe(false);
    expect(await vaultService.listCustomCategories()).toEqual([
      { id: 'custom-x', label: 'Loyihalar' },
    ]);
  });

  it('refuses a wrong master password and leaves the vault untouched', async () => {
    const backup = await parseBackup(serialiseBackup(await createBackup()));
    await expect(restoreBackup(backup, 'Wrong-Master-1!xy')).rejects.toBeInstanceOf(
      BackupError,
    );

    // Nothing was replaced: the original vault still works.
    const list = await vaultService.listCredentials();
    expect(list).toHaveLength(2);
  });

  it('survives a lock after restore (the backup key became the session key)', async () => {
    const backup = await parseBackup(serialiseBackup(await createBackup()));
    await restoreBackup(backup, MASTER);
    vaultService.lock();
    await vaultService.unlock(MASTER);
    expect(await vaultService.listCredentials()).toHaveLength(2);
  });
});
