# Aplikasi Android (APK) — Panduan

APK membungkus aplikasi web yang sudah jalan dan menambah **pelacakan latar
belakang**: posisi karyawan terus terkirim selama jam kerja **meskipun layar
mati atau aplikasi ditutup** — sesuatu yang tidak mungkin dilakukan aplikasi
web biasa. Demi transparansi & privasi:

- Selama pelacakan aktif, HP karyawan menampilkan **notifikasi permanen**
  "Sedang bekerja — posisi terpantau".
- Pelacakan **berhenti total otomatis** saat karyawan absen pulang (server
  juga menolak data posisi setelahnya), dan notifikasinya hilang.

## Cara mendapatkan APK

Setiap ada perubahan di folder `android/`, GitHub otomatis merakit APK:

1. Buka repo di GitHub → tab **Actions** → workflow **Build APK Android**
   (bisa juga dijalankan manual: tombol *Run workflow*).
2. Setelah hijau (±5 menit), buka halaman **Releases** repo → unduh
   **AbsensiBBG.apk** dari rilis terbaru.
3. Kirim file APK itu lewat **WhatsApp** (sebagai dokumen) ke HP karyawan.

## Pemasangan di HP karyawan (sekali saja per HP)

1. Buka kiriman WA → ketuk file **AbsensiBBG.apk** → Unduh → Buka.
2. Jika muncul "tidak diizinkan memasang aplikasi tak dikenal" → ketuk
   **Setelan** → izinkan *Install unknown apps* untuk WhatsApp/Files → ulangi.
3. Buka aplikasi **Absensi BBG** → login NIK + PIN (sekali saja).
4. Saat diminta izin, pilih:
   - **Lokasi** → *Saat aplikasi digunakan*, lalu ketika diminta lagi pilih
     **"Izinkan sepanjang waktu"** (ini kunci pelacakan layar-mati).
   - **Kamera** → Izinkan (untuk selfie absen).
   - **Notifikasi** → Izinkan.
   - **Abaikan pengoptimalan baterai** → Izinkan/Ya.
5. Khusus HP Xiaomi/Redmi/POCO, Oppo, Vivo, Realme (sekali saja):
   buka *Setelan → Aplikasi → Absensi BBG* →
   aktifkan **Autostart/Mulai otomatis**, dan set baterai ke
   **"Tanpa batasan" / No restrictions**. Tanpa ini, sistem HP bisa mematikan
   pelacakan saat layar lama mati.

## Catatan teknis

- Alamat server tertanam di aplikasi (`android/app/build.gradle` →
  `BASE_URL`). Kalau domain berubah, ganti di situ lalu build ulang.
- APK ditandatangani keystore di `android/app/absensi-release.keystore`
  (untuk distribusi internal). Selama keystore-nya sama, update aplikasi bisa
  ditimpa langsung tanpa uninstall. **Jika repo ini publik, sebaiknya ubah
  jadi private** (Settings → Change visibility) karena keystore ikut publik.
- Versi aplikasi diatur di `android/app/build.gradle`
  (`versionCode`/`versionName`) — naikkan `versionCode` setiap rilis baru.
- Web app mendeteksi dirinya berjalan di dalam APK lewat jembatan
  `window.AbsensiNative` dan menyerahkan tugas ping posisi ke layanan native.
  Di browser biasa, perilaku lama (ping selama halaman terbuka) tetap berlaku.
