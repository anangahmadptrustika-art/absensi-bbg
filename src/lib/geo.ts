/** Jarak antara dua koordinat dalam meter (rumus haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface GeofenceLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface GeofenceResult {
  inside: boolean;
  /** Lokasi yang cocok (jika di dalam) atau lokasi terdekat (jika di luar). */
  location: GeofenceLocation | null;
  distance_m: number;
}

/**
 * Cek apakah koordinat berada di dalam salah satu lokasi yang diizinkan.
 * Jika di dalam beberapa lokasi sekaligus, dipilih yang jaraknya paling dekat.
 * Jika di luar semua lokasi, kembalikan lokasi terdekat beserta jaraknya.
 */
export function checkGeofence(
  lat: number,
  lng: number,
  locations: GeofenceLocation[]
): GeofenceResult {
  let insideBest: GeofenceLocation | null = null;
  let insideDist = Infinity;
  let nearest: GeofenceLocation | null = null;
  let nearestDist = Infinity;
  for (const loc of locations) {
    const d = distanceMeters(lat, lng, loc.lat, loc.lng);
    if (d <= loc.radius_m && d < insideDist) {
      insideBest = loc;
      insideDist = d;
    }
    if (d < nearestDist) {
      nearest = loc;
      nearestDist = d;
    }
  }
  if (insideBest) {
    return { inside: true, location: insideBest, distance_m: Math.round(insideDist) };
  }
  return { inside: false, location: nearest, distance_m: Math.round(nearestDist) };
}

export function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng as number) <= 180
  );
}
