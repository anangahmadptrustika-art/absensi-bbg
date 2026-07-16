import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { isValidCoord } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  const id = Number(params.id);
  const db = getDb();
  if (!db.prepare('SELECT id FROM locations WHERE id = ?').get(id)) {
    return NextResponse.json({ ok: false, error: 'Lokasi tidak ditemukan.' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  // jangan pakai Number(): null/'' akan berubah jadi 0 (koordinat 0,0 valid!)
  const lat = body?.lat;
  const lng = body?.lng;
  const radius = Math.round(Number(body?.radius_m));
  const active = body?.active === false ? 0 : 1;

  if (!name) {
    return NextResponse.json({ ok: false, error: 'Nama lokasi wajib diisi.' }, { status: 400 });
  }
  if (!isValidCoord(lat, lng)) {
    return NextResponse.json({ ok: false, error: 'Koordinat tidak valid.' }, { status: 400 });
  }
  if (!Number.isFinite(radius) || radius < 20 || radius > 10000) {
    return NextResponse.json(
      { ok: false, error: 'Radius harus antara 20 dan 10.000 meter.' },
      { status: 400 }
    );
  }

  db.prepare('UPDATE locations SET name = ?, lat = ?, lng = ?, radius_m = ?, active = ? WHERE id = ?').run(
    name,
    lat,
    lng,
    radius,
    active,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  const id = Number(params.id);
  const result = getDb().prepare('DELETE FROM locations WHERE id = ?').run(id);
  if (result.changes === 0) {
    return NextResponse.json({ ok: false, error: 'Lokasi tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
