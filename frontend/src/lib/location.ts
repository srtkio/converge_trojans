// "Use my current location" for the citizen report form. The position is asked for only when the
// citizen taps the button, kept in memory for this form, and sent only with the report. It is
// never written to localStorage.
import { useCallback, useEffect, useRef, useState } from "react";

import { distanceM } from "./citizen";

/** MG Road metro, Bengaluru: the middle of the pilot area. */
export const PILOT_CENTRE = { lat: 12.9756, lng: 77.6058 };
/** Further than this from the centre, the citizen is told they're outside the pilot (not blocked). */
export const PILOT_RADIUS_M = 3000;

export function outsidePilot(lat: number, lng: number): boolean {
  return distanceM(lat, lng, PILOT_CENTRE.lat, PILOT_CENTRE.lng) > PILOT_RADIUS_M;
}

export const LOCATION_MESSAGE = {
  insecure: "Your browser can only share location over a secure https link. Pick a nearby place below.",
  unsupported: "This browser can't share your location. Pick a nearby place below.",
  denied: "Location is turned off for this site. Pick a nearby place below, or allow location in your browser settings.",
  unavailable: "We couldn't find your location. Pick a nearby place below.",
  timeout: "Finding your location took too long. Try again, or pick a nearby place below.",
} as const;

export type DeviceLocation =
  | { state: "off" }
  | { state: "locating" }
  | { state: "on"; lat: number; lng: number; accuracy: number }
  | { state: "failed"; message: string };

const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 };
// OPTIONS.timeout doesn't count time spent on an unanswered permission prompt (common on iOS and in
// in-app browsers), so give up ourselves after this long and leave the landmark list in charge.
const WATCHDOG_MS = 15_000;

// GeolocationPositionError codes.
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

/** The device position, on request. `stop()` goes back to the landmark list and ignores late answers. */
export function useDeviceLocation() {
  const [location, setLocation] = useState<DeviceLocation>({ state: "off" });
  const request = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Answers arriving after the form is gone are ignored.
  useEffect(
    () => () => {
      request.current += 1;
      clearTimeout(watchdog.current);
    },
    [],
  );

  const locate = useCallback(() => {
    const mine = (request.current += 1);
    if (!window.isSecureContext) {
      setLocation({ state: "failed", message: LOCATION_MESSAGE.insecure });
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocation({ state: "failed", message: LOCATION_MESSAGE.unsupported });
      return;
    }
    setLocation({ state: "locating" });
    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => {
      if (mine !== request.current) return;
      request.current += 1;
      setLocation({ state: "failed", message: LOCATION_MESSAGE.timeout });
    }, WATCHDOG_MS);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (mine !== request.current) return;
        clearTimeout(watchdog.current);
        setLocation({ state: "on", lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
      },
      (err) => {
        if (mine !== request.current) return;
        clearTimeout(watchdog.current);
        const message =
          err.code === PERMISSION_DENIED
            ? LOCATION_MESSAGE.denied
            : err.code === TIMEOUT
              ? LOCATION_MESSAGE.timeout
              : LOCATION_MESSAGE.unavailable;
        setLocation({ state: "failed", message });
      },
      OPTIONS,
    );
  }, []);

  const stop = useCallback(() => {
    request.current += 1;
    clearTimeout(watchdog.current);
    setLocation({ state: "off" });
  }, []);

  return { location, locate, stop };
}
