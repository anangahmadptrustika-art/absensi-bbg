import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Riwayat rute perjalanan satu hari kerja (untuk ditampilkan sebagai garis di peta). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  const id = Number(params.id);

  const att = getDb()
    .prepare(
      `SELECT a.id, a.date, a.check_in_at, a.check_out_at, e.name AS employee_name
       FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`
    )
    .get(id);
  if (!att) {
    return NextResponse.json({ ok: false, error: 'Data absensi tidak ditemukan.' }, { status: 404 });
  }

  const points = getDb()
    .prepare(
      'SELECT lat, lng, acc, recorded_at FROM track_points WHERE attendance_id = ? ORDER BY recorded_at'
    )
    .all(id);

  return NextResponse.json({ ok: true, attendance: att, points });
}
