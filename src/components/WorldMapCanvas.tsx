import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Compass, Globe, LocateFixed, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
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
  onSailToIsland?: (islandId: string) => void;
  onGoToSabaody?: () => void;
}

const MAP_W = 2400;
const MAP_H = 1200;

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
  onSailToIsland,
  onGoToSabaody,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<{ centerLat: number; centerLon: number; zoom: number }>({
    centerLat: initialFocus?.lat ?? 4,
    centerLon: initialFocus?.lon ?? -45,
    zoom: initialFocus?.zoom ?? 1.15,
  });

  const [trenchSubmerged, setTrenchSubmerged] = useState(false);
  const [zoomReadout, setZoomReadout] = useState<number>(viewRef.current.zoom);
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
  };

  useEffect(() => {
    if (!initialFocus) return;
    viewRef.current = {
      centerLat: initialFocus.lat,
      centerLon: initialFocus.lon,
      zoom: Math.max(0.78, Math.min(18, initialFocus.zoom ?? 4.2)),
    };
    setZoomReadout(viewRef.current.zoom);
  }, [initialFocus]);

  useEffect(() => {
    if (selectedIslandId !== 'isla-hombres-pez') {
      setTrenchSubmerged(false);
    }
  }, [selectedIslandId]);

  // Persistent hit rects updated every draw so clicking works accurately on islands & ships
  const hitRegionsRef = useRef<
    Array<{ type: 'island' | 'pirate' | 'roaming_npc'; id: string; x: number; y: number; r: number }>
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let rafId = 0;
    let lastDraw = 0;

    const getTransform = () => {
      const w = canvas.width;
      const h = canvas.height;
      const v = viewRef.current;
      // At zoom=1.0, full map width fits nicely with small margin
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
      return { w, h, scale, cx, cy, worldCenterX, worldCenterY };
    };

    const DRAW_MARGIN_PX = 48;
    const PRELOAD_FRINGE_PX = 280;
    const MAX_PREWARM_PER_FRAME = 2;

    let cachedIslandsRef: Island[] | null = null;
    const islandLookup = new Map<string, Island>();

    const draw = (nowMs: number) => {
      if (document.hidden) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(draw);
      if (nowMs - lastDraw < 40) return; // smooth ~25fps CPU friendly
      lastDraw = nowMs;

      const parent = canvas.parentElement;
      if (parent) {
        const pw = parent.clientWidth || window.innerWidth;
        const ph = parent.clientHeight || window.innerHeight;
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
      }

      const { w, h, scale, cx, cy, worldCenterX, worldCenterY } = getTransform();
      const v = viewRef.current;
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
      const worldToScreen = (wx: number, wy: number): [number, number] => {
        let dx = wx - worldCenterX;
        if (dx > MAP_W / 2) dx -= MAP_W;
        if (dx < -MAP_W / 2) dx += MAP_W;
        return [cx + dx * scale, cy + (wy - worldCenterY) * scale];
      };

      // Tile horizontally (-MAP_W, 0, +MAP_W) so panning across ±180° is seamless
      for (const wrapShift of [-MAP_W, 0, MAP_W]) {
        const sx = cx + (0 + wrapShift - worldCenterX) * scale;
        const sy = cy + (0 - worldCenterY) * scale;
        const sw = MAP_W * scale;
        const sh = MAP_H * scale;
        if (sx + sw < -20 || sx > w + 20) continue;
        ctx.drawImage(backdrop, sx, sy, sw, sh);
      }

      // Active player voyage dashed golden route arc
      const trackedPirate =
        curPirates.find((p) => p.id === selPirId && p.sailingToIslandId) ??
        curPirates.find((p) => p.sailingToIslandId);
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
            const [px, py] = worldToScreen(lonToMapX(lon), latToMapY(lat));
            if (step === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      const hits: Array<{ type: 'island' | 'pirate' | 'roaming_npc'; id: string; x: number; y: number; r: number }> = [];
      const placedLabels: Array<{ x: number; y: number; w: number }> = [];
      const prewarmQueue: Array<{ isl: Island; variant: 'surface' | 'underwater' }> = [];
      const tSec = nowMs * 0.001;
      const patrolStep = Math.floor(nowMs / 1800);

      // Draw islands inside viewport + queue outer smoothness fringe for zero pop-in panning
      for (let i = 0; i < curIslands.length; i++) {
        const isl = curIslands[i];
        const wx = lonToMapX(isl.lon);
        const wy = latToMapY(isl.lat);
        const [sx, sy] = worldToScreen(wx, wy);

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
            prewarmQueue.length < MAX_PREWARM_PER_FRAME &&
            sx + halfScreen >= -PRELOAD_FRINGE_PX &&
            sx - halfScreen <= w + PRELOAD_FRINGE_PX &&
            sy + halfScreen >= -PRELOAD_FRINGE_PX &&
            sy - halfScreen <= h + PRELOAD_FRINGE_PX &&
            !hasIslandArtCached(isl.id, variant)
          ) {
            prewarmQueue.push({ isl, variant });
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

        hits.push({ type: 'island', id: isl.id, x: sx, y: sy, r: Math.max(18, screenSize * 0.44) });

        // Live moving island interior NPCs / Bosses / Docked Players at DEEP interior zoom only!
        if (
          v.zoom >= 7.0 &&
          screenSize >= 260 &&
          !isl.isMiniIsland &&
          (isl.id !== 'isla-hombres-pez' || trenchSubmergedRef.current)
        ) {
          const npcs = getNpcsForIsland(isl);
          const miniBosses = getMiniBossesForIsland(isl);
          const boss = getBossForIsland(isl);
          const docked = curPirates.filter((p) => !p.sailingToIslandId && p.islandId === isl.id);

          const actors: Array<{
            app: PirateSpriteAppearance;
            baseX: number;
            baseY: number;
            seed: number;
            tag?: string;
            color?: string;
          }> = [];

          actors.push({
            app: getEntitySpriteAppearance(boss, 'coat', 'robust'),
            baseX: 0.16,
            baseY: -0.1,
            seed: 1,
            tag: boss.name,
            color: '#fda4af',
          });

          for (let m = 0; m < miniBosses.length && m < 2; m++) {
            actors.push({
              app: getEntitySpriteAppearance(miniBosses[m], 'coat', 'normal'),
              baseX: m === 0 ? 0.12 : -0.14,
              baseY: 0.04,
              seed: m + 11,
            });
          }

          const slotCoords: Array<[number, number]> = [
            [-0.18, 0.06],
            [-0.08, -0.02],
            [0.02, 0.1],
            [-0.02, -0.14],
            [0.1, 0.14],
          ];
          for (let qIdx = 0; qIdx < npcs.length && qIdx < 5; qIdx++) {
            const [bx, by] = slotCoords[qIdx % slotCoords.length];
            actors.push({
              app: getEntitySpriteAppearance(npcs[qIdx], 'shirt', 'normal'),
              baseX: bx,
              baseY: by,
              seed: qIdx + 31,
            });
          }

          for (let dIdx = 0; dIdx < docked.length && dIdx < 4; dIdx++) {
            const p = docked[dIdx];
            actors.push({
              app: getEntitySpriteAppearance(p, 'coat', 'normal'),
              baseX: -0.05 + dIdx * 0.05,
              baseY: 0.08,
              seed: dIdx + 71,
              tag: p.name,
              color: '#fde047',
            });
          }

          for (const act of actors) {
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
            ctx.drawImage(spriteCanvas, ax - sw / 2, ay - sh, sw, sh);
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

        // Island label (crisp single-line name clear of island art, matching image_ab1711ec.png)
        const showLabel =
          v.zoom >= 2.0 ||
          isl.id === selIslId ||
          (!isl.isMiniIsland && isl.dangerTier >= 4 && v.zoom >= 1.25);

        if (showLabel && v.zoom < 10.5) {
          const lx = sx;
          const placeBelow = !isl.isMiniIsland && isl.id !== 'isla-hombres-pez';
          const ly = placeBelow
            ? sy + screenSize * 0.45 + 14
            : sy - screenSize * 0.44 - 8;
          const labelText = isl.isMiniIsland ? `${isl.name} ✦` : isl.name;
          const estW = labelText.length * 6.5;
          const collides =
            isl.id !== selIslId &&
            placedLabels.some((r) => Math.abs(r.x - lx) < (r.w + estW) * 0.46 && Math.abs(r.y - ly) < 16);
          if (!collides) {
            placedLabels.push({ x: lx, y: ly, w: estW });
            ctx.save();
            ctx.font = v.zoom >= 3.2 ? '800 12px Plus Jakarta Sans, sans-serif' : '700 11px Plus Jakarta Sans, sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#040b17';
            ctx.strokeText(labelText, lx, ly);
            ctx.fillStyle =
              isl.id === selIslId
                ? '#fde047'
                : isl.isMiniIsland
                ? '#fef08a'
                : '#f8fafc';
            ctx.fillText(labelText, lx, ly);
            ctx.restore();
          }
        }
      }

      // Warm up to 2 islands in the off-screen smoothness fringe without blocking visible frame
      for (let q = 0; q < prewarmQueue.length; q++) {
        getIslandPixelCanvas(prewarmQueue[q].isl, prewarmQueue[q].variant);
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
        const [sx, sy] = worldToScreen(lonToMapX(lon), latToMapY(lat));
        if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) return;

        let angle = 0;
        if (headLatLon) {
          const [hx, hy] = worldToScreen(lonToMapX(headLatLon[1]), latToMapY(headLatLon[0]));
          angle = Math.atan2(hy - sy, hx - sx);
        }

        if (v.zoom < 2.6) {
          // Far / Macro Zoom: Crisp Red Dots (puntos rojos) + tapered white wake
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
          ctx.fillRect(Math.round(sx - halfDot - 1), Math.round(sy - halfDot - 1), dotSize + 2, dotSize + 2);
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
          // Detailed Pixel Ship
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
          // Wake
          if (headLatLon) {
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-Math.cos(angle) * 14, -Math.sin(angle) * 14);
            ctx.stroke();
          }
          // Hull & Sail
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
          hits.push({ type: 'pirate', id: pirateId, x: sx, y: sy, r: 12 });
        } else if (roamingNpcId) {
          hits.push({ type: 'roaming_npc', id: roamingNpcId, x: sx, y: sy, r: 14 });
        }
      };

      // Rank & filter all visible vessels/red dots (players + ship-only roaming NPCs + world bots)
      const activeRoamingNpcs = getActiveRoamingShipNpcs(curIslands, Date.now());
      const dotCandidates = buildMapDotCandidates(
        curPirates,
        curBots,
        activeRoamingNpcs,
        selPirId
      );
      const { visible: visibleCandidates } = filterAndRankMapDots(
        dotCandidates,
        curRedDotFilters,
        MAX_IMPORTANT_RED_DOTS
      );

      for (let idx = 0; idx < visibleCandidates.length; idx++) {
        const cand = visibleCandidates[idx];
        if (cand.kind === 'bot' && cand.bot) {
          const bot = cand.bot;
          const fromIsl = islandLookup.get(bot.fromIslandId);
          if (fromIsl) {
            const [fx, fy] = worldToScreen(lonToMapX(fromIsl.lon), latToMapY(fromIsl.lat));
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
                const [tx, ty] = worldToScreen(lonToMapX(toIsl.lon), latToMapY(toIsl.lat));
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

      hitRegionsRef.current = hits;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && rafId === 0) {
        rafId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    rafId = requestAnimationFrame(draw);
    return () => {
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

    // Check pirate & roaming NPC ships first, then islands
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

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const prevZoom = viewRef.current.zoom;
    const factor = e.deltaY < 0 ? 1.18 : 0.85;
    const rawNext = prevZoom * factor;
    if (e.deltaY > 0 && prevZoom <= 0.82 && rawNext < 0.74 && propsRef.current.onZoomOutToGlobe) {
      propsRef.current.onZoomOutToGlobe(viewRef.current.centerLat, viewRef.current.centerLon);
      return;
    }
    const nextZoom = Math.max(0.78, Math.min(18, rawNext));
    if (canvas && nextZoom !== prevZoom) {
      const rect = canvas.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const w = canvas.width;
      const h = canvas.height;
      const baseScale = Math.max(w / MAP_W, h / MAP_H);
      const oldScale = baseScale * prevZoom;
      const newScale = baseScale * nextZoom;
      const leftOffsetPx =
        propsRef.current.leftMenuOpen && w >= 1024
          ? 270
          : propsRef.current.sidePanelOpen && w >= 1024
          ? 210
          : 0;
      const cx = (w + leftOffsetPx) * 0.5;
      const cy = h * 0.5;
      const oldCenterX = lonToMapX(viewRef.current.centerLon);
      const oldCenterY = latToMapY(viewRef.current.centerLat);
      const worldUnderX = oldCenterX + (pointerX - cx) / oldScale;
      const worldUnderY = oldCenterY + (pointerY - cy) / oldScale;
      const nextCenterX = worldUnderX - (pointerX - cx) / newScale;
      const nextCenterY = Math.max(40, Math.min(MAP_H - 40, worldUnderY - (pointerY - cy) / newScale));
      const [nLat, nLon] = mapXYToLatLon(nextCenterX, nextCenterY);
      viewRef.current.centerLat = nLat;
      viewRef.current.centerLon = nLon;
    }
    viewRef.current.zoom = nextZoom;
    setZoomReadout(nextZoom);
  };

  const adjustZoom = (mult: number) => {
    const next = Math.max(0.78, Math.min(18, viewRef.current.zoom * mult));
    viewRef.current.zoom = next;
    setZoomReadout(next);
  };

  const focusSelectedShip = () => {
    const p = pirates.find((x) => x.id === selectedPirateId) ?? pirates[0];
    if (!p) return;
    const [lat, lon] = getPirateLatLon(p, islands);
    viewRef.current = { centerLat: lat, centerLon: lon, zoom: 4.5 };
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

      {/* Map Toolbar (Bottom-Right, clean dark panel without backdrop-blur) */}
      <div className="pointer-events-auto fixed bottom-20 md:bottom-4 right-3 z-30 flex items-center gap-1.5 rounded-xl border border-[#22395d] bg-[#0a1426] p-1.5 shadow-2xl">
        <button
          type="button"
          data-testid="map-zoom-in-btn"
          onClick={() => adjustZoom(1.35)}
          aria-label="Acercar mapa"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#101f37] text-slate-100 hover:border-amber-400 cursor-pointer"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          data-testid="map-zoom-out-btn"
          onClick={() => adjustZoom(0.74)}
          aria-label="Alejar mapa"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#101f37] text-slate-100 hover:border-amber-400 cursor-pointer"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="px-1.5 font-mono-num text-[11px] font-bold text-slate-300">
          {zoomReadout.toFixed(1)}x
        </span>
        <button
          type="button"
          data-testid="map-center-ship-btn"
          onClick={focusSelectedShip}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#101f37] px-2.5 py-1.5 text-[11px] font-bold text-amber-300 hover:border-amber-400 cursor-pointer"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mi barco</span>
        </button>
        {onZoomOutToGlobe && (
          <button
            type="button"
            data-testid="map-to-globe-btn"
            onClick={() => onZoomOutToGlobe(viewRef.current.centerLat, viewRef.current.centerLon)}
            className="flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950 hover:bg-sky-400 cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Globo 3D</span>
          </button>
        )}
      </div>

      {/* Fish-Man Island Trench Interaction Card when selected on 2D Map */}
      {selectedIsFishman && (
        <div
          data-testid="map-trench-modal"
          className="pointer-events-auto fixed bottom-32 md:bottom-16 right-3 z-30 w-80 rounded-2xl border border-cyan-400/60 bg-[#071529] p-3.5 text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                {trenchSubmerged ? 'Reino de Ryugu · 10,000 m' : 'Fosa Abisal · Isla de los Hombres-Pez'}
              </div>
              <h3 className="font-display text-sm font-black text-white">
                {trenchSubmerged ? 'Palacio Ryugu bajo el mar' : 'Fosa oceánica abisal'}
              </h3>
            </div>
            <button
              type="button"
              data-testid="map-trench-toggle-btn"
              onClick={() => setTrenchSubmerged((prev) => !prev)}
              className="flex items-center gap-1 rounded-lg bg-cyan-400 px-2.5 py-1.5 text-[11px] font-black text-slate-950 hover:bg-cyan-300 cursor-pointer shrink-0"
            >
              {trenchSubmerged ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              <span>{trenchSubmerged ? 'Subir' : 'Bajar'}</span>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
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
                  className="flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
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
                  className="flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-950/60 px-2.5 py-1.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-900/60 cursor-pointer"
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
