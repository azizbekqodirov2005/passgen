/**
 * End-to-end browser tests for PassGen.
 *
 * These run the production build in a real Chromium instance on localhost, so
 * Web Crypto, IndexedDB, clipboard and the full React UI are all exercised the
 * way a user would exercise them.
 *
 * Requirements (not part of the app's dependencies):
 *   npm install -D playwright && npx playwright install chromium
 *
 * Usage:
 *   npm run build && npx vite preview --port 4173 &
 *   node e2e/passgen.e2e.mjs [baseUrl]
 */

import { chromium } from 'playwright';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_URL = process.argv[2] ?? 'http://localhost:4173';
const MASTER = 'Toshkent-2026!xy';
const SECRET = 'Juda-Maxfiy-Parol-9!';

const downloadDir = join(tmpdir(), `passgen-e2e-${String(Date.now())}`);

let passed = 0;
let failed = 0;
const consoleErrors = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function main() {
  await mkdir(downloadDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env['CHROME_PATH'] ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  /* ---------------------------------------------------------------- *
   * 1. First run / master password creation
   * ---------------------------------------------------------------- */
  section('1. Ombor yaratish (setup)');

  await page.waitForSelector('#master-password', { timeout: 15_000 });
  check('Setup ekrani ochildi', await page.isVisible('#master-password'));

  await page.fill('#master-password', 'parol');
  check(
    'Kuchsiz master parolda tugma bloklangan',
    await page.isDisabled('button[type="submit"]'),
  );

  await page.fill('#master-password', MASTER);
  await page.fill('#master-password-confirm', `${MASTER}X`);
  check(
    'Mos kelmagan tasdiqda xato ko‘rsatiladi',
    (await page.locator('.field__error').count()) > 0,
  );

  await page.fill('#master-password-confirm', MASTER);
  await page.locator('.check input[type="checkbox"]').check();
  await page.click('button[type="submit"]');

  await page.waitForSelector('.shell', { timeout: 30_000 });
  check('Ombor yaratildi va panel ochildi', await page.isVisible('.shell'));

  /* ---------------------------------------------------------------- *
   * 2. No secrets in storage
   * ---------------------------------------------------------------- */
  section('2. Saqlash xavfsizligi');

  const storageDump = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  check('localStorage’da master parol yo‘q', !storageDump.local.includes(MASTER));
  check('sessionStorage bo‘sh yoki parolsiz', !storageDump.session.includes(MASTER));
  check(
    'localStorage’da shifrlangan ma’lumot yoki kalit yo‘q',
    !/iv|ct|kdf|salt|verifier/u.test(storageDump.local),
    storageDump.local,
  );

  /* ---------------------------------------------------------------- *
   * 3. Add a credential
   * ---------------------------------------------------------------- */
  section('3. Yozuv qo‘shish');

  await page.click('button:has-text("Yangi yozuv")');
  await page.waitForSelector('#credential-name');
  await page.fill('#credential-name', 'Gmail');
  await page.fill('#credential-username', 'azizbek@example.com');
  await page.fill('#credential-url', 'https://mail.google.com');
  await page.selectOption('#credential-category', 'email');
  await page.fill('#credential-form input[type="password"]', SECRET);
  await page.click('.modal button:has-text("Omborga saqlash")');
  await page.waitForSelector('.toast', { timeout: 10_000 });
  check('Saqlash bildirishnomasi chiqdi', await page.isVisible('.toast'));

  await page.click('.nav-item:has-text("Barcha parollar")');
  await page.waitForSelector('table.table tbody tr');
  check('Yozuv ro‘yxatda ko‘rinadi', (await page.locator('tbody tr').count()) === 1);
  check(
    'Parol sukut bo‘yicha yashirilgan',
    await page.locator('.secret__value--hidden').first().isVisible(),
  );
  check(
    'Yashirilgan qiymat ochiq matnni ko‘rsatmaydi',
    !(await page.locator('tbody').innerText()).includes(SECRET),
  );

  /* ---------------------------------------------------------------- *
   * 4. Reveal requires the master password
   * ---------------------------------------------------------------- */
  section('4. Parolni ko‘rsatish (qayta tasdiqlash)');

  await page.locator('button[aria-label="Parolni ko‘rsatish"]').first().click();
  await page.waitForSelector('#reauth-password', { timeout: 5000 });
  check('Master parol so‘raldi', await page.isVisible('#reauth-password'));

  await page.fill('#reauth-password', 'wrong-password');
  await page.click('button:has-text("Tasdiqlash")');
  await page.waitForTimeout(1500);
  check(
    'Noto‘g‘ri parol rad etildi',
    (await page.locator('.field__error').count()) > 0 &&
      (await page.isVisible('#reauth-password')),
  );

  await page.fill('#reauth-password', MASTER);
  await page.click('button:has-text("Tasdiqlash")');
  await page.waitForSelector('.secret__value--revealed', { timeout: 15_000 });
  check(
    'To‘g‘ri parolda qiymat ko‘rsatildi',
    (await page.locator('.secret__value--revealed').first().innerText()) === SECRET,
  );

  /* ---------------------------------------------------------------- *
   * 5. Clipboard
   * ---------------------------------------------------------------- */
  section('5. Clipboard');

  await page.locator('button[aria-label="Parolni nusxalash"]').first().click();
  await page.waitForTimeout(500);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  check('Parol clipboardga nusxalandi', clipboard === SECRET);

  /* ---------------------------------------------------------------- *
   * 6. Generator
   * ---------------------------------------------------------------- */
  section('6. Generator');

  await page.click('.nav-item:has-text("Parol generatori")');
  await page.waitForSelector('.readout__value');
  const generated = await page.locator('.readout__value').innerText();
  check('Parol yaratildi', generated.length >= 8);
  check('Standart uzunlik 20', generated.length === 20, `uzunligi ${generated.length}`);

  await page.click('button[aria-label="Qayta yaratish"]');
  await page.waitForTimeout(300);
  const regenerated = await page.locator('.readout__value').innerText();
  check('Qayta yaratishda boshqa parol chiqdi', regenerated !== generated);

  // Turn every character type off: the UI must refuse instead of generating.
  for (const label of ['Katta harflar', 'Kichik harflar', 'Raqamlar', 'Maxsus belgilar']) {
    await page.locator(`.check:has-text("${label}") input`).uncheck();
  }
  await page.waitForTimeout(300);
  check(
    'Turlar o‘chirilganda xato ko‘rsatiladi',
    await page.isVisible('.notice--danger'),
  );
  await page.locator('.check:has-text("Kichik harflar") input').check();
  await page.locator('.check:has-text("Raqamlar") input').check();
  await page.waitForTimeout(300);
  const digitsLower = await page.locator('.readout__value').innerText();
  check(
    'Faqat tanlangan belgilar ishlatiladi',
    /^[a-z0-9]+$/u.test(digitsLower),
    digitsLower,
  );

  /* ---------------------------------------------------------------- *
   * 7. Security audit
   * ---------------------------------------------------------------- */
  section('7. Xavfsizlik tahlili');

  // Add two weak, reused passwords so the audit has something to find.
  for (const name of ['Forum A', 'Forum B']) {
    await page.click('button:has-text("Yangi yozuv")');
    await page.waitForSelector('#credential-name');
    await page.fill('#credential-name', name);
    await page.fill('#credential-form input[type="password"]', '123456');
    await page.click('.modal button:has-text("Omborga saqlash")');
    await page.waitForTimeout(800);
  }

  await page.click('.nav-item:has-text("Xavfsizlik tahlili")');
  await page.waitForSelector('.score__number');
  const auditText = await page.locator('.shell__content').innerText();
  check('Takrorlangan parollar aniqlandi', auditText.includes('Takrorlangan'));
  check(
    'Tahlilda ochiq parol ko‘rinmaydi',
    !auditText.includes(SECRET) && !auditText.includes('123456'),
  );
  const scoreText = await page.locator('.score__number').innerText();
  const score = Number(/\d+/u.exec(scoreText)?.[0] ?? '-1');
  check('Baho 0–100 oralig‘ida', score >= 0 && score <= 100, `baho matni: ${scoreText}`);

  /* ---------------------------------------------------------------- *
   * 8. Persistence across reload
   * ---------------------------------------------------------------- */
  section('8. Sahifa yangilangandan keyin saqlanish');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#unlock-password', { timeout: 15_000 });
  check('Yangilanishdan keyin ombor qulflangan', await page.isVisible('#unlock-password'));

  await page.fill('#unlock-password', 'not-the-password');
  await page.click('button:has-text("Omborni ochish")');
  await page.waitForTimeout(2500);
  check(
    'Noto‘g‘ri master parol rad etildi',
    (await page.locator('.field__error').count()) > 0,
  );

  await page.fill('#unlock-password', MASTER);
  await page.click('button:has-text("Omborni ochish")');
  await page.waitForSelector('.shell', { timeout: 30_000 });
  await page.click('.nav-item:has-text("Barcha parollar")');
  await page.waitForSelector('tbody tr');
  check(
    'Barcha yozuvlar saqlanib qoldi',
    (await page.locator('tbody tr').count()) === 3,
    `topildi: ${await page.locator('tbody tr').count()}`,
  );

  /* ---------------------------------------------------------------- *
   * 9. Edit, favourite, delete
   * ---------------------------------------------------------------- */
  section('9. Tahrirlash, sevimli, o‘chirish');

  await page.locator('.entry__name-button:has-text("Forum A")').click();
  await page.waitForSelector('#credential-name');
  await page.fill('#credential-name', 'Forum A (yangilandi)');
  await page.click('.modal button:has-text("O‘zgarishlarni saqlash")');
  await page.waitForTimeout(1000);
  check(
    'Tahrirlangan nom saqlandi',
    (await page.locator('tbody').innerText()).includes('Forum A (yangilandi)'),
  );

  await page.locator('button[aria-label="Sevimlilarga qo‘shish"]').first().click();
  await page.waitForTimeout(800);
  await page.click('.nav-item:has-text("Sevimlilar")');
  await page.waitForTimeout(500);
  check(
    'Sevimlilar bo‘limida bitta yozuv bor',
    (await page.locator('tbody tr').count()) === 1,
  );

  await page.click('.nav-item:has-text("Barcha parollar")');
  await page.waitForSelector('tbody tr');
  const rowsBeforeDelete = await page.locator('tbody tr').count();
  await page
    .locator('tbody tr', { hasText: 'Forum B' })
    .locator('button[aria-label="O‘chirish"]')
    .click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button:has-text("O‘chirish")').click();
  await page.waitForTimeout(1200);
  const rowsAfterDelete = await page.locator('tbody tr').count();
  check(
    'Yozuv o‘chirildi',
    rowsAfterDelete === rowsBeforeDelete - 1,
    `${rowsBeforeDelete} → ${rowsAfterDelete}`,
  );
  check(
    'O‘chirilgan yozuv ro‘yxatdan ketdi',
    !(await page.locator('tbody').innerText()).includes('Forum B'),
  );

  /* ---------------------------------------------------------------- *
   * 10. Search and filters
   * ---------------------------------------------------------------- */
  section('10. Qidiruv va filtr');

  await page.fill('.search__input', 'gmail');
  await page.waitForTimeout(500);
  check('Qidiruv natijani toraytirdi', (await page.locator('tbody tr').count()) === 1);

  await page.fill('.search__input', SECRET.slice(0, 8));
  await page.waitForTimeout(500);
  check(
    'Qidiruv parol matni bo‘yicha ishlamaydi',
    (await page.locator('tbody tr').count()) === 0,
  );

  await page.fill('.search__input', '');
  await page.waitForTimeout(400);

  /* ---------------------------------------------------------------- *
   * 11. Theme
   * ---------------------------------------------------------------- */
  section('11. Mavzu');

  const themeBefore = await page.getAttribute('html', 'data-theme');
  await page.locator('.topbar button[aria-label*="rejim"]').click();
  await page.waitForTimeout(400);
  const themeAfter = await page.getAttribute('html', 'data-theme');
  check('Mavzu almashdi', themeBefore !== themeAfter, `${themeBefore} → ${themeAfter}`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  check(
    'Mavzu yangilangandan keyin saqlandi',
    (await page.getAttribute('html', 'data-theme')) === themeAfter,
  );
  await page.fill('#unlock-password', MASTER);
  await page.click('button:has-text("Omborni ochish")');
  await page.waitForSelector('.shell', { timeout: 30_000 });

  /* ---------------------------------------------------------------- *
   * 12. Backup export and restore
   * ---------------------------------------------------------------- */
  section('12. Zaxira nusxa');

  await page.click('.nav-item:has-text("Sozlamalar")');
  await page.waitForSelector('button:has-text("Shifrlangan nusxani yuklab olish")');

  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await page.click('button:has-text("Shifrlangan nusxani yuklab olish")');
  // Export always re-authenticates.
  await page.waitForSelector('#reauth-password', { timeout: 10_000 });
  await page.fill('#reauth-password', MASTER);
  await page.click('button:has-text("Tasdiqlash")');

  const download = await downloadPromise;
  const backupPath = join(downloadDir, download.suggestedFilename());
  await download.saveAs(backupPath);
  const backupRaw = await readFile(backupPath, 'utf8');

  check('Zaxira fayl yuklandi', backupRaw.length > 0);
  check('Faylda ochiq parol yo‘q', !backupRaw.includes(SECRET));
  check('Faylda ochiq nom yo‘q', !backupRaw.includes('Gmail'));
  check('Faylda master parol yo‘q', !backupRaw.includes(MASTER));
  const backupJson = JSON.parse(backupRaw);
  check('Shifrlash metama’lumoti bor', backupJson.kdf?.name === 'PBKDF2');
  check('Tekshiruv summasi bor', typeof backupJson.checksum === 'string');
  check('Yozuvlar shifrlangan', backupJson.credentials.every((r) => r.data?.iv && r.data?.ct));

  // A corrupted file must be rejected before anything is replaced.
  const corrupted = JSON.parse(backupRaw);
  corrupted.credentials[0].data.ct = `AAAA${String(corrupted.credentials[0].data.ct).slice(4)}`;
  const corruptedPath = join(downloadDir, 'corrupted.passgen.json');
  await page.evaluate(() => undefined);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(corruptedPath, JSON.stringify(corrupted), 'utf8');

  await page.setInputFiles('input[type="file"]', corruptedPath);
  await page.waitForSelector('.toast--error', { timeout: 10_000 });
  check('Buzilgan fayl rad etildi', await page.isVisible('.toast--error'));
  await page.waitForTimeout(4500);

  // Restore the valid backup over the current vault.
  await page.setInputFiles('input[type="file"]', backupPath);
  await page.waitForSelector('#restore-password', { timeout: 10_000 });
  await page.fill('#restore-password', 'wrong-master-password');
  await page.fill('#restore-confirm', 'TIKLASH');
  await page.click('button:has-text("Omborni tiklash")');
  await page.waitForTimeout(2500);
  check(
    'Noto‘g‘ri parol bilan tiklash rad etildi',
    (await page.locator('.modal .field__error').count()) > 0,
  );

  await page.fill('#restore-password', MASTER);
  await page.click('button:has-text("Omborni tiklash")');
  await page.waitForTimeout(3000);
  await page.click('.nav-item:has-text("Barcha parollar")');
  await page.waitForTimeout(800);
  const restoredRows = await page.locator('tbody tr').count();
  check(
    'Tiklangandan keyin fayldagi barcha yozuvlar qaytdi',
    restoredRows === backupJson.credentials.length,
    `fayl: ${backupJson.credentials.length}, ro‘yxat: ${restoredRows}`,
  );
  check(
    'Tiklangan yozuv ochiladi (kalit to‘g‘ri)',
    (await page.locator('tbody').innerText()).includes('Gmail'),
  );

  /* ---------------------------------------------------------------- *
   * 13. Manual lock
   * ---------------------------------------------------------------- */
  section('13. Qulflash');

  await page.locator('.sidebar button:has-text("Omborni qulflash")').click();
  await page.waitForSelector('#unlock-password', { timeout: 10_000 });
  check('Qo‘lda qulflash ishladi', await page.isVisible('#unlock-password'));
  const afterLock = await page.evaluate(() => document.body.innerText);
  check('Qulflangandan keyin sahifada parol qolmadi', !afterLock.includes(SECRET));

  await page.fill('#unlock-password', MASTER);
  await page.click('button:has-text("Omborni ochish")');
  await page.waitForSelector('.shell', { timeout: 30_000 });

  /* ---------------------------------------------------------------- *
   * 14. Responsive layout
   * ---------------------------------------------------------------- */
  section('14. Mobil ko‘rinish');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('Gorizontal overflow yo‘q', overflow <= 1, `overflow: ${overflow}px`);
  check(
    'Menyu tugmasi ko‘rinadi',
    await page.isVisible('button[aria-label="Menyuni ochish"]'),
  );

  await page.click('button[aria-label="Menyuni ochish"]');
  await page.waitForTimeout(500);
  check('Drawer ochildi', await page.isVisible('.sidebar.is-open'));
  // Tap outside the drawer (to the right of it) to dismiss.
  await page.mouse.click(350, 400);
  await page.waitForTimeout(500);
  check('Drawer yopildi', !(await page.isVisible('.sidebar.is-open')));

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(400);
  const tabletOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('Planshetda overflow yo‘q', tabletOverflow <= 1, `overflow: ${tabletOverflow}px`);
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ---------------------------------------------------------------- *
   * 15. Console cleanliness
   * ---------------------------------------------------------------- */
  section('15. Konsol');

  const realErrors = consoleErrors.filter(
    (text) => !text.includes('favicon') && !text.includes('Download the React DevTools'),
  );
  check('Konsolda xato yo‘q', realErrors.length === 0, realErrors.join(' | '));

  await browser.close();
  await rm(downloadDir, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nE2E run failed:', error);
  try {
    await rm(downloadDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
