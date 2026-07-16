import { NextRequest, NextResponse } from 'next/server';
import { getDb } from './db';
import { randomToken } from './hash';

const COOKIE_NAME = 'absensi_session';
const EMPLOYEE_SESSION_DAYS = 60; // karyawan jarang login ulang — ramah untuk pekerja lapangan
const ADMIN_SESSION_DAYS = 7;

export interface Session {
  token: string;
  kind: 'admin' | 'employee';
  ref_id: number;
}

export function createSession(kind: 'admin' | 'employee', refId: number): string {
  const token = randomToken();
  const days = kind === 'admin' ? ADMIN_SESSION_DAYS : EMPLOYEE_SESSION_DAYS;
  const expires = new Date(Date.now() + days * 86400_000).toISOString();
  const db = getDb();
  // bersihkan sesi kedaluwarsa sekalian
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  db.prepare('INSERT INTO sessions (token, kind, ref_id, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    kind,
    refId,
    expires
  );
  return token;
}

export function getSession(req: NextRequest): Session | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare('SELECT token, kind, ref_id, expires_at FROM sessions WHERE token = ?')
    .get(token) as (Session & { expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { token: row.token, kind: row.kind, ref_id: row.ref_id };
}

export function requireAdmin(req: NextRequest): Session | null {
  const s = getSession(req);
  return s && s.kind === 'admin' ? s : null;
}

export function requireEmployee(req: NextRequest): Session | null {
  const s = getSession(req);
  return s && s.kind === 'employee' ? s : null;
}

export function destroySession(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function attachSessionCookie(res: NextResponse, token: string, kind: 'admin' | 'employee') {
  const days = kind === 'admin' ? ADMIN_SESSION_DAYS : EMPLOYEE_SESSION_DAYS;
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: days * 86400,
    // Wajib HTTPS di produksi (kamera & GPS juga menuntut HTTPS) —
    // tanpa flag ini token sesi bisa bocor lewat request http:// biasa.
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function unauthorized(message = 'Sesi berakhir. Silakan masuk kembali.') {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}
