'use client';

import { useCallback, useEffect, useState } from 'react';
import MapPicker from './MapPicker';

interface LocationRow {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  active: number;
  employee_count: number;
}

interface FormState {
  id: number | null;
  name: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  active: boolean;
}

const EMPTY: FormState = { id: null, name: '', lat: null, lng: null, radius_m: 100, active: true };

/** Kelola lokasi absen: titik di peta + radius. Karyawan hanya bisa absen di dalam area ini. */
export default function LocationsTab() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/locations');
      const data = await res.json().catch(() => null);
      if (data?.ok) setRows(data.locations);
    } catch {
      setMsg('Gagal memuat daftar lokasi. Periksa koneksi lalu muat ulang halaman.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        form.id ? `/api/admin/locations/${form.id}` : '/api/admin/locations',
        {
          method: form.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setForm(null);
        await load();
      } else {
        setMsg(data?.error ?? 'Gagal menyimpan.');
      }
    } catch {
      setMsg('Tidak ada koneksi. Periksa jaringan lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: LocationRow) {
    if (
      !window.confirm(
        `Hapus lokasi "${row.name}"? Karyawan tidak akan bisa absen di lokasi ini lagi.`
      )
    )
      return;
    try {
      await fetch(`/api/admin/locations/${row.id}`, { method: 'DELETE' });
    } catch {
      setMsg('Tidak ada koneksi. Lokasi belum terhapus — coba lagi.');
    }
    await load();
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setForm((f) => (f ? { ...f, lat: p.coords.latitude, lng: p.coords.longitude } : f)),
      () => setMsg('Tidak bisa mengambil posisi Anda. Klik peta secara manual.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Lokasi Absen</h2>
          <p className="text-sm text-gray-500">
            Karyawan hanya bisa absen jika berada di dalam radius lokasi yang aktif.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
          + Tambah Lokasi
        </button>
      </div>

      {msg && !form && (
        <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-600">{msg}</p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Nama Lokasi</th>
              <th className="px-4 py-3">Koordinat</th>
              <th className="px-4 py-3">Radius</th>
              <th className="px-4 py-3">Karyawan Ditugaskan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Belum ada lokasi. Tambahkan lokasi absen pertama Anda.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3 tabular-nums text-gray-500">
                  {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                </td>
                <td className="px-4 py-3">{r.radius_m} m</td>
                <td className="px-4 py-3">
                  {r.employee_count > 0 ? `${r.employee_count} orang` : 'Semua (tanpa penugasan)'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      r.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {r.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="mr-2 font-semibold text-brand-600 hover:underline"
                    onClick={() =>
                      setForm({
                        id: r.id,
                        name: r.name,
                        lat: r.lat,
                        lng: r.lng,
                        radius_m: r.radius_m,
                        active: !!r.active,
                      })
                    }
                  >
                    Ubah
                  </button>
                  <button className="font-semibold text-red-600 hover:underline" onClick={() => remove(r)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-6 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">{form.id ? 'Ubah Lokasi' : 'Tambah Lokasi'}</h3>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="loc-name" className="label-admin">Nama lokasi</label>
                <input
                  id="loc-name"
                  className="input-admin"
                  placeholder="contoh: Kebun Blok A"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <MapPicker
                lat={form.lat}
                lng={form.lng}
                radiusM={form.radius_m}
                onPick={(lat, lng) => setForm((f) => (f ? { ...f, lat, lng } : f))}
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor="loc-lat" className="label-admin">Latitude</label>
                  <input
                    id="loc-lat"
                    className="input-admin"
                    type="number"
                    step="any"
                    value={form.lat ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, lat: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="loc-lng" className="label-admin">Longitude</label>
                  <input
                    id="loc-lng"
                    className="input-admin"
                    type="number"
                    step="any"
                    value={form.lng ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, lng: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="loc-radius" className="label-admin">Radius (meter)</label>
                  <input
                    id="loc-radius"
                    className="input-admin"
                    type="number"
                    min={20}
                    max={10000}
                    value={form.radius_m}
                    onChange={(e) => setForm({ ...form, radius_m: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    Aktif
                  </label>
                </div>
              </div>

              <button className="btn-secondary" onClick={useMyLocation}>
                📍 Gunakan lokasi saya sekarang
              </button>

              {msg && <p className="font-semibold text-red-600">{msg}</p>}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>
                  Batal
                </button>
                <button className="btn-primary" onClick={save} disabled={busy}>
                  {busy ? 'Menyimpan…' : 'Simpan Lokasi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
