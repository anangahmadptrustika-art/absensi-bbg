'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';

interface WorkingEmployee {
  attendanceId: number;
  employeeId: number;
  name: string;
  nik: string;
  checkInTime: string;
  checkInStatus: string;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  acc: number | null;
  lastSeenAgoS: number | null;
}

interface LocationRow {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  active: number;
}

const POLL_MS = 5000;
const STALE_AFTER_S = 120; // > 2 menit tanpa kabar → penanda abu-abu

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function agoLabel(s: number | null): string {
  if (s == null) return 'belum ada sinyal';
  if (s < 15) return 'baru saja';
  if (s < 60) return `${s} detik lalu`;
  return `${Math.floor(s / 60)} menit lalu`;
}

/**
 * Peta pantauan langsung. Hanya karyawan yang SEDANG bekerja yang tampil;
 * yang sudah absen pulang otomatis hilang dari peta (privasi).
 */
export default function LiveMapTab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const fittedRef = useRef(false);
  // respons poll lama tidak boleh menimpa yang lebih baru (bisa memunculkan
  // kembali penanda karyawan yang sudah absen pulang)
  const pollSeqRef = useRef(0);
  const [working, setWorking] = useState<WorkingEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Inisialisasi peta + lingkaran lokasi absen.
  useEffect(() => {
    let cancelled = false;
    const circles: Circle[] = [];
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current).setView([-2.5, 118], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      mapRef.current = map;

      try {
        const res = await fetch('/api/admin/locations');
        const data = await res.json();
        if (!cancelled && data?.ok) {
          for (const loc of (data.locations as LocationRow[]).filter((l) => l.active)) {
            circles.push(
              L.circle([loc.lat, loc.lng], {
                radius: loc.radius_m,
                color: '#15803d',
                fillColor: '#22c55e',
                fillOpacity: 0.08,
                weight: 1.5,
              })
                .bindTooltip(loc.name)
                .addTo(map)
            );
          }
          if (circles.length > 0 && !fittedRef.current) {
            const group = L.featureGroup(circles);
            map.fitBounds(group.getBounds().pad(0.4));
          }
        }
      } catch {
        /* lokasi gagal dimuat — peta tetap jalan */
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      fittedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++pollSeqRef.current;
    try {
      const res = await fetch('/api/admin/live');
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (seq !== pollSeqRef.current) return; // sudah ada poll yang lebih baru
      setWorking(data.working);
      setError(null);

      const L = await import('leaflet');
      const map = mapRef.current;
      if (!map) return;

      const seen = new Set<number>();
      for (const w of data.working as WorkingEmployee[]) {
        if (w.lat == null || w.lng == null) continue;
        seen.add(w.employeeId);
        const stale = (w.lastSeenAgoS ?? 0) > STALE_AFTER_S;
        const icon = L.divIcon({
          className: '',
          html: `<div class="emp-marker${stale ? ' stale' : ''}">${initials(w.name)}</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
        const popup = `<strong>${escapeHtml(w.name)}</strong><br/>Masuk ${escapeHtml(w.checkInTime)} (${escapeHtml(w.checkInStatus)})<br/>Sinyal: ${agoLabel(w.lastSeenAgoS)}`;
        const existing = markersRef.current.get(w.employeeId);
        if (existing) {
          existing.setLatLng([w.lat, w.lng]);
          existing.setIcon(icon);
          existing.setPopupContent(popup);
        } else {
          const m = L.marker([w.lat, w.lng], { icon }).bindPopup(popup).addTo(map);
          markersRef.current.set(w.employeeId, m);
        }
      }
      // hapus penanda karyawan yang sudah absen pulang
      for (const [id, marker] of markersRef.current) {
        if (!seen.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }
      if (!fittedRef.current && seen.size > 0) {
        fittedRef.current = true;
        const group = L.featureGroup([...markersRef.current.values()]);
        map.fitBounds(group.getBounds().pad(0.4), { maxZoom: 16 });
      }
    } catch {
      if (seq === pollSeqRef.current) setError('Gagal memuat data live. Mencoba lagi…');
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  function focusOn(w: WorkingEmployee) {
    if (w.lat == null || w.lng == null || !mapRef.current) return;
    mapRef.current.setView([w.lat, w.lng], 17);
    markersRef.current.get(w.employeeId)?.openPopup();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Sedang Bekerja ({working.length})</h2>
        <p className="mt-1 text-sm text-gray-500">
          Hanya karyawan yang belum absen pulang yang bisa dipantau. Setelah absen pulang, posisi
          tidak dilacak lagi.
        </p>
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        <ul className="mt-3 space-y-2">
          {working.length === 0 && (
            <li className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
              Belum ada karyawan yang sedang bekerja.
            </li>
          )}
          {working.map((w) => (
            <li key={w.employeeId}>
              <button
                onClick={() => focusOn(w)}
                className="w-full rounded-lg border border-gray-200 p-3 text-left transition hover:border-brand-500 hover:bg-brand-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{w.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      w.checkInStatus === 'TERLAMBAT'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {w.checkInStatus === 'TERLAMBAT' ? 'Terlambat' : 'Tepat'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Masuk {w.checkInTime}
                  {w.locationName ? ` · ${w.locationName}` : ''}
                </p>
                <p className="text-sm text-gray-500">
                  {w.lat == null ? '📡 Belum ada sinyal posisi' : `📍 Sinyal ${agoLabel(w.lastSeenAgoS)}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div ref={containerRef} className="h-[70vh] min-h-[420px] rounded-xl shadow-sm" />
    </div>
  );
}
