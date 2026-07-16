'use client';

import { useEffect, useState } from 'react';

interface SettingsForm {
  work_start: string;
  late_tolerance_min: string;
  tracking_interval_s: string;
  timezone: string;
  require_checkout_in_area: boolean;
}

interface TzOption {
  id: string;
  label: string;
}

export default function SettingsTab() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [timezones, setTimezones] = useState<TzOption[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setForm({
            work_start: d.settings.work_start,
            late_tolerance_min: d.settings.late_tolerance_min,
            tracking_interval_s: d.settings.tracking_interval_s,
            timezone: d.settings.timezone,
            require_checkout_in_area: d.settings.require_checkout_in_area === '1',
          });
          setTimezones(d.timezones);
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    if (!form) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          late_tolerance_min: Number(form.late_tolerance_min),
          tracking_interval_s: Number(form.tracking_interval_s),
        }),
      });
      const data = await res.json().catch(() => null);
      setMsg(
        res.ok && data?.ok
          ? { ok: true, text: 'Pengaturan tersimpan.' }
          : { ok: false, text: data?.error ?? 'Gagal menyimpan.' }
      );
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setPwMsg({ ok: true, text: 'Password berhasil diganti.' });
        setOldPassword('');
        setNewPassword('');
      } else {
        setPwMsg({ ok: false, text: data?.error ?? 'Gagal mengganti password.' });
      }
    } finally {
      setPwBusy(false);
    }
  }

  if (!form) return <p className="text-gray-500">Memuat pengaturan…</p>;

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Aturan Absensi</h2>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="set-workstart" className="label-admin">Jam masuk kerja</label>
              <input
                id="set-workstart"
                type="time"
                className="input-admin"
                value={form.work_start}
                onChange={(e) => setForm({ ...form, work_start: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="set-tolerance" className="label-admin">Toleransi terlambat (menit)</label>
              <input
                id="set-tolerance"
                type="number"
                min={0}
                max={480}
                className="input-admin"
                value={form.late_tolerance_min}
                onChange={(e) => setForm({ ...form, late_tolerance_min: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label htmlFor="set-timezone" className="label-admin">Zona waktu</label>
            <select
              id="set-timezone"
              className="input-admin"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {timezones.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5"
              checked={form.require_checkout_in_area}
              onChange={(e) => setForm({ ...form, require_checkout_in_area: e.target.checked })}
            />
            <span>
              Absen pulang wajib di dalam area lokasi
              <span className="block font-normal text-gray-500">
                Jika dimatikan, karyawan boleh absen pulang dari mana saja.
              </span>
            </span>
          </label>
          <div>
            <label htmlFor="set-interval" className="label-admin">Interval pelacakan posisi (detik)</label>
            <input
              id="set-interval"
              type="number"
              min={5}
              max={600}
              className="input-admin"
              value={form.tracking_interval_s}
              onChange={(e) => setForm({ ...form, tracking_interval_s: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">
              Semakin kecil semakin sering posisi diperbarui (baterai HP karyawan lebih boros).
            </p>
          </div>
          {msg && (
            <p className={`font-semibold ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>
              {msg.text}
            </p>
          )}
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Ganti Password Admin</h2>
          <form onSubmit={changePassword} className="mt-4 space-y-3">
            <div>
              <label htmlFor="set-oldpw" className="label-admin">Password lama</label>
              <input
                id="set-oldpw"
                type="password"
                className="input-admin"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="set-newpw" className="label-admin">Password baru (minimal 8 karakter)</label>
              <input
                id="set-newpw"
                type="password"
                className="input-admin"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            {pwMsg && (
              <p className={`font-semibold ${pwMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
                {pwMsg.text}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={pwBusy}>
              {pwBusy ? 'Memproses…' : 'Ganti Password'}
            </button>
          </form>
        </div>

        <div className="rounded-xl bg-blue-50 p-5 text-sm leading-relaxed text-blue-900">
          <h3 className="font-bold">🔒 Cara kerja privasi pelacakan</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Posisi karyawan hanya dikirim <strong>setelah absen masuk</strong>.</li>
            <li>
              Begitu karyawan <strong>absen pulang</strong>, aplikasi berhenti mengirim posisi dan
              server juga <strong>menolak</strong> data posisi baru.
            </li>
            <li>Karyawan yang sudah pulang otomatis hilang dari Peta Live.</li>
            <li>Riwayat rute selama jam kerja tetap tersimpan untuk keperluan rekap.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
