import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DUMMY_HASH, verifySecret } from '@/lib/hash';
import { attachSessionCookie, createSession } from '@/lib/auth';
import { clearFailures, lockedForSeconds, lockMessage, recordFailure } from '@/lib/ratelimit';
import { readJsonLimited, SMALL_BODY_LIMIT } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await readJsonLimited(req, SMALL_BODY_LIMIT);
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Isi username dan password.' }, { status: 400 });
  }

  const lockKey = `admin:${username}`;
  const lockedS = lockedForSeconds(lockKey);
  if (lockedS > 0) {
    return NextResponse.json({ ok: false, error: lockMessage(lockedS) }, { status: 429 });
  }

  const admin = getDb()
    .prepare('SELECT id, username, password_hash FROM admins WHERE username = ?')
    .get(username) as { id: number; username: string; password_hash: string } | undefined;

  const valid = await verifySecret(password, admin?.password_hash ?? DUMMY_HASH);

  if (!admin || !valid) {
    recordFailure(lockKey);
    return NextResponse.json({ ok: false, error: 'Username atau password salah.' }, { status: 401 });
  }

  clearFailures(lockKey);
  const token = createSession('admin', admin.id);
  const res = NextResponse.json({ ok: true, admin: { id: admin.id, username: admin.username } });
  attachSessionCookie(res, token, 'admin');
  return res;
}
