'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CameraCapture from '@/components/CameraCapture';
import { distanceMeters } from '@/lib/geo';

interface LocationInfo {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

interface Me {
  employee: { id: number; name: string; nik: string };
  status: 'BELUM_MASUK' | 'BEKERJA' | 'SELESAI';
  today: {
    checkInAt: string;
    checkInTime: string;
    checkInStatus: string;
    checkOutAt: string | null;
    checkOutTime: string | null;
  } | null;
  locations: LocationInfo[];
  settings: {
    trackingIntervalS: number;
    requireCheckoutInArea: boolean;
    workStart: string;
    timezone: string;
  };
}

interface Position {
  lat: number;
  lng: number;
  acc: number;
}

type ResultScreen = { kind: 'success' | 'error'; title: string; message: string } | null;

export default function EmployeeApp() {
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const posRef = useRef<Position | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [camera, setCamera] = useState<'in' | 'out' | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ResultScreen>(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/employee/me');
      if (res.ok) {
        setMe(await res.json());
      } else {
        setMe(null);
      }
    } catch {
      setMe(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Pantau posisi GPS selama halaman terbuka (hanya di perangkat, belum dikirim ke server).
  useEffect(() => {
    if (!me) return;
    if (!('geolocation' in navigator)) {
      setGpsError('HP ini tidak mendukung GPS.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const next = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: Math.round(p.coords.accuracy),
        };
        posRef.current = next;
        setPos(next);
        setGpsError(null);
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Buka pengaturan HP dan izinkan akses lokasi untuk aplikasi ini.'
            : 'Sinyal GPS belum ditemukan. Pastikan GPS aktif dan Anda berada di luar ruangan.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [me?.employee?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kirim posisi ke server HANYA selama status BEKERJA (privasi:
  // begitu absen pulang, pengiriman berhenti dan server juga menolak).
  useEffect(() => {
    if (me?.status !== 'BEKERJA') return;
    const intervalMs = Math.max(5, me.settings.trackingIntervalS) * 1000;
    let stopped = false;

    const sendPing = async () => {
      const p = posRef.current;
      if (!p || stopped) return;
      try {
        const res = await fetch('/api/employee/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        });
        const data = await res.json().catch(() => null);
        if (data && data.tracking === false) {
          stopped = true;
          loadMe();
        }
      } catch {
        // koneksi putus — coba lagi pada interval berikutnya
      }
    };

    sendPing();
    const id = setInterval(sendPing, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [me?.status, me?.settings.trackingIntervalS, loadMe]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitAttendance(kind: 'in' | 'out', photo: string) {
    const p = posRef.current;
    if (!p) return;
    setSending(true);
    try {
      const res = await fetch(kind === 'in' ? '/api/employee/checkin' : '/api/employee/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, photo }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setCamera(null);
        setResult(
          kind === 'in'
            ? {
                kind: 'success',
                title: `Absen masuk berhasil — ${data.time}`,
                message: `Lokasi: ${data.locationName}. Selamat bekerja! Posisi Anda akan terpantau sampai absen pulang.`,
              }
            : {
                kind: 'success',
                title: `Absen pulang berhasil — ${data.time}`,
                message:
                  'Pelacakan lokasi sudah DIMATIKAN. Terima kasih untuk hari ini, hati-hati di jalan!',
              }
        );
        await loadMe();
      } else {
        setCamera(null);
        setResult({
          kind: 'error',
          title: kind === 'in' ? 'Absen masuk gagal' : 'Absen pulang gagal',
          message: data?.error ?? 'Terjadi gangguan. Coba lagi.',
        });
      }
    } catch {
      setCamera(null);
      setResult({
        kind: 'error',
        title: 'Tidak ada koneksi internet',
        message: 'Periksa jaringan HP Anda, lalu tekan tombol absen sekali lagi.',
      });
    } finally {
      setSending(false);
    }
  }

  function startAbsen(kind: 'in' | 'out') {
    if (!pos) {
      setResult({
        kind: 'error',
        title: 'Lokasi belum ditemukan',
        message:
          gpsError ??
          'Tunggu beberapa detik sampai tanda lokasi berwarna hijau, lalu tekan tombol lagi.',
      });
      return;
    }
    setCamera(kind);
  }

  async function logout() {
    if (!window.confirm('Keluar dari aplikasi? Anda perlu memasukkan Nomor Induk dan PIN lagi.'))
      return;
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setMe(null);
  }

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-2xl font-semibold text-gray-500">Memuat…</p>
      </main>
    );
  }

  if (!me) return <LoginScreen onLoggedIn={loadMe} />;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-base text-gray-500">Selamat datang,</p>
          <h1 className="text-2xl font-extrabold leading-tight">{me.employee.name}</h1>
        </div>
        <button onClick={logout} className="rounded-lg px-3 py-2 text-base font-semibold text-gray-400">
          Keluar
        </button>
      </header>

      <Clock timezone={me.settings.timezone} />

      <GpsBadge pos={pos} gpsError={gpsError} locations={me.locations} />

      <div className="mt-4 flex-1">
        {me.status === 'BELUM_MASUK' && (
          <>
            <StatusCard color="gray" title="Anda belum absen masuk hari ini">
              Tekan tombol hijau di bawah untuk absen masuk.
            </StatusCard>
            <button className="btn-huge mt-5 bg-brand-600" onClick={() => startAbsen('in')}>
              ☀️ ABSEN MASUK
            </button>
          </>
        )}

        {me.status === 'BEKERJA' && (
          <>
            <StatusCard color="green" title={`Masuk jam ${me.today?.checkInTime}`}>
              {me.today?.checkInStatus === 'TERLAMBAT' ? 'Status: Terlambat. ' : 'Status: Tepat waktu. '}
              Selamat bekerja!
            </StatusCard>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-blue-800">
              <span className="tracking-dot text-2xl">🔵</span>
              <p className="text-base leading-snug">
                <strong>Posisi Anda sedang terpantau</strong> selama jam kerja. Pemantauan berhenti
                otomatis setelah Anda absen pulang.
              </p>
            </div>
            <button className="btn-huge mt-5 bg-orange-500" onClick={() => startAbsen('out')}>
              🌙 ABSEN PULANG
            </button>
          </>
        )}

        {me.status === 'SELESAI' && (
          <>
            <StatusCard color="blue" title="Absensi hari ini sudah selesai">
              Masuk {me.today?.checkInTime} — Pulang {me.today?.checkOutTime}. Sampai jumpa besok!
            </StatusCard>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-gray-100 p-4 text-gray-600">
              <span className="text-2xl">🔒</span>
              <p className="text-base leading-snug">
                <strong>Pelacakan lokasi sudah mati.</strong> Posisi Anda tidak lagi terlihat oleh
                kantor.
              </p>
            </div>
          </>
        )}
      </div>

      {camera && (
        <CameraCapture
          title={camera === 'in' ? 'Selfie Absen Masuk' : 'Selfie Absen Pulang'}
          accentClass={camera === 'in' ? 'bg-brand-600' : 'bg-orange-500'}
          sending={sending}
          onConfirm={(photo) => submitAttendance(camera, photo)}
          onCancel={() => setCamera(null)}
        />
      )}

      {result && <ResultOverlay result={result} onClose={() => setResult(null)} />}
    </main>
  );
}

function Clock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(now)
    .replace(/\./g, ':');
  const date = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  return (
    <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
      <p className="text-5xl font-extrabold tabular-nums tracking-tight">{time}</p>
      <p className="mt-1 text-lg text-gray-500">{date}</p>
    </div>
  );
}

function GpsBadge({
  pos,
  gpsError,
  locations,
}: {
  pos: Position | null;
  gpsError: string | null;
  locations: LocationInfo[];
}) {
  let icon = '🛰️';
  let cls = 'bg-yellow-50 text-yellow-800';
  let text = 'Mencari sinyal GPS… pastikan izin lokasi diizinkan.';

  if (gpsError) {
    icon = '⚠️';
    cls = 'bg-red-50 text-red-700';
    text = gpsError;
  } else if (pos && locations.length > 0) {
    let nearest = locations[0];
    let nearestD = Infinity;
    for (const loc of locations) {
      const d = distanceMeters(pos.lat, pos.lng, loc.lat, loc.lng);
      if (d < nearestD) {
        nearest = loc;
        nearestD = d;
      }
    }
    if (nearestD <= nearest.radius_m) {
      icon = '✅';
      cls = 'bg-green-50 text-green-800';
      text = `Anda di dalam area: ${nearest.name}. Siap untuk absen.`;
    } else {
      icon = '📍';
      cls = 'bg-orange-50 text-orange-800';
      const jarak =
        nearestD >= 1000
          ? `${(nearestD / 1000).toFixed(1).replace('.', ',')} km`
          : `${Math.round(nearestD)} meter`;
      text = `Anda di luar area absen. Jarak ${jarak} dari ${nearest.name}.`;
    }
  } else if (pos) {
    icon = '✅';
    cls = 'bg-green-50 text-green-800';
    text = 'Lokasi ditemukan.';
  }

  return (
    <div className={`mt-3 flex items-start gap-3 rounded-2xl p-4 ${cls}`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-base font-medium leading-snug">{text}</p>
    </div>
  );
}

function StatusCard({
  color,
  title,
  children,
}: {
  color: 'gray' | 'green' | 'blue';
  title: string;
  children: React.ReactNode;
}) {
  const map = {
    gray: 'bg-white text-gray-800',
    green: 'bg-brand-50 text-brand-700 border border-brand-100',
    blue: 'bg-blue-50 text-blue-900',
  };
  return (
    <div className={`rounded-3xl p-5 shadow-sm ${map[color]}`}>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-1 text-lg leading-snug">{children}</p>
    </div>
  );
}

function ResultOverlay({
  result,
  onClose,
}: {
  result: NonNullable<ResultScreen>;
  onClose: () => void;
}) {
  const success = result.kind === 'success';
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center text-white ${
        success ? 'bg-brand-600' : 'bg-red-600'
      }`}
    >
      <span className="text-8xl">{success ? '✔' : '✖'}</span>
      <h2 className="mt-6 text-3xl font-extrabold leading-tight">{result.title}</h2>
      <p className="mt-4 text-xl leading-relaxed">{result.message}</p>
      <button
        onClick={onClose}
        className="btn-huge mt-10 max-w-xs bg-white !text-gray-900"
        autoFocus
      >
        OK
      </button>
    </div>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [nik, setNik] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/employee-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik, pin }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        onLoggedIn();
      } else {
        setError(data?.error ?? 'Gagal masuk. Coba lagi.');
      }
    } catch {
      setError('Tidak ada koneksi internet. Periksa jaringan HP Anda.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="text-center">
        <span className="text-6xl">🕐</span>
        <h1 className="mt-3 text-3xl font-extrabold">Absensi BBG</h1>
        <p className="mt-2 text-lg text-gray-500">
          Masuk sekali saja — setelah itu langsung bisa absen setiap hari.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="nik" className="mb-2 block text-lg font-bold">
            Nomor Induk Karyawan
          </label>
          <input
            id="nik"
            className="input-big"
            inputMode="numeric"
            autoComplete="username"
            placeholder="contoh: 1001"
            value={nik}
            onChange={(e) => setNik(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="pin" className="mb-2 block text-lg font-bold">
            PIN
          </label>
          <input
            id="pin"
            className="input-big"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="PIN dari admin"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-lg font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        <button type="submit" className="btn-huge bg-brand-600" disabled={busy}>
          {busy ? 'MEMPROSES…' : 'MASUK'}
        </button>
      </form>

      <p className="mt-6 text-center text-base text-gray-400">
        Lupa PIN? Hubungi admin kantor untuk diatur ulang.
      </p>
    </main>
  );
}
