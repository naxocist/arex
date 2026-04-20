export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '-';
  const s = new Date(start).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  if (!end) return s;
  const e = new Date(end).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  return s === e ? s : `${s} - ${e}`;
}

export function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function buildGoogleMapsDirectionsUrl(waypoints: { lat: number; lng: number }[]): string {
  if (waypoints.length < 2) return '';
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  const mid = waypoints.slice(1, -1).map((w) => `${w.lat},${w.lng}`).join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  return mid ? `${base}&waypoints=${mid}` : base;
}

export function isoToDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}
