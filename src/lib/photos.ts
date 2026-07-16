import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR, getDb } from './db';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Simpan foto selfie dari data URL (JPEG) ke disk.
 * Mengembalikan nama file, atau null jika data tidak valid.
 */
export function savePhotoDataUrl(dataUrl: unknown): string | null {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return null;
  const name = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return name;
}

const SAFE_NAME = /^[a-f0-9]{32}\.jpg$/;

export function photoPath(name: string): string | null {
  if (!SAFE_NAME.test(name)) return null;
  const p = path.join(UPLOADS_DIR, name);
  return fs.existsSync(p) ? p : null;
}

/** Apakah foto ini milik karyawan tersebut (foto masuk/pulang di absensinya sendiri)? */
export function photoBelongsToEmployee(name: string, employeeId: number): boolean {
  const row = getDb()
    .prepare(
      'SELECT id FROM attendance WHERE employee_id = ? AND (check_in_photo = ? OR check_out_photo = ?) LIMIT 1'
    )
    .get(employeeId, name, name);
  return !!row;
}
