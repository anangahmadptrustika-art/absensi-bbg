# Konteks Proyek — Absensi BBG

Aplikasi absensi karyawan lapangan (GPS + selfie + geofence + live tracking).
Pemilik proyek **bukan orang teknis** — jelaskan dalam bahasa Indonesia yang
sederhana, beri perintah terminal satu per satu, dan pandu pelan-pelan.

## Arsitektur

- **Web app**: Next.js 14 + better-sqlite3 + Leaflet. Data (SQLite + foto
  selfie) di folder `data/` — JANGAN pernah dihapus/di-commit.
- **Aplikasi karyawan** `/` (mobile, ramah lansia), **dashboard admin** `/admin`.
- **APK Android** di `android/` (Kotlin): WebView + TrackingService
  (foreground service GPS latar belakang). Dibangun otomatis oleh GitHub
  Actions (`.github/workflows/build-apk.yml`) → terbit di GitHub Releases.
- Jembatan web→APK: `window.AbsensiNative.startTracking()/stopTracking()`
  dipanggil dari `src/app/page.tsx`.

## Infrastruktur produksi milik pemilik

- **Server**: mini server di lokasi pemilik, Proxmox + CasaOS/ZimaOS,
  user SSH `rustika2026`, aplikasi jalan via Docker Compose di
  `~/absensi-bbg` (container `absensi-bbg` port host 8020, dan
  `absensi-tunnel` = cloudflared).
- **Domain**: `aplikasicanb.web.id` (registrar Domainesia, DNS di Cloudflare).
- **Akses publik**: Cloudflare Tunnel bernama `absensi` (Zero Trust) —
  tanpa IP publik, tanpa buka port. URL produksi:
  `https://absensi.aplikasicanb.web.id`.
- **Menambah aplikasi/subdomain baru**: jalankan container baru di server,
  lalu di tunnel yang sama tambah Public Hostname
  (`subdomain.aplikasicanb.web.id` → `http://IP-server:PORT`). Domain &
  tunnel yang ada dipakai bersama — tidak perlu DNS/domain baru.
- **Update produksi**: `cd ~/absensi-bbg && git pull && docker compose up -d --build`
  (data aman — terpisah di `data/`).

## Pengembangan & verifikasi

- Branch kerja: `claude/field-worker-attendance-gps-07pog6` (branch default).
- Build web: `npm install && npx next build`.
- Uji end-to-end (sudah tersedia polanya di riwayat proyek): jalankan server
  dengan `ADMIN_INITIAL_PASSWORD=admin123`, reset `rm -rf data` untuk mulai
  bersih. Kredensial seed: karyawan NIK `1001`/PIN `123456`, admin `admin`.
- HTTPS wajib untuk kamera/GPS di browser HP; cookie sesi memakai flag
  Secure mengikuti `x-forwarded-proto`.
- Kunci APK: `android/app/absensi-release.keystore` (distribusi internal
  via WhatsApp; naikkan `versionCode` tiap rilis). `BASE_URL` APK di
  `android/app/build.gradle`.

## Panduan yang sudah ada

`README.md` (fitur & privasi tracking), `DEPLOY-CASAOS.md` (deploy server
sendiri + tunnel), `DEPLOY.md` (alternatif VPS), `PANDUAN-APK.md` (build &
pemasangan APK di HP karyawan).
