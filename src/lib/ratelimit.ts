import { getDb } from './db';

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
// Kegagalan lama tidak dihitung lagi setelah jendela ini.
const WINDOW_MINUTES = 30;

/**
 * Pembatas percobaan login per-akun (NIK/username), disimpan di SQLite.
 * Setelah MAX_FAILURES kegagalan beruntun, akun dikunci LOCK_MINUTES menit.
 * PIN karyawan hanya 4-8 digit, jadi tanpa ini PIN bisa ditebak paksa.
 */
export function lockedForSeconds(key: string): number {
  const row = getDb()
    .prepare('SELECT locked_until FROM login_attempts WHERE key = ?')
    .get(key) as { locked_until: string | null } | undefined;
  if (!row?.locked_until) return 0;
  const remaining = new Date(row.locked_until).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function recordFailure(key: string) {
  const db = getDb();
  const now = new Date();
  const row = db
    .prepare('SELECT fail_count, last_fail_at FROM login_attempts WHERE key = ?')
    .get(key) as { fail_count: number; last_fail_at: string } | undefined;

  const withinWindow =
    row && now.getTime() - new Date(row.last_fail_at).getTime() < WINDOW_MINUTES * 60_000;
  const count = withinWindow ? row.fail_count + 1 : 1;
  const lockedUntil =
    count >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null;

  db.prepare(
    `INSERT INTO login_attempts (key, fail_count, last_fail_at, locked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       fail_count = excluded.fail_count,
       last_fail_at = excluded.last_fail_at,
       locked_until = excluded.locked_until`
  ).run(key, count, now.toISOString(), lockedUntil);
}

export function clearFailures(key: string) {
  getDb().prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
}

export function lockMessage(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return `Terlalu banyak percobaan yang salah. Demi keamanan, coba lagi dalam ${m} menit.`;
}
