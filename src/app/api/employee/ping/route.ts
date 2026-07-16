import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireEmployee, unauthorized } from '@/lib/auth';
import { activeAttendance } from '@/lib/attendance';
import { isValidCoord } from '@/lib/geo';
import { readJsonLimited, SMALL_BODY_LIMIT } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Jeda minimal antar titik yang disimpan, agar database tidak membengkak.
const MIN_GAP_MS = 10_000;

/**
 * Terima posisi karyawan SELAMA berstatus bekerja (sudah absen masuk,
 * belum absen pulang). Di luar itu ditolak — privasi karyawan terjaga:
 * setelah absen pulang, tidak ada lagi data lokasi yang diterima.
 */
export async function POST(req: NextRequest) {
  const session = requireEmployee(req);
  if (!session) return unauthorized();

  // Body dibaca dulu, baru status dicek — cek status + INSERT berjalan
  // sinkron tanpa await di antaranya, jadi absen pulang yang terjadi
  // bersamaan tidak bisa menyelipkan titik posisi setelah check-out.
  const body = await readJsonLimited(req, SMALL_BODY_LIMIT);
  const lat = body?.lat;
  const lng = body?.lng;
  const acc = typeof body?.acc === 'number' ? body.acc : null;

  const att = activeAttendance(session.ref_id);
  if (!att) {
    // 200 dengan tracking:false supaya klien tahu harus berhenti mengirim.
    return NextResponse.json({ ok: true, tracking: false });
  }

  if (!isValidCoord(lat, lng)) {
    return NextResponse.json(
      { ok: false, tracking: true, error: 'Koordinat tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const last = db
    .prepare(
      'SELECT recorded_at FROM track_points WHERE attendance_id = ? ORDER BY recorded_at DESC LIMIT 1'
    )
    .get(att.id) as { recorded_at: string } | undefined;

  const now = new Date();
  if (!last || now.getTime() - new Date(last.recorded_at).getTime() >= MIN_GAP_MS) {
    db.prepare(
      'INSERT INTO track_points (attendance_id, employee_id, lat, lng, acc, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(att.id, session.ref_id, lat, lng, acc, now.toISOString());
  }

  return NextResponse.json({ ok: true, tracking: true });
}
