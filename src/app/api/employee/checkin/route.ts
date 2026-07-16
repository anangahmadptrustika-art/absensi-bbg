import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { requireEmployee, unauthorized } from '@/lib/auth';
import {
  activeAttendance,
  allowedLocations,
  lateStatus,
  todayAttendance,
  todayKey,
} from '@/lib/attendance';
import { checkGeofence, isValidCoord } from '@/lib/geo';
import { savePhotoDataUrl } from '@/lib/photos';
import { timeHMInTz } from '@/lib/time';
import { ATTENDANCE_BODY_LIMIT, readJsonLimited } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = requireEmployee(req);
  if (!session) return unauthorized();

  const body = await readJsonLimited(req, ATTENDANCE_BODY_LIMIT);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: 'Data absen tidak valid atau foto terlalu besar.' },
      { status: 413 }
    );
  }
  const lat = body.lat;
  const lng = body.lng;
  const acc = typeof body.acc === 'number' ? body.acc : null;

  if (!isValidCoord(lat, lng)) {
    return NextResponse.json(
      { ok: false, error: 'Lokasi GPS belum ditemukan. Pastikan GPS/izin lokasi aktif.' },
      { status: 400 }
    );
  }

  const open = activeAttendance(session.ref_id);
  if (open) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Anda masih tercatat bekerja (belum absen pulang). Silakan absen pulang terlebih dahulu.',
      },
      { status: 409 }
    );
  }
  const doneToday = todayAttendance(session.ref_id);
  if (doneToday) {
    return NextResponse.json(
      { ok: false, error: 'Absensi hari ini sudah selesai (sudah absen pulang).' },
      { status: 409 }
    );
  }

  const locations = allowedLocations(session.ref_id);
  if (locations.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Lokasi absen Anda belum diatur atau sedang nonaktif. Hubungi admin.' },
      { status: 400 }
    );
  }

  const fence = checkGeofence(lat, lng as number, locations);
  if (!fence.inside) {
    const info = fence.location
      ? ` Jarak Anda ${formatDistance(fence.distance_m)} dari ${fence.location.name}.`
      : '';
    return NextResponse.json(
      {
        ok: false,
        code: 'OUTSIDE',
        error: `Anda berada di luar area absen.${info} Silakan mendekat ke lokasi kerja.`,
        distance_m: fence.distance_m,
        nearest: fence.location?.name ?? null,
      },
      { status: 403 }
    );
  }

  const photo = savePhotoDataUrl(body.photo);
  if (!photo) {
    return NextResponse.json(
      { ok: false, error: 'Foto selfie wajib diambil untuk absen.' },
      { status: 400 }
    );
  }

  const now = new Date();
  const status = lateStatus(now);
  let attendanceId: number | bigint;
  try {
    const result = getDb()
      .prepare(
        `INSERT INTO attendance
          (employee_id, date, check_in_at, check_in_lat, check_in_lng, check_in_acc,
           check_in_photo, check_in_location_id, check_in_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.ref_id,
        todayKey(),
        now.toISOString(),
        lat,
        lng,
        acc,
        photo,
        fence.location!.id,
        status
      );
    attendanceId = result.lastInsertRowid;
  } catch (e: unknown) {
    // dua permintaan bersamaan (tombol ditekan dua kali) → UNIQUE(employee_id, date)
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return NextResponse.json(
        { ok: false, error: 'Anda sudah absen masuk hari ini.' },
        { status: 409 }
      );
    }
    throw e;
  }

  // Titik pertama pelacakan = posisi absen masuk.
  getDb()
    .prepare(
      'INSERT INTO track_points (attendance_id, employee_id, lat, lng, acc, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(attendanceId, session.ref_id, lat, lng, acc, now.toISOString());

  return NextResponse.json({
    ok: true,
    time: timeHMInTz(now, getSetting('timezone')),
    locationName: fence.location!.name,
    status,
  });
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} meter`;
}
