import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifySecret } from '@/lib/hash';
import { attachSessionCookie, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nik = String(body?.nik ?? '').trim();
  const pin = String(body?.pin ?? '').trim();
  if (!nik || !pin) {
    return NextResponse.json(
      { ok: false, error: 'Isi Nomor Induk dan PIN terlebih dahulu.' },
      { status: 400 }
    );
  }

  const emp = getDb()
    .prepare('SELECT id, name, nik, pin_hash, active FROM employees WHERE nik = ?')
    .get(nik) as
    | { id: number; name: string; nik: string; pin_hash: string; active: number }
    | undefined;

  if (!emp || !verifySecret(pin, emp.pin_hash)) {
    return NextResponse.json(
      { ok: false, error: 'Nomor Induk atau PIN salah. Coba lagi.' },
      { status: 401 }
    );
  }
  if (!emp.active) {
    return NextResponse.json(
      { ok: false, error: 'Akun Anda tidak aktif. Hubungi admin.' },
      { status: 403 }
    );
  }

  const token = createSession('employee', emp.id);
  const res = NextResponse.json({ ok: true, employee: { id: emp.id, name: emp.name, nik: emp.nik } });
  attachSessionCookie(res, token, 'employee');
  return res;
}
