import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getSession, unauthorized } from '@/lib/auth';
import { photoBelongsToEmployee, photoPath } from '@/lib/photos';

export const dynamic = 'force-dynamic';

/**
 * Sajikan foto selfie absen.
 * Admin boleh melihat semua foto; karyawan hanya foto absennya sendiri.
 */
export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const session = getSession(req);
  if (!session) return unauthorized();

  const name = params.name;
  if (session.kind === 'employee' && !photoBelongsToEmployee(name, session.ref_id)) {
    return NextResponse.json({ ok: false, error: 'Tidak diizinkan.' }, { status: 403 });
  }

  const p = photoPath(name);
  if (!p) {
    return NextResponse.json({ ok: false, error: 'Foto tidak ditemukan.' }, { status: 404 });
  }

  const buf = fs.readFileSync(p);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
