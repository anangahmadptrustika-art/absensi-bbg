import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';
import { durationLabel, timeHMInTz } from '@/lib/time';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ekspor rekap absensi ke CSV (pemisah ';' agar terbuka rapi di Excel Indonesia). */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const employeeId = Number(searchParams.get('employee_id') || 0);

  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json(
      { ok: false, error: 'Format tanggal tidak valid (YYYY-MM-DD).' },
      { status: 400 }
    );
  }

  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (from) {
    conds.push('a.date >= ?');
    params.push(from);
  }
  if (to) {
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
              li.name AS in_location_name, lo.name AS out_location_name
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN locations li ON li.id = a.check_in_location_id
       LEFT JOIN locations lo ON lo.id = a.check_out_location_id
       ${where}
       ORDER BY a.date, e.name COLLATE NOCASE`
    )
    .all(...params) as Record<string, unknown>[];

  const tz = getSetting('timezone');
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v);
    // cegah injeksi formula Excel (nama diawali =, +, -, @)
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = [
    'Tanggal',
    'Nama',
    'Nomor Induk',
    'Jam Masuk',
    'Status Masuk',
    'Lokasi Masuk',
    'Jam Pulang',
    'Lokasi Pulang',
    'Durasi Kerja',
  ];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push(
      [
        esc(r.date),
        esc(r.employee_name),
        esc(r.nik),
        esc(timeHMInTz(new Date(r.check_in_at as string), tz)),
        esc(r.check_in_status),
        esc(r.in_location_name),
        esc(r.check_out_at ? timeHMInTz(new Date(r.check_out_at as string), tz) : 'Belum pulang'),
        esc(r.out_location_name ?? ''),
        esc(
          r.check_out_at ? durationLabel(r.check_in_at as string, r.check_out_at as string) : ''
        ),
      ].join(';')
    );
  }

  const filename = `absensi_${from || 'semua'}_${to || 'semua'}.csv`;
  // BOM agar Excel membaca UTF-8 dengan benar
  return new NextResponse('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
