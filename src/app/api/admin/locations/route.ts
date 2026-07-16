import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { isValidCoord } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const rows = getDb()
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM employees e WHERE e.location_id = l.id) AS employee_count
       FROM locations l ORDER BY l.name COLLATE NOCASE`
    )
    .all();
  return NextResponse.json({ ok: true, locations: rows });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const radius = Math.round(Number(body?.radius_m));
  const active = body?.active === false ? 0 : 1;

  if (!name) {
    return NextResponse.json({ ok: false, error: 'Nama lokasi wajib diisi.' }, { status: 400 });
  }
  if (!isValidCoord(lat, lng)) {
    return NextResponse.json(
      { ok: false, error: 'Pilih titik lokasi pada peta terlebih dahulu.' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(radius) || radius < 20 || radius > 10000) {
    return NextResponse.json(
      { ok: false, error: 'Radius harus antara 20 dan 10.000 meter.' },
      { status: 400 }
    );
  }

  const result = getDb()
    .prepare('INSERT INTO locations (name, lat, lng, radius_m, active) VALUES (?, ?, ?, ?, ?)')
    .run(name, lat, lng, radius, active);
  return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
}
