import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { hashSecret } from '@/lib/hash';
import { todayKey } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const rows = getDb()
    .prepare(
      `SELECT e.id, e.name, e.nik, e.location_id, e.active, l.name AS location_name,
              a.check_in_at AS today_in, a.check_out_at AS today_out
       FROM employees e
       LEFT JOIN locations l ON l.id = e.location_id
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
       ORDER BY e.name COLLATE NOCASE`
    )
    .all(todayKey());
  return NextResponse.json({ ok: true, employees: rows });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const nik = String(body?.nik ?? '').trim();
  const pin = String(body?.pin ?? '').trim();
  const locationId = body?.location_id ? Number(body.location_id) : null;
  const active = body?.active === false ? 0 : 1;

  if (!name || !nik) {
    return NextResponse.json({ ok: false, error: 'Nama dan Nomor Induk wajib diisi.' }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'PIN harus 4-8 digit angka.' }, { status: 400 });
  }

  try {
    const result = getDb()
      .prepare(
        'INSERT INTO employees (name, nik, pin_hash, location_id, active) VALUES (?, ?, ?, ?, ?)'
      )
      .run(name, nik, hashSecret(pin), locationId, active);
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return NextResponse.json(
        { ok: false, error: `Nomor Induk "${nik}" sudah dipakai karyawan lain.` },
        { status: 409 }
      );
    }
    throw e;
  }
}
