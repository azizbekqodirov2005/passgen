# PassGen

Lokal, nol-bilim (*zero-knowledge*) parol menejeri. Parollar brauzerning o‘zida
AES-256-GCM bilan shifrlanadi va IndexedDB’da faqat shifrlangan holida
saqlanadi. Server yo‘q, ro‘yxatdan o‘tish yo‘q, hech qanday ma’lumot tashqariga
yuborilmaydi.

**Stack:** React 18 · TypeScript (strict) · Vite 5 · Web Crypto API · IndexedDB ·
toza CSS (tashqi UI kutubxonasiz)

---

## Ishga tushirish

```bash
npm install
npm run dev          # http://localhost:5173
```

Boshqa buyruqlar:

```bash
npm run typecheck    # tsc --noEmit (strict)
npm run test         # birlik testlari (Vitest) — 89 ta test
npm run build        # typecheck + production build → dist/
npm run preview      # dist/ ni lokal serverda ochish
npm run build:single # bitta portativ HTML fayl → dist-single/passgen.html
```

> **Muhim:** Web Crypto API faqat xavfsiz kontekstda ishlaydi — ya’ni `https://`
> yoki `localhost`. Faylni to‘g‘ridan-to‘g‘ri `file://` orqali ochsangiz,
> shifrlash va IndexedDB ishlamaydi.

## Deploy

Build natijasi — statik fayllar, `base: './'` bilan, shuning uchun istalgan
statik hostingga mos keladi:

- **Netlify:** build buyrug‘i `npm run build`, publish katalogi `dist`
- **GitHub Pages:** `dist/` ni `gh-pages` branchiga yuklang
- **Oddiy hosting:** `dist/` ichidagi fayllarni papkaga ko‘chiring

---

## Xavfsizlik arxitekturasi

| Qism | Tanlov |
| --- | --- |
| Shifrlash | AES-256-GCM (autentifikatsiyalangan shifrlash) |
| IV | Har bir shifrlash uchun yangi, 12 bayt, `crypto.getRandomValues()` |
| Tuz (salt) | 16 bayt, kriptografik tasodifiy, ombor yaratilganda bir marta |
| Kalit hosil qilish | PBKDF2-SHA-256, qurilmaga moslab kalibrlanadi (min 310 000, maks 1 200 000 iteratsiya) |
| Kalit | `extractable: false` — brauzer kripto-dvigatelidan tashqariga chiqmaydi |
| Format | Versiyalangan (`v1`), kelajakda yangilash uchun ochiq |

Kafolatlar:

- Master parol **hech qayerda saqlanmaydi** — na diskda, na xotirada (faqat
  kiritilgan lahzada ishlatiladi).
- Kalit faqat ombor ochiq turganda xotirada bo‘ladi; qulflash uni o‘chiradi.
- `localStorage`da faqat mavzu (dark/light) tanlovi turadi.
- IndexedDB’da yozuvlarning **barcha** maydonlari (nom, login, parol, izoh,
  kategoriya) shifrlangan; ochiq holda faqat `id` va sana turadi.
- Tahlil, taqqoslash va takrorlanishni aniqlash — hammasi lokal. Hech bir
  parol yoki uning xeshi tashqi API’ga yuborilmaydi.
- PassGen parol "sizib ketgan" deb da’vo qilmaydi: buni tekshiradigan
  mexanizm yo‘q, shuning uchun bunday xulosa ham chiqarilmaydi.

### Master parolni yo‘qotsangiz

Tiklashning **hech qanday yo‘li yo‘q**. Kalit faqat shu paroldan hosil bo‘ladi,
ombor esa shu kalitsiz oddiy tasodifiy baytlar to‘plami. Soxta "parolni tiklash"
funksiyasi ataylab qo‘shilmagan.

---

## Arxitektura

```
src/
  services/          xavfsizlikka aloqador barcha mantiq (UI'dan ajratilgan)
    cryptoService.ts        AES-GCM, PBKDF2, IV/salt, verifier
    databaseService.ts      IndexedDB: sxema, migratsiya, tranzaksiyalar
    vaultService.ts         kalit egasi; CRUD, master parolni almashtirish
    authenticationService.ts qulflash, avto-qulflash, qayta tasdiqlash oynasi
    passwordGenerator.ts    xavfsiz generator (rejection sampling)
    securityAudit.ts        lokal tahlil: kuchsiz, takrorlangan, eskirgan
    backupService.ts        shifrlangan eksport/import + checksum
    clipboardService.ts     nusxalash va clipboardni tozalash
  state/             React konteksti (mavzu, bildirishnoma, ombor holati)
  hooks/             useRoute, useAudit, useCopy, useReauth, useFilteredCredentials
  components/        UI primitivlari, layout, auth ekranlari, ombor jadvali
  pages/             7 ta sahifa (dashboard, parollar, sevimlilar, generator,
                     tahlil, kategoriyalar, sozlamalar)
  lib/               turlar, kuch bahosi, kategoriyalar, formatlash
```

UI qatlami hech qachon kalitni ko‘rmaydi: u faqat `vaultService` qaytargan
ochilgan qiymatlar bilan ishlaydi, kalitning o‘zi modul ichida qoladi.

---

## Testlar

### Birlik testlari — `npm run test`

89 ta test, Vitest + `fake-indexeddb` + Node’ning Web Crypto’si:

- **cryptoService (19):** shifrlash/ochish, IV takrorlanmasligi (200 ta yozuvda),
  buzilgan shifrmatnni GCM tegi orqali aniqlash, noto‘g‘ri parolni rad etish,
  kalit `extractable: false` ekani, iteratsiya chegarasi, master parol siyosati.
- **passwordGenerator (19):** uzunlik oralig‘i, tanlangan turlar, chalkash
  belgilarni chiqarib tashlash, 500 ta parolning takrorlanmasligi, modulo
  siljishi yo‘qligi (20 000 ta tanlovda taqsimot tekshiruvi).
- **vaultService (19):** ombor hayot sikli, qulflangan holatda har qanday
  o‘qish/yozishning bloklanishi, **ochiq matn saqlanmasligi**, har yozuvda yangi
  IV, master parolni almashtirishda to‘liq qayta shifrlash.
- **backupService (15):** nusxada ochiq parol yo‘qligi, checksum orqali
  buzilgan/qisqartirilgan faylni aniqlash, noto‘g‘ri parol bilan tiklashning
  rad etilishi (va ombor buzilmasligi).
- **securityAudit (8) va strength (9):** takrorlanishni guruhlash, baho
  oralig‘i, hisobotda parol ko‘rinmasligi.

### Brauzer testlari — `e2e/passgen.e2e.mjs`

Haqiqiy Chromium’da production build ustida 53 ta tekshiruv: ombor yaratish,
qayta tasdiqlash bilan parolni ko‘rsatish, clipboard, generator, tahlil,
sahifani yangilagandan keyin saqlanish, tahrirlash/o‘chirish/sevimlilar,
qidiruv, mavzu almashtirish va saqlanishi, shifrlangan eksport va tiklash,
buzilgan faylni rad etish, qo‘lda qulflash, mobil/planshet maketi (gorizontal
overflow yo‘qligi) va konsolda xato yo‘qligi. Avtomatik qulflash alohida
tekshirilgan (1 daqiqalik sozlama bilan).

Ishga tushirish:

```bash
npm install -D playwright && npx playwright install chromium
npm run build
npx vite preview --port 4173 &
node e2e/passgen.e2e.mjs http://localhost:4173
```

---

## Klaviatura

| Tugma | Amal |
| --- | --- |
| `/` yoki `Ctrl/⌘ + K` | Qidiruvga o‘tish |
| `n` | Yangi yozuv |
| `g` | Generator |
| `l` | Omborni qulflash |
| `Esc` | Oynani yopish |

---

## Ishlab chiquvchi

**Azizbek Qodirov** — [azbek.uz](https://azbek.uz) ·
[Telegram](https://t.me/QodirovAzizbek)
