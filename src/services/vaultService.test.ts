import { beforeEach, describe, expect, it } from 'vitest';
import { databaseService } from './databaseService';
import { vaultService, VaultError } from './vaultService';
import { MIN_PBKDF2_ITERATIONS } from './cryptoService';

const MASTER = 'Toshkent-2026!xy';

async function freshVault(master = MASTER): Promise<void> {
  await databaseService.destroyVault();
  vaultService.lock();
  await vaultService.initialise(master);
}

describe('vault lifecycle', () => {
  beforeEach(async () => {
    await databaseService.destroyVault();
    vaultService.lock();
  });

  it('starts uninitialised and locked', async () => {
    expect(await vaultService.isInitialised()).toBe(false);
    expect(vaultService.isUnlocked()).toBe(false);
  });

  it('creates a vault and leaves it unlocked', async () => {
    await vaultService.initialise(MASTER);
    expect(await vaultService.isInitialised()).toBe(true);
    expect(vaultService.isUnlocked()).toBe(true);
  });

  it('stores calibrated KDF parameters and no master password', async () => {
    await vaultService.initialise(MASTER);
    const meta = await vaultService.getMeta();
    expect(meta?.kdf.name).toBe('PBKDF2');
    expect(meta?.kdf.hash).toBe('SHA-256');
    expect(meta?.kdf.iterations).toBeGreaterThanOrEqual(MIN_PBKDF2_ITERATIONS);
    expect(JSON.stringify(meta)).not.toContain(MASTER);
    expect(JSON.stringify(meta)).not.toContain('Toshkent');
  });

  it('refuses a weak master password', async () => {
    await expect(vaultService.initialise('parol')).rejects.toMatchObject({
      code: 'weak-master-password',
    });
    expect(await vaultService.isInitialised()).toBe(false);
  });

  it('refuses to initialise twice', async () => {
    await vaultService.initialise(MASTER);
    await expect(vaultService.initialise(MASTER)).rejects.toMatchObject({
      code: 'already-initialised',
    });
  });

  it('unlocks with the right master password and rejects the wrong one', async () => {
    await vaultService.initialise(MASTER);
    vaultService.lock();
    expect(vaultService.isUnlocked()).toBe(false);

    await expect(vaultService.unlock('Boshqa-Parol-123!')).rejects.toMatchObject({
      code: 'wrong-master-password',
    });
    expect(vaultService.isUnlocked()).toBe(false);

    await vaultService.unlock(MASTER);
    expect(vaultService.isUnlocked()).toBe(true);
  });

  it('verifies a master password without changing the lock state', async () => {
    await vaultService.initialise(MASTER);
    vaultService.lock();
    expect(await vaultService.verifyMasterPassword(MASTER)).toBe(true);
    expect(await vaultService.verifyMasterPassword('nope')).toBe(false);
    expect(vaultService.isUnlocked()).toBe(false);
  });

  it('blocks every read and write while locked', async () => {
    await vaultService.initialise(MASTER);
    vaultService.lock();
    await expect(vaultService.listCredentials()).rejects.toBeInstanceOf(VaultError);
    await expect(
      vaultService.createCredential({ name: 'X', password: 'y' }),
    ).rejects.toMatchObject({ code: 'locked' });
  });
});

describe('credential CRUD', () => {
  beforeEach(async () => {
    await freshVault();
  });

  it('creates, lists, updates and deletes', async () => {
    const created = await vaultService.createCredential({
      name: 'Gmail',
      username: 'azizbek@example.com',
      password: 'r8#Kp2$wQz!7mTv4',
      url: 'https://mail.google.com',
      category: 'email',
      notes: 'asosiy pochta',
      favorite: true,
    });

    expect(created.id).toBeTruthy();
    const list = await vaultService.listCredentials();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'Gmail',
      username: 'azizbek@example.com',
      password: 'r8#Kp2$wQz!7mTv4',
      category: 'email',
      favorite: true,
    });

    const updated = await vaultService.updateCredential(created.id, {
      password: 'yangi-parol-9!Xz',
      favorite: false,
    });
    expect(updated.password).toBe('yangi-parol-9!Xz');
    expect(updated.favorite).toBe(false);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    // Fields not mentioned in the update survive.
    expect(updated.username).toBe('azizbek@example.com');

    await vaultService.deleteCredential(created.id);
    expect(await vaultService.listCredentials()).toHaveLength(0);
  });

  it('requires a name', async () => {
    await expect(
      vaultService.createCredential({ name: '   ', password: 'x' }),
    ).rejects.toMatchObject({ code: 'invalid-input' });
  });

  it('reports a missing record on update', async () => {
    await expect(
      vaultService.updateCredential('no-such-id', { password: 'x' }),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('never persists a password in plaintext', async () => {
    const secret = 'Juda-Maxfiy-9!parol';
    await vaultService.createCredential({ name: 'Bank', password: secret });

    const stored = await databaseService.listCredentials();
    const raw = JSON.stringify(stored);
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain('Maxfiy');
    // The platform name is encrypted too, not just the password.
    expect(raw).not.toContain('Bank');
    expect(stored[0]?.data.iv).toBeTruthy();
    expect(stored[0]?.data.v).toBe(1);
  });

  it('uses a new IV on every write', async () => {
    const created = await vaultService.createCredential({ name: 'A', password: 'p' });
    const first = (await databaseService.listCredentials())[0]?.data.iv;
    await vaultService.updateCredential(created.id, { password: 'p' });
    const second = (await databaseService.listCredentials())[0]?.data.iv;
    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('keeps data available after the vault is locked and unlocked again', async () => {
    await vaultService.createCredential({ name: 'Telegram', password: 'tg-parol-1!Xy' });
    vaultService.lock();
    await vaultService.unlock(MASTER);
    const list = await vaultService.listCredentials();
    expect(list[0]?.name).toBe('Telegram');
    expect(list[0]?.password).toBe('tg-parol-1!Xy');
  });
});

describe('custom categories', () => {
  beforeEach(async () => {
    await freshVault();
  });

  it('round-trips encrypted category names', async () => {
    await vaultService.saveCustomCategories([{ id: 'custom-oqish', label: "O'qish" }]);
    expect(await vaultService.listCustomCategories()).toEqual([
      { id: 'custom-oqish', label: "O'qish" },
    ]);

    const stored = await databaseService.getCategories();
    expect(JSON.stringify(stored)).not.toContain('qish');
  });

  it('returns an empty list when none were saved', async () => {
    expect(await vaultService.listCustomCategories()).toEqual([]);
  });
});

describe('changeMasterPassword', () => {
  beforeEach(async () => {
    await freshVault();
  });

  it('re-encrypts everything under the new password', async () => {
    await vaultService.createCredential({ name: 'Instagram', password: 'ig-parol-7!Qw' });
    await vaultService.saveCustomCategories([{ id: 'custom-x', label: 'X' }]);

    const NEXT = 'Yangi-Master-2027!z';
    await vaultService.changeMasterPassword(MASTER, NEXT);

    vaultService.lock();
    await expect(vaultService.unlock(MASTER)).rejects.toMatchObject({
      code: 'wrong-master-password',
    });

    await vaultService.unlock(NEXT);
    const list = await vaultService.listCredentials();
    expect(list[0]?.password).toBe('ig-parol-7!Qw');
    expect(await vaultService.listCustomCategories()).toEqual([{ id: 'custom-x', label: 'X' }]);
  });

  it('rejects a wrong current password and a weak new one', async () => {
    await expect(
      vaultService.changeMasterPassword('wrong', 'Yangi-Master-2027!z'),
    ).rejects.toMatchObject({ code: 'wrong-master-password' });
    await expect(
      vaultService.changeMasterPassword(MASTER, 'weak'),
    ).rejects.toMatchObject({ code: 'weak-master-password' });
    // The vault is untouched and still opens with the original password.
    vaultService.lock();
    await vaultService.unlock(MASTER);
  });
});

describe('destroy', () => {
  it('removes the vault entirely', async () => {
    await freshVault();
    await vaultService.createCredential({ name: 'X', password: 'y' });
    await vaultService.destroy();
    expect(await vaultService.isInitialised()).toBe(false);
    expect(vaultService.isUnlocked()).toBe(false);
    expect(await databaseService.listCredentials()).toHaveLength(0);
  });
});
