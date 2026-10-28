"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useEffectEvent, useRef } from "react";

import { CITIZEN_STATUS_LABEL, prefersReducedMotion } from "@/lib/citizen";
import { CATEGORY_ICON, STATUS_STYLE } from "@/lib/format";
import { tidyLatLng, type LatLng } from "@/lib/pinHandoff";
import type { Incident } from "@/lib/types";

/**
 * The citizen app's street map: OpenStreetMap tiles through Leaflet (free, no key).
 *
 * The tile source, attribution, tile settings, 6-failure fallback and cached divIcons are copied
 * from StreetMap.tsx (the operator map), which stays untouched. Unlike StreetMap this drives
 * Leaflet directly instead of through react-leaflet: Next keeps recently visited screens alive in
 * a hidden <Activity>, which runs effect cleanups on hide and effects again on show. react-leaflet's
 * MapContainer removes its map on hide and never builds a new one. Here the map is created in an
 * effect and removed in its cleanup, so a screen shown again simply gets a fresh map.
 *
 * Only loaded with ssr:false (through CitizenMapView), because Leaflet needs `window`.
 */

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// If tiles keep failing with none loaded, the screen switches to its list or landmark fallback.
const TILE_FAILURES_BEFORE_FALLBACK = 6;
const FOCUS_ZOOM = 17;

const iconCache = new Map<string, L.DivIcon>();

function cachedIcon(key: string, make: () => L.DivIcon): L.DivIcon {
  let icon = iconCache.get(key);
  if (!icon) {
    icon = make();
    iconCache.set(key, icon);
  }
  return icon;
}

function incidentIcon(i: Incident, selected: boolean) {
  const dot = STATUS_STYLE[i.status]?.dot ?? "#64748b";
  return cachedIcon(`inc|${i.status}|${i.category}|${selected}`, () => {
    const size = selected ? 40 : 32;
    return L.divIcon({
      className: "",
      // Only the inner element animates; Leaflet owns the transform of the icon's root.
      html: `<div class="cz-marker" style="width:${size}px;height:${size}px;border-radius:50%;background:${dot};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:${
        selected ? 18 : 15
      }px">${CATEGORY_ICON[i.category]}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  });
}

// The draggable "your spot" pin: a 44 px target with its tip on the point.
const PIN_HTML = `<div class="cz-pin" style="width:44px;height:52px;display:flex;justify-content:center;filter:drop-shadow(0 4px 6px rgba(15,23,42,.35))">
<svg viewBox="0 0 44 52" width="44" height="52" aria-hidden="true"><path d="M22 50s-16-14-16-27a16 16 0 0 1 32 0c0 13-16 27-16 27Z" fill="#047857" stroke="#fff" stroke-width="3"/><circle cx="22" cy="22" r="6" fill="#fff"/></svg></div>`;

function pinIcon() {
  return cachedIcon("pin", () => L.divIcon({ className: "", html: PIN_HTML, iconSize: [44, 52], iconAnchor: [22, 50] }));
}

const ME_STYLE: Omit<L.CircleMarkerOptions, "radius"> = { color: "#2563eb", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.12, interactive: false };
const ME_DOT: L.CircleMarkerOptions = { radius: 7, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1, interactive: false };

export type MapMe = { lat: number; lng: number; accuracy: number };

export type CitizenMapProps = {
  /** Where the map centres when it opens and whenever `viewKey` changes. */
  focus: LatLng;
  viewKey?: string | number;
  /** The citizen's spot. With `onPinChange` it can be dragged, or moved by tapping the map. */
  pin?: LatLng | null;
  onPinChange?: (p: LatLng) => void;
  /** The phone's position: a blue dot with an accuracy ring. */
  me?: MapMe | null;
  incidents?: Incident[];
  /** Points to frame once, when they first arrive after the map opens (with `focus`), unless the citizen already moved the map. */
  fitTo?: LatLng[];
  selectedId?: string | null;
  onIncidentTap?: (id: string) => void;
  onTilesFailed?: () => void;
  /** Accessible name of the map region. */
  label: string;
};

export default function CitizenMap({
  focus,
  viewKey,
  pin,
  onPinChange,
  me,
  incidents,
  fitTo,
  selectedId,
  onIncidentTap,
  onTilesFailed,
  label,
}: CitizenMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const pinRef = useRef<L.Marker | null>(null);
  const meRef = useRef<L.LayerGroup | null>(null);
  // The viewKey the current map was built for: its first recentre would be a no-op.
  const builtFor = useRef<string | number | undefined>(undefined);
  // Framed the nearby issues for this map yet? Reset on every (re)build; set by a fit or a user move.
  const framed = useRef(false);

  const startView = useEffectEvent(() => ({ focus, viewKey }));
  const tilesFailed = useEffectEvent(() => onTilesFailed?.());
  const placePin = useEffectEvent((p: LatLng) => onPinChange?.(p));
  const canPlace = useEffectEvent(() => !!onPinChange);
  const tapIncident = useEffectEvent((id: string) => onIncidentTap?.(id));

  // Build the map (again, after the screen was hidden and shown).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    const { focus: start, viewKey: key } = startView();
    builtFor.current = key;
    framed.current = false;
    const map = L.map(el, {
      center: [start.lat, start.lng],
      zoom: FOCUS_ZOOM,
      zoomSnap: 0.5,
      scrollWheelZoom: false,
      zoomAnimation: !reduced,
      fadeAnimation: !reduced,
      markerZoomAnimation: !reduced,
      inertia: !reduced,
    });
    map.on("dragstart zoomstart", (e: L.LeafletEvent) => {
      // Only real gestures count; programmatic setView/fitBounds don't carry an originalEvent.
      if ((e as L.LeafletEvent & { originalEvent?: Event }).originalEvent) framed.current = true;
    });
    const tiles = { loaded: 0, failed: 0, reported: false };
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, keepBuffer: 6, updateWhenZooming: false })
      .on("tileload", () => {
        tiles.loaded += 1;
      })
      .on("tileerror", () => {
        tiles.failed += 1;
        if (!tiles.reported && tiles.loaded === 0 && tiles.failed >= TILE_FAILURES_BEFORE_FALLBACK) {
          tiles.reported = true;
          tilesFailed();
        }
      })
      .addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!canPlace()) return;
      const w = e.latlng.wrap();
      placePin(tidyLatLng(w.lat, w.lng));
    });
    // Leaflet measures its box once; re-measure after layout settles so tiles fill it.
    const settle = setTimeout(() => map.invalidateSize(), 50);
    const obs = new ResizeObserver(() => map.invalidateSize());
    obs.observe(el);
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      clearTimeout(settle);
      obs.disconnect();
      // Stop pans in flight and let a zoom animation's pending end-callback bail out: the
      // screen can be hidden mid-gesture, and Leaflet's timers would then touch the removed map.
      map.stop();
      (map as unknown as { _animatingZoom: boolean })._animatingZoom = false;
      map.off();
      map.remove();
      mapRef.current = null;
      markers.clear();
      pinRef.current = null;
      meRef.current = null;
    };
  }, []);

  // Nearby issues. Markers are updated in place (no flicker on each poll); icons are cached.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const keep = new Set<string>();
    for (const i of incidents ?? []) {
      keep.add(i.id);
      const icon = incidentIcon(i, i.id === selectedId);
      const title = `${i.title}, ${CITIZEN_STATUS_LABEL[i.status] ?? "Open"}`;
      let m = markers.get(i.id);
      if (!m) {
        const id = i.id;
        m = L.marker([i.lat, i.lng], { icon, keyboard: true, title, alt: title, riseOnHover: true })
          .on("click", () => tapIncident(id))
          .addTo(map);
        markers.set(i.id, m);
      } else {
        const ll = m.getLatLng();
        if (ll.lat !== i.lat || ll.lng !== i.lng) m.setLatLng([i.lat, i.lng]);
        if (m.options.icon !== icon) m.setIcon(icon);
      }
      m.setZIndexOffset(i.id === selectedId ? 1000 : 500);
    }
    for (const [id, m] of markers) {
      if (!keep.has(id)) {
        m.remove();
        markers.delete(id);
      }
    }
  }, [incidents, selectedId]);

  // The citizen's pin: created once, moved in place, so a re-render never interrupts a drag.
  const pinLat = pin?.lat;
  const pinLng = pin?.lng;
  const draggable = !!onPinChange;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinLat === undefined || pinLng === undefined) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    let m = pinRef.current;
    if (!m) {
      m = L.marker([pinLat, pinLng], {
        icon: pinIcon(),
        draggable,
        autoPan: true,
        zIndexOffset: 200,
        keyboard: false,
        title: "Your spot",
        alt: "Your spot",
      }).addTo(map);
      const inner = () => m?.getElement()?.querySelector<HTMLElement>(".cz-pin");
      m.on("dragstart", () => {
        const el = inner();
        el?.classList.remove("cz-pin-drop");
        el?.classList.add("is-lifted");
      });
      m.on("dragend", (e) => {
        const el = inner();
        if (el) {
          el.classList.remove("is-lifted");
          void el.offsetWidth; // restart the drop animation
          el.classList.add("cz-pin-drop");
        }
        const w = (e.target as L.Marker).getLatLng().wrap();
        placePin(tidyLatLng(w.lat, w.lng));
      });
      pinRef.current = m;
    } else {
      const ll = m.getLatLng();
      if (ll.lat !== pinLat || ll.lng !== pinLng) m.setLatLng([pinLat, pinLng]);
    }
    if (draggable) m.dragging?.enable();
    else m.dragging?.disable();
  }, [pinLat, pinLng, draggable]);

  // The phone's position.
  const meLat = me?.lat;
  const meLng = me?.lng;
  const meAcc = me?.accuracy;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    meRef.current?.remove();
    meRef.current = null;
    if (meLat === undefined || meLng === undefined || meAcc === undefined) return;
    meRef.current = L.layerGroup([
      L.circle([meLat, meLng], { ...ME_STYLE, radius: Math.min(meAcc, 2000) }),
      L.circleMarker([meLat, meLng], ME_DOT),
    ]).addTo(map);
  }, [meLat, meLng, meAcc]);

  // Recentre only when asked (a GPS fix, a landmark, opening the sheet), never on a drag or a poll.
  // Show every nearby issue on first load instead of a street-level view of just one.
  const fitPoints = fitTo && fitTo.length ? fitTo.map((p) => `${p.lat},${p.lng}`).join(";") : "";
  const frameNow = useEffectEvent(() => ({ focus, points: fitTo ?? [] }));
  useEffect(() => {
    const map = mapRef.current;
    if (!map || framed.current || !fitPoints) return;
    framed.current = true;
    const { focus: f, points } = frameNow();
    const bounds = L.latLngBounds([[f.lat, f.lng], ...points.map((p) => [p.lat, p.lng] as [number, number])]);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: FOCUS_ZOOM - 1, animate: false });
  }, [fitPoints]);

  const focusNow = useEffectEvent(() => focus);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || builtFor.current === viewKey) return;
    builtFor.current = viewKey;
    const f = focusNow();
    const zoom = Math.max(map.getZoom(), FOCUS_ZOOM);
    // Glide when only the centre changes; a zoom change is instant (no zoom animation to race a tab switch).
    map.setView([f.lat, f.lng], zoom, { animate: !prefersReducedMotion() && zoom === map.getZoom() });
  }, [viewKey]);

  return (
    <div
      ref={boxRef}
      role="region"
      aria-label={label}
      className="cz-map h-full w-full"
      // OSM's land colour behind the tiles: tiles still loading blend in instead of flashing grey.
      style={{ background: "#f2efe9" }}
    />
  );
}
