import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb, UPLOADS_DIR } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { hashSecret } from '@/lib/hash';
import { locationExists, parseLocationId } from '@/lib/api';

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
  const locationId = parseLocationId(body?.location_id);
  const active = body?.active === false ? 0 : 1;

  if (!name || !nik) {
    return NextResponse.json({ ok: false, error: 'Nama dan Nomor Induk wajib diisi.' }, { status: 400 });
  }
  if (pin && !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'PIN harus 4-8 digit angka.' }, { status: 400 });
  }
  if (locationId === undefined || !locationExists(locationId)) {
    return NextResponse.json({ ok: false, error: 'Lokasi tugas tidak ditemukan.' }, { status: 400 });
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

  // foto selfie milik karyawan ikut dihapus dari disk (data pribadi)
  const photos = db
    .prepare(
      'SELECT check_in_photo, check_out_photo FROM attendance WHERE employee_id = ?'
    )
    .all(id) as { check_in_photo: string | null; check_out_photo: string | null }[];

  db.prepare("DELETE FROM sessions WHERE kind = 'employee' AND ref_id = ?").run(id);
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  if (result.changes === 0) {
    return NextResponse.json({ ok: false, error: 'Karyawan tidak ditemukan.' }, { status: 404 });
  }

  for (const row of photos) {
    for (const name of [row.check_in_photo, row.check_out_photo]) {
      if (name && /^[a-f0-9]{32}\.jpg$/.test(name)) {
        fs.rm(path.join(UPLOADS_DIR, name), { force: true }, () => {});
      }
    }
  }
  return NextResponse.json({ ok: true });
}
