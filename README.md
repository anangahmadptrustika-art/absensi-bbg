# Absensi BBG

Aplikasi absensi karyawan lapangan yang **sederhana dan ramah untuk pekerja usia lanjut**:
tombol besar, teks besar, bahasa Indonesia, dan alur satu-tombol.

## Fitur

### Aplikasi Karyawan (buka `/` di HP)
- **Login sekali saja** dengan Nomor Induk + PIN (sesi bertahan 60 hari).
- **Absen masuk & pulang dengan GPS + foto selfie.** Keduanya wajib — tanpa foto atau tanpa lokasi, absen ditolak.
- **Geofencing**: absen hanya bisa dilakukan di dalam radius lokasi yang diatur admin. Jika di luar area, aplikasi menunjukkan jarak ke lokasi terdekat.
- **Pelacakan posisi realtime hanya selama jam kerja**: dimulai saat absen masuk, dan **berhenti total saat absen pulang** — aplikasi berhenti mengirim, dan server juga menolak data posisi baru (privasi karyawan terjaga).
- Indikator jelas di layar: "Posisi Anda sedang terpantau" saat bekerja, dan "Pelacakan lokasi sudah mati" setelah pulang.
- Bisa dipasang di layar utama HP (PWA) — cukup buka lewat browser, tidak perlu Play Store.

### Dashboard Admin (buka `/admin`)
- **🗺️ Peta Live** — posisi terkini karyawan yang sedang bekerja, diperbarui otomatis tiap 5 detik. Karyawan yang sudah absen pulang otomatis hilang dari peta.
- **📋 Absensi** — rekap per tanggal/karyawan, foto selfie masuk & pulang, status tepat waktu/terlambat, durasi kerja, rute perjalanan selama jam kerja, dan ekspor CSV (terbuka rapi di Excel).
- **👷 Karyawan** — tambah/ubah/nonaktifkan karyawan, atur PIN, tugaskan ke lokasi tertentu (atau bebas absen di semua lokasi aktif).
- **📍 Lokasi** — tentukan titik lokasi absen dengan **klik pada peta**, atur radius (meter), aktif/nonaktif.
- **⚙️ Pengaturan** — jam masuk, toleransi terlambat, zona waktu (WIB/WITA/WIT), wajib/tidaknya absen pulang di dalam area, interval pelacakan, dan ganti password admin.

## Menjalankan

```bash
npm install
npm run dev        # pengembangan → http://localhost:3000
# atau produksi:
npm run build
npm start
```

Halaman karyawan: `http://localhost:3000` · Dashboard admin: `http://localhost:3000/admin`

**Akun awal (segera ganti):**
- Admin: `admin` / `admin123` (ganti lewat menu Pengaturan; atau set env `ADMIN_INITIAL_PASSWORD` sebelum pertama kali jalan)
- Karyawan contoh: NIK `1001` / PIN `123456`

Database SQLite dan foto selfie tersimpan di folder `./data` (otomatis dibuat; bisa dipindah lewat env `DATA_DIR`). Backup cukup dengan menyalin folder ini.

## PENTING: wajib HTTPS saat dipakai di lapangan

Browser HP hanya mengizinkan **kamera dan GPS** pada halaman **HTTPS** (atau `localhost` saat pengembangan).
Saat di-deploy, pasang aplikasi di belakang HTTPS — misalnya:
- VPS + Nginx/Caddy dengan sertifikat Let's Encrypt (Caddy paling mudah: HTTPS otomatis), atau
- layanan tunnel seperti Cloudflare Tunnel.

Contoh Caddyfile:

```
absensi.perusahaan-anda.com {
    reverse_proxy localhost:3000
}
```

> Catatan hosting: aplikasi menyimpan data di disk (SQLite + foto), jadi butuh server dengan penyimpanan permanen (VPS, on-premise). Platform serverless seperti Vercel tidak cocok tanpa mengganti lapisan penyimpanan.

## Cara kerja privasi pelacakan

1. Karyawan absen masuk (GPS + selfie, divalidasi server di dalam geofence) → pelacakan aktif.
2. Selama bekerja, HP mengirim posisi tiap N detik (interval diatur admin) → tampil di Peta Live.
3. Karyawan absen pulang → aplikasi berhenti mengirim posisi **dan** server menolak posisi baru untuk hari itu; karyawan hilang dari Peta Live.
4. Riwayat rute selama jam kerja tetap tersimpan untuk rekap; tidak ada data posisi di luar jam kerja.

Keterbatasan yang wajar diketahui: pengiriman posisi berjalan selama halaman aplikasi terbuka di HP.
Jika HP dikunci lama atau browser ditutup, posisi berhenti terkirim sampai aplikasi dibuka lagi
(penanda karyawan di Peta Live berubah abu-abu jika > 2 menit tanpa kabar).

## Teknologi

- [Next.js 14](https://nextjs.org) + React 18 + TypeScript + Tailwind CSS
- SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) — tanpa server database terpisah
- [Leaflet](https://leafletjs.com) + OpenStreetMap — peta gratis tanpa API key
- Sesi httpOnly cookie; PIN & password di-hash dengan scrypt
