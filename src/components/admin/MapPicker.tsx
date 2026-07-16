'use client';

import { useEffect, useRef } from 'react';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';

interface Props {
  lat: number | null;
  lng: number | null;
  radiusM: number;
  onPick: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: [number, number] = [-2.5, 118]; // tengah Indonesia
const DEFAULT_ZOOM = 5;

/** Peta kecil untuk memilih titik lokasi absen: klik peta = pindahkan titik. */
export default function MapPicker({ lat, lng, radiusM, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current).setView(
        lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER,
        lat != null ? 16 : DEFAULT_ZOOM
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      map.on('click', (e) => {
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perbarui penanda + lingkaran radius saat nilai berubah.
  useEffect(() => {
    (async () => {
      const L = await import('leaflet');
      const map = mapRef.current;
      if (!map) return;
      if (lat == null || lng == null) {
        markerRef.current?.remove();
        circleRef.current?.remove();
        markerRef.current = null;
        circleRef.current = null;
        return;
      }
      const icon = L.divIcon({ className: '', html: '<div class="loc-marker">📍</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        map.setView([lat, lng], Math.max(map.getZoom(), 16));
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (!circleRef.current) {
        circleRef.current = L.circle([lat, lng], {
          radius: radiusM,
          color: '#15803d',
          fillColor: '#22c55e',
          fillOpacity: 0.15,
        }).addTo(map);
      } else {
        circleRef.current.setLatLng([lat, lng]);
        circleRef.current.setRadius(radiusM);
      }
    })();
  }, [lat, lng, radiusM]);

  return (
    <div>
      <div ref={containerRef} className="h-72 w-full rounded-lg border border-gray-300" />
      <p className="mt-1 text-sm text-gray-500">
        Klik pada peta untuk menentukan titik lokasi absen. Lingkaran hijau = area yang diizinkan.
      </p>
    </div>
  );
}
