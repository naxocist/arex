const distanceCache = new Map<string, number | null>();

export async function fetchRoadDistanceKm(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): Promise<number | null> {
  const key = `${fromLat},${fromLng}->${toLat},${toLng}`;
  if (distanceCache.has(key)) return distanceCache.get(key)!;
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
      { headers: { Referer: typeof window !== 'undefined' ? window.location.origin : '' } },
    );
    if (!res.ok) throw new Error('OSRM error');
    const data = await res.json() as { routes?: { distance?: number }[] };
    const km = data.routes?.[0]?.distance != null ? data.routes[0].distance / 1000 : null;
    distanceCache.set(key, km);
    return km;
  } catch {
    distanceCache.set(key, null);
    return null;
  }
}

export function formatKm(km: number): string {
  return `${km.toFixed(1)} กม.`;
}

export function buildGoogleMapsDirectionsUrl(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}`;
}
