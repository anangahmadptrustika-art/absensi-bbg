import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DUMMY_HASH, verifySecret } from '@/lib/hash';
import { attachSessionCookie, createSession } from '@/lib/auth';
import { clearFailures, lockedForSeconds, lockMessage, recordFailure } from '@/lib/ratelimit';
import { readJsonLimited, SMALL_BODY_LIMIT } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await readJsonLimited(req, SMALL_BODY_LIMIT);
  const nik = String(body?.nik ?? '').trim();
  const pin = String(body?.pin ?? '').trim();
  if (!nik || !pin) {
    return NextResponse.json(
      { ok: false, error: 'Isi Nomor Induk dan PIN terlebih dahulu.' },
      { status: 400 }
    );
  }

  const lockKey = `emp:${nik}`;
  const lockedS = lockedForSeconds(lockKey);
  if (lockedS > 0) {
    return NextResponse.json({ ok: false, error: lockMessage(lockedS) }, { status: 429 });
  }

  const emp = getDb()
    .prepare('SELECT id, name, nik, pin_hash, active FROM employees WHERE nik = ?')
    .get(nik) as
    | { id: number; name: string; nik: string; pin_hash: string; active: number }
    | undefined;

  // verifikasi tetap dijalankan meski NIK tidak ada, agar waktu respons seragam
  const valid = await verifySecret(pin, emp?.pin_hash ?? DUMMY_HASH);

  if (!emp || !valid) {
    recordFailure(lockKey);
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

  clearFailures(lockKey);
  const token = createSession('employee', emp.id);
  const res = NextResponse.json({ ok: true, employee: { id: emp.id, name: emp.name, nik: emp.nik } });
  attachSessionCookie(req, res, token, 'employee');
  return res;
}
