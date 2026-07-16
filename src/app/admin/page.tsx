'use client';

import { useCallback, useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import LiveMapTab from '@/components/admin/LiveMapTab';
import LocationsTab from '@/components/admin/LocationsTab';
import EmployeesTab from '@/components/admin/EmployeesTab';
import AttendanceTab from '@/components/admin/AttendanceTab';
import SettingsTab from '@/components/admin/SettingsTab';

type Tab = 'live' | 'attendance' | 'employees' | 'locations' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: '🗺️ Peta Live' },
  { id: 'attendance', label: '📋 Absensi' },
  { id: 'employees', label: '👷 Karyawan' },
  { id: 'locations', label: '📍 Lokasi' },
  { id: 'settings', label: '⚙️ Pengaturan' },
];

export default function AdminPage() {
  const [booting, setBooting] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<Tab>('live');

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/me');
      setLoggedIn(res.ok);
    } catch {
      setLoggedIn(false);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setLoggedIn(false);
  }

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">Memuat…</p>
      </main>
    );
  }

  if (!loggedIn) return <AdminLogin onLoggedIn={check} />;

  return (
    <main className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-extrabold">
            🕐 Dashboard Absensi <span className="text-brand-600">BBG</span>
          </h1>
          <button onClick={logout} className="btn-secondary !py-1.5 text-sm">
            Keluar
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id
                  ? 'border-b-2 border-brand-600 bg-brand-50 text-brand-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl p-4">
        {tab === 'live' && <LiveMapTab />}
        {tab === 'attendance' && <AttendanceTab />}
        {tab === 'employees' && <EmployeesTab />}
        {tab === 'locations' && <LocationsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </main>
  );
}

function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        onLoggedIn();
      } else {
        setError(data?.error ?? 'Gagal masuk.');
      }
    } catch {
      setError('Tidak ada koneksi. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-extrabold">
          🕐 Dashboard Absensi <span className="text-brand-600">BBG</span>
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">Masuk sebagai admin</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-username" className="label-admin">
              Username
            </label>
            <input
              id="admin-username"
              className="input-admin"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="label-admin">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              className="input-admin"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="font-semibold text-red-600">⚠️ {error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Memproses…' : 'Masuk'}
          </button>
        </div>
      </form>
    </main>
  );
}
