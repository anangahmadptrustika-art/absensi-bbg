'use client';

import { useCallback, useEffect, useState } from 'react';

interface EmployeeRow {
  id: number;
  name: string;
  nik: string;
  location_id: number | null;
  location_name: string | null;
  active: number;
  today_in: string | null;
  today_out: string | null;
}

interface LocationOption {
  id: number;
  name: string;
}

interface FormState {
  id: number | null;
  name: string;
  nik: string;
  pin: string;
  location_id: number | null;
  active: boolean;
}

const EMPTY: FormState = { id: null, name: '', nik: '', pin: '', location_id: null, active: true };

export default function EmployeesTab() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [empRes, locRes] = await Promise.all([
        fetch('/api/admin/employees'),
        fetch('/api/admin/locations'),
      ]);
      const emp = await empRes.json().catch(() => null);
      const loc = await locRes.json().catch(() => null);
      if (emp?.ok) setRows(emp.employees);
      if (loc?.ok) setLocations(loc.locations);
    } catch {
      setMsg('Gagal memuat data. Periksa koneksi lalu muat ulang halaman.');
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
        form.id ? `/api/admin/employees/${form.id}` : '/api/admin/employees',
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

  async function remove(row: EmployeeRow) {
    if (
      !window.confirm(
        `Hapus karyawan "${row.name}"? SELURUH riwayat absensinya ikut terhapus. Jika hanya ingin menonaktifkan, pilih Ubah lalu hilangkan centang Aktif.`
      )
    )
      return;
    try {
      await fetch(`/api/admin/employees/${row.id}`, { method: 'DELETE' });
    } catch {
      setMsg('Tidak ada koneksi. Karyawan belum terhapus — coba lagi.');
    }
    await load();
  }

  function todayBadge(r: EmployeeRow) {
    if (r.today_out) return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">Selesai</span>;
    if (r.today_in) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Bekerja</span>;
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">Belum absen</span>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Karyawan</h2>
          <p className="text-sm text-gray-500">
            Karyawan masuk aplikasi dengan Nomor Induk + PIN. Tanpa penugasan lokasi, karyawan boleh
            absen di semua lokasi aktif.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
          + Tambah Karyawan
        </button>
      </div>

      {msg && !form && (
        <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-600">{msg}</p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Nomor Induk</th>
              <th className="px-4 py-3">Lokasi Tugas</th>
              <th className="px-4 py-3">Hari Ini</th>
              <th className="px-4 py-3">Status Akun</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Belum ada karyawan.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3 tabular-nums">{r.nik}</td>
                <td className="px-4 py-3">{r.location_name ?? 'Semua lokasi aktif'}</td>
                <td className="px-4 py-3">{todayBadge(r)}</td>
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
                        nik: r.nik,
                        pin: '',
                        location_id: r.location_id,
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
          <div className="mt-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">{form.id ? 'Ubah Karyawan' : 'Tambah Karyawan'}</h3>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="emp-name" className="label-admin">Nama lengkap</label>
                <input
                  id="emp-name"
                  className="input-admin"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="emp-nik" className="label-admin">Nomor Induk (untuk login)</label>
                  <input
                    id="emp-nik"
                    className="input-admin"
                    inputMode="numeric"
                    value={form.nik}
                    onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="emp-pin" className="label-admin">
                    PIN (4-8 digit){form.id ? ' — kosongkan jika tetap' : ''}
                  </label>
                  <input
                    id="emp-pin"
                    className="input-admin"
                    inputMode="numeric"
                    placeholder={form.id ? 'Tidak diganti' : 'contoh: 123456'}
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="emp-location" className="label-admin">Lokasi tugas</label>
                <select
                  id="emp-location"
                  className="input-admin"
                  value={form.location_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, location_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">Semua lokasi aktif</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Akun aktif (boleh login dan absen)
              </label>

              {msg && <p className="font-semibold text-red-600">{msg}</p>}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>
                  Batal
                </button>
                <button className="btn-primary" onClick={save} disabled={busy}>
                  {busy ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
