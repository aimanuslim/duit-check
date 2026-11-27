# Duit Check 💸

PWA offline utk baca statement PDF bank, tengok duit lari mana (semua akaun + kad kredit), dan kira zakat pendapatan. Semua proses dalam browser — PDF & data x keluar dari phone.

## Apa dia buat

- **Import PDF statement**, parse dalam browser guna pdf.js yg dah dibundle (x guna network). Format yg disokong buat masa ni:
  - Maybank akaun simpanan/semasa (cth Personal Saver-i)
  - Maybank kad kredit (statement gabung: AMEX Ikhwan + Visa Ikhwan)
  - AmBank kad kredit (kad principal + supplementary, Al-Taslif)
- Setiap statement di-**reconcile**: baki awal ± transaksi mesti = baki akhir (✅/❌).
- Statement yg sama x boleh masuk 2 kali, walaupun kau download semula.
- **Bayar kad dari Savers** dipadankan auto sebagai *Pindahan sendiri*, so x double count.
  - Syarat padan: amaun sama, ±4 hari, satu belah mesti kad kredit.
- **Kategori sendiri**, setiap satu ada *bucket*: Keperluan / Kehendak / Simpanan / Pendapatan / Pindahan.
- **Rule keyword**: description ada keyword tu → masuk kategori tu. Keyword paling panjang menang. Yg kau set sendiri x kena overwrite.
  - Bila kau set kategori satu transaksi, app tawar terus buat rule utk merchant tu.
  - **Cari keyword**: senarai merchant dari data kau, susun ikut jumlah RM. Tap → pilih kategori → siap.
- **Zakat pendapatan**, default **dengan tolakan**: 2.5% × (pendapatan − keperluan), per tahun atau per bulan.
  - Nisab kau masukkan sendiri ikut tahun.
  - Kehendak/leisure x ditolak.
  - Ni anggaran je; confirm dgn pusat zakat negeri.

## Tambah bank / akaun pelaburan baru

Buat parser baru dalam `src/parse/` yg implement `Parser` (`detect(lines)` + `parse(lines)`), lepas tu daftar dalam `PARSERS` kat `src/parse/index.ts`.

- `lines` ialah baris PDF yg dah disusun ikut kedudukan y/x (`src/parse/lines.ts`).
- Test fixture mesti data palsu (`tests/fixtures.ts`).

**Jangan commit statement sebenar.** Utk test dgn PDF sebenar dlm komputer sendiri:

```
STATEMENTS_DIR=/path/ke/folder/pdf npm test
```

## Dev

```
npm install
npm run dev      # local
npm test         # unit tests (+ real PDFs kalau STATEMENTS_DIR set)
npm run build
npm run preview
npm run icons    # regenerate PNG icons dari public/icon.svg
```

## Deploy

Setiap merge ke `main` auto deploy ke `https://duit-check.pages.dev` melalui `.github/workflows/deploy.yml`. Kalau nak run semula: tab **Actions** → Deploy Duit Check → Run workflow. Run pertama akan create projek Cloudflare Pages tu.

Kena set dulu repo secrets `CLOUDFLARE_API_TOKEN` (Account › Cloudflare Pages › Edit) dan `CLOUDFLARE_ACCOUNT_ID` kat GitHub → Settings → Secrets and variables → Actions.

## Install kat iPhone

1. Buka URL tu kat Safari.
2. Tekan Share → **Add to Home Screen**.
3. Buka sekali masa online. Lepas tu dia jalan offline sepenuhnya.

## Backup / restore

Data duduk dalam IndexedDB phone tu je. Kalau padam app atau clear Safari data, semua hilang.

- **Lagi → Backup & settings → Export backup** simpan `duit-check-backup.json`. Kalau save kat Files dgn nama yg sama, dia replace backup lama.
  - Isi passphrase kalau nak backup tu di-encrypt (AES-GCM). Lupa passphrase = backup x boleh buka.
- **Import backup** → pilih file → **Replace semua** atau **Merge** (rekod yg lagi baru menang).
