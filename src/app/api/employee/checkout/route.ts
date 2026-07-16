import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { requireEmployee, unauthorized } from '@/lib/auth';
import { activeAttendance, allowedLocations, todayAttendance } from '@/lib/attendance';
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

  const att = activeAttendance(session.ref_id);
  if (!att) {
    const doneToday = todayAttendance(session.ref_id);
    return NextResponse.json(
      {
        ok: false,
        error: doneToday?.check_out_at
          ? 'Anda sudah absen pulang hari ini.'
          : 'Anda belum absen masuk hari ini.',
      },
      { status: 409 }
    );
  }

  let checkoutLocationId: number | null = null;
  if (getSetting('require_checkout_in_area') === '1') {
    const locations = allowedLocations(session.ref_id);
    // Jika semua lokasi terhapus/nonaktif, jangan kunci karyawan dalam status
    // "bekerja" selamanya — absen pulang tetap diperbolehkan.
    if (locations.length > 0) {
      const fence = checkGeofence(lat, lng as number, locations);
      if (!fence.inside) {
        const info = fence.location
          ? ` Jarak Anda ${formatDistance(fence.distance_m)} dari ${fence.location.name}.`
          : '';
        return NextResponse.json(
          {
            ok: false,
            code: 'OUTSIDE',
            error: `Absen pulang harus di dalam area lokasi kerja.${info}`,
            distance_m: fence.distance_m,
            nearest: fence.location?.name ?? null,
          },
          { status: 403 }
        );
      }
      checkoutLocationId = fence.location!.id;
    }
  }

  const photo = savePhotoDataUrl(body.photo);
  if (!photo) {
    return NextResponse.json(
      { ok: false, error: 'Foto selfie wajib diambil untuk absen pulang.' },
      { status: 400 }
    );
  }

  const now = new Date();
  getDb()
    .prepare(
      `UPDATE attendance SET
        check_out_at = ?, check_out_lat = ?, check_out_lng = ?, check_out_acc = ?,
        check_out_photo = ?, check_out_location_id = ?
       WHERE id = ? AND check_out_at IS NULL`
    )
    .run(now.toISOString(), lat, lng, acc, photo, checkoutLocationId, att.id);

  return NextResponse.json({
    ok: true,
    time: timeHMInTz(now, getSetting('timezone')),
    trackingStopped: true,
  });
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} meter`;
}
