import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { hashSecret, verifySecret } from '@/lib/hash';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const oldPassword = String(body?.oldPassword ?? '');
  const newPassword = String(body?.newPassword ?? '');

  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'Password baru minimal 8 karakter.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const admin = db
    .prepare('SELECT id, password_hash FROM admins WHERE id = ?')
    .get(session.ref_id) as { id: number; password_hash: string } | undefined;

  if (!admin || !verifySecret(oldPassword, admin.password_hash)) {
    return NextResponse.json({ ok: false, error: 'Password lama salah.' }, { status: 403 });
  }

  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(
    hashSecret(newPassword),
    admin.id
  );
  // putuskan semua sesi admin lain (token lama tidak berlaku lagi), pertahankan sesi ini
  db.prepare("DELETE FROM sessions WHERE kind = 'admin' AND token != ?").run(session.token);

  return NextResponse.json({ ok: true });
}
