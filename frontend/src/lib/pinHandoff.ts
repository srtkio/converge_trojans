// Hands a spot from the Map tab ("Report something here") to the Report form, in memory only.
// A module variable instead of a URL parameter: no useSearchParams (which would need Suspense
// with cacheComponents), and the position never lands in the address bar or history.

export type LatLng = { lat: number; lng: number };

let pending: LatLng | null = null;

export function putPin(p: LatLng): void {
  pending = { lat: p.lat, lng: p.lng };
}

/** The handed-over spot, once: the next call returns null. */
export function takePin(): LatLng | null {
  const p = pending;
  pending = null;
  return p;
}

/** Six decimals (about 10 cm) and a longitude inside ±180, which the backend requires. */
export function tidyLatLng(lat: number, lng: number): LatLng {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  const r = (x: number) => Math.round(x * 1e6) / 1e6;
  return { lat: r(Math.max(-90, Math.min(90, lat))), lng: r(wrapped) };
}
