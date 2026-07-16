import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifySecret } from '@/lib/hash';
import { attachSessionCookie, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Isi username dan password.' }, { status: 400 });
  }

  const admin = getDb()
    .prepare('SELECT id, username, password_hash FROM admins WHERE username = ?')
    .get(username) as { id: number; username: string; password_hash: string } | undefined;

  if (!admin || !verifySecret(password, admin.password_hash)) {
    return NextResponse.json({ ok: false, error: 'Username atau password salah.' }, { status: 401 });
  }

  const token = createSession('admin', admin.id);
  const res = NextResponse.json({ ok: true, admin: { id: admin.id, username: admin.username } });
  attachSessionCookie(res, token, 'admin');
  return res;
}
