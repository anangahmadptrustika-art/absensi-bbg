'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';

interface AttendanceRecord {
  id: number;
  date: string;
  employeeName: string;
  nik: string;
  checkInTime: string;
  checkInStatus: string;
  checkInPhoto: string | null;
  inLocationName: string | null;
  checkOutTime: string | null;
  checkOutPhoto: string | null;
  outLocationName: string | null;
  duration: string | null;
  pointCount: number;
}

interface EmployeeOption {
  id: number;
  name: string;
}

function isoDateDaysAgo(days: number): string {
  // pakai tanggal LOKAL, bukan toISOString() (UTC) — kalau tidak, tiap pagi
  // sebelum jam 07.00 WIB data "hari ini" tidak masuk rentang default
  const d = new Date(Date.now() - days * 86400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AttendanceTab() {
  const [from, setFrom] = useState(() => isoDateDaysAgo(6));
  const [to, setTo] = useState(() => isoDateDaysAgo(0));
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ src: string; caption: string } | null>(null);
  const [trackModal, setTrackModal] = useState<AttendanceRecord | null>(null);
  // nomor urut request: respons lama yang datang terlambat tidak boleh
  // menimpa hasil filter yang lebih baru
  const loadSeqRef = useRef(0);

  useEffect(() => {
    fetch('/api/admin/employees')
      .then((r) => r.json())
      .then((d) => d?.ok && setEmployees(d.employees))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (employeeId) params.set('employee_id', String(employeeId));
      const res = await fetch(`/api/admin/attendance?${params}`);
      const data = await res.json().catch(() => null);
      if (seq === loadSeqRef.current && data?.ok) setRecords(data.records);
    } catch {
      // jaringan gagal — biarkan data lama tampil
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [from, to, employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const params = new URLSearchParams({ from, to });
    if (employeeId) params.set('employee_id', String(employeeId));
    window.open(`/api/admin/export?${params}`, '_blank');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="att-from" className="label-admin">Dari tanggal</label>
          <input id="att-from" type="date" className="input-admin" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="att-to" className="label-admin">Sampai tanggal</label>
          <input id="att-to" type="date" className="input-admin" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="att-employee" className="label-admin">Karyawan</label>
          <select
            id="att-employee"
            className="input-admin"
            value={employeeId}
            onChange={(e) => setEmployeeId(Number(e.target.value))}
          >
            <option value={0}>Semua karyawan</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Memuat…' : 'Tampilkan'}
        </button>
        <button className="btn-secondary" onClick={exportCsv}>
          ⬇ Ekspor CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">Masuk</th>
              <th className="px-4 py-3">Pulang</th>
              <th className="px-4 py-3">Durasi</th>
              <th className="px-4 py-3">Rute</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Tidak ada data absensi pada rentang tanggal ini.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id} className="border-b align-top last:border-0">
                <td className="px-4 py-3 tabular-nums">{r.date}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{r.employeeName}</p>
                  <p className="text-xs text-gray-400">NIK {r.nik}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.checkInPhoto && (
                      <PhotoThumb
                        name={r.checkInPhoto}
                        onClick={() =>
                          setPhotoModal({
                            src: `/api/photos/${r.checkInPhoto}`,
                            caption: `${r.employeeName} — masuk ${r.checkInTime}, ${r.date}`,
                          })
                        }
                      />
                    )}
                    <div>
                      <p className="font-semibold tabular-nums">{r.checkInTime}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          r.checkInStatus === 'TERLAMBAT'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {r.checkInStatus === 'TERLAMBAT' ? 'Terlambat' : 'Tepat waktu'}
                      </span>
                      {r.inLocationName && (
                        <p className="mt-0.5 text-xs text-gray-400">{r.inLocationName}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.checkOutTime ? (
                    <div className="flex items-center gap-2">
                      {r.checkOutPhoto && (
                        <PhotoThumb
                          name={r.checkOutPhoto}
                          onClick={() =>
                            setPhotoModal({
                              src: `/api/photos/${r.checkOutPhoto}`,
                              caption: `${r.employeeName} — pulang ${r.checkOutTime}, ${r.date}`,
                            })
                          }
                        />
                      )}
                      <div>
                        <p className="font-semibold tabular-nums">{r.checkOutTime}</p>
                        {r.outLocationName && (
                          <p className="mt-0.5 text-xs text-gray-400">{r.outLocationName}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                      Masih bekerja
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{r.duration ?? '—'}</td>
                <td className="px-4 py-3">
                  {r.pointCount > 1 ? (
                    <button
                      className="font-semibold text-brand-600 hover:underline"
                      onClick={() => setTrackModal(r)}
                    >
                      Lihat rute ({r.pointCount} titik)
                    </button>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {photoModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPhotoModal(null)}
        >
          <div className="max-w-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoModal.src} alt={photoModal.caption} className="w-full rounded-xl" />
            <p className="mt-2 text-center font-semibold text-white">{photoModal.caption}</p>
            <p className="mt-1 text-center text-sm text-gray-300">Klik di mana saja untuk menutup</p>
          </div>
        </div>
      )}

      {trackModal && <TrackModal record={trackModal} onClose={() => setTrackModal(null)} />}
    </div>
  );
}

function PhotoThumb({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title="Lihat foto selfie">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/photos/${name}`}
        alt="Selfie absen"
        className="h-12 w-12 rounded-lg border object-cover"
      />
    </button>
  );
}

/** Peta rute perjalanan karyawan pada satu hari kerja. */
function TrackModal({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [info, setInfo] = useState('Memuat rute…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current).setView([-2.5, 118], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      mapRef.current = map;

      let data: { ok?: boolean; points?: unknown } | null = null;
      try {
        const res = await fetch(`/api/admin/attendance/${record.id}/track`);
        data = await res.json();
      } catch {
        data = null;
      }
      if (cancelled) return;
      if (!data?.ok) {
        setInfo('Gagal memuat rute. Tutup lalu coba lagi.');
        return;
      }
      const pts = (data.points as { lat: number; lng: number }[]).map(
        (p) => [p.lat, p.lng] as [number, number]
      );
      if (pts.length === 0) {
        setInfo('Tidak ada titik pelacakan.');
        return;
      }
      const line = L.polyline(pts, { color: '#1d4ed8', weight: 4, opacity: 0.8 }).addTo(map);
      L.circleMarker(pts[0], { radius: 8, color: '#15803d', fillColor: '#22c55e', fillOpacity: 1 })
        .bindTooltip('Absen masuk')
        .addTo(map);
      L.circleMarker(pts[pts.length - 1], {
        radius: 8,
        color: '#b45309',
        fillColor: '#f59e0b',
        fillOpacity: 1,
      })
        .bindTooltip('Titik terakhir')
        .addTo(map);
      map.fitBounds(line.getBounds().pad(0.3), { maxZoom: 17 });
      setInfo(`${pts.length} titik posisi selama jam kerja.`);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [record.id]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">
              Rute {record.employeeName} — {record.date}
            </h3>
            <p className="text-sm text-gray-500">{info}</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
        <div ref={containerRef} className="h-[60vh] rounded-lg" />
      </div>
    </div>
  );
}
