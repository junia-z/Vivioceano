import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Compass, LocateFixed, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import {
  getEntitySpriteAppearance,
  getSpriteAppearanceKey,
  renderPirateSpriteCanvas,
  type PirateSpriteAppearance,
} from '../game/pixelSprite';
import {
  createSeededRng,
  getBotHeadingLatLon,
  getBotPositionLatLon,
  getCharacterSpriteScale,
  getNavigationPathCoords,
  getPirateLatLon,
  sampleNavigationPathXYZ,
  xyzToLatLon,
} from '../game/sim';
import {
  MAX_IMPORTANT_RED_DOTS,
  buildMapDotCandidates,
  filterAndRankMapDots,
} from '../game/mapFilters';
import { getActiveRoamingShipNpcs } from '../game/roamingNpcs';
import type {
  BotPirate,
  Island,
  Pirate,
  RedDotFilterId,
  WorldEvent,
} from '../game/types';
import {
  getBossForIsland,
  getMiniBossesForIsland,
  getNpcsForIsland,
} from '../game/worldData';
import { getIslandPixelCanvas, hasIslandArtCached } from '../game/worldMapArt';
import {
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  evaluateMapZoomTransition,
} from '../game/zoomContinuum';

export interface WorldMapFocusRequest {
  lat: number;
  lon: number;
  zoom?: number;
  nonce: number;
}

interface WorldMapCanvasProps {
  islands: Island[];
  pirates: Pirate[];
  bots: BotPirate[];
  events: WorldEvent[];
  selectedIslandId: string | null;
  selectedPirateId: string | null;
  selectedRoamingNpcId?: string | null;
  redDotFilters?: RedDotFilterId[];
  initialFocus?: WorldMapFocusRequest | null;
  day?: number;
  minuteOfDay?: number;
  sidePanelOpen?: boolean;
  leftMenuOpen?: boolean;
  onSelectIsland: (islandId: string) => void;
  onSelectPirate: (pirateId: string) => void;
  onSelectRoamingNpc?: (npcId: string) => void;
  onZoomOutToGlobe?: (lat: number, lon: number) => void;
  onZoomInToIsland?: (island: Island) => void;
  onSailToIsland?: (islandId: string) => void;
  onGoToSabaody?: () => void;
}

const MAP_W = 2400;
const MAP_H = 1200;

const INTERIOR_SLOT_COORDS: ReadonlyArray<readonly [number, number]> = [
  [-0.18, 0.06],
  [-0.08, -0.02],
  [0.02, 0.1],
  [-0.02, -0.14],
  [0.1, 0.14],
];

function lonToMapX(lonDeg: number): number {
  const norm = (((lonDeg + 180) % 360) + 360) % 360;
  return (norm / 360) * MAP_W;
}

function latToMapY(latDeg: number): number {
  const clamped = Math.max(-85, Math.min(85, latDeg));
  return ((90 - clamped) / 180) * MAP_H;
}

function mapXYToLatLon(x: number, y: number): [number, number] {
  const normX = ((x % MAP_W) + MAP_W) % MAP_W;
  const lon = (normX / MAP_W) * 360 - 180;
  const lat = Math.max(-85, Math.min(85, 90 - (y / MAP_H) * 180));
  return [lat, lon];
}

function lerpWrappedLon(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  let next = a + diff * t;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return next;
}

let cachedBackdrop: HTMLCanvasElement | null = null;
function getBackdropCanvas(): HTMLCanvasElement {
  if (cachedBackdrop) return cachedBackdrop;
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Ocean vertical gradient matching reference image_47493ed6.png
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, MAP_H);
  oceanGrad.addColorStop(0, '#0f3c75');
  oceanGrad.addColorStop(0.28, '#14539c');
  oceanGrad.addColorStop(0.5, '#196ec2');
  oceanGrad.addColorStop(0.72, '#14539c');
  oceanGrad.addColorStop(1, '#0f3c75');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Calm Belts & Grand Line equator band
  const calmTopOuter = latToMapY(21);
  const calmTopInner = latToMapY(13.5);
  const calmBotInner = latToMapY(-13.5);
  const calmBotOuter = latToMapY(-21);

  ctx.fillStyle = '#1878cc';
  ctx.fillRect(0, calmTopInner, MAP_W, calmBotInner - calmTopInner);

  ctx.fillStyle = '#387688';
  ctx.fillRect(0, calmTopOuter, MAP_W, calmTopInner - calmTopOuter);
  ctx.fillRect(0, calmBotInner, MAP_W, calmBotOuter - calmBotInner);

  ctx.fillStyle = '#4e96a6';
  for (let x = 0; x < MAP_W; x += 14) {
    const jitter = (((x * 7) % 3) - 1) * 2;
    ctx.fillRect(x, calmTopOuter + jitter, 14, 4);
    ctx.fillRect(x, calmTopInner + jitter, 14, 4);
    ctx.fillRect(x, calmBotInner + jitter, 14, 4);
    ctx.fillRect(x, calmBotOuter + jitter, 14, 4);
  }

  // Pixel ocean ripples
  const rng = createSeededRng(424242);
  for (let i = 0; i < 3200; i++) {
    const px = Math.floor(rng() * (MAP_W / 4)) * 4;
    const py = Math.floor(rng() * (MAP_H / 4)) * 4;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(125, 211, 252, 0.16)' : 'rgba(9, 32, 68, 0.2)';
    ctx.fillRect(px, py, i % 5 === 0 ? 12 : 8, 4);
  }

  // Red Line (Muralla Roja) at lon=0 (center of map) and lon=±180 (outer edges)
  const drawRedLine = (cx: number) => {
    for (let y = 0; y < MAP_H; y += 6) {
      const wobble = Math.round(Math.sin(y * 0.025) * 9 + Math.cos(y * 0.075) * 4);
      const halfW = 34 + Math.round(Math.sin(y * 0.04) * 7);
      ctx.fillStyle = '#631d10';
      ctx.fillRect(cx - halfW + wobble - 5, y, halfW * 2 + 10, 6);
      ctx.fillStyle = '#99371e';
      ctx.fillRect(cx - halfW + wobble, y, halfW * 2, 6);
      ctx.fillStyle = '#c15331';
      ctx.fillRect(cx - Math.floor(halfW * 0.5) + wobble, y, halfW, 6);
    }
  };
  drawRedLine(lonToMapX(0));
  drawRedLine(0);
  drawRedLine(MAP_W);

  // Reverse Mountain X canals at center (0°, 0°)
  const rmX = lonToMapX(0);
  const rmY = latToMapY(0);
  ctx.fillStyle = '#38bdf8';
  for (let d = -64; d <= 64; d += 2) {
    ctx.fillRect(rmX + d - 4, rmY + d - 4, 8, 8);
    ctx.fillRect(rmX - d - 4, rmY + d - 4, 8, 8);
  }
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(rmX - 11, rmY - 11, 22, 22);

  // Sea titles & Calm Belt labels
  const drawLabel = (text: string, lon: number, lat: number, fontSize: number, alpha: number) => {
    const x = lonToMapX(lon);
    const y = latToMapY(lat);
    ctx.save();
    ctx.font = `700 ${fontSize}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(4, 12, 26, ${Math.min(0.75, alpha + 0.18)})`;
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = `rgba(226, 240, 255, ${alpha})`;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  drawLabel('N U E V O   M U N D O', -92, 0, 28, 0.54);
  drawLabel('P A R A Í S O', 92, 0, 28, 0.54);
  drawLabel('M A R   D E L   N O R T E', -90, 46, 24, 0.5);
  drawLabel('M A R   D E L   O E S T E', -90, -44, 24, 0.5);
  drawLabel('M A R   D E L   E S T E', 88, 42, 24, 0.5);
  drawLabel('M A R   D E L   S U R', 88, -42, 24, 0.5);
  for (const lon of [-125, -45, 55, 135]) {
    drawLabel('F R A N J A   D E   C A L M A', lon, 17.2, 15, 0.48);
    drawLabel('F R A N J A   D E   C A L M A', lon, -17.2, 15, 0.48);
  }

  // Vertical MURALLA ROJA label
  ctx.save();
  ctx.translate(rmX, latToMapY(42));
  ctx.rotate(-Math.PI / 2);
  ctx.font = '700 18px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 226, 200, 0.52)';
  ctx.fillText('M U R A L L A   R O J A', 0, 0);
  ctx.restore();

  cachedBackdrop = canvas;
  return canvas;
}

function getPirateHeadingLatLon(pirate: Pirate, islands: Island[]): [number, number] | null {
  if (!pirate.sailingToIslandId) return null;
  const fromIsl = islands.find((i) => i.id === pirate.islandId) ?? islands[0];
  const toIsl = islands.find((i) => i.id === pirate.sailingToIslandId) ?? fromIsl;
  const coords = getNavigationPathCoords(fromIsl, toIsl);
  const xyz = sampleNavigationPathXYZ(coords, Math.min(1, pirate.sailProgress + 0.025), 1);
  return xyzToLatLon(xyz);
}

const MAX_SPRITE_CANVAS_CACHE = 48;
const spriteCanvasCache = new Map<string, HTMLCanvasElement>();
function getCachedSprite(app: PirateSpriteAppearance, facing: 'right' | 'left'): HTMLCanvasElement {
  const key = `${getSpriteAppearanceKey(app)}|${facing}`;
  const hit = spriteCanvasCache.get(key);
  if (hit) {
    spriteCanvasCache.delete(key);
    spriteCanvasCache.set(key, hit);
    return hit;
  }
  const c = renderPirateSpriteCanvas(app, 2, facing);
  if (spriteCanvasCache.size >= MAX_SPRITE_CANVAS_CACHE) {
    const oldest = spriteCanvasCache.keys().next().value;
    if (oldest !== undefined) spriteCanvasCache.delete(oldest);
  }
  spriteCanvasCache.set(key, c);
  return c;
}

export const WorldMapCanvas: React.FC<WorldMapCanvasProps> = ({
  islands,
  pirates,
  bots,
  selectedIslandId,
  selectedPirateId,
  selectedRoamingNpcId = null,
  redDotFilters = [],
  initialFocus,
  day = 1,
  minuteOfDay = 480,
  sidePanelOpen = true,
  leftMenuOpen = false,
  onSelectIsland,
  onSelectPirate,
  onSelectRoamingNpc,
  onZoomOutToGlobe,
  onZoomInToIsland,
  onSailToIsland,
  onGoToSabaody,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialZoom = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, initialFocus?.zoom ?? 1.65));
  const viewRef = useRef<{ centerLat: number; centerLon: number; zoom: number }>({
    centerLat: initialFocus?.lat ?? 4,
    centerLon: initialFocus?.lon ?? -45,
    zoom: initialZoom,
  });
  const targetViewRef = useRef<{ centerLat: number; centerLon: number; zoom: number }>({
    centerLat: initialFocus?.lat ?? 4,
    centerLon: initialFocus?.lon ?? -45,
    zoom: initialZoom,
  });
  const zoomLatchRef = useRef(false);
  const lastReadoutRef = useRef(initialZoom);

  const [trenchSubmerged, setTrenchSubmerged] = useState(false);
  const [zoomReadout, setZoomReadout] = useState<number>(initialZoom);
  const trenchSubmergedRef = useRef(trenchSubmerged);
  trenchSubmergedRef.current = trenchSubmerged;

  const propsRef = useRef({
    islands,
    pirates,
    bots,
    selectedIslandId,
    selectedPirateId,
    selectedRoamingNpcId,
    redDotFilters,
    day,
    minuteOfDay,
    sidePanelOpen,
    leftMenuOpen,
    onSelectIsland,
    onSelectPirate,
    onSelectRoamingNpc,
    onZoomOutToGlobe,
    onZoomInToIsland,
  });
  propsRef.current = {
    islands,
    pirates,
    bots,
    selectedIslandId,
    selectedPirateId,
    selectedRoamingNpcId,
    redDotFilters,
    day,
    minuteOfDay,
    sidePanelOpen,
    leftMenuOpen,
    onSelectIsland,
    onSelectPirate,
    onSelectRoamingNpc,
    onZoomOutToGlobe,
    onZoomInToIsland,
  };

  useEffect(() => {
    if (!initialFocus) return;
    const clampedZoom = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, initialFocus.zoom ?? 4.2));
    viewRef.current = {
      centerLat: initialFocus.lat,
      centerLon: initialFocus.lon,
      zoom: clampedZoom,
    };
    targetViewRef.current = {
      centerLat: initialFocus.lat,
      centerLon: initialFocus.lon,
      zoom: clampedZoom,
    };
    zoomLatchRef.current = false;
    lastReadoutRef.current = clampedZoom;
    setZoomReadout(clampedZoom);
  }, [initialFocus]);

  useEffect(() => {
    if (selectedIslandId !== 'isla-hombres-pez') {
      setTrenchSubmerged(false);
    }
  }, [selectedIslandId]);

  // Persistent hit rects updated every draw without reallocation
  const hitRegionsRef = useRef<
    Array<{ type: 'island' | 'pirate' | 'roaming_npc'; id: string; x: number; y: number; r: number }>
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const syncCanvasSize = () => {
      const parent = canvas.parentElement;
      const pw = parent?.clientWidth || window.innerWidth;
      const ph = parent?.clientHeight || window.innerHeight;
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
    };
    syncCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    let rafId = 0;
    let lastDraw = 0;

    const DRAW_MARGIN_PX = 48;
    const PRELOAD_FRINGE_PX = 280;
    const MAX_PREWARM_PER_FRAME = 2;
    const WRAP_SHIFTS = [-MAP_W, 0, MAP_W] as const;

    let cachedIslandsRef: Island[] | null = null;
    const islandLookup = new Map<string, Island>();

    // Reusable per-frame scratch state (zero GC churn inside draw loop)
    const _screenOut = { x: 0, y: 0 };
    const _headOut = { x: 0, y: 0 };
    const _hitsPool: Array<{
      type: 'island' | 'pirate' | 'roaming_npc';
      id: string;
      x: number;
      y: number;
      r: number;
    }> = [];
    const _placedLabels: Array<{ x: number; y: number; w: number }> = [];
    const _labelDrawPool: Array<{
      text: string;
      x: number;
      y: number;
      color: string;
      font: string;
    }> = [];
    const _prewarmQueue: Array<{ isl: Island; variant: 'surface' | 'underwater' }> = [];
    const _dockedScratch: Pirate[] = [];
    const _interiorActors: Array<{
      app: PirateSpriteAppearance;
      baseX: number;
      baseY: number;
      seed: number;
      tag?: string;
      color?: string;
    }> = [];

    // 2-second bucket cache for red-dot candidate filtering & roaming NPC evaluation
    let lastDotBucket = -1;
    let cachedDotIslands: Island[] | null = null;
    let cachedDotPirates: Pirate[] | null = null;
    let cachedDotBots: BotPirate[] | null = null;
    let cachedDotSelPir: string | null = null;
    let cachedDotFilters: RedDotFilterId[] | undefined = undefined;
    let cachedVisibleCandidates: ReturnType<typeof filterAndRankMapDots>['visible'] = [];

    const draw = (nowMs: number) => {
      if (document.hidden) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(draw);
      const dtMs = nowMs - lastDraw;
      if (dtMs < 32) return; // smooth ~30fps CPU-friendly cadence
      lastDraw = nowMs;

      // Smooth exponential zoom & focus interpolation
      const dtSec = Math.min(0.08, Math.max(0.01, dtMs * 0.001));
      const lerpFactor = 1 - Math.exp(-dtSec * 15);
      const v = viewRef.current;
      const tv = targetViewRef.current;
      if (Math.abs(tv.zoom - v.zoom) > 0.002) {
        v.zoom += (tv.zoom - v.zoom) * lerpFactor;
      } else {
        v.zoom = tv.zoom;
      }
      if (Math.abs(tv.centerLat - v.centerLat) > 0.005) {
        v.centerLat += (tv.centerLat - v.centerLat) * lerpFactor;
      } else {
        v.centerLat = tv.centerLat;
      }
      if (Math.abs(tv.centerLon - v.centerLon) > 0.005) {
        v.centerLon = lerpWrappedLon(v.centerLon, tv.centerLon, lerpFactor);
      } else {
        v.centerLon = tv.centerLon;
      }
      if (Math.abs(v.zoom - lastReadoutRef.current) >= 0.05) {
        lastReadoutRef.current = v.zoom;
        setZoomReadout(v.zoom);
      }

      const w = canvas.width;
      const h = canvas.height;
      const baseScale = Math.max(w / MAP_W, h / MAP_H);
      const scale = baseScale * v.zoom;
      const leftOffsetPx =
        propsRef.current.leftMenuOpen && w >= 1024
          ? 270
          : propsRef.current.sidePanelOpen && w >= 1024
          ? 210
          : 0;
      const cx = (w + leftOffsetPx) * 0.5;
      const cy = h * 0.5;
      const worldCenterX = lonToMapX(v.centerLon);
      const worldCenterY = latToMapY(v.centerLat);

      const {
        islands: curIslands,
        pirates: curPirates,
        bots: curBots,
        selectedIslandId: selIslId,
        selectedPirateId: selPirId,
        selectedRoamingNpcId: selRoamId,
        redDotFilters: curRedDotFilters,
      } = propsRef.current;

      if (cachedIslandsRef !== curIslands) {
        cachedIslandsRef = curIslands;
        islandLookup.clear();
        for (let i = 0; i < curIslands.length; i++) {
          islandLookup.set(curIslands[i].id, curIslands[i]);
        }
      }

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#060d18';
      ctx.fillRect(0, 0, w, h);

      const backdrop = getBackdropCanvas();
      const projectToOut = (wx: number, wy: number, out: { x: number; y: number }) => {
        let dx = wx - worldCenterX;
        if (dx > MAP_W * 0.5) dx -= MAP_W;
        if (dx < -MAP_W * 0.5) dx += MAP_W;
        out.x = cx + dx * scale;
        out.y = cy + (wy - worldCenterY) * scale;
      };

      // Sub-rectangle backdrop blitting across horizontal wraps: draws ONLY visible pixels!
      const swFull = MAP_W * scale;
      const shFull = MAP_H * scale;
      const syFull = cy - worldCenterY * scale;
      for (let wIdx = 0; wIdx < WRAP_SHIFTS.length; wIdx++) {
        const sxFull = cx + (WRAP_SHIFTS[wIdx] - worldCenterX) * scale;
        if (sxFull + swFull <= 0 || sxFull >= w) continue;

        const ix0 = Math.max(0, sxFull);
        const iy0 = Math.max(0, syFull);
        const ix1 = Math.min(w, sxFull + swFull);
        const iy1 = Math.min(h, syFull + shFull);
        if (ix1 <= ix0 || iy1 <= iy0) continue;

        const srcX = Math.max(0, (ix0 - sxFull) / scale);
        const srcY = Math.max(0, (iy0 - syFull) / scale);
        const srcW = Math.min(MAP_W - srcX, (ix1 - ix0) / scale);
        const srcH = Math.min(MAP_H - srcY, (iy1 - iy0) / scale);
        if (srcW <= 0 || srcH <= 0) continue;

        ctx.drawImage(backdrop, srcX, srcY, srcW, srcH, ix0, iy0, ix1 - ix0, iy1 - iy0);
      }

      // Active player voyage dashed golden route arc
      let trackedPirate: Pirate | undefined;
      for (let i = 0; i < curPirates.length; i++) {
        const p = curPirates[i];
        if (!p.sailingToIslandId) continue;
        if (p.id === selPirId) {
          trackedPirate = p;
          break;
        }
        if (!trackedPirate) trackedPirate = p;
      }
      if (trackedPirate && trackedPirate.sailingToIslandId) {
        const fromIsl = islandLookup.get(trackedPirate.islandId);
        const toIsl = islandLookup.get(trackedPirate.sailingToIslandId);
        if (fromIsl && toIsl) {
          const coords = getNavigationPathCoords(fromIsl, toIsl);
          ctx.save();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          for (let step = 0; step <= 32; step++) {
            const xyz = sampleNavigationPathXYZ(coords, step / 32, 1);
            const [lat, lon] = xyzToLatLon(xyz);
            projectToOut(lonToMapX(lon), latToMapY(lat), _screenOut);
            if (step === 0) ctx.moveTo(_screenOut.x, _screenOut.y);
            else ctx.lineTo(_screenOut.x, _screenOut.y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      _hitsPool.length = 0;
      _placedLabels.length = 0;
      _labelDrawPool.length = 0;
      _prewarmQueue.length = 0;
      const tSec = nowMs * 0.001;
      const patrolStep = Math.floor(nowMs / 1800);

      // Draw visible islands + queue outer fringe prewarm
      for (let i = 0; i < curIslands.length; i++) {
        const isl = curIslands[i];
        projectToOut(lonToMapX(isl.lon), latToMapY(isl.lat), _screenOut);
        const sx = _screenOut.x;
        const sy = _screenOut.y;

        const baseWorldSize = isl.isMiniIsland ? 46 : 74 * Math.sqrt(isl.scale ?? 1.0);
        const screenSize = baseWorldSize * scale;
        const halfScreen = screenSize * 0.5;
        const variant: 'surface' | 'underwater' =
          isl.id === 'isla-hombres-pez' && trenchSubmergedRef.current ? 'underwater' : 'surface';

        const inDrawBounds =
          sx + halfScreen >= -DRAW_MARGIN_PX &&
          sx - halfScreen <= w + DRAW_MARGIN_PX &&
          sy + halfScreen >= -DRAW_MARGIN_PX &&
          sy - halfScreen <= h + DRAW_MARGIN_PX;

        if (!inDrawBounds) {
          if (
            _prewarmQueue.length < MAX_PREWARM_PER_FRAME &&
            sx + halfScreen >= -PRELOAD_FRINGE_PX &&
            sx - halfScreen <= w + PRELOAD_FRINGE_PX &&
            sy + halfScreen >= -PRELOAD_FRINGE_PX &&
            sy - halfScreen <= h + PRELOAD_FRINGE_PX &&
            !hasIslandArtCached(isl.id, variant)
          ) {
            _prewarmQueue.push({ isl, variant });
          }
          continue;
        }

        const art = getIslandPixelCanvas(isl, variant);
        ctx.drawImage(art, sx - halfScreen, sy - halfScreen, screenSize, screenSize);

        if (isl.id === selIslId) {
          ctx.save();
          ctx.strokeStyle = isl.id === 'isla-hombres-pez' ? '#22d3ee' : '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, screenSize * 0.44, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        _hitsPool.push({
          type: 'island',
          id: isl.id,
          x: sx,
          y: sy,
          r: Math.max(18, screenSize * 0.44),
        });

        // Live moving island interior NPCs / Bosses / Docked Players at deep zoom
        if (
          v.zoom >= 6.8 &&
          screenSize >= 240 &&
          !isl.isMiniIsland &&
          (isl.id !== 'isla-hombres-pez' || trenchSubmergedRef.current)
        ) {
          const npcs = getNpcsForIsland(isl);
          const miniBosses = getMiniBossesForIsland(isl);
          const boss = getBossForIsland(isl);

          _dockedScratch.length = 0;
          for (let pIdx = 0; pIdx < curPirates.length; pIdx++) {
            const p = curPirates[pIdx];
            if (!p.sailingToIslandId && p.islandId === isl.id) {
              _dockedScratch.push(p);
            }
          }

          _interiorActors.length = 0;
          _interiorActors.push({
            app: getEntitySpriteAppearance(boss, 'coat', 'robust'),
            baseX: 0.16,
            baseY: -0.1,
            seed: 1,
            tag: boss.name,
            color: '#fda4af',
          });

          for (let m = 0; m < miniBosses.length && m < 2; m++) {
            _interiorActors.push({
              app: getEntitySpriteAppearance(miniBosses[m], 'coat', 'normal'),
              baseX: m === 0 ? 0.12 : -0.14,
              baseY: 0.04,
              seed: m + 11,
            });
          }

          for (let qIdx = 0; qIdx < npcs.length && qIdx < 5; qIdx++) {
            const slot = INTERIOR_SLOT_COORDS[qIdx % INTERIOR_SLOT_COORDS.length];
            _interiorActors.push({
              app: getEntitySpriteAppearance(npcs[qIdx], 'shirt', 'normal'),
              baseX: slot[0],
              baseY: slot[1],
              seed: qIdx + 31,
            });
          }

          for (let dIdx = 0; dIdx < _dockedScratch.length && dIdx < 4; dIdx++) {
            const p = _dockedScratch[dIdx];
            _interiorActors.push({
              app: getEntitySpriteAppearance(p, 'coat', 'normal'),
              baseX: -0.05 + dIdx * 0.05,
              baseY: 0.08,
              seed: dIdx + 71,
              tag: p.name,
              color: '#fde047',
            });
          }

          for (let aIdx = 0; aIdx < _interiorActors.length; aIdx++) {
            const act = _interiorActors[aIdx];
            const phase = (patrolStep + act.seed) % 8;
            const dx = Math.sin(tSec * 1.4 + act.seed) * 0.028;
            const dy = Math.cos(tSec * 1.1 + act.seed * 1.7) * 0.02;
            const facing: 'right' | 'left' = phase % 4 < 2 ? 'right' : 'left';
            const spriteCanvas = getCachedSprite(act.app, facing);
            const charScale = getCharacterSpriteScale(act.app.race, isl.id);
            const sh = Math.max(16, Math.min(34, screenSize * 0.085 * charScale));
            const sw = sh * (spriteCanvas.width / spriteCanvas.height);
            const ax = sx + (act.baseX + dx) * screenSize;
            const ay = sy + (act.baseY + dy) * screenSize;
            ctx.drawImage(spriteCanvas, ax - sw * 0.5, ay - sh, sw, sh);
            if (act.tag && screenSize >= 320) {
              ctx.font = '700 9px Plus Jakarta Sans, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillStyle = '#050e1c';
              ctx.fillText(act.tag, ax + 1, ay - sh - 2);
              ctx.fillStyle = act.color ?? '#f8fafc';
              ctx.fillText(act.tag, ax, ay - sh - 3);
            }
          }
        }

        // Island label (crisp single-line name clear of island art)
        const showLabel =
          v.zoom >= 1.8 ||
          isl.id === selIslId ||
          (!isl.isMiniIsland && isl.dangerTier >= 4 && v.zoom >= 1.2);

        if (showLabel && v.zoom < 10.5) {
          const lx = sx;
          const placeBelow = !isl.isMiniIsland && isl.id !== 'isla-hombres-pez';
          const ly = placeBelow
            ? sy + screenSize * 0.45 + 14
            : sy - screenSize * 0.44 - 8;
          const labelText = isl.isMiniIsland ? `${isl.name} ✦` : isl.name;
          const estW = labelText.length * 6.5;
          let collides = false;
          if (isl.id !== selIslId) {
            for (let lIdx = 0; lIdx < _placedLabels.length; lIdx++) {
              const r = _placedLabels[lIdx];
              if (Math.abs(r.x - lx) < (r.w + estW) * 0.46 && Math.abs(r.y - ly) < 16) {
                collides = true;
                break;
              }
            }
          }
          if (!collides) {
            _placedLabels.push({ x: lx, y: ly, w: estW });
            _labelDrawPool.push({
              text: labelText,
              x: lx,
              y: ly,
              color:
                isl.id === selIslId
                  ? '#fde047'
                  : isl.isMiniIsland
                  ? '#fef08a'
                  : '#f8fafc',
              font:
                v.zoom >= 3.2
                  ? '800 12px Plus Jakarta Sans, sans-serif'
                  : '700 11px Plus Jakarta Sans, sans-serif',
            });
          }
        }
      }

      // Render all buffered island labels in a dedicated pass so neighboring islands never clip them
      if (_labelDrawPool.length > 0) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#040b17';
        for (let lIdx = 0; lIdx < _labelDrawPool.length; lIdx++) {
          const lbl = _labelDrawPool[lIdx];
          ctx.font = lbl.font;
          ctx.strokeText(lbl.text, lbl.x, lbl.y);
          ctx.fillStyle = lbl.color;
          ctx.fillText(lbl.text, lbl.x, lbl.y);
        }
        ctx.restore();
      }

      // Warm up to 2 islands in the off-screen smoothness fringe
      for (let q = 0; q < _prewarmQueue.length; q++) {
        getIslandPixelCanvas(_prewarmQueue[q].isl, _prewarmQueue[q].variant);
      }

      // Helper to render either a Red Dot (far zoom) or Pixel Ship (closer zoom)
      const drawVessel = (
        lat: number,
        lon: number,
        headLatLon: [number, number] | null,
        flagColor: string,
        isPlayer: boolean,
        isSelected: boolean,
        isBubbleCoated: boolean,
        label?: string,
        pirateId?: string,
        roamingNpcId?: string,
        badgeKind?: 'player' | 'roaming_special' | 'roaming' | 'special_event' | 'boss_troop' | 'fleet'
      ) => {
        projectToOut(lonToMapX(lon), latToMapY(lat), _screenOut);
        const sx = _screenOut.x;
        const sy = _screenOut.y;
        if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) return;

        let angle = 0;
        if (headLatLon) {
          projectToOut(lonToMapX(headLatLon[1]), latToMapY(headLatLon[0]), _headOut);
          angle = Math.atan2(_headOut.y - sy, _headOut.x - sx);
        }

        if (v.zoom < 2.6) {
          if (headLatLon) {
            ctx.save();
            ctx.strokeStyle =
              badgeKind === 'roaming_special'
                ? 'rgba(253, 224, 71, 0.88)'
                : 'rgba(226, 240, 255, 0.72)';
            ctx.lineWidth = badgeKind === 'roaming_special' ? 2 : 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - Math.cos(angle) * 13, sy - Math.sin(angle) * 13);
            ctx.stroke();
            ctx.restore();
          }

          const frameColor = isPlayer
            ? '#fde047'
            : badgeKind === 'roaming_special' || badgeKind === 'special_event'
            ? '#facc15'
            : badgeKind === 'roaming'
            ? '#38bdf8'
            : badgeKind === 'boss_troop'
            ? '#9f1239'
            : '#09111e';

          const dotSize = badgeKind === 'roaming_special' || isSelected ? 8 : 6;
          const halfDot = Math.round(dotSize / 2);
          ctx.fillStyle = frameColor;
          ctx.fillRect(
            Math.round(sx - halfDot - 1),
            Math.round(sy - halfDot - 1),
            dotSize + 2,
            dotSize + 2
          );
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(Math.round(sx - halfDot), Math.round(sy - halfDot), dotSize, dotSize);

          if (roamingNpcId && label && (badgeKind === 'roaming_special' || v.zoom >= 1.35)) {
            ctx.font = '800 9px Plus Jakarta Sans, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#040b17';
            ctx.fillText(label, sx + 1, sy - 9);
            ctx.fillStyle = badgeKind === 'roaming_special' ? '#fde047' : '#7dd3fc';
            ctx.fillText(label, sx, sy - 10);
          }
        } else {
          ctx.save();
          ctx.translate(sx, sy);
          if (isBubbleCoated) {
            ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
            ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          if (badgeKind === 'roaming_special' || isSelected) {
            ctx.strokeStyle = badgeKind === 'roaming_special' && !isSelected ? '#facc15' : '#fde047';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.stroke();
          } else if (badgeKind === 'roaming') {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (headLatLon) {
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-Math.cos(angle) * 14, -Math.sin(angle) * 14);
            ctx.stroke();
          }
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-7, 1, 14, 5);
          ctx.fillStyle = '#92400e';
          ctx.fillRect(-6, 0, 12, 4);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-1, -9, 2, 10);
          ctx.fillStyle = flagColor;
          ctx.fillRect(-5, -8, 9, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-2, -6, 3, 3);
          ctx.restore();

          if (label && (isPlayer || roamingNpcId)) {
            ctx.font = '800 10px Plus Jakarta Sans, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#040b17';
            ctx.fillText(label, sx + 1, sy - 14);
            ctx.fillStyle =
              badgeKind === 'roaming_special'
                ? '#fde047'
                : roamingNpcId
                ? '#7dd3fc'
                : '#fde047';
            ctx.fillText(label, sx, sy - 15);
          }
        }

        if (pirateId) {
          _hitsPool.push({ type: 'pirate', id: pirateId, x: sx, y: sy, r: 12 });
        } else if (roamingNpcId) {
          _hitsPool.push({ type: 'roaming_npc', id: roamingNpcId, x: sx, y: sy, r: 14 });
        }
      };

      // Bucketed (2s) red-dot filtering & roaming NPC recomputation
      const nowEpoch = Date.now();
      const dotBucket = Math.floor(nowEpoch / 2000);
      if (
        dotBucket !== lastDotBucket ||
        cachedDotIslands !== curIslands ||
        cachedDotPirates !== curPirates ||
        cachedDotBots !== curBots ||
        cachedDotSelPir !== selPirId ||
        cachedDotFilters !== curRedDotFilters
      ) {
        lastDotBucket = dotBucket;
        cachedDotIslands = curIslands;
        cachedDotPirates = curPirates;
        cachedDotBots = curBots;
        cachedDotSelPir = selPirId;
        cachedDotFilters = curRedDotFilters;

        const activeRoamingNpcs = getActiveRoamingShipNpcs(curIslands, nowEpoch);
        const dotCandidates = buildMapDotCandidates(
          curPirates,
          curBots,
          activeRoamingNpcs,
          selPirId
        );
        cachedVisibleCandidates = filterAndRankMapDots(
          dotCandidates,
          curRedDotFilters,
          MAX_IMPORTANT_RED_DOTS
        ).visible;
      }

      for (let idx = 0; idx < cachedVisibleCandidates.length; idx++) {
        const cand = cachedVisibleCandidates[idx];
        if (cand.kind === 'bot' && cand.bot) {
          const bot = cand.bot;
          const fromIsl = islandLookup.get(bot.fromIslandId);
          if (fromIsl) {
            projectToOut(lonToMapX(fromIsl.lon), latToMapY(fromIsl.lat), _screenOut);
            const fx = _screenOut.x;
            const fy = _screenOut.y;
            if (bot.status !== 'sailing' || !bot.toIslandId || bot.toIslandId === bot.fromIslandId) {
              if (
                fx < -PRELOAD_FRINGE_PX ||
                fx > w + PRELOAD_FRINGE_PX ||
                fy < -PRELOAD_FRINGE_PX ||
                fy > h + PRELOAD_FRINGE_PX
              ) {
                continue;
              }
            } else {
              const toIsl = islandLookup.get(bot.toIslandId);
              if (
                toIsl &&
                fromIsl.sea === toIsl.sea &&
                Math.abs(fromIsl.lon - toIsl.lon) < 165 &&
                Math.sign(fromIsl.lon || 1) === Math.sign(toIsl.lon || 1)
              ) {
                projectToOut(lonToMapX(toIsl.lon), latToMapY(toIsl.lat), _headOut);
                const tx = _headOut.x;
                const ty = _headOut.y;
                if (
                  (fx < -PRELOAD_FRINGE_PX && tx < -PRELOAD_FRINGE_PX) ||
                  (fx > w + PRELOAD_FRINGE_PX && tx > w + PRELOAD_FRINGE_PX) ||
                  (fy < -PRELOAD_FRINGE_PX && ty < -PRELOAD_FRINGE_PX) ||
                  (fy > h + PRELOAD_FRINGE_PX && ty > h + PRELOAD_FRINGE_PX)
                ) {
                  continue;
                }
              }
            }
          }

          const [bLat, bLon] = getBotPositionLatLon(bot, curIslands);
          const head = getBotHeadingLatLon(bot, curIslands);
          const offsetLon = bot.status === 'docked' ? Math.cos(bot.seed) * 1.6 : 0;
          const offsetLat = bot.status === 'docked' ? Math.sin(bot.seed) * 1.2 : 0;
          drawVessel(
            bLat + offsetLat,
            bLon + offsetLon,
            head,
            bot.flagColor,
            false,
            false,
            false,
            undefined,
            undefined,
            undefined,
            bot.roleKind
          );
        } else if (cand.kind === 'roaming_npc' && cand.roamingNpc) {
          const npc = cand.roamingNpc;
          const badgeLabel = npc.remainingWindowMinutes
            ? `${npc.def.name} · ${npc.remainingWindowMinutes}m`
            : npc.def.name;
          drawVessel(
            npc.lat,
            npc.lon,
            npc.headingLatLon,
            npc.def.flagColor,
            false,
            npc.def.id === selRoamId,
            false,
            badgeLabel,
            undefined,
            npc.def.id,
            npc.def.isSpecialEvent ? 'roaming_special' : 'roaming'
          );
        } else if (cand.kind === 'player' && cand.pirate) {
          const p = cand.pirate;
          const [pLat, pLon] = getPirateLatLon(p, curIslands);
          const head = getPirateHeadingLatLon(p, curIslands);
          const offLon = p.sailingToIslandId ? 0 : Math.cos(idx * 1.4) * 1.9;
          const offLat = p.sailingToIslandId ? 0 : Math.sin(idx * 1.4) * 1.3;
          drawVessel(
            pLat + offLat,
            pLon + offLon,
            head,
            p.flagColor,
            true,
            p.id === selPirId,
            Boolean(p.bubbleCoated),
            p.name,
            p.id,
            undefined,
            'player'
          );
        }
      }

      hitRegionsRef.current = _hitsPool;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && rafId === 0) {
        rafId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    rafId = requestAnimationFrame(draw);
    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Drag-to-pan and Wheel-to-zoom interactions
  const dragRef = useRef<{ active: boolean; x: number; y: number; moved: number }>({
    active: false,
    x: 0,
    y: 0,
    moved: 0,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, x: e.clientX, y: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    dragRef.current.moved += Math.hypot(dx, dy);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const baseScale = Math.max(canvas.width / MAP_W, canvas.height / MAP_H);
    const scale = baseScale * viewRef.current.zoom;
    const wx = lonToMapX(viewRef.current.centerLon) - dx / scale;
    const wy = Math.max(20, Math.min(MAP_H - 20, latToMapY(viewRef.current.centerLat) - dy / scale));
    const [nextLat, nextLon] = mapXYToLatLon(wx, wy);
    viewRef.current.centerLat = nextLat;
    viewRef.current.centerLon = nextLon;
    targetViewRef.current.centerLat = nextLat;
    targetViewRef.current.centerLon = nextLon;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const moved = dragRef.current.moved;
    dragRef.current.active = false;
    if (moved > 7) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const hits = hitRegionsRef.current;
    for (const h of hits) {
      if (h.type === 'pirate' && Math.hypot(h.x - clickX, h.y - clickY) <= h.r) {
        propsRef.current.onSelectPirate(h.id);
        return;
      }
      if (h.type === 'roaming_npc' && Math.hypot(h.x - clickX, h.y - clickY) <= h.r) {
        propsRef.current.onSelectRoamingNpc?.(h.id);
        return;
      }
    }
    for (const h of hits) {
      if (h.type === 'island' && Math.hypot(h.x - clickX, h.y - clickY) <= h.r) {
        propsRef.current.onSelectIsland(h.id);
        return;
      }
    }
  };

  const applyMapZoomStep = (
    mult: number,
    pointerClient?: { clientX: number; clientY: number }
  ) => {
    if (zoomLatchRef.current) return;
    const canvas = canvasRef.current;
    const prevZoom = targetViewRef.current.zoom;
    const rawNext = prevZoom * mult;
    const deltaDir: 'in' | 'out' = mult > 1 ? 'in' : 'out';

    let nextCenterLat = targetViewRef.current.centerLat;
    let nextCenterLon = targetViewRef.current.centerLon;

    if (canvas && pointerClient) {
      const rect = canvas.getBoundingClientRect();
      const pointerX = pointerClient.clientX - rect.left;
      const pointerY = pointerClient.clientY - rect.top;
      const w = canvas.width;
      const h = canvas.height;
      const baseScale = Math.max(w / MAP_W, h / MAP_H);
      const oldScale = baseScale * prevZoom;
      const clampedPreview = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, rawNext));
      const newScale = baseScale * clampedPreview;
      const leftOffsetPx =
        propsRef.current.leftMenuOpen && w >= 1024
          ? 270
          : propsRef.current.sidePanelOpen && w >= 1024
          ? 210
          : 0;
      const cx = (w + leftOffsetPx) * 0.5;
      const cy = h * 0.5;
      const oldCenterX = lonToMapX(nextCenterLon);
      const oldCenterY = latToMapY(nextCenterLat);
      const worldUnderX = oldCenterX + (pointerX - cx) / oldScale;
      const worldUnderY = oldCenterY + (pointerY - cy) / oldScale;
      const targetCenterX = worldUnderX - (pointerX - cx) / newScale;
      const targetCenterY = Math.max(
        40,
        Math.min(MAP_H - 40, worldUnderY - (pointerY - cy) / newScale)
      );
      [nextCenterLat, nextCenterLon] = mapXYToLatLon(targetCenterX, targetCenterY);
    } else if (!pointerClient && deltaDir === 'in' && prevZoom >= 3.2 && propsRef.current.selectedIslandId) {
      const selIsl = propsRef.current.islands.find(
        (i) => i.id === propsRef.current.selectedIslandId
      );
      if (selIsl) {
        nextCenterLat += (selIsl.lat - nextCenterLat) * 0.45;
        nextCenterLon = lerpWrappedLon(nextCenterLon, selIsl.lon, 0.45);
      }
    }

    const res = evaluateMapZoomTransition(
      prevZoom,
      rawNext,
      deltaDir,
      nextCenterLat,
      nextCenterLon,
      propsRef.current.islands,
      propsRef.current.selectedIslandId
    );

    if (res.action === 'to_globe') {
      if (propsRef.current.onZoomOutToGlobe) {
        zoomLatchRef.current = true;
        propsRef.current.onZoomOutToGlobe(res.lat, res.lon);
      }
      return;
    }

    if (res.action === 'to_island') {
      if (propsRef.current.onZoomInToIsland) {
        zoomLatchRef.current = true;
        propsRef.current.onZoomInToIsland(res.island);
      }
      return;
    }

    targetViewRef.current = {
      centerLat: nextCenterLat,
      centerLon: nextCenterLon,
      zoom: res.zoom,
    };
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const mult = e.deltaY < 0 ? 1.2 : 0.83;
    applyMapZoomStep(mult, { clientX: e.clientX, clientY: e.clientY });
  };

  const adjustZoom = (mult: number) => {
    applyMapZoomStep(mult);
  };

  const focusSelectedShip = () => {
    const p = pirates.find((x) => x.id === selectedPirateId) ?? pirates[0];
    if (!p) return;
    const [lat, lon] = getPirateLatLon(p, islands);
    targetViewRef.current = { centerLat: lat, centerLon: lon, zoom: 4.5 };
    viewRef.current = { centerLat: lat, centerLon: lon, zoom: 4.5 };
    lastReadoutRef.current = 4.5;
    setZoomReadout(4.5);
  };

  const activePirate = pirates.find((p) => p.id === selectedPirateId) ?? pirates[0];
  const selectedIsFishman = selectedIslandId === 'isla-hombres-pez';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#060d18]">
      <canvas
        ref={canvasRef}
        data-testid="world-map-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Unified Continuum Zoom Toolbar (Bottom-Right, light frosted glass) */}
      <div
        data-testid="map-zoom-toolbar"
        className="pointer-events-auto fixed bottom-20 md:bottom-4 right-3 z-30 flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/84 backdrop-blur-sm p-1.5 shadow-[0_14px_38px_rgba(15,23,42,0.16)]"
      >
        <button
          type="button"
          data-testid="map-zoom-in-btn"
          onClick={() => adjustZoom(1.38)}
          aria-label="Acercar mapa"
          title="Acercar hacia el interior de la isla"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50/90 text-slate-800 hover:border-amber-500 hover:bg-white cursor-pointer"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          data-testid="map-zoom-out-btn"
          onClick={() => adjustZoom(0.72)}
          aria-label="Alejar mapa"
          title="Alejar hacia el Globo 3D"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50/90 text-slate-800 hover:border-amber-500 hover:bg-white cursor-pointer"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span
          data-testid="map-zoom-readout"
          className="px-1.5 font-mono-num text-[11px] font-bold text-sky-700 whitespace-nowrap"
        >
          {zoomReadout.toFixed(1)}x · Mapa 2D
        </span>
        <button
          type="button"
          data-testid="map-center-ship-btn"
          onClick={focusSelectedShip}
          className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50/90 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:border-amber-500 hover:bg-white cursor-pointer"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mi barco</span>
        </button>
      </div>

      {/* Fish-Man Island Trench Interaction Card when selected on 2D Map */}
      {selectedIsFishman && (
        <div
          data-testid="map-trench-modal"
          className="pointer-events-auto fixed bottom-32 md:bottom-16 right-3 z-30 w-80 rounded-2xl border border-cyan-300/90 bg-white/86 backdrop-blur-sm p-3.5 text-slate-900 shadow-[0_14px_38px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-cyan-700">
                {trenchSubmerged ? 'Reino de Ryugu · 10,000 m' : 'Fosa Abisal · Isla de los Hombres-Pez'}
              </div>
              <h3 className="font-display text-sm font-black text-slate-900">
                {trenchSubmerged ? 'Palacio Ryugu bajo el mar' : 'Fosa oceánica abisal'}
              </h3>
            </div>
            <button
              type="button"
              data-testid="map-trench-toggle-btn"
              onClick={() => setTrenchSubmerged((prev) => !prev)}
              className="flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-cyan-500 cursor-pointer shrink-0"
            >
              {trenchSubmerged ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              <span>{trenchSubmerged ? 'Subir' : 'Bajar'}</span>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-700">
            {trenchSubmerged
              ? 'La doble burbuja protege la Colina Coral y el Palacio Ryugu bajo el Árbol Solar Eve.'
              : 'Pulsa «Bajar» para descender 10,000 metros por la fosa. Para navegar aquí necesitas revestir tu barco en una burbuja de Sabaody.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {activePirate?.bubbleCoated ? (
              onSailToIsland && activePirate.islandId !== 'isla-hombres-pez' && (
                <button
                  type="button"
                  onClick={() => onSailToIsland('isla-hombres-pez')}
                  className="flex items-center gap-1 rounded-lg bg-[#f5b82e] px-2.5 py-1.5 text-[11px] font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Zarpar con burbuja</span>
                </button>
              )
            ) : (
              onGoToSabaody && (
                <button
                  type="button"
                  onClick={onGoToSabaody}
                  className="flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50/90 px-2.5 py-1.5 text-[11px] font-bold text-cyan-800 hover:bg-cyan-100 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Ir a Sabaody por burbuja</span>
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
