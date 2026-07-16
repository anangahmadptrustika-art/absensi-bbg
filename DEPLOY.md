# Panduan Deploy ke VPS (Ubuntu 22.04/24.04)

Panduan ini cocok untuk VPS mana pun (Hostinger, DigitalOcean, dll).
Perkiraan waktu: 15–20 menit.

## Yang perlu disiapkan

1. **VPS** Ubuntu 22.04/24.04 (RAM 1 GB sudah cukup).
2. **Domain atau subdomain** yang diarahkan ke IP VPS (A record), contoh:
   `absensi.namaperusahaan.com` → `IP_VPS`.
   HTTPS **wajib** — browser HP hanya mengizinkan kamera & GPS di halaman HTTPS.
   (Kelola DNS di panel domain Anda; di Hostinger: hPanel → Domains → DNS Zone.)

## 1. Masuk ke VPS

```bash
ssh root@IP_VPS
```

## 2. Pasang Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
node -v   # v22.x
```

## 3. Ambil kode & build

```bash
cd /opt
git clone https://github.com/anangahmadptrustika-art/absensi-bbg.git
cd absensi-bbg
npm install
npm run build
```

## 4. Jalankan sebagai service (pm2)

```bash
npm install -g pm2

# Ganti PASSWORD_RAHASIA dengan password admin pilihan Anda.
# (Kalau ADMIN_INITIAL_PASSWORD tidak diset, password acak dibuat
#  dan dicetak sekali di log: lihat dengan `pm2 logs absensi`.)
ADMIN_INITIAL_PASSWORD='PASSWORD_RAHASIA' pm2 start npm --name absensi -- start

pm2 save
pm2 startup   # jalankan perintah yang ditampilkan, agar otomatis hidup saat VPS restart
```

Cek: `curl -I http://localhost:3000` harus menjawab `200`.

## 5. HTTPS otomatis dengan Caddy

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
```

Edit `/etc/caddy/Caddyfile`, isi dengan (ganti domainnya):

```
absensi.namaperusahaan.com {
    reverse_proxy localhost:3000
}
```

Lalu:

```bash
systemctl reload caddy
```

Caddy mengurus sertifikat SSL (Let's Encrypt) secara otomatis — tidak perlu apa-apa lagi.

## 6. Firewall (jika aktif)

```bash
ufw allow 22
ufw allow 80
ufw allow 443
```

Port 3000 **tidak perlu** dibuka keluar — cukup lewat Caddy.

## 7. Selesai — cek hasilnya

- Karyawan: `https://absensi.namaperusahaan.com` (buka di HP → izinkan lokasi & kamera → menu browser → *Tambahkan ke layar utama*)
- Admin: `https://absensi.namaperusahaan.com/admin`

Langkah pertama di dashboard:
1. Masuk sebagai `admin` + password Anda.
2. Menu **Lokasi** → hapus "Lokasi Contoh", buat lokasi kerja asli (klik peta, atur radius).
3. Menu **Karyawan** → hapus "Budi (Karyawan Contoh)", daftarkan karyawan asli (NIK + PIN).
4. Menu **Pengaturan** → sesuaikan jam masuk, toleransi, zona waktu.

## Pemeliharaan

```bash
# Lihat log aplikasi (termasuk password admin awal jika tidak diset via env)
pm2 logs absensi

# Update ke versi terbaru
cd /opt/absensi-bbg && git pull && npm install && npm run build && pm2 restart absensi

# Backup data (database + semua foto selfie) — cukup salin satu folder ini
tar czf backup-absensi-$(date +%F).tar.gz /opt/absensi-bbg/data
```

## Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| Kamera/GPS tidak muncul di HP | Halaman dibuka lewat `http://` atau IP langsung. Wajib pakai domain + HTTPS (langkah 5). |
| "Sinyal GPS belum ditemukan" terus | Izin lokasi HP belum diizinkan untuk browser, atau karyawan di dalam gedung — minta pindah ke area terbuka. |
| Lupa password admin | `pm2 stop absensi`, jalankan `sqlite3 /opt/absensi-bbg/data/absensi.db "DELETE FROM admins;"`, lalu start ulang dengan `ADMIN_INITIAL_PASSWORD` baru (akun admin dibuat ulang otomatis). |
| Domain belum bisa diakses | Tunggu propagasi DNS (bisa sampai 1 jam) — cek dengan `ping absensi.namaperusahaan.com` harus menjawab IP VPS Anda. |
