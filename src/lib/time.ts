/**
 * Semua timestamp disimpan sebagai ISO 8601 UTC.
 * Fungsi di bawah mengonversi ke zona waktu yang dikonfigurasi
 * (Asia/Jakarta = WIB, Asia/Makassar = WITA, Asia/Jayapura = WIT)
 * untuk menentukan tanggal absen dan status terlambat.
 */

export const TIMEZONES = [
  { id: 'Asia/Jakarta', label: 'WIB (Jakarta)' },
  { id: 'Asia/Makassar', label: 'WITA (Makassar)' },
  { id: 'Asia/Jayapura', label: 'WIT (Jayapura)' },
];

/** Tanggal 'YYYY-MM-DD' pada zona waktu tertentu. */
export function dateKeyInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Jam 'HH:MM' pada zona waktu tertentu. */
export function timeHMInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Menit sejak tengah malam pada zona waktu tertentu. */
export function minutesOfDayInTz(date: Date, timeZone: string): number {
  const [h, m] = timeHMInTz(date, timeZone).split(':').map(Number);
  return h * 60 + m;
}

/** Parse 'HH:MM' menjadi menit sejak tengah malam. Null jika format salah. */
export function parseHM(hm: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Durasi antara dua ISO timestamp, ditampilkan sebagai "7j 32m". */
export function durationLabel(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const totalMin = Math.floor(ms / 60000);
  return `${Math.floor(totalMin / 60)}j ${totalMin % 60}m`;
}
