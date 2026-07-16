import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { hashSecret, randomPassword } from './hash';

/**
 * Semua data disimpan di direktori DATA_DIR (default: ./data).
 * - absensi.db  : database SQLite
 * - uploads/    : foto selfie absen
 */
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

let db: Database.Database | null = null;

export const DEFAULT_SETTINGS: Record<string, string> = {
  // Jam masuk kerja (HH:MM). Absen masuk setelah jam ini + toleransi dianggap TERLAMBAT.
  work_start: '07:00',
  // Toleransi keterlambatan dalam menit.
  late_tolerance_min: '15',
  // 1 = absen pulang juga wajib di dalam area lokasi; 0 = boleh dari mana saja.
  require_checkout_in_area: '1',
  // Interval kirim posisi (detik) selama karyawan berstatus bekerja.
  tracking_interval_s: '20',
  // Zona waktu untuk penentuan tanggal absen & status terlambat.
  timezone: 'Asia/Jakarta',
};

function createSchema(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_m INTEGER NOT NULL DEFAULT 100,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nik TEXT UNIQUE NOT NULL,
      pin_hash TEXT NOT NULL,
      location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in_at TEXT NOT NULL,
      check_in_lat REAL,
      check_in_lng REAL,
      check_in_acc REAL,
      check_in_photo TEXT,
      check_in_location_id INTEGER,
      check_in_status TEXT NOT NULL DEFAULT 'TEPAT',
      check_out_at TEXT,
      check_out_lat REAL,
      check_out_lng REAL,
      check_out_acc REAL,
      check_out_photo TEXT,
      check_out_location_id INTEGER,
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS track_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      acc REAL,
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_track_attendance ON track_points(attendance_id, recorded_at);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('admin','employee')),
      ref_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      last_fail_at TEXT NOT NULL,
      locked_until TEXT
    );
  `);
}

function seed(d: Database.Database) {
  const hasAdmin = d.prepare('SELECT COUNT(*) AS n FROM admins').get() as { n: number };
  if (hasAdmin.n === 0) {
    // Tidak ada password bawaan yang bisa ditebak publik: jika env tidak diset,
    // buat password acak dan tampilkan SEKALI di log server saat pertama jalan.
    let pw = process.env.ADMIN_INITIAL_PASSWORD;
    if (!pw) {
      pw = randomPassword();
      console.log('');
      console.log('='.repeat(64));
      console.log('  AKUN ADMIN DIBUAT — username: admin');
      console.log(`  Password awal: ${pw}`);
      console.log('  Catat sekarang, lalu ganti lewat menu Pengaturan.');
      console.log('  (Atau set env ADMIN_INITIAL_PASSWORD sebelum pertama jalan.)');
      console.log('='.repeat(64));
      console.log('');
    }
    d.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(
      'admin',
      hashSecret(pw)
    );
  }

  const setStmt = d.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setStmt.run(k, v);

  const hasLocation = d.prepare('SELECT COUNT(*) AS n FROM locations').get() as { n: number };
  if (hasLocation.n === 0) {
    d.prepare(
      'INSERT INTO locations (name, lat, lng, radius_m, active) VALUES (?, ?, ?, ?, 1)'
    ).run('Lokasi Contoh — ubah di menu Lokasi', -6.1753924, 106.8271528, 250);
  }

  const hasEmployee = d.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number };
  if (hasEmployee.n === 0) {
    d.prepare(
      'INSERT INTO employees (name, nik, pin_hash, location_id, active) VALUES (?, ?, ?, NULL, 1)'
    ).run('Budi (Karyawan Contoh)', '1001', hashSecret('123456'));
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, 'absensi.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);
  seed(db);
  return db;
}

export function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value);
}
