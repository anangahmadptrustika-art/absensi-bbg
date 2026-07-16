import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { durationLabel, timeHMInTz } from '@/lib/time';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const employeeId = Number(searchParams.get('employee_id') || 0);

  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (DATE_RE.test(from)) {
    conds.push('a.date >= ?');
    params.push(from);
  }
  if (DATE_RE.test(to)) {
    conds.push('a.date <= ?');
    params.push(to);
  }
  if (employeeId > 0) {
    conds.push('a.employee_id = ?');
    params.push(employeeId);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = getDb()
    .prepare(
      `SELECT a.*, e.name AS employee_name, e.nik,
              li.name AS in_location_name, lo.name AS out_location_name,
              (SELECT COUNT(*) FROM track_points tp WHERE tp.attendance_id = a.id) AS point_count
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN locations li ON li.id = a.check_in_location_id
       LEFT JOIN locations lo ON lo.id = a.check_out_location_id
       ${where}
       ORDER BY a.date DESC, a.check_in_at DESC
       LIMIT 1000`
    )
    .all(...params) as Record<string, unknown>[];

  const tz = getSetting('timezone');
  const records = rows.map((r) => ({
    id: r.id,
    date: r.date,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    nik: r.nik,
    checkInAt: r.check_in_at,
    checkInTime: timeHMInTz(new Date(r.check_in_at as string), tz),
    checkInStatus: r.check_in_status,
    checkInPhoto: r.check_in_photo,
    inLocationName: r.in_location_name,
    checkOutAt: r.check_out_at,
    checkOutTime: r.check_out_at ? timeHMInTz(new Date(r.check_out_at as string), tz) : null,
    checkOutPhoto: r.check_out_photo,
    outLocationName: r.out_location_name,
    duration: r.check_out_at
      ? durationLabel(r.check_in_at as string, r.check_out_at as string)
      : null,
    pointCount: r.point_count,
  }));

  return NextResponse.json({ ok: true, records });
}
