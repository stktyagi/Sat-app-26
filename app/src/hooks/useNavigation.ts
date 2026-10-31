/**
 * useNavigationLogic – a self-contained hook that owns all live-navigation
 * state and logic for the MapScreen.
 *
 * Configurable defaults (all distances in metres):
 *   OFF_ROUTE_DISTANCE_THRESHOLD  – how far the user must be from the route
 *                                    before counting as "off-route" (default 40 m)
 *   OFF_ROUTE_CONSECUTIVE_COUNT   – consecutive off-route readings before
 *                                    triggering a reroute (default 3)
 *   REROUTE_COOLDOWN_MS           – minimum milliseconds between reroute
 *                                    requests (default 20 000 ms)
 *   ARRIVAL_RADIUS                – distance from destination to trigger
 *                                    "arrived" (default 20 m)
 *   ARRIVAL_CONSECUTIVE_COUNT     – consecutive readings within arrival radius
 *                                    to confirm arrival (default 3)
 *   STEP_ADVANCE_RADIUS           – distance to the next maneuver point that
 *                                    advances the step index (default 25 m)
 *   MAX_OFF_ROUTE_ADVANCE         – max points to search forward even when
 *                                    off-route to find the nearest segment
 *                                    (default 50)
 */

import { useRef, useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteManeuver {
  type: string;
  modifier?: string;
  instruction: string;
  bearingAfter?: number;
}

export interface RouteStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: RouteManeuver;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface MapboxDirectionsRoute {
  geometry: RouteGeometry;
  legs: Array<{
    steps: RouteStep[];
    distance: number;
    duration: number;
  }>;
  distance: number;
  duration: number;
}

export interface MapboxDirectionsResponse {
  routes: MapboxDirectionsRoute[];
  code: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Haversine helper
// ---------------------------------------------------------------------------

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Segment-distance helper
// ---------------------------------------------------------------------------

function distanceToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) {
    return { dist: haversineDistance(py, px, ay, ax), t: 0 };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const dist = haversineDistance(py, px, closestY, closestX);
  return { dist, t };
}

// ---------------------------------------------------------------------------
// Route progress
// ---------------------------------------------------------------------------

interface RouteProgress {
  segmentIndex: number;
  t: number;
  distToRoute: number;
}

export function findRouteProgress(
  userLat: number,
  userLng: number,
  coords: [number, number][],
  currentProgress: RouteProgress,
  maxLookAhead = 50,
): RouteProgress {
  if (coords.length < 2) return currentProgress;

  const startSeg = Math.max(0, currentProgress.segmentIndex - 1);
  const endSeg = Math.min(
    coords.length - 2,
    currentProgress.segmentIndex + maxLookAhead,
  );

  let bestDist = Infinity;
  let bestSeg = currentProgress.segmentIndex;
  let bestT = currentProgress.t;

  for (let i = startSeg; i <= endSeg; i++) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i + 1];
    const { dist, t } = distanceToSegment(userLng, userLat, ax, ay, bx, by);
    if (dist < bestDist - 2) {
      bestDist = dist;
      bestSeg = i;
      bestT = t;
    }
  }

  const newSeg = Math.max(currentProgress.segmentIndex - 1, bestSeg);
  return { segmentIndex: newSeg, t: bestT, distToRoute: bestDist };
}

// ---------------------------------------------------------------------------
// GeoJSON builder
// ---------------------------------------------------------------------------

export function buildTrimmedGeoJSON(
  userLat: number,
  userLng: number,
  coords: [number, number][],
  progress: RouteProgress,
): GeoJSON.FeatureCollection {
  const { segmentIndex, t } = progress;
  const segStart = coords[segmentIndex];
  const segEnd = coords[Math.min(segmentIndex + 1, coords.length - 1)];
  const closestLng = segStart[0] + t * (segEnd[0] - segStart[0]);
  const closestLat = segStart[1] + t * (segEnd[1] - segStart[1]);

  const remaining: [number, number][] = [
    [userLng, userLat],
    [closestLng, closestLat],
    ...coords.slice(segmentIndex + 1),
  ];

  const deduped = remaining.filter((c, i) => {
    if (i === 0) return true;
    const prev = remaining[i - 1];
    return !(Math.abs(c[0] - prev[0]) < 1e-8 && Math.abs(c[1] - prev[1]) < 1e-8);
  });

  const safeCoords: [number, number][] =
    deduped.length >= 2 ? deduped : coords.slice(Math.max(0, coords.length - 2));

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: safeCoords },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function buildFallbackInstruction(step: RouteStep): string {
  const { type, modifier, instruction } = step.maneuver;
  if (instruction) return instruction;
  const road = step.name ? ` onto ${step.name}` : '';
  switch (type) {
    case 'depart':     return `Head ${modifier ?? 'forward'}${road}`;
    case 'arrive':     return 'Arrive at your destination';
    case 'turn':       return `Turn ${modifier ?? 'onto'}${road}`;
    case 'new name':   return `Continue${road}`;
    case 'merge':      return `Merge${road}`;
    case 'fork':       return `Keep ${modifier ?? 'straight'}${road}`;
    case 'roundabout': return `Enter roundabout${road}`;
    case 'rotary':     return `Enter rotary${road}`;
    case 'continue':   return `Continue ${modifier ?? 'straight'}${road}`;
    default:           return `Continue${road}`;
  }
}

export function maneuverIconName(step: RouteStep): string {
  const { type, modifier } = step.maneuver;
  if (type === 'arrive') return 'flag';
  if (type === 'depart') return 'navigation';
  if (type === 'turn') {
    if (modifier === 'left' || modifier === 'sharp left') return 'turn-left';
    if (modifier === 'right' || modifier === 'sharp right') return 'turn-right';
    if (modifier === 'slight left') return 'corner-down-left';
    if (modifier === 'slight right') return 'corner-down-right';
    if (modifier === 'uturn') return 'corner-up-left';
  }
  return 'arrow-up';
}

// ---------------------------------------------------------------------------
// parseSteps
// ---------------------------------------------------------------------------

export function parseSteps(route: MapboxDirectionsRoute): RouteStep[] {
  const steps: RouteStep[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of (leg.steps as any[]) ?? []) {
      const geometry: RouteStep['geometry'] =
        step.geometry ?? { type: 'LineString', coordinates: [] };
      const maneuver: RouteManeuver = {
        type: step.maneuver?.type ?? 'continue',
        modifier: step.maneuver?.modifier,
        instruction: step.maneuver?.instruction ?? '',
        bearingAfter: step.maneuver?.bearing_after,
      };
      steps.push({
        distance: step.distance ?? 0,
        duration: step.duration ?? 0,
        name: step.name ?? '',
        maneuver,
        geometry,
      });
    }
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFF_ROUTE_DISTANCE_THRESHOLD = 40;
const OFF_ROUTE_CONSECUTIVE_COUNT  = 3;
const REROUTE_COOLDOWN_MS          = 20_000;
const ARRIVAL_RADIUS               = 20;
const ARRIVAL_CONSECUTIVE_COUNT    = 3;
const STEP_ADVANCE_RADIUS          = 25;
const MAX_OFF_ROUTE_ADVANCE        = 50;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseNavigationLogicReturn {
  trimmedGeoJSON: GeoJSON.FeatureCollection | null;
  steps: RouteStep[];
  currentStepIndex: number;
  isRerouting: boolean;
  hasArrived: boolean;
  initRoute: (coords: [number, number][], steps: RouteStep[]) => void;
  onLocationUpdate: (lat: number, lng: number) => void;
  resetNavigation: () => void;
}

export function useNavigationLogic(
  destination: { lat: number; lng: number; name: string } | null,
  accessToken: string,
  onRerouteSuccess: (coords: [number, number][], steps: RouteStep[]) => void,
): UseNavigationLogicReturn {
  const [trimmedGeoJSON, setTrimmedGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);

  const routeCoordsRef   = useRef<[number, number][] | null>(null);
  const routeProgressRef = useRef<RouteProgress>({ segmentIndex: 0, t: 0, distToRoute: 0 });
  const stepsRef         = useRef<RouteStep[]>([]);
  const stepIndexRef     = useRef<number>(0);
  const hasArrivedRef    = useRef<boolean>(false);
  const offRouteCountRef = useRef<number>(0);
  const reroutingRef     = useRef<boolean>(false);
  const lastRerouteTime  = useRef<number>(0);
  const arrivalCountRef  = useRef<number>(0);
  const destinationRef   = useRef(destination);
  destinationRef.current = destination;

  const initRoute = useCallback(
    (coords: [number, number][], newSteps: RouteStep[]) => {
      routeCoordsRef.current = coords;
      routeProgressRef.current = { segmentIndex: 0, t: 0, distToRoute: 0 };
      stepsRef.current = newSteps;
      stepIndexRef.current = 0;
      hasArrivedRef.current = false;
      offRouteCountRef.current = 0;
      arrivalCountRef.current = 0;
      reroutingRef.current = false;

      setSteps(newSteps);
      setCurrentStepIndex(0);
      setHasArrived(false);
      setIsRerouting(false);
      setTrimmedGeoJSON({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          },
        ],
      });
    },
    [],
  );

  const triggerReroute = useCallback(
    async (userLat: number, userLng: number) => {
      const dest = destinationRef.current;
      if (!dest || reroutingRef.current) return;
      const now = Date.now();
      if (now - lastRerouteTime.current < REROUTE_COOLDOWN_MS) return;

      reroutingRef.current = true;
      lastRerouteTime.current = now;
      setIsRerouting(true);

      try {
        const start = `${userLng},${userLat}`;
        const end   = `${dest.lng},${dest.lat}`;
        const url =
          `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}` +
          `?geometries=geojson&steps=true&overview=full&banner_instructions=true` +
          `&voice_instructions=true&access_token=${accessToken}`;

        const resp = await fetch(url);
        if (!resp.ok) {
          console.warn('[Nav] Reroute HTTP error', resp.status);
          return;
        }

        const data: MapboxDirectionsResponse = await resp.json();
        if (data.code !== 'Ok' || !data.routes?.length) {
          console.warn('[Nav] Reroute: no routes returned', data.code, data.message);
          return;
        }

        const route = data.routes[0];
        const newCoords: [number, number][] = route.geometry.coordinates;
        if (newCoords.length < 2) {
          console.warn('[Nav] Reroute returned degenerate geometry');
          return;
        }

        const newSteps = parseSteps(route);
        routeCoordsRef.current = newCoords;
        routeProgressRef.current = { segmentIndex: 0, t: 0, distToRoute: 0 };
        stepsRef.current = newSteps;
        stepIndexRef.current = 0;
        offRouteCountRef.current = 0;
        arrivalCountRef.current = 0;

        setSteps(newSteps);
        setCurrentStepIndex(0);
        onRerouteSuccess(newCoords, newSteps);
      } catch (err) {
        console.error('[Nav] Reroute error:', err);
      } finally {
        reroutingRef.current = false;
        setIsRerouting(false);
      }
    },
    [accessToken, onRerouteSuccess],
  );

  const onLocationUpdate = useCallback(
    (lat: number, lng: number) => {
      if (hasArrivedRef.current) return;
      const coords = routeCoordsRef.current;
      if (!coords || coords.length < 2) return;

      const dest = destinationRef.current;

      // 1. Arrival detection
      if (dest) {
        const distToDest = haversineDistance(lat, lng, dest.lat, dest.lng);
        if (distToDest <= ARRIVAL_RADIUS) {
          arrivalCountRef.current += 1;
          if (arrivalCountRef.current >= ARRIVAL_CONSECUTIVE_COUNT) {
            hasArrivedRef.current = true;
            setHasArrived(true);
            return;
          }
        } else {
          arrivalCountRef.current = 0;
        }
      }

      // 2. Route progress
      const progress = findRouteProgress(
        lat, lng, coords,
        routeProgressRef.current,
        MAX_OFF_ROUTE_ADVANCE,
      );
      routeProgressRef.current = progress;

      // 3. Off-route detection
      if (progress.distToRoute > OFF_ROUTE_DISTANCE_THRESHOLD) {
        offRouteCountRef.current += 1;
        if (offRouteCountRef.current >= OFF_ROUTE_CONSECUTIVE_COUNT) {
          offRouteCountRef.current = 0;
          triggerReroute(lat, lng);
          return;
        }
        return; // Not yet confirmed off-route
      } else {
        offRouteCountRef.current = 0;
      }

      // 4. Advance step index
      const currentSteps = stepsRef.current;
      let stepIdx = stepIndexRef.current;
      while (stepIdx < currentSteps.length - 1) {
        const nextStep = currentSteps[stepIdx + 1];
        const nextCoord = nextStep.geometry?.coordinates?.[0];
        if (!nextCoord) break;
        const distToNext = haversineDistance(lat, lng, nextCoord[1], nextCoord[0]);
        if (distToNext <= STEP_ADVANCE_RADIUS) {
          stepIdx += 1;
        } else {
          break;
        }
      }
      if (stepIdx !== stepIndexRef.current) {
        stepIndexRef.current = stepIdx;
        setCurrentStepIndex(stepIdx);
      }

      // 5. Trim route
      const geoJSON = buildTrimmedGeoJSON(lat, lng, coords, progress);
      setTrimmedGeoJSON(geoJSON);
    },
    [triggerReroute],
  );

  const resetNavigation = useCallback(() => {
    routeCoordsRef.current = null;
    routeProgressRef.current = { segmentIndex: 0, t: 0, distToRoute: 0 };
    stepsRef.current = [];
    stepIndexRef.current = 0;
    hasArrivedRef.current = false;
    offRouteCountRef.current = 0;
    arrivalCountRef.current = 0;
    reroutingRef.current = false;

    setTrimmedGeoJSON(null);
    setSteps([]);
    setCurrentStepIndex(0);
    setIsRerouting(false);
    setHasArrived(false);
  }, []);

  return {
    trimmedGeoJSON,
    steps,
    currentStepIndex,
    isRerouting,
    hasArrived,
    initRoute,
    onLocationUpdate,
    resetNavigation,
  };
}
