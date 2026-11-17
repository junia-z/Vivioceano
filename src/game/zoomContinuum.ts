import type { Island } from './types';

export type ZoomDepthStage = 'globe' | 'map' | 'island';

export const GLOBE_DIST_MIN = 5.75;
export const GLOBE_DIST_MAX = 18.5;
export const GLOBE_TO_MAP_DIST = 6.75;
export const GLOBE_ENTRY_DIST_FROM_MAP = 8.4;

export const MAP_ZOOM_MIN = 0.78;
export const MAP_ZOOM_MAX = 11.2;
export const MAP_ENTRY_ZOOM_FROM_GLOBE = 1.65;
export const MAP_ENTRY_ZOOM_FROM_ISLAND = 6.4;
export const MAP_TO_GLOBE_ZOOM = 0.8;
export const MAP_TO_ISLAND_ZOOM = 9.2;

export const ISLAND_ZOOM_MIN = 0.84;
export const ISLAND_ZOOM_MAX = 2.4;
export const ISLAND_ENTRY_ZOOM = 1.05;
export const ISLAND_TO_MAP_ZOOM = 0.9;

/**
 * Computes wrapped angular distance in degrees between two lat/lon points.
 */
export function angularDistanceDeg(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  const dLat = latA - latB;
  let dLon = Math.abs(lonA - lonB);
  if (dLon > 180) dLon = 360 - dLon;
  return Math.hypot(dLat, dLon);
}

/**
 * Picks the best island to enter when zooming deeply into the 2D Map.
 * Prioritizes the currently selected island if within generous view range,
 * otherwise selects the nearest island to the viewport center within `maxDeg`.
 */
export function findNearestIslandForZoomEntry(
  centerLat: number,
  centerLon: number,
  islands: Island[],
  selectedIslandId?: string | null,
  maxDeg = 22
): Island | null {
  if (islands.length === 0) return null;

  if (selectedIslandId) {
    const sel = islands.find((i) => i.id === selectedIslandId);
    if (sel) {
      const selRadius = (sel.isMiniIsland ? 8 : 13) + (sel.scale ?? 1) * 2.5;
      const dSel = angularDistanceDeg(centerLat, centerLon, sel.lat, sel.lon);
      if (dSel <= Math.max(maxDeg * 0.85, selRadius)) {
        return sel;
      }
    }
  }

  let best: Island | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < islands.length; i++) {
    const isl = islands[i];
    const d = angularDistanceDeg(centerLat, centerLon, isl.lat, isl.lon);
    if (d < bestDist && d <= maxDeg) {
      bestDist = d;
      best = isl;
    }
  }
  return best;
}

/**
 * Evaluates whether zooming in on the 3D Globe should cross into the 2D World Map.
 */
export function evaluateGlobeZoomTransition(
  camDist: number,
  zoomingIn: boolean
): { nextStage: 'globe' | 'map'; mapEntryZoom: number } {
  if (zoomingIn && camDist < GLOBE_TO_MAP_DIST) {
    return { nextStage: 'map', mapEntryZoom: MAP_ENTRY_ZOOM_FROM_GLOBE };
  }
  return { nextStage: 'globe', mapEntryZoom: MAP_ENTRY_ZOOM_FROM_GLOBE };
}

/**
 * Evaluates bidirectional transitions from the 2D World Map (out to 3D Globe or in to Island Interior).
 */
export function evaluateMapZoomTransition(
  prevZoom: number,
  rawNextZoom: number,
  deltaDir: 'in' | 'out',
  centerLat: number,
  centerLon: number,
  islands: Island[],
  selectedIslandId?: string | null
):
  | { action: 'stay'; zoom: number }
  | { action: 'to_globe'; lat: number; lon: number; globeDist: number }
  | { action: 'to_island'; island: Island; islandEntryZoom: number } {
  if (deltaDir === 'out' && prevZoom <= 0.84 && rawNextZoom < MAP_TO_GLOBE_ZOOM) {
    return {
      action: 'to_globe',
      lat: centerLat,
      lon: centerLon,
      globeDist: GLOBE_ENTRY_DIST_FROM_MAP,
    };
  }

  if (deltaDir === 'in' && rawNextZoom >= MAP_TO_ISLAND_ZOOM) {
    const targetIsland = findNearestIslandForZoomEntry(
      centerLat,
      centerLon,
      islands,
      selectedIslandId
    );
    if (targetIsland) {
      return {
        action: 'to_island',
        island: targetIsland,
        islandEntryZoom: ISLAND_ENTRY_ZOOM,
      };
    }
  }

  return {
    action: 'stay',
    zoom: Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, rawNextZoom)),
  };
}

/**
 * Evaluates whether zooming out inside IslandSceneView should cross back out to the 2D World Map.
 */
export function evaluateIslandZoomTransition(
  prevZoom: number,
  rawNextZoom: number,
  deltaDir: 'in' | 'out'
):
  | { action: 'stay'; zoom: number }
  | { action: 'to_map'; mapEntryZoom: number } {
  if (deltaDir === 'out' && prevZoom <= 0.96 && rawNextZoom < ISLAND_TO_MAP_ZOOM) {
    return {
      action: 'to_map',
      mapEntryZoom: MAP_ENTRY_ZOOM_FROM_ISLAND,
    };
  }
  return {
    action: 'stay',
    zoom: Math.max(ISLAND_ZOOM_MIN, Math.min(ISLAND_ZOOM_MAX, rawNextZoom)),
  };
}
