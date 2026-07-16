import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { parseHM, TIMEZONES } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  return NextResponse.json({ ok: true, settings: getAllSettings(), timezones: TIMEZONES });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Data tidak valid.' }, { status: 400 });
  }

  const workStart = String(body.work_start ?? '');
  if (parseHM(workStart) === null) {
    return NextResponse.json(
      { ok: false, error: 'Jam masuk tidak valid. Gunakan format JJ:MM, contoh 07:00.' },
      { status: 400 }
    );
  }

  const tolerance = Number(body.late_tolerance_min);
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 480) {
    return NextResponse.json(
      { ok: false, error: 'Toleransi terlambat harus 0-480 menit.' },
      { status: 400 }
    );
  }

  const interval = Number(body.tracking_interval_s);
  if (!Number.isInteger(interval) || interval < 5 || interval > 600) {
    return NextResponse.json(
      { ok: false, error: 'Interval pelacakan harus 5-600 detik.' },
      { status: 400 }
    );
  }

  const timezone = String(body.timezone ?? '');
  if (!TIMEZONES.some((t) => t.id === timezone)) {
    return NextResponse.json({ ok: false, error: 'Zona waktu tidak valid.' }, { status: 400 });
  }

  setSetting('work_start', workStart.trim());
  setSetting('late_tolerance_min', String(tolerance));
  setSetting('tracking_interval_s', String(interval));
  setSetting('timezone', timezone);
  setSetting('require_checkout_in_area', body.require_checkout_in_area ? '1' : '0');

  return NextResponse.json({ ok: true });
}
