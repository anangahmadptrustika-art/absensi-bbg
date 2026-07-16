import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { hashSecret } from '@/lib/hash';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  const id = Number(params.id);
  const db = getDb();
  const existing = db.prepare('SELECT id FROM employees WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Karyawan tidak ditemukan.' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const nik = String(body?.nik ?? '').trim();
  const pin = String(body?.pin ?? '').trim(); // kosong = tidak diganti
  const locationId = body?.location_id ? Number(body.location_id) : null;
  const active = body?.active === false ? 0 : 1;

  if (!name || !nik) {
    return NextResponse.json({ ok: false, error: 'Nama dan Nomor Induk wajib diisi.' }, { status: 400 });
  }
  if (pin && !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'PIN harus 4-8 digit angka.' }, { status: 400 });
  }

  try {
    db.prepare('UPDATE employees SET name = ?, nik = ?, location_id = ?, active = ? WHERE id = ?').run(
      name,
      nik,
      locationId,
      active,
      id
    );
    if (pin) {
      db.prepare('UPDATE employees SET pin_hash = ? WHERE id = ?').run(hashSecret(pin), id);
    }
    if (!active) {
      // karyawan dinonaktifkan → putuskan sesinya agar tidak bisa absen/mengirim lokasi
      db.prepare("DELETE FROM sessions WHERE kind = 'employee' AND ref_id = ?").run(id);
    }
    return NextResponse.json({ ok: true });
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  const id = Number(params.id);
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE kind = 'employee' AND ref_id = ?").run(id);
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  if (result.changes === 0) {
    return NextResponse.json({ ok: false, error: 'Karyawan tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
