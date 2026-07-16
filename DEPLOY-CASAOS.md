# Deploy di Server Sendiri (CasaOS / Proxmox) + Cloudflare Tunnel

Panduan untuk menjalankan aplikasi di **mini server sendiri** (CasaOS di atas
Proxmox) dan membuatnya bisa diakses dari internet **tanpa IP publik, tanpa
buka port router, gratis, dan otomatis HTTPS** — memakai Cloudflare Tunnel
dengan domain yang sudah Anda miliki.

> HTTPS wajib: browser HP hanya mengizinkan kamera & GPS di halaman HTTPS.
> Cloudflare Tunnel mengurus itu otomatis.

## Gambaran alur

```
HP karyawan ──HTTPS──> Cloudflare ──tunnel──> mini server Anda (Docker: absensi + cloudflared)
```

Perkiraan waktu: 30–45 menit (paling lama menunggu pergantian nameserver).

---

## Bagian A — Pindahkan DNS domain ke Cloudflare (gratis)

1. Daftar akun gratis di https://dash.cloudflare.com.
2. **Add a domain** → masukkan domain Anda → pilih paket **Free**.
3. Cloudflare menampilkan **2 nameserver** (contoh: `lena.ns.cloudflare.com`
   dan `theo.ns.cloudflare.com`). Catat keduanya.
4. Buka **hPanel Hostinger → Domains → domain Anda → Nameservers →
   Change nameservers** → isi 2 nameserver dari Cloudflare → simpan.
5. Tunggu sampai Cloudflare mengirim email "site is active" (biasanya
   15 menit – beberapa jam). Sambil menunggu, lanjut Bagian B.

*(Domain tetap milik Anda di Hostinger — hanya "buku telepon"-nya yang
pindah ke Cloudflare. Hosting `public_html` tidak dipakai dan tidak
terganggu apa-apa.)*

## Bagian B — Buat Tunnel

1. Di dashboard Cloudflare, buka **Zero Trust** (menu kiri) →
   **Networks → Tunnels → Create a tunnel**.
2. Pilih **Cloudflared** → beri nama, mis. `absensi` → **Save tunnel**.
3. Di layar berikutnya akan tampil **token** — string sangat panjang diawali
   `eyJ...` (di dalam contoh perintah `cloudflared service install eyJ...`).
   **Salin token itu saja.** Jangan bagikan ke siapa pun.
4. Klik **Next**, lalu isi **Public Hostname**:
   - Subdomain: `absensi` — Domain: pilih domain Anda
   - Service: Type **HTTP**, URL: `absensi:3000`
5. **Save**.

## Bagian C — Jalankan di server

Masuk ke terminal server CasaOS (SSH, atau console di Proxmox), lalu:

```bash
# masuk ke folder data CasaOS (atau folder lain sesuka Anda)
cd /DATA

# ambil kode
git clone https://github.com/anangahmadptrustika-art/absensi-bbg.git
cd absensi-bbg

# buat file .env berisi token tunnel + password admin pilihan Anda
cat > .env << 'EOF'
TUNNEL_TOKEN=tempel-token-eyJ...-di-sini
ADMIN_INITIAL_PASSWORD=PasswordAdminPilihanAnda
EOF

# build + jalankan (pertama kali ±5 menit)
docker compose up -d --build
```

Cek statusnya:

```bash
docker compose ps          # dua container: absensi-bbg & absensi-tunnel, status Up
docker compose logs -f     # Ctrl+C untuk keluar
```

Di dashboard Cloudflare Zero Trust → Tunnels, status tunnel akan berubah
menjadi **HEALTHY**.

## Bagian D — Selesai, cek hasilnya

- Aplikasi karyawan: `https://absensi.domainanda.com` (buka di HP →
  izinkan lokasi & kamera → menu browser → **Tambahkan ke layar utama**)
- Dashboard admin: `https://absensi.domainanda.com/admin`
  (username `admin`, password sesuai `.env`)

Langkah pertama di dashboard: hapus lokasi & karyawan contoh, buat lokasi
kerja asli (klik di peta + atur radius), daftarkan karyawan (NIK + PIN),
sesuaikan jam masuk di Pengaturan.

---

## Pemeliharaan

```bash
# lihat log (termasuk password admin acak, jika .env tidak diisi)
docker compose logs absensi

# update aplikasi ke versi terbaru
cd /DATA/absensi-bbg && git pull && docker compose up -d --build

# backup SEMUA data (database + foto selfie) = salin satu folder ini
tar czf backup-absensi-$(date +%F).tar.gz data/
```

## Hal yang perlu diketahui

- **Server & internet lokasi harus menyala** setidaknya sebelum jam absen
  masuk sampai setelah jam absen pulang. Kalau listrik/internet di lokasi
  server mati, karyawan tidak bisa absen sampai hidup kembali.
- Aplikasi hanya jalan di jaringan lokal juga bisa (`http://IP-server:3000`)
  untuk dicoba-coba, tapi kamera/GPS di HP hanya aktif lewat alamat HTTPS
  (lewat tunnel).
- Kalau suatu saat pindah ke VPS: cukup bawa folder `data/` — semua riwayat
  absen dan foto ikut pindah.
- Alternatif tanpa CasaOS: buat VM/LXC Ubuntu di Proxmox lalu ikuti
  `DEPLOY.md` (jalur pm2 + Caddy). Hasilnya sama; jalur Docker di atas
  lebih sederhana.

## Masalah umum

| Gejala | Solusi |
|---|---|
| Tunnel status DOWN | Cek `docker compose logs cloudflared` — biasanya token salah tempel. Ulangi Bagian B langkah 3. |
| `https://absensi...` error 502 | Container absensi belum jalan: `docker compose ps`, lalu `docker compose logs absensi`. |
| Nameserver tidak kunjung aktif | Cek ulang ejaan 2 nameserver di hPanel; propagasi bisa sampai 24 jam (jarang). |
| Kamera/GPS tidak muncul | Pastikan dibuka lewat `https://absensi.domainanda.com`, bukan IP lokal. |
