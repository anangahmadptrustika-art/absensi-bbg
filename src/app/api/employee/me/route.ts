import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { requireEmployee, unauthorized } from '@/lib/auth';
import { allowedLocations, todayAttendance, workStatus } from '@/lib/attendance';
import { timeHMInTz } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = requireEmployee(req);
  if (!session) return unauthorized();

  const emp = getDb()
    .prepare('SELECT id, name, nik, active FROM employees WHERE id = ?')
    .get(session.ref_id) as { id: number; name: string; nik: string; active: number } | undefined;
  if (!emp || !emp.active) return unauthorized('Akun tidak aktif. Hubungi admin.');

  const att = todayAttendance(emp.id);
  const tz = getSetting('timezone');

  return NextResponse.json({
    ok: true,
    employee: { id: emp.id, name: emp.name, nik: emp.nik },
    status: workStatus(att),
    today: att
      ? {
          checkInAt: att.check_in_at,
          checkInTime: timeHMInTz(new Date(att.check_in_at), tz),
          checkInStatus: att.check_in_status,
          checkOutAt: att.check_out_at,
          checkOutTime: att.check_out_at ? timeHMInTz(new Date(att.check_out_at), tz) : null,
        }
      : null,
    locations: allowedLocations(emp.id),
    settings: {
      trackingIntervalS: Math.max(5, parseInt(getSetting('tracking_interval_s'), 10) || 20),
      requireCheckoutInArea: getSetting('require_checkout_in_area') === '1',
      workStart: getSetting('work_start'),
      timezone: tz,
    },
  });
}
