import { getDb, getSetting } from './db';
import { GeofenceLocation } from './geo';
import { dateKeyInTz, minutesOfDayInTz, parseHM } from './time';

export interface AttendanceRow {
  id: number;
  employee_id: number;
  date: string;
  check_in_at: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_acc: number | null;
  check_in_photo: string | null;
  check_in_location_id: number | null;
  check_in_status: string;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_acc: number | null;
  check_out_photo: string | null;
  check_out_location_id: number | null;
}

export function todayKey(): string {
  return dateKeyInTz(new Date(), getSetting('timezone'));
}

/**
 * Lokasi absen yang berlaku untuk karyawan:
 * jika karyawan ditugaskan ke satu lokasi, hanya lokasi itu;
 * jika tidak, semua lokasi aktif.
 */
export function allowedLocations(employeeId: number): GeofenceLocation[] {
  const db = getDb();
  const emp = db.prepare('SELECT location_id FROM employees WHERE id = ?').get(employeeId) as
    | { location_id: number | null }
    | undefined;
  if (emp?.location_id) {
    const rows = db
      .prepare('SELECT id, name, lat, lng, radius_m FROM locations WHERE id = ? AND active = 1')
      .all(emp.location_id) as GeofenceLocation[];
    if (rows.length > 0) return rows;
  }
  return db
    .prepare('SELECT id, name, lat, lng, radius_m FROM locations WHERE active = 1')
    .all() as GeofenceLocation[];
}

export function todayAttendance(employeeId: number): AttendanceRow | undefined {
  return getDb()
    .prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?')
    .get(employeeId, todayKey()) as AttendanceRow | undefined;
}

export type WorkStatus = 'BELUM_MASUK' | 'BEKERJA' | 'SELESAI';

export function workStatus(att: AttendanceRow | undefined): WorkStatus {
  if (!att) return 'BELUM_MASUK';
  return att.check_out_at ? 'SELESAI' : 'BEKERJA';
}

/** Status ketepatan waktu untuk absen masuk sekarang: TEPAT atau TERLAMBAT. */
export function lateStatus(now: Date): string {
  const tz = getSetting('timezone');
  const workStart = parseHM(getSetting('work_start'));
  const tolerance = parseInt(getSetting('late_tolerance_min'), 10);
  if (workStart === null) return 'TEPAT';
  const nowMin = minutesOfDayInTz(now, tz);
  return nowMin > workStart + (Number.isFinite(tolerance) ? tolerance : 0) ? 'TERLAMBAT' : 'TEPAT';
}
