import { NextRequest } from 'next/server';
import { getDb } from './db';

/**
 * Baca body JSON dengan batas ukuran, supaya request raksasa ditolak
 * sebelum mem-buffer dan mem-parse seluruhnya. Mengembalikan null jika
 * melebihi batas atau bukan JSON valid.
 */
export async function readJsonLimited(
  req: NextRequest,
  maxBytes: number
): Promise<Record<string, unknown> | null> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Batas body absen: foto ±5 MB → base64 ±6,7 MB + koordinat. */
export const ATTENDANCE_BODY_LIMIT = 8 * 1024 * 1024;
/** Batas body kecil (login, ping, CRUD). */
export const SMALL_BODY_LIMIT = 64 * 1024;

/** null = tanpa penugasan lokasi; angka = id lokasi; undefined = input tidak valid. */
export function parseLocationId(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function locationExists(id: number | null): boolean {
  if (id === null) return true;
  return !!getDb().prepare('SELECT id FROM locations WHERE id = ?').get(id);
}
