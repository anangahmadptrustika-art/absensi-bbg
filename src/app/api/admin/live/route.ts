import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { todayKey } from '@/lib/attendance';
import { timeHMInTz } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Posisi terakhir karyawan yang SEDANG BEKERJA saja
 * (sudah absen masuk hari ini dan belum absen pulang).
 * Karyawan yang sudah absen pulang tidak pernah muncul di sini — privasi.
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();

  const db = getDb();
  const tz = getSetting('timezone');
  const rows = db
    .prepare(
      `SELECT a.id AS attendance_id, a.check_in_at, a.check_in_status,
              e.id AS employee_id, e.name, e.nik,
              l.name AS location_name,
              tp.lat, tp.lng, tp.acc, tp.recorded_at
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN locations l ON l.id = a.check_in_location_id
       LEFT JOIN track_points tp ON tp.id = (
         SELECT id FROM track_points WHERE attendance_id = a.id
         ORDER BY recorded_at DESC LIMIT 1
       )
       WHERE a.date = ? AND a.check_out_at IS NULL
       ORDER BY e.name COLLATE NOCASE`
    )
    .all(todayKey()) as {
    attendance_id: number;
    check_in_at: string;
    check_in_status: string;
    employee_id: number;
    name: string;
    nik: string;
    location_name: string | null;
    lat: number | null;
    lng: number | null;
    acc: number | null;
    recorded_at: string | null;
  }[];

  const now = Date.now();
  const working = rows.map((r) => ({
    attendanceId: r.attendance_id,
    employeeId: r.employee_id,
    name: r.name,
    nik: r.nik,
    checkInAt: r.check_in_at,
    checkInTime: timeHMInTz(new Date(r.check_in_at), tz),
    checkInStatus: r.check_in_status,
    locationName: r.location_name,
    lat: r.lat,
    lng: r.lng,
    acc: r.acc,
    lastSeenAt: r.recorded_at,
    lastSeenAgoS: r.recorded_at
      ? Math.max(0, Math.round((now - new Date(r.recorded_at).getTime()) / 1000))
      : null,
  }));

  return NextResponse.json({ ok: true, working, serverTime: new Date().toISOString() });
}
