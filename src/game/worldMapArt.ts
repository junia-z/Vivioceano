import { createSeededRng } from './sim';
import type { Island } from './types';

const ART_SIZE = 256;
export const MAX_ISLAND_ART_CACHE = 140;
const artCache = new Map<string, HTMLCanvasElement>();

export function hasIslandArtCached(
  islandId: string,
  variant: 'surface' | 'underwater' = 'surface'
): boolean {
  const effectiveVariant = islandId === 'isla-hombres-pez' ? variant : 'surface';
  return artCache.has(`${islandId}:${effectiveVariant}`);
}

export function getIslandArtCacheSize(): number {
  return artCache.size;
}

function hashId(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  ctx.fillStyle = color;
  const r2 = r * r;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      if (dx * dx + dy * dy <= r2) {
        ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
      }
    }
  }
}

function drawJapaneseHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roofColor: string,
  roofShade: string,
  w = 14
) {
  const h = Math.round(w * 0.72);
  // Shadow
  drawRect(ctx, x + 1, y + h, w, 2, 'rgba(0,0,0,0.28)');
  // White plaster walls & timber frame
  drawRect(ctx, x, y, w, h, '#f8fafc');
  drawRect(ctx, x, y, w, 1, '#334155');
  drawRect(ctx, x, y + h - 1, w, 1, '#475569');
  drawRect(ctx, x + Math.floor(w / 2), y + 2, 1, h - 3, '#94a3b8');
  drawRect(ctx, x + 2, y + Math.floor(h / 2), w - 4, 1, '#94a3b8');
  // Pitched roof overhang
  drawRect(ctx, x - 2, y - 4, w + 4, 5, roofColor);
  drawRect(ctx, x - 1, y - 6, w + 2, 2, roofShade);
  drawRect(ctx, x + 1, y - 7, w - 2, 1, roofShade);
}

function drawCottage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roofColor: string,
  wallColor = '#fef3c7',
  w = 13
) {
  const h = 9;
  drawRect(ctx, x + 1, y + h, w, 2, 'rgba(0,0,0,0.25)');
  drawRect(ctx, x, y, w, h, wallColor);
  drawRect(ctx, x - 1, y - 4, w + 2, 4, roofColor);
  drawRect(ctx, x + 1, y - 6, w - 2, 2, roofColor);
  drawRect(ctx, x + 2, y + 3, 3, 3, '#fbbf24');
  drawRect(ctx, x + w - 5, y + 3, 3, 6, '#5c3317');
}

function drawTorii(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1) {
  const w = Math.round(14 * scale);
  const h = Math.round(12 * scale);
  drawRect(ctx, cx - Math.floor(w / 2) - 2, cy - h, w + 4, 2, '#991b1b');
  drawRect(ctx, cx - Math.floor(w / 2), cy - h + 2, w, 2, '#dc2626');
  drawRect(ctx, cx - Math.floor(w * 0.35), cy - h + 4, w * 0.7, 2, '#b91c1c');
  drawRect(ctx, cx - Math.floor(w * 0.32), cy - h + 2, 2, h - 2, '#dc2626');
  drawRect(ctx, cx + Math.floor(w * 0.32) - 2, cy - h + 2, 2, h - 2, '#dc2626');
}

function drawSakuraTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, r = 7) {
  drawRect(ctx, cx - 1, cy + 1, 3, 5, '#5c3317');
  drawCircle(ctx, cx, cy, r, '#f472b6');
  drawCircle(ctx, cx - 2, cy - 2, Math.max(3, r - 2), '#f9a8d4');
  drawCircle(ctx, cx + 1, cy - 3, Math.max(2, r - 4), '#fbcfe8');
}

function drawPineTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, h = 11) {
  drawRect(ctx, cx - 1, cy + 2, 2, 4, '#451a03');
  drawRect(ctx, cx - 4, cy - 1, 8, 4, '#14532d');
  drawRect(ctx, cx - 3, cy - 4, 6, 4, '#15803d');
  drawRect(ctx, cx - 2, cy - Math.round(h * 0.65), 4, 3, '#166534');
  drawRect(ctx, cx - 1, cy - Math.round(h * 0.8), 2, 2, '#22c55e');
}

function drawPalmTree(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  drawRect(ctx, cx - 1, cy - 5, 2, 10, '#78350f');
  drawRect(ctx, cx - 6, cy - 7, 5, 2, '#16a34a');
  drawRect(ctx, cx + 1, cy - 7, 5, 2, '#22c55e');
  drawRect(ctx, cx - 4, cy - 9, 8, 2, '#4ade80');
}

function drawCloudCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.94
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const puffs = [
    { dx: -rx * 0.45, dy: ry * 0.15, r: ry * 0.8 },
    { dx: -rx * 0.15, dy: -ry * 0.2, r: ry * 0.95 },
    { dx: rx * 0.22, dy: -ry * 0.15, r: ry * 0.9 },
    { dx: rx * 0.48, dy: ry * 0.15, r: ry * 0.72 },
    { dx: 0, dy: ry * 0.25, r: ry * 0.85 },
  ];
  for (const p of puffs) {
    drawCircle(ctx, cx + p.dx, cy + p.dy + 2, p.r, '#cbd5e1');
  }
  for (const p of puffs) {
    drawCircle(ctx, cx + p.dx, cy + p.dy, p.r, '#ffffff');
  }
  ctx.restore();
}

function drawMountain(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  halfW: number,
  height: number,
  rockColor: string,
  shadeColor: string,
  snowCap = true
) {
  for (let row = 0; row < height; row++) {
    const t = row / height;
    const w = Math.max(2, Math.round(halfW * (1 - t)));
    const y = Math.round(baseY - row);
    drawRect(ctx, cx - w, y, w * 2, 1, rockColor);
    drawRect(ctx, cx, y, w, 1, shadeColor);
    if (snowCap && t > 0.72) {
      drawRect(ctx, cx - w, y, w * 2, 1, t > 0.84 ? '#ffffff' : '#e2e8f0');
    }
  }
}

type SilhouetteKind =
  | 'organic'
  | 'crescent'
  | 'octagon_sea'
  | 'ship_hull'
  | 'bridge'
  | 'ring_archipelago'
  | 'twin_split'
  | 'cloud_bank'
  | 'heart'
  | 'jagged_volcano'
  | 'fortress_plateau';

function getSilhouetteKind(island: Island): SilhouetteKind {
  switch (island.id) {
    case 'marineford':
    case 'nuevo-marineford':
    case 'mini-baterilla':
      return 'crescent';
    case 'impel-down':
    case 'enies-lobby':
    case 'mini-ilusia':
      return 'octagon_sea';
    case 'thriller-bark':
    case 'reino-germa':
    case 'isla-barco-guerra':
    case 'mini-baratie':
      return 'ship_hull';
    case 'tequila-wolf':
    case 'mini-estacion-shift':
      return 'bridge';
    case 'anillos-largos':
    case 'archipielago-sabaody':
    case 'islas-nanatsu':
    case 'mini-bancos-coral':
      return 'ring_archipelago';
    case 'punk-hazard':
    case 'jaya':
    case 'islas-conomi':
    case 'isla-cactus':
    case 'mini-isla-bigotes':
      return 'twin_split';
    case 'skypiea':
    case 'weatheria':
    case 'merveille':
    case 'isla-perdida':
    case 'mini-isla-bruma':
      return 'cloud_bank';
    case 'amazon-lily':
    case 'isla-momoiro':
      return 'heart';
    case 'onigashima':
    case 'hachinosu':
    case 'isla-raijin':
    case 'isla-kuraigana':
    case 'mini-atolones-azufre':
      return 'jagged_volcano';
    case 'dressrosa':
    case 'mary-geoise':
    case 'water-7':
    case 'islas-polestar':
    case 'mini-shell-town':
    case 'mini-roca-tronos':
      return 'fortress_plateau';
    default:
      return 'organic';
  }
}

function drawLandmassBase(
  ctx: CanvasRenderingContext2D,
  island: Island,
  baseRadius: number,
  options?: {
    cliffRim?: boolean;
    sandColor?: string;
    grassA?: string;
    grassB?: string;
    grassC?: string;
    coastGlow?: boolean;
  }
): { land: boolean[][]; distGrid: number[][] } {
  const seed = hashId(island.id);
  const rng = createSeededRng(seed);
  const cx = ART_SIZE / 2;
  const cy = ART_SIZE / 2;
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;
  const kind = getSilhouetteKind(island);
  const stretchX =
    island.id === 'elbaph'
      ? 1.18
      : kind === 'ship_hull' || kind === 'bridge'
      ? 1.24
      : 0.88 + rng() * 0.26;
  const stretchY =
    island.id === 'elbaph'
      ? 0.86
      : kind === 'ship_hull'
      ? 0.72
      : 0.84 + rng() * 0.24;

  const land: boolean[][] = Array.from({ length: ART_SIZE }, () => Array(ART_SIZE).fill(false));
  const distGrid: number[][] = Array.from({ length: ART_SIZE }, () => Array(ART_SIZE).fill(99));

  // Pixelize at 2px grid blocks for crisp retro pixel art
  const step = 2;
  for (let y = 0; y < ART_SIZE; y += step) {
    for (let x = 0; x < ART_SIZE; x += step) {
      const dx = (x - cx) / stretchX;
      const dy = (y - cy) / stretchY;
      const angle = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy);
      let d = 99;

      if (kind === 'crescent') {
        // Marineford-style harbor bay carved at the south
        const outerD = r - (baseRadius * 0.96 + Math.cos(angle * 2) * 5);
        const bayD = Math.hypot(x - cx, y - (cy + baseRadius * 0.42)) - baseRadius * 0.44;
        d = Math.max(outerD, -bayD);
      } else if (kind === 'octagon_sea') {
        const oct = Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * 0.72);
        d = oct - baseRadius * 0.86;
      } else if (kind === 'ship_hull') {
        // Pointed bow on right, squared stern on left
        const nx = (x - cx) / (baseRadius * 1.12);
        const ny = (y - cy) / (baseRadius * 0.56);
        const hull = Math.abs(ny) - (1 - Math.max(0, nx) * 0.65) * 0.92;
        const capX = Math.abs(nx) - 1;
        d = Math.max(hull, capX) * baseRadius * 0.7;
      } else if (kind === 'bridge') {
        const leftIsl = Math.hypot(x - (cx - baseRadius * 0.72), y - cy) - baseRadius * 0.36;
        const rightIsl = Math.hypot(x - (cx + baseRadius * 0.72), y - cy) - baseRadius * 0.36;
        const span = Math.max(Math.abs(x - cx) - baseRadius * 0.76, Math.abs(y - cy) - 9);
        d = Math.min(leftIsl, rightIsl, span);
      } else if (kind === 'ring_archipelago') {
        const count = island.id === 'anillos-largos' ? 6 : 5;
        let best = 99;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + 0.35;
          const subR = baseRadius * (island.id === 'anillos-largos' ? 0.25 : 0.34);
          const orbit = baseRadius * (island.id === 'anillos-largos' ? 0.66 : 0.48);
          const subD = Math.hypot(x - (cx + Math.cos(a) * orbit), y - (cy + Math.sin(a) * orbit * 0.86)) - subR;
          if (subD < best) best = subD;
        }
        if (island.id === 'archipielago-sabaody') {
          const coreD = r - baseRadius * 0.52;
          best = Math.min(best, coreD);
        }
        d = best;
      } else if (kind === 'twin_split') {
        const leftD = Math.hypot(x - (cx - baseRadius * 0.44), y - (cy - 4)) - baseRadius * 0.58 + Math.sin(angle * 3 + phase1) * 4;
        const rightD = Math.hypot(x - (cx + baseRadius * 0.44), y - (cy + 4)) - baseRadius * 0.58 + Math.cos(angle * 4 + phase2) * 4;
        const isthmus =
          island.id === 'punk-hazard'
            ? 99
            : Math.max(Math.abs(x - cx) - baseRadius * 0.34, Math.abs(y - cy) - 7);
        d = Math.min(leftD, rightD, isthmus);
      } else if (kind === 'cloud_bank') {
        const lobe = Math.sin(angle * 6 + phase1) * (baseRadius * 0.14) + Math.cos(angle * 3) * 4;
        d = r - (baseRadius * 0.94 + lobe);
      } else if (kind === 'heart') {
        const lobe = Math.sin(angle * 2 + phase1) * (baseRadius * 0.12) - Math.sin(angle) * (baseRadius * 0.12);
        d = r - (baseRadius * 0.92 + lobe);
      } else if (kind === 'jagged_volcano') {
        const spike = Math.abs(Math.sin(angle * 7 + phase1)) * (baseRadius * 0.2) + Math.cos(angle * 4 + phase2) * 5;
        d = r - (baseRadius * 0.85 + spike);
      } else if (kind === 'fortress_plateau') {
        const box = Math.max(Math.abs(dx) * 0.94, Math.abs(dy) * 1.06);
        const circ = r;
        d = box * 0.45 + circ * 0.55 - (baseRadius * 0.9 + Math.sin(angle * 4 + phase1) * 4);
      } else {
        const lobe =
          island.id === 'egghead'
            ? Math.sin(angle * 4 + phase1) * 4
            : Math.sin(angle * 3 + phase1) * (baseRadius * 0.16) +
              Math.cos(angle * 5 + phase2) * (baseRadius * 0.09);
        d = r - (baseRadius + lobe);
      }

      for (let sy = 0; sy < step; sy++) {
        for (let sx = 0; sx < step; sx++) {
          if (y + sy < ART_SIZE && x + sx < ART_SIZE) {
            distGrid[y + sy][x + sx] = d;
            land[y + sy][x + sx] = d <= 0;
          }
        }
      }
    }
  }

  // Shallow water glow + foam
  const glowLimit = options?.coastGlow === false ? 8 : 22;
  for (let y = 0; y < ART_SIZE; y += step) {
    for (let x = 0; x < ART_SIZE; x += step) {
      const d = distGrid[y][x];
      if (d > 0 && d <= glowLimit) {
        if (d <= 3.5) {
          ctx.fillStyle = kind === 'cloud_bank' ? 'rgba(241, 245, 249, 0.85)' : 'rgba(186, 230, 253, 0.82)';
        } else {
          const alpha = Math.max(0.05, ((glowLimit - d) / glowLimit) * 0.48);
          ctx.fillStyle = kind === 'cloud_bank' ? `rgba(224, 242, 254, ${alpha.toFixed(2)})` : `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
        }
        ctx.fillRect(x, y, step, step);
      }
    }
  }

  // Terrain fill
  const sandColor = options?.sandColor ?? '#ecd297';
  const grassA = options?.grassA ?? '#4aa142';
  const grassB = options?.grassB ?? '#3a8839';
  const grassC = options?.grassC ?? '#2c6c31';
  const cliffRim = Boolean(options?.cliffRim);

  for (let y = 0; y < ART_SIZE; y += step) {
    for (let x = 0; x < ART_SIZE; x += step) {
      if (!land[y][x]) continue;
      const d = distGrid[y][x];
      const noise = (((x >> 1) * 37 + (y >> 1) * 17 + seed) % 7) / 7;

      if (cliffRim && d > -10) {
        ctx.fillStyle = noise > 0.5 ? '#8f8b85' : '#736f6a';
      } else if (!cliffRim && d > -8.5) {
        ctx.fillStyle = island.id === 'isla-drum' ? '#e2e8f0' : sandColor;
      } else if (island.biome === 'fire_ice') {
        const splitX = cx + Math.sin(y * 0.08) * 6;
        if (x < splitX) {
          ctx.fillStyle = d > -8 ? '#7c3f28' : noise > 0.6 ? '#431407' : '#291714';
        } else {
          ctx.fillStyle = d > -8 ? '#cbd5e1' : noise > 0.5 ? '#f1f5f9' : '#bae6fd';
        }
      } else if (island.id === 'isla-drum') {
        ctx.fillStyle = noise > 0.5 ? '#f8fafc' : '#e2e8f0';
      } else if (island.id === 'baltigo') {
        ctx.fillStyle = noise > 0.5 ? '#e7e5e4' : '#d6d3d1';
      } else if (island.biome === 'desert') {
        ctx.fillStyle = d > -8 ? '#fde68a' : noise > 0.55 ? '#eab308' : '#d99b43';
      } else if (island.biome === 'candy') {
        ctx.fillStyle = d > -8 ? '#fbcfe8' : noise > 0.55 ? '#f9a8d4' : '#f472b6';
      } else if (island.biome === 'sky') {
        ctx.fillStyle = d > -8 ? '#e2e8f0' : noise > 0.5 ? '#ffffff' : '#f1f5f9';
      } else if (island.biome === 'volcano') {
        ctx.fillStyle = d > -8 ? '#78716c' : noise > 0.55 ? '#475569' : '#334155';
      } else {
        ctx.fillStyle = noise > 0.58 ? grassA : noise > 0.25 ? grassB : grassC;
      }
      ctx.fillRect(x, y, step, step);
    }
  }

  return { land, distGrid };
}

function renderWanoArt(ctx: CanvasRenderingContext2D, island: Island) {
  drawLandmassBase(ctx, island, 84, {
    cliffRim: true,
    grassA: '#4ba342',
    grassB: '#3c8c38',
    grassC: '#2f7230',
  });

  // Western wooden pier jutting out over coast
  drawRect(ctx, 20, 134, 28, 8, '#451a03');
  drawRect(ctx, 21, 135, 26, 6, '#92400e');
  drawRect(ctx, 25, 133, 3, 10, '#291206');
  drawRect(ctx, 37, 133, 3, 10, '#291206');

  // Towering snowy Mt. Fuji on left (matching image_31838f00.png & image_ab1711ec.png)
  drawMountain(ctx, 76, 104, 24, 92, '#7d8fa8', '#61728a', true);
  drawRect(ctx, 50, 102, 52, 5, '#526278');
  drawCloudCluster(ctx, 56, 36, 18, 8, 0.86);

  // Elevated brown rocky plateau on right with 3 waterfalls & cave
  drawRect(ctx, 146, 104, 62, 62, '#6d5746');
  drawRect(ctx, 142, 112, 70, 54, '#5e4a3b');
  drawRect(ctx, 146, 98, 62, 10, '#4ba342');
  // 3 bright cascading waterfalls
  for (const wx of [154, 175, 196]) {
    drawRect(ctx, wx, 106, 7, 56, '#7dd3fc');
    drawRect(ctx, wx + 2, 106, 3, 56, '#f0f9ff');
    for (let fy = 112; fy < 158; fy += 8) {
      drawRect(ctx, wx + 1, fy, 5, 2, '#ffffff');
    }
    drawRect(ctx, wx - 1, 160, 9, 4, '#ffffff');
  }
  drawRect(ctx, 170, 150, 16, 16, '#3b150e');
  drawTorii(ctx, 178, 152, 1.0);

  // Shogun 4-tier black & white castle atop the cliff
  drawRect(ctx, 152, 88, 50, 10, '#94a3b8');
  drawRect(ctx, 156, 76, 42, 12, '#f8fafc');
  drawRect(ctx, 152, 73, 50, 5, '#0f172a');
  drawRect(ctx, 161, 63, 32, 10, '#f8fafc');
  drawRect(ctx, 157, 60, 40, 5, '#1e293b');
  drawRect(ctx, 165, 51, 24, 9, '#f8fafc');
  drawRect(ctx, 161, 48, 32, 4, '#0f172a');
  drawRect(ctx, 168, 40, 18, 8, '#f8fafc');
  drawRect(ctx, 164, 37, 26, 4, '#0f172a');
  drawRect(ctx, 169, 34, 3, 3, '#facc15');
  drawRect(ctx, 182, 34, 3, 3, '#facc15');
  drawRect(ctx, 156, 78, 42, 2, '#dc2626');

  // Winding river flowing south from left waterfall to the sea
  drawRect(ctx, 152, 164, 12, 44, '#38bdf8');
  drawRect(ctx, 155, 164, 6, 44, '#7dd3fc');
  drawRect(ctx, 154, 198, 12, 12, '#7dd3fc');

  // Red arched bridge crossing the river
  drawRect(ctx, 146, 178, 24, 4, '#dc2626');
  drawRect(ctx, 149, 175, 18, 3, '#ef4444');
  drawRect(ctx, 145, 182, 4, 4, '#78350f');
  drawRect(ctx, 167, 182, 4, 4, '#78350f');

  // Tan dirt paths & central grey plaza
  drawRect(ctx, 84, 136, 18, 14, '#78716c');
  drawRect(ctx, 96, 142, 48, 8, '#e6d3a5');
  drawRect(ctx, 114, 150, 34, 8, '#e6d3a5');
  drawRect(ctx, 168, 174, 24, 8, '#e6d3a5');

  drawTorii(ctx, 120, 148, 0.9);
  drawTorii(ctx, 134, 156, 0.9);
  drawTorii(ctx, 151, 175, 0.8);

  drawJapaneseHouse(ctx, 74, 112, '#1e293b', '#0f172a', 13);
  drawJapaneseHouse(ctx, 94, 116, '#b91c1c', '#7f1d1d', 15);
  drawJapaneseHouse(ctx, 64, 140, '#b91c1c', '#7f1d1d', 13);
  drawJapaneseHouse(ctx, 108, 106, '#1e293b', '#0f172a', 13);
  drawJapaneseHouse(ctx, 124, 118, '#1e293b', '#0f172a', 13);
  drawJapaneseHouse(ctx, 62, 168, '#b91c1c', '#7f1d1d', 13);
  drawJapaneseHouse(ctx, 82, 166, '#1e293b', '#0f172a', 14);
  drawJapaneseHouse(ctx, 74, 184, '#b91c1c', '#7f1d1d', 15);
  drawJapaneseHouse(ctx, 118, 176, '#1e293b', '#0f172a', 15);

  const sakuras: Array<[number, number, number]> = [
    [106, 94, 6],
    [122, 90, 7],
    [134, 104, 7],
    [116, 128, 6],
    [104, 162, 6],
    [82, 200, 7],
    [140, 188, 6],
    [206, 122, 7],
    [214, 136, 7],
    [208, 148, 6],
  ];
  for (const [sx, sy, sr] of sakuras) {
    drawSakuraTree(ctx, sx, sy, sr);
  }
  const pines: Array<[number, number]> = [
    [68, 128],
    [86, 130],
    [98, 182],
    [136, 132],
    [192, 184],
    [206, 162],
  ];
  for (const [px, py] of pines) {
    drawPineTree(ctx, px, py, 10);
  }
}

function renderEggheadArt(ctx: CanvasRenderingContext2D, island: Island) {
  drawLandmassBase(ctx, island, 60, {
    sandColor: '#e2f2e9',
    grassA: '#65c466',
    grassB: '#4ea854',
    grassC: '#3d8b44',
  });
  const cx = 128;

  ctx.clearRect(0, 0, ART_SIZE, ART_SIZE);
  for (let y = 104; y < 232; y += 2) {
    for (let x = 56; x < 200; x += 2) {
      const dx = (x - cx) / 1.08;
      const dy = (y - 168) / 0.92;
      const r = Math.hypot(dx, dy);
      if (r <= 62 && r > 50) {
        const a = Math.max(0.08, ((62 - r) / 12) * 0.55);
        ctx.fillStyle = r <= 53 ? 'rgba(224, 242, 254, 0.92)' : `rgba(56, 189, 248, ${a.toFixed(2)})`;
        ctx.fillRect(x, y, 2, 2);
      } else if (r <= 50) {
        const isCoast = r > 44;
        ctx.fillStyle = isCoast ? '#e2e8f0' : ((x + y) % 8 === 0 ? '#4ade80' : '#34a853');
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, 168, 42, 34, 0, 0, Math.PI * 2);
  ctx.stroke();

  const blockColors = ['#f9a8d4', '#93c5fd', '#fde047', '#86efac', '#c4b5fd', '#fdba74', '#f8fafc'];
  let bIdx = 0;
  for (let by = -20; by <= 18; by += 10) {
    for (let bx = -28; bx <= 20; bx += 12) {
      if (Math.hypot(bx + 5, by + 3) > 33) continue;
      if (Math.abs(bx) < 8 && Math.abs(by) < 8) continue;
      drawRect(ctx, cx + bx, 168 + by, 9, 7, blockColors[bIdx % blockColors.length]);
      drawRect(ctx, cx + bx, 168 + by, 9, 2, '#ffffff');
      bIdx++;
    }
  }
  drawCircle(ctx, cx, 168, 8, '#38bdf8');
  drawCircle(ctx, cx, 168, 4, '#e0f2fe');

  drawRect(ctx, cx - 3, 94, 6, 72, 'rgba(125, 211, 252, 0.55)');
  drawRect(ctx, cx - 1, 94, 2, 72, '#e0f2fe');

  drawCloudCluster(ctx, cx, 108, 44, 18, 0.96);

  for (let ex = -26; ex <= 26; ex += 2) {
    const h = 10 + ((Math.abs(ex) * 7) % 6);
    drawRect(ctx, cx + ex, 92 - h, 2, h, '#f472b6');
    if (Math.abs(ex) % 6 === 0) {
      drawRect(ctx, cx + ex, 92 - h, 2, h, '#ffffff');
    }
  }
  drawRect(ctx, cx - 26, 86, 52, 6, '#38bdf8');
  for (let dy = -26; dy <= 0; dy += 2) {
    const t = Math.abs(dy) / 26;
    const halfW = Math.max(2, Math.round(22 * Math.sqrt(Math.max(0, 1 - t * t))));
    const stripe = ((dy >> 1) & 1) === 0 ? '#f472b6' : '#f9a8d4';
    drawRect(ctx, cx - halfW, 66 + dy, halfW * 2, 2, stripe);
    drawRect(ctx, cx + Math.floor(halfW * 0.45), 66 + dy, Math.max(2, Math.floor(halfW * 0.45)), 2, '#db2777');
  }
  drawRect(ctx, cx - 14, 67, 28, 12, 'rgba(56, 189, 248, 0.45)');
  drawRect(ctx, cx - 6, 70, 12, 8, '#bae6fd');
  drawRect(ctx, cx - 22, 62, 2, 2, '#e0f2fe');
  drawRect(ctx, cx + 22, 60, 2, 2, '#e0f2fe');

  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, 68, 38, Math.PI * 0.24, Math.PI * 0.76);
  ctx.stroke();
  ctx.font = '800 7px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0369a1';
  ctx.fillText('ISLA DEL FUTURO', cx + 1, 96);
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText('ISLA DEL FUTURO', cx, 95);
  ctx.restore();
}

function renderElbaphArt(ctx: CanvasRenderingContext2D, _island: Island) {
  const cx = 128;
  const cy = 166;
  for (let y = 106; y < 246; y += 2) {
    for (let x = 22; x < 234; x += 2) {
      const dx = (x - cx) / 1.38;
      const dy = (y - cy) / 0.85;
      const angle = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy);
      const maxR = 66 + Math.sin(angle * 3 + 0.7) * 7 + Math.cos(angle * 4 - 0.5) * 4;
      const d = r - maxR;
      if (d > 0 && d <= 14) {
        const a = Math.max(0.06, ((14 - d) / 14) * 0.45);
        ctx.fillStyle = d <= 3 ? 'rgba(186, 230, 253, 0.82)' : `rgba(56, 189, 248, ${a.toFixed(2)})`;
        ctx.fillRect(x, y, 2, 2);
      } else if (d <= 0) {
        const isBeach = d > -8;
        const n = ((x * 29 + y * 13) % 5) / 5;
        ctx.fillStyle = isBeach
          ? '#ecd297'
          : n > 0.6
          ? '#4ba342'
          : n > 0.25
          ? '#3b8936'
          : '#2b6b2f';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  drawRect(ctx, 84, 152, 24, 18, '#e6d3a5');
  const huts: Array<[number, number, number, number]> = [
    [60, 136, 20, 14],
    [90, 128, 22, 14],
    [118, 128, 20, 14],
    [52, 166, 22, 14],
    [82, 174, 22, 14],
  ];
  for (const [hx, hy, hw, hh] of huts) {
    drawRect(ctx, hx + 1, hy + hh, hw, 2, 'rgba(0,0,0,0.28)');
    drawRect(ctx, hx, hy, hw, hh, '#78350f');
    drawRect(ctx, hx + 2, hy + 2, hw - 4, 3, '#92400e');
    drawRect(ctx, hx + Math.floor(hw / 2) - 2, hy + hh - 4, 4, 4, '#291206');
  }
  for (const [px, py] of [
    [58, 156],
    [76, 154],
    [48, 186],
    [112, 162],
    [122, 182],
  ]) {
    drawPineTree(ctx, px, py, 9);
  }

  const tx = 160;
  drawRect(ctx, tx - 14, 110, 28, 74, '#6b3f23');
  drawRect(ctx, tx - 10, 110, 8, 74, '#85502d');
  drawRect(ctx, tx + 6, 110, 8, 74, '#4e2c17');
  drawRect(ctx, tx - 22, 176, 44, 10, '#542f18');
  drawRect(ctx, tx - 5, 170, 10, 16, '#1e0e06');
  drawRect(ctx, tx - 7, 138, 3, 3, '#fde047');
  drawRect(ctx, tx + 5, 150, 3, 3, '#fde047');

  drawCircle(ctx, tx - 28, 92, 26, '#14532d');
  drawCircle(ctx, tx + 26, 94, 26, '#14532d');
  drawCircle(ctx, tx, 82, 34, '#15803d');
  drawCircle(ctx, tx - 20, 74, 22, '#16a34a');
  drawCircle(ctx, tx + 20, 76, 22, '#16a34a');
  drawCircle(ctx, tx, 64, 24, '#22c55e');

  for (const lx of [126, 192]) {
    drawRect(ctx, lx, 106, 2, 72, '#92400e');
    for (let ry = 110; ry < 176; ry += 5) {
      drawRect(ctx, lx - 2, ry, 6, 1, '#d97706');
    }
  }

  const treeHouses: Array<[number, number, string]> = [
    [120, 92, '#dc2626'],
    [136, 70, '#0d9488'],
    [156, 56, '#d97706'],
    [176, 68, '#7c3aed'],
    [186, 88, '#2563eb'],
  ];
  for (let i = 0; i < treeHouses.length - 1; i++) {
    const [x1, y1] = treeHouses[i];
    const [x2, y2] = treeHouses[i + 1];
    for (let s = 1; s <= 6; s++) {
      const t = s / 7;
      drawRect(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 4, 2, 1, '#eab308');
    }
  }
  for (const [hx, hy, col] of treeHouses) {
    drawCottage(ctx, hx, hy, col, '#fef3c7', 9);
  }

  drawCloudCluster(ctx, 160, 94, 34, 12, 0.88);

  const rainbowColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#a855f7'];
  ctx.save();
  rainbowColors.forEach((col, idx) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(136, 146, 84 - idx * 3, Math.PI * 1.03, Math.PI * 1.97);
    ctx.stroke();
  });
  ctx.restore();
}

function renderFishmanTrenchSurfaceArt(ctx: CanvasRenderingContext2D) {
  const cx = 128;
  const cy = 128;
  for (let y = 18; y < 238; y += 2) {
    for (let x = 18; x < 238; x += 2) {
      const dx = (x - cx) / 1.1;
      const dy = (y - cy) / 0.92;
      const angle = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy) + Math.sin(angle * 4) * 5;
      if (r <= 18) {
        ctx.fillStyle = '#01050f';
      } else if (r <= 34) {
        ctx.fillStyle = '#020b1f';
      } else if (r <= 50) {
        ctx.fillStyle = '#041936';
      } else if (r <= 66) {
        ctx.fillStyle = '#072a54';
      } else if (r <= 82) {
        ctx.fillStyle = 'rgba(14, 74, 130, 0.65)';
      } else {
        continue;
      }
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const rng = createSeededRng(7711);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = 58 + rng() * 14;
    const rx = cx + Math.cos(a) * rr * 1.08;
    const ry = cy + Math.sin(a) * rr * 0.9;
    drawRect(ctx, rx - 3, ry - 2, 6, 5, '#1e293b');
    drawRect(ctx, rx - 2, ry - 1, 3, 2, '#334155');
  }
  for (let b = 0; b < 14; b++) {
    const a = rng() * Math.PI * 2;
    const rr = 14 + rng() * 44;
    drawCircle(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2 + (b % 2), '#38bdf8');
  }
}

function renderFishmanUnderwaterArt(ctx: CanvasRenderingContext2D) {
  const cx = 128;
  const cy = 132;
  drawCircle(ctx, cx, cy, 86, 'rgba(14, 116, 144, 0.35)');
  drawCircle(ctx, cx, cy, 78, 'rgba(8, 47, 73, 0.72)');
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#f9a8d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, 0, Math.PI * 2);
  ctx.stroke();

  drawRect(ctx, cx - 22, 54, 44, 34, 'rgba(253, 224, 71, 0.18)');
  drawRect(ctx, cx - 10, 50, 20, 42, 'rgba(254, 240, 138, 0.28)');

  drawCircle(ctx, cx, cy + 16, 56, '#0f4c5c');
  drawCircle(ctx, cx, cy + 20, 46, '#155e75');
  drawRect(ctx, cx - 44, cy + 14, 88, 12, '#67e8f9');

  drawRect(ctx, cx - 26, cy - 22, 52, 26, '#f472b6');
  drawRect(ctx, cx - 22, cy - 18, 44, 18, '#fce7f3');
  drawRect(ctx, cx - 30, cy - 26, 60, 6, '#06b6d4');
  drawRect(ctx, cx - 12, cy - 40, 24, 14, '#fb7185');
  drawRect(ctx, cx - 16, cy - 44, 32, 5, '#22d3ee');
  drawRect(ctx, cx - 3, cy - 52, 6, 8, '#fde047');

  drawCottage(ctx, cx - 50, cy + 8, '#ec4899', '#e0f2fe', 12);
  drawCottage(ctx, cx + 36, cy + 8, '#06b6d4', '#fce7f3', 12);
  drawCottage(ctx, cx - 18, cy + 28, '#f59e0b', '#e0f2fe', 12);
  drawCottage(ctx, cx + 10, cy + 28, '#ec4899', '#fce7f3', 12);
  drawCircle(ctx, cx - 52, cy - 4, 6, '#fb7185');
  drawCircle(ctx, cx + 52, cy - 4, 6, '#34d399');
}

function renderSkullIslandArt(ctx: CanvasRenderingContext2D, island: Island) {
  const isOnigashima = island.id === 'onigashima';
  drawLandmassBase(ctx, island, 72, {
    cliffRim: true,
    grassA: isOnigashima ? '#334155' : '#475569',
    grassB: isOnigashima ? '#1e293b' : '#334155',
    grassC: '#1e293b',
  });
  const cx = 128;
  const cy = 128;
  drawCircle(ctx, cx, cy - 8, 30, isOnigashima ? '#334155' : '#cbd5e1');
  drawRect(ctx, cx - 18, cy + 12, 36, 18, isOnigashima ? '#334155' : '#cbd5e1');
  drawCircle(ctx, cx - 11, cy - 8, 7, isOnigashima ? '#ef4444' : '#0f172a');
  drawCircle(ctx, cx + 11, cy - 8, 7, isOnigashima ? '#ef4444' : '#0f172a');
  drawRect(ctx, cx - 3, cy + 2, 6, 6, '#0f172a');
  for (let tx = -14; tx <= 10; tx += 6) {
    drawRect(ctx, cx + tx, cy + 20, 4, 8, '#1e293b');
  }
  if (isOnigashima) {
    drawRect(ctx, cx - 38, cy - 32, 12, 8, '#f8fafc');
    drawRect(ctx, cx - 30, cy - 24, 10, 12, '#e2e8f0');
    drawRect(ctx, cx + 26, cy - 32, 12, 8, '#f8fafc');
    drawRect(ctx, cx + 20, cy - 24, 10, 12, '#e2e8f0');
    drawTorii(ctx, cx, cy + 44, 1.0);
  } else {
    drawRect(ctx, cx - 8, cy - 2, 16, 14, '#38bdf8');
    drawCottage(ctx, cx - 44, cy + 16, '#991b1b', '#cbd5e1', 11);
    drawCottage(ctx, cx + 32, cy + 16, '#1e293b', '#cbd5e1', 11);
  }
}

function drawVariedRoads(ctx: CanvasRenderingContext2D, island: Island, seed: number) {
  const cx = 128;
  const cy = 128;
  const roadColor =
    island.biome === 'volcano' || island.biome === 'fire_ice'
      ? '#94a3b8'
      : island.biome === 'marine' || island.biome === 'fortress'
      ? '#cbd5e1'
      : island.biome === 'candy'
      ? '#fbcfe8'
      : '#e8d095';

  const layout = seed % 4;
  if (layout === 0) {
    // Central circular plaza + radial roads
    drawCircle(ctx, cx, cy, 16, roadColor);
    drawRect(ctx, cx - 46, cy - 3, 92, 6, roadColor);
    drawRect(ctx, cx - 3, cy - 42, 6, 84, roadColor);
  } else if (layout === 1) {
    // Curved crescent promenade
    drawRect(ctx, cx - 42, cy - 18, 84, 5, roadColor);
    drawRect(ctx, cx - 42, cy - 18, 5, 42, roadColor);
    drawRect(ctx, cx + 37, cy - 18, 5, 42, roadColor);
    drawRect(ctx, cx - 42, cy + 19, 84, 5, roadColor);
  } else if (layout === 2) {
    // Diagonal mountain pass & south dock spur
    for (let i = -34; i <= 34; i += 4) {
      drawRect(ctx, cx + i - 3, cy + Math.round(i * 0.4) - 3, 7, 6, roadColor);
    }
    drawRect(ctx, cx - 3, cy - 26, 6, 62, roadColor);
  } else {
    // Twin avenues with harbor quay
    drawRect(ctx, cx - 44, cy + 12, 88, 6, roadColor);
    drawRect(ctx, cx - 22, cy - 34, 6, 52, roadColor);
    drawRect(ctx, cx + 16, cy - 34, 6, 52, roadColor);
  }

  // Varied harbor pier position
  if (seed % 2 === 0) {
    drawRect(ctx, cx + 36, cy + 32, 28, 7, '#451a03');
    drawRect(ctx, cx + 36, cy + 33, 26, 5, '#b45309');
  } else {
    drawRect(ctx, cx - 6, cy + 44, 12, 26, '#451a03');
    drawRect(ctx, cx - 4, cy + 44, 8, 24, '#b45309');
  }
}

function renderCanonIslandArt(ctx: CanvasRenderingContext2D, island: Island) {
  if (island.id === 'pais-de-wano') {
    renderWanoArt(ctx, island);
    return;
  }
  if (island.id === 'egghead') {
    renderEggheadArt(ctx, island);
    return;
  }
  if (island.id === 'elbaph') {
    renderElbaphArt(ctx, island);
    return;
  }
  if (island.id === 'onigashima' || island.id === 'hachinosu') {
    renderSkullIslandArt(ctx, island);
    return;
  }

  const baseR = island.isMiniIsland ? 44 : island.sizeTier === 'colosal' ? 84 : island.sizeTier === 'grande' ? 76 : 64;
  drawLandmassBase(ctx, island, baseR, {
    cliffRim:
      island.biome === 'volcano' ||
      island.biome === 'colosseum' ||
      island.id === 'enies-lobby' ||
      island.id === 'impel-down' ||
      island.id === 'marineford' ||
      island.id === 'nuevo-marineford' ||
      island.id === 'mary-geoise',
    sandColor: island.id === 'mary-geoise' ? '#cbd5e1' : undefined,
    grassA: island.id === 'mary-geoise' ? '#4d7c0f' : undefined,
    grassB: island.id === 'mary-geoise' ? '#3f6212' : undefined,
    grassC: island.id === 'mary-geoise' ? '#365314' : undefined,
  });

  const cx = 128;
  const cy = 128;
  const seed = hashId(island.id);
  const rng = createSeededRng(seed);

  // Mini-island bespoke builds
  if (island.isMiniIsland) {
    if (island.id === 'mini-baratie') {
      // Sea-going fish-head restaurant ship!
      drawRect(ctx, cx - 34, cy - 10, 68, 24, '#78350f');
      drawRect(ctx, cx - 30, cy - 6, 60, 16, '#b45309');
      drawRect(ctx, cx - 18, cy - 22, 36, 16, '#fef3c7');
      drawRect(ctx, cx - 22, cy - 26, 44, 5, '#0284c7');
      drawCircle(ctx, cx + 32, cy + 2, 9, '#facc15');
      drawCircle(ctx, cx + 35, cy, 3, '#0f172a');
      return;
    }
    if (island.id === 'mini-shell-town') {
      drawRect(ctx, cx - 20, cy - 18, 40, 24, '#f8fafc');
      drawRect(ctx, cx - 22, cy - 22, 44, 5, '#1d4ed8');
      drawRect(ctx, cx - 6, cy - 32, 12, 10, '#e2e8f0');
      drawCottage(ctx, cx - 32, cy + 12, '#dc2626', '#fef3c7', 11);
      drawCottage(ctx, cx + 18, cy + 12, '#0284c7', '#f8fafc', 11);
      return;
    }
    if (island.id === 'mini-estacion-shift') {
      // Sea Train rails + Shift Station lighthouse!
      drawRect(ctx, cx - 64, cy + 10, 128, 3, '#475569');
      drawRect(ctx, cx - 64, cy + 15, 128, 3, '#94a3b8');
      drawRect(ctx, cx - 10, cy - 24, 14, 30, '#f8fafc');
      drawRect(ctx, cx - 12, cy - 28, 18, 5, '#dc2626');
      drawCircle(ctx, cx - 3, cy - 32, 4, '#fde047');
      drawCottage(ctx, cx + 12, cy - 10, '#0284c7', '#fef3c7', 12);
      return;
    }
    if (island.id === 'mini-ohara') {
      // Tree of Knowledge!
      drawRect(ctx, cx - 8, cy - 4, 16, 28, '#78350f');
      drawCircle(ctx, cx, cy - 14, 22, '#15803d');
      drawCircle(ctx, cx - 12, cy - 8, 12, '#16a34a');
      drawCircle(ctx, cx + 12, cy - 8, 12, '#22c55e');
      drawCottage(ctx, cx - 28, cy + 12, '#0d9488', '#f8fafc', 10);
      return;
    }
    if (island.id === 'mini-puerto-zepelin') {
      drawRect(ctx, cx - 18, cy + 8, 22, 6, '#78350f');
      drawCottage(ctx, cx - 18, cy - 8, '#ea580c', '#fef3c7', 12);
      drawCottage(ctx, cx + 2, cy - 2, '#f59e0b', '#fef3c7', 11);
      drawRect(ctx, cx - 8, cy - 24, 24, 10, '#f97316');
      drawRect(ctx, cx - 4, cy - 22, 16, 6, '#fed7aa');
      drawPineTree(ctx, cx - 26, cy + 2, 8);
      return;
    }
    if (island.id === 'mini-villa-banquete') {
      drawRect(ctx, cx - 14, cy - 6, 28, 16, '#e6d3a5');
      drawCottage(ctx, cx - 12, cy - 18, '#b45309', '#fde68a', 14);
      drawCottage(ctx, cx + 6, cy + 4, '#dc2626', '#fef3c7', 11);
      drawRect(ctx, cx - 3, cy + 2, 6, 5, '#f97316');
      drawPineTree(ctx, cx - 24, cy + 8, 9);
      drawPineTree(ctx, cx + 18, cy - 12, 9);
      return;
    }
    if (island.id === 'mini-isla-campeon') {
      drawMountain(ctx, cx, cy - 2, 22, 26, '#78716c', '#57534e', false);
      drawCircle(ctx, cx, cy + 12, 12, '#cbd5e1');
      drawCircle(ctx, cx, cy + 12, 7, '#e7c791');
      drawCottage(ctx, cx - 22, cy + 10, '#dc2626', '#e2e8f0', 10);
      return;
    }
    if (island.id === 'mini-isla-bigotes') {
      drawMountain(ctx, cx - 18, cy + 2, 12, 16, '#4d7c0f', '#365314', false);
      drawMountain(ctx, cx + 18, cy + 2, 12, 16, '#4d7c0f', '#365314', false);
      drawPalmTree(ctx, cx - 14, cy + 14);
      drawPalmTree(ctx, cx + 14, cy + 14);
      drawCottage(ctx, cx - 5, cy + 12, '#0284c7', '#fef3c7', 10);
      return;
    }
    if (island.id === 'mini-bancos-coral' || island.id === 'mini-islote-cacao') {
      drawCircle(ctx, cx - 14, cy - 6, 8, island.id === 'mini-islote-cacao' ? '#7c2d12' : '#fb7185');
      drawCircle(ctx, cx + 14, cy + 6, 7, island.id === 'mini-islote-cacao' ? '#f472b6' : '#22d3ee');
      drawCottage(ctx, cx - 8, cy + 4, '#ec4899', '#fdf2f8', 11);
      return;
    }
    if (island.biome === 'desert') {
      drawMountain(ctx, cx, cy, 14, 18, '#d97706', '#b45309', false);
      drawPalmTree(ctx, cx - 12, cy + 10);
    } else if (island.biome === 'volcano') {
      drawMountain(ctx, cx, cy + 2, 16, 22, '#475569', '#334155', false);
      drawCircle(ctx, cx, cy - 16, 4, '#ef4444');
    } else if (island.biome === 'sky') {
      drawCloudCluster(ctx, cx, cy, 24, 10, 0.95);
      drawCottage(ctx, cx - 8, cy - 10, '#38bdf8', '#f8fafc', 11);
    } else {
      drawCottage(ctx, cx - 12, cy - 6, rng() > 0.5 ? '#dc2626' : '#0284c7', '#fef3c7', 11);
      drawPineTree(ctx, cx + 10, cy - 4, 8);
      drawPineTree(ctx, cx + 4, cy + 12, 8);
    }
    drawRect(ctx, cx - 2, cy + 26, 8, 4, '#92400e');
    return;
  }

  // Bespoke iconic canon major islands (full unique compositions!)
  if (island.id === 'marineford' || island.id === 'nuevo-marineford') {
    const isNew = island.id === 'nuevo-marineford';
    const roofCol = isNew ? '#0284c7' : '#1d4ed8';
    // Crescent stone plaza & twin warships moored in the harbor bay
    drawRect(ctx, cx - 34, cy + 4, 68, 12, '#e2e8f0');
    drawRect(ctx, cx - 26, cy - 28, 52, 30, '#f8fafc');
    drawRect(ctx, cx - 30, cy - 34, 60, 7, roofCol);
    drawRect(ctx, cx - 16, cy - 46, 32, 12, '#f8fafc');
    drawRect(ctx, cx - 18, cy - 50, 36, 5, roofCol);
    drawRect(ctx, cx - 6, cy - 62, 12, 12, '#f8fafc');
    drawRect(ctx, cx - 3, cy - 66, 6, 4, '#eab308');
    // Flanking execution scaffold & Oris Bell tower
    drawRect(ctx, cx - 44, cy - 8, 10, 20, '#cbd5e1');
    drawRect(ctx, cx + 34, cy - 8, 10, 20, '#cbd5e1');
    drawCircle(ctx, cx + 39, cy - 12, 5, '#facc15');
    // Moored Marine battleships in southern crescent bay
    drawRect(ctx, cx - 18, cy + 32, 12, 6, '#e2e8f0');
    drawRect(ctx, cx + 8, cy + 32, 12, 6, '#e2e8f0');
    drawRect(ctx, cx - 14, cy + 26, 4, 6, '#ffffff');
    drawRect(ctx, cx + 12, cy + 26, 4, 6, '#ffffff');
    return;
  }

  if (island.id === 'impel-down') {
    // Giant submarine prison tower rising from calm belt sea ring
    drawCircle(ctx, cx, cy, 44, '#0f172a');
    drawCircle(ctx, cx, cy, 34, '#334155');
    drawRect(ctx, cx - 22, cy - 38, 44, 52, '#475569');
    drawRect(ctx, cx - 24, cy - 42, 48, 6, '#991b1b');
    drawRect(ctx, cx - 12, cy - 56, 24, 14, '#64748b');
    drawRect(ctx, cx - 14, cy - 60, 28, 4, '#dc2626');
    drawRect(ctx, cx - 4, cy - 68, 8, 8, '#facc15');
    drawRect(ctx, cx - 12, cy - 22, 24, 16, '#1e293b');
    drawRect(ctx, cx - 3, cy + 16, 6, 26, '#e2e8f0');
    return;
  }

  if (island.id === 'thriller-bark') {
    // Colossal Gothic ship hull + Thriller Mansion + dead spooky forest
    drawRect(ctx, cx - 58, cy - 10, 116, 24, '#292524');
    drawRect(ctx, cx - 42, cy - 18, 84, 34, '#3f3f46');
    // Great central mast & tattered sail
    drawRect(ctx, cx - 3, cy - 64, 6, 56, '#44403c');
    drawRect(ctx, cx - 26, cy - 56, 52, 18, '#52525b');
    // Gothic Mansion
    drawRect(ctx, cx - 22, cy - 26, 44, 26, '#312e81');
    drawRect(ctx, cx - 12, cy - 40, 24, 14, '#4338ca');
    drawRect(ctx, cx - 24, cy - 30, 8, 8, '#dc2626');
    drawRect(ctx, cx + 16, cy - 30, 8, 8, '#dc2626');
    drawPineTree(ctx, cx - 44, cy + 4, 11);
    drawPineTree(ctx, cx + 44, cy + 4, 11);
    return;
  }

  if (island.id === 'dressrosa') {
    // Corrida Colosseum + King's Plateau + Flower Hill + Harbor
    drawCircle(ctx, cx - 24, cy + 4, 24, '#cbd5e1');
    drawCircle(ctx, cx - 24, cy + 4, 17, '#ef4444');
    drawCircle(ctx, cx - 24, cy + 4, 10, '#e7c791');
    // King's Plateau & Royal Palace
    drawMountain(ctx, cx + 22, cy - 4, 26, 36, '#94a3b8', '#64748b', false);
    drawRect(ctx, cx + 8, cy - 42, 28, 16, '#f8fafc');
    drawRect(ctx, cx + 12, cy - 50, 20, 8, '#f59e0b');
    // Sunflower hill & colorful town cottages
    drawCircle(ctx, cx + 24, cy + 28, 10, '#fde047');
    drawCottage(ctx, cx - 48, cy - 28, '#e11d48', '#fef3c7', 13);
    drawCottage(ctx, cx - 14, cy - 34, '#f59e0b', '#fef3c7', 13);
    drawCottage(ctx, cx - 2, cy + 28, '#ec4899', '#fef3c7', 13);
    return;
  }

  if (island.id === 'totto-land') {
    // Whole Cake Chateau + chocolate rivers + pastel candy spires!
    drawRect(ctx, cx - 54, cy + 16, 108, 7, '#7c2d12'); // chocolate river
    drawRect(ctx, cx - 26, cy - 16, 52, 28, '#fce7f3');
    drawRect(ctx, cx - 28, cy - 20, 56, 5, '#ec4899');
    drawRect(ctx, cx - 18, cy - 34, 36, 14, '#fbcfe8');
    drawRect(ctx, cx - 20, cy - 38, 40, 5, '#db2777');
    drawRect(ctx, cx - 8, cy - 50, 16, 12, '#f9a8d4');
    drawCircle(ctx, cx, cy - 54, 5, '#fde047');
    // Side biscuit turrets
    drawRect(ctx, cx - 40, cy - 22, 10, 22, '#f59e0b');
    drawRect(ctx, cx + 30, cy - 22, 10, 22, '#f59e0b');
    drawCircle(ctx, cx - 44, cy + 4, 7, '#a855f7');
    drawCircle(ctx, cx + 44, cy + 4, 7, '#38bdf8');
    return;
  }

  if (island.id === 'punk-hazard') {
    // Blazing volcanic west vs Jagged ice glacier east + central canal + skull lab
    drawMountain(ctx, cx - 32, cy + 6, 22, 38, '#431407', '#7c2d12', false);
    drawCircle(ctx, cx - 32, cy - 28, 7, '#f97316');
    drawCircle(ctx, cx - 32, cy - 29, 3, '#fde047');
    drawRect(ctx, cx - 48, cy + 18, 22, 5, '#ef4444');
    drawMountain(ctx, cx + 32, cy + 8, 22, 42, '#bae6fd', '#38bdf8', true);
    drawMountain(ctx, cx + 18, cy + 20, 14, 24, '#e0f2fe', '#7dd3fc', true);
    drawRect(ctx, cx - 4, cy - 42, 8, 84, '#0284c7');
    drawRect(ctx, cx - 12, cy - 16, 24, 16, '#94a3b8');
    drawCircle(ctx, cx, cy - 10, 5, '#f8fafc');
    return;
  }

  if (island.id === 'skypiea') {
    drawCloudCluster(ctx, cx, cy + 24, 48, 16, 0.94);
    // Upper Yard Vearth emerald forest & Giant Jack beanstalk
    drawCircle(ctx, cx - 12, cy - 4, 26, '#15803d');
    drawRect(ctx, cx - 16, cy - 52, 8, 48, '#22c55e');
    drawCircle(ctx, cx - 12, cy - 54, 12, '#4ade80');
    // Golden Bell of Shandora!
    drawRect(ctx, cx + 14, cy - 28, 22, 22, '#ca8a04');
    drawCircle(ctx, cx + 25, cy - 20, 9, '#fde047');
    drawCloudCluster(ctx, cx + 32, cy + 6, 24, 10, 0.9);
    return;
  }

  if (island.id === 'isla-drum') {
    // 7 cylindrical Drum Rockies mountains + Wapol's Castle + sakura grove
    for (const [mx, my, mh] of [
      [cx - 38, cy + 8, 32],
      [cx - 20, cy - 4, 40],
      [cx, cy - 12, 46],
      [cx + 22, cy - 2, 38],
      [cx + 38, cy + 10, 30],
    ]) {
      drawRect(ctx, mx - 8, my - mh, 16, mh, '#64748b');
      drawRect(ctx, mx - 9, my - mh, 18, 6, '#f8fafc');
    }
    drawRect(ctx, cx - 10, cy - 66, 20, 10, '#f8fafc');
    drawRect(ctx, cx - 12, cy - 70, 24, 4, '#dc2626');
    drawSakuraTree(ctx, cx - 32, cy + 26, 7);
    drawSakuraTree(ctx, cx + 30, cy + 26, 7);
    drawCottage(ctx, cx - 10, cy + 24, '#0284c7', '#f8fafc', 14);
    return;
  }

  if (island.id === 'little-garden') {
    drawMountain(ctx, cx - 28, cy + 4, 18, 30, '#334155', '#1e293b', false);
    drawCircle(ctx, cx - 28, cy - 24, 5, '#ef4444');
    drawMountain(ctx, cx + 28, cy + 4, 18, 28, '#475569', '#334155', false);
    drawCircle(ctx, cx + 28, cy - 22, 4, '#f97316');
    drawCircle(ctx, cx, cy + 16, 16, '#e2e8f0'); // Dino skull rock
    drawPineTree(ctx, cx - 40, cy + 22, 12);
    drawPineTree(ctx, cx + 38, cy + 22, 12);
    drawPalmTree(ctx, cx, cy - 18);
    return;
  }

  if (island.id === 'reino-germa') {
    // Interlocking hexagonal Germa 66 snail warships
    for (const [gx, gy, col] of [
      [cx - 32, cy - 10, '#2563eb'],
      [cx + 22, cy - 10, '#dc2626'],
      [cx - 6, cy + 10, '#facc15'],
      [cx - 6, cy - 24, '#16a34a'],
    ] as Array<[number, number, string]>) {
      drawRect(ctx, gx - 12, gy - 8, 24, 16, '#475569');
      drawRect(ctx, gx - 8, gy - 14, 16, 8, col);
      drawRect(ctx, gx - 3, gy - 20, 6, 6, '#f8fafc');
    }
    return;
  }

  if (island.id === 'tequila-wolf') {
    drawRect(ctx, cx - 64, cy - 6, 128, 12, '#94a3b8');
    drawRect(ctx, cx - 64, cy - 2, 128, 4, '#e2e8f0');
    drawRect(ctx, cx - 54, cy - 16, 16, 20, '#475569');
    drawRect(ctx, cx + 38, cy - 16, 16, 20, '#475569');
    drawCottage(ctx, cx - 10, cy - 18, '#334155', '#cbd5e1', 14);
    return;
  }

  if (island.id === 'islas-conomi') {
    // Arlong Park sawtooth spire + tangerine grove + windmill!
    drawRect(ctx, cx + 10, cy - 34, 24, 28, '#e2e8f0');
    drawRect(ctx, cx + 6, cy - 38, 32, 5, '#0284c7');
    drawRect(ctx, cx + 16, cy - 48, 12, 10, '#f8fafc');
    drawRect(ctx, cx + 18, cy - 54, 8, 6, '#ef4444');
    drawCircle(ctx, cx - 24, cy - 12, 12, '#15803d');
    drawCircle(ctx, cx - 28, cy - 14, 3, '#f97316');
    drawCircle(ctx, cx - 20, cy - 10, 3, '#f97316');
    drawCottage(ctx, cx - 24, cy + 14, '#0284c7', '#fef3c7', 14);
    return;
  }

  if (island.id === 'islas-polestar') {
    // Loguetown Execution Scaffold & harbor plaza
    drawRect(ctx, cx - 22, cy - 6, 44, 22, '#cbd5e1');
    drawRect(ctx, cx - 8, cy - 36, 16, 30, '#78350f');
    drawRect(ctx, cx - 10, cy - 40, 20, 5, '#b45309');
    drawCottage(ctx, cx - 44, cy - 16, '#dc2626', '#fef3c7', 13);
    drawCottage(ctx, cx + 28, cy - 16, '#1d4ed8', '#f8fafc', 13);
    drawCottage(ctx, cx - 34, cy + 20, '#d97706', '#fef3c7', 13);
    return;
  }

  if (island.id === 'isla-cactus') {
    // Whisky Peak giant cactus mesas!
    for (const [mx, my, mh] of [
      [cx - 32, cy + 6, 34],
      [cx, cy - 4, 42],
      [cx + 32, cy + 8, 30],
    ]) {
      drawRect(ctx, mx - 6, my - mh, 12, mh, '#15803d');
      drawRect(ctx, mx - 12, my - mh + 10, 6, 6, '#16a34a');
      drawRect(ctx, mx + 6, my - mh + 14, 6, 6, '#16a34a');
    }
    drawCottage(ctx, cx - 10, cy + 20, '#d97706', '#fef3c7', 13);
    return;
  }

  if (island.id === 'baltigo') {
    drawMountain(ctx, cx - 22, cy + 8, 22, 34, '#d6d3d1', '#a8a29e', false);
    drawMountain(ctx, cx + 20, cy + 12, 20, 30, '#e7e5e4', '#d6d3d1', false);
    drawRect(ctx, cx - 12, cy - 12, 24, 18, '#44403c');
    drawRect(ctx, cx - 4, cy - 22, 8, 10, '#0d9488');
    return;
  }

  if (island.id === 'amazon-lily') {
    drawMountain(ctx, cx, cy - 10, 28, 34, '#475569', '#334155', false);
    drawJapaneseHouse(ctx, cx - 12, cy - 8, '#be185d', '#831843', 24);
    drawPalmTree(ctx, cx - 32, cy + 12);
    drawPalmTree(ctx, cx + 32, cy + 12);
    return;
  }

  if (island.id === 'isla-momoiro') {
    drawRect(ctx, cx - 18, cy - 16, 36, 26, '#fbcfe8');
    drawRect(ctx, cx - 20, cy - 22, 40, 6, '#ec4899');
    drawRect(ctx, cx - 8, cy - 34, 16, 12, '#db2777');
    drawSakuraTree(ctx, cx - 34, cy + 10, 8);
    drawSakuraTree(ctx, cx + 34, cy + 10, 8);
    return;
  }

  if (island.id === 'jaya') {
    drawCottage(ctx, cx - 36, cy + 6, '#b45309', '#fde68a', 14);
    drawCottage(ctx, cx - 22, cy - 12, '#dc2626', '#fef3c7', 12);
    drawCircle(ctx, cx + 22, cy - 6, 18, '#cbd5e1'); // half-skull ruins
    drawCircle(ctx, cx + 16, cy - 8, 4, '#0f172a');
    drawPineTree(ctx, cx + 32, cy + 18, 10);
    return;
  }

  if (island.id === 'anillos-largos') {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.35;
      const sx = cx + Math.cos(a) * 42;
      const sy = cy + Math.sin(a) * 36;
      drawPineTree(ctx, sx, sy, 8);
    }
    drawCottage(ctx, cx - 24, cy + 16, '#eab308', '#fef3c7', 10);
    return;
  }

  if (island.id === 'weatheria') {
    drawCloudCluster(ctx, cx, cy, 40, 16, 0.95);
    drawCircle(ctx, cx, cy - 8, 16, '#93c5fd');
    drawRect(ctx, cx - 20, cy - 12, 40, 4, '#f59e0b');
    drawRect(ctx, cx - 2, cy - 30, 4, 34, '#f59e0b');
    return;
  }

  if (island.id === 'isla-raijin') {
    for (const [lx, ly] of [
      [cx - 26, cy - 10],
      [cx, cy - 22],
      [cx + 26, cy - 10],
    ]) {
      drawRect(ctx, lx - 2, ly - 18, 4, 26, '#facc15');
      drawCircle(ctx, lx, ly - 20, 4, '#fef08a');
    }
    drawCottage(ctx, cx - 8, cy + 14, '#7c3aed', '#e2e8f0', 14);
    return;
  }

  if (island.id === 'isla-lodestar') {
    // Giant magnetic compass spire!
    drawCircle(ctx, cx, cy, 24, '#334155');
    drawRect(ctx, cx - 28, cy - 2, 56, 4, '#facc15');
    drawRect(ctx, cx - 2, cy - 28, 4, 56, '#facc15');
    drawCircle(ctx, cx, cy, 7, '#38bdf8');
    return;
  }

  if (island.id === 'reino-torino') {
    drawRect(ctx, cx - 8, cy, 16, 26, '#78350f');
    drawCircle(ctx, cx, cy - 12, 32, '#15803d');
    drawCircle(ctx, cx - 12, cy - 18, 16, '#22c55e');
    drawCottage(ctx, cx - 26, cy + 16, '#0d9488', '#fef3c7', 12);
    return;
  }

  if (island.id === 'isla-kuraigana') {
    drawRect(ctx, cx - 18, cy - 24, 36, 30, '#334155');
    drawRect(ctx, cx - 22, cy - 36, 10, 14, '#1e293b');
    drawRect(ctx, cx + 12, cy - 36, 10, 14, '#1e293b');
    drawRect(ctx, cx - 6, cy - 46, 12, 22, '#475569');
    drawRect(ctx, cx - 36, cy + 6, 3, 18, '#cbd5e1');
    drawRect(ctx, cx - 41, cy + 10, 13, 3, '#cbd5e1');
    drawPineTree(ctx, cx + 32, cy + 14, 11);
    return;
  }

  if (island.id === 'islas-kinoko') {
    for (const [mx, my, col] of [
      [cx - 22, cy - 6, '#ef4444'],
      [cx + 18, cy - 12, '#a855f7'],
      [cx + 2, cy + 14, '#ec4899'],
    ] as Array<[number, number, string]>) {
      drawRect(ctx, mx - 3, my, 6, 14, '#fef3c7');
      drawCircle(ctx, mx, my - 4, 12, col);
      drawCircle(ctx, mx - 4, my - 7, 3, '#ffffff');
      drawCircle(ctx, mx + 4, my - 3, 3, '#ffffff');
    }
    return;
  }

  if (island.id === 'reino-arabasta') {
    drawRect(ctx, cx - 6, cy - 58, 12, 116, '#38bdf8');
    drawMountain(ctx, cx - 34, cy + 4, 20, 26, '#d97706', '#b45309', false);
    drawRect(ctx, cx - 16, cy - 18, 32, 22, '#fef3c7');
    drawCircle(ctx, cx, cy - 20, 10, '#f59e0b');
    drawPalmTree(ctx, cx + 24, cy + 12);
    drawPalmTree(ctx, cx - 26, cy + 28);
    return;
  }
  if (island.id === 'water-7') {
    drawRect(ctx, cx - 42, cy - 4, 84, 10, '#0ea5e9');
    drawRect(ctx, cx - 5, cy - 48, 10, 96, '#38bdf8');
    drawRect(ctx, cx - 16, cy - 28, 32, 24, '#f8fafc');
    drawRect(ctx, cx - 10, cy - 42, 20, 14, '#e2e8f0');
    drawCottage(ctx, cx - 38, cy - 22, '#0284c7', '#f8fafc', 14);
    drawCottage(ctx, cx + 22, cy - 22, '#0284c7', '#f8fafc', 14);
    drawCottage(ctx, cx + 20, cy + 10, '#38bdf8', '#f8fafc', 14);
    return;
  }
  if (island.id === 'enies-lobby') {
    drawCircle(ctx, cx, cy, 56, '#082f49');
    drawCircle(ctx, cx, cy, 46, '#64748b');
    drawRect(ctx, cx - 14, cy - 34, 28, 42, '#f8fafc');
    drawRect(ctx, cx - 16, cy - 38, 32, 6, '#334155');
    drawRect(ctx, cx - 6, cy - 48, 12, 12, '#e2e8f0');
    drawRect(ctx, cx - 28, cy + 10, 56, 10, '#cbd5e1');
    return;
  }
  if (island.id === 'archipielago-sabaody') {
    const mangroves = [
      [cx - 24, cy - 16],
      [cx + 22, cy - 18],
      [cx, cy - 4],
      [cx - 26, cy + 16],
      [cx + 24, cy + 14],
    ];
    for (const [mx, my] of mangroves) {
      drawRect(ctx, mx - 5, my - 10, 10, 22, '#78350f');
      drawCircle(ctx, mx, my - 16, 15, '#15803d');
      drawCircle(ctx, mx - 3, my - 20, 10, '#22c55e');
    }
    drawCircle(ctx, cx - 14, cy - 32, 7, 'rgba(103, 232, 249, 0.72)');
    drawCircle(ctx, cx + 18, cy - 34, 8, 'rgba(249, 168, 212, 0.65)');
    drawCircle(ctx, cx + 2, cy + 28, 6, 'rgba(125, 211, 252, 0.72)');
    return;
  }
  if (island.id === 'zou') {
    drawCircle(ctx, cx, cy - 4, 26, '#15803d');
    drawRect(ctx, cx - 12, cy - 18, 24, 34, '#64748b');
    drawCircle(ctx, cx, cy - 22, 18, '#22c55e');
    drawCottage(ctx, cx - 38, cy - 8, '#ca8a04', '#fef3c7', 12);
    drawCottage(ctx, cx + 26, cy - 8, '#ca8a04', '#fef3c7', 12);
    drawCottage(ctx, cx - 10, cy + 24, '#16a34a', '#fef3c7', 12);
    return;
  }
  if (island.id === 'isla-dawn') {
    drawMountain(ctx, cx + 22, cy - 4, 22, 34, '#64748b', '#475569', false);
    drawRect(ctx, cx - 6, cy - 20, 10, 22, '#f8fafc');
    drawRect(ctx, cx - 16, cy - 14, 30, 4, '#f59e0b');
    drawRect(ctx, cx - 3, cy - 26, 4, 28, '#f59e0b');
    drawCottage(ctx, cx - 36, cy - 12, '#dc2626', '#fef3c7', 13);
    drawCottage(ctx, cx - 28, cy + 8, '#0284c7', '#fef3c7', 13);
    drawPineTree(ctx, cx + 20, cy + 16, 12);
    drawPineTree(ctx, cx + 32, cy + 10, 10);
    return;
  }
  if (island.id === 'mary-geoise') {
    // Red Line stone bastion + multi-tiered Pangaea Castle & formal gardens
    drawRect(ctx, cx - 44, cy - 30, 88, 60, '#cbd5e1');
    drawRect(ctx, cx - 40, cy - 26, 80, 52, '#65a30d');
    drawRect(ctx, cx - 40, cy + 2, 80, 8, '#e2e8f0');
    drawRect(ctx, cx - 8, cy - 26, 16, 52, '#e2e8f0');
    drawRect(ctx, cx - 28, cy - 16, 56, 26, '#f8fafc');
    drawRect(ctx, cx - 32, cy - 20, 64, 5, '#991b1b');
    drawRect(ctx, cx - 20, cy - 30, 40, 10, '#f1f5f9');
    drawRect(ctx, cx - 24, cy - 34, 48, 5, '#dc2626');
    drawRect(ctx, cx - 9, cy - 46, 18, 12, '#fef08a');
    drawRect(ctx, cx - 5, cy - 54, 10, 8, '#facc15');
    drawRect(ctx, cx - 28, cy + 14, 12, 10, '#f8fafc');
    drawRect(ctx, cx + 16, cy + 14, 12, 10, '#f8fafc');
    drawPineTree(ctx, cx - 36, cy - 10, 8);
    drawPineTree(ctx, cx + 32, cy - 10, 8);
    return;
  }

  // Remaining major islands: varied road layout + distinct biome village props
  drawVariedRoads(ctx, island, seed);

  const roofPalettes = ['#dc2626', '#0284c7', '#d97706', '#0d9488', '#7c3aed', '#b45309'];
  const roofA = roofPalettes[seed % roofPalettes.length];
  const roofB = roofPalettes[(seed + 2) % roofPalettes.length];

  switch (island.biome) {
    case 'colosseum': {
      drawCircle(ctx, cx, cy, 24, '#cbd5e1');
      drawCircle(ctx, cx, cy, 18, '#ef4444');
      drawCircle(ctx, cx, cy, 11, '#e7c791');
      drawCottage(ctx, cx - 44, cy - 10, roofA, '#fef3c7', 13);
      drawCottage(ctx, cx + 32, cy - 10, roofB, '#fef3c7', 13);
      break;
    }
    case 'marine': {
      drawRect(ctx, cx - 26, cy - 18, 52, 30, '#f8fafc');
      drawRect(ctx, cx - 22, cy - 26, 44, 10, '#2563eb');
      drawRect(ctx, cx - 8, cy - 38, 16, 14, '#e2e8f0');
      drawRect(ctx, cx - 5, cy - 12, 10, 24, '#94a3b8');
      break;
    }
    case 'pagoda': {
      drawMountain(ctx, cx + 24, cy, 16, 26, '#64748b', '#475569', true);
      drawJapaneseHouse(ctx, cx - 14, cy - 10, roofA, '#7f1d1d', 22);
      drawSakuraTree(ctx, cx - 30, cy + 8, 7);
      drawSakuraTree(ctx, cx + 26, cy + 14, 7);
      break;
    }
    case 'sky': {
      drawCloudCluster(ctx, cx, cy, 40, 15, 0.96);
      drawRect(ctx, cx - 12, cy - 22, 24, 18, '#fef08a');
      drawRect(ctx, cx - 8, cy - 30, 16, 8, '#eab308');
      drawRect(ctx, cx - 2, cy - 38, 4, 8, '#facc15');
      break;
    }
    case 'volcano': {
      drawMountain(ctx, cx, cy + 8, 26, 36, '#334155', '#1e293b', false);
      drawCircle(ctx, cx, cy - 24, 8, '#ef4444');
      drawCircle(ctx, cx, cy - 25, 4, '#fde047');
      break;
    }
    case 'desert': {
      drawMountain(ctx, cx - 18, cy + 4, 18, 24, '#d97706', '#b45309', false);
      drawCircle(ctx, cx + 20, cy + 10, 10, '#38bdf8');
      drawPalmTree(ctx, cx + 12, cy + 4);
      drawPalmTree(ctx, cx + 28, cy + 6);
      break;
    }
    case 'treasure': {
      drawCircle(ctx, cx, cy - 6, 22, '#15803d');
      drawRect(ctx, cx - 6, cy - 2, 12, 22, '#78350f');
      drawCottage(ctx, cx - 30, cy + 8, roofA, '#fef3c7', 12);
      drawPineTree(ctx, cx + 24, cy + 10, 12);
      break;
    }
    case 'fortress': {
      drawRect(ctx, cx - 24, cy - 18, 48, 28, '#475569');
      drawRect(ctx, cx - 28, cy - 22, 10, 32, '#334155');
      drawRect(ctx, cx + 18, cy - 22, 10, 32, '#334155');
      drawCottage(ctx, cx - 10, cy + 16, roofA, '#e2e8f0', 14);
      break;
    }
    default: {
      drawMountain(ctx, cx + (seed % 2 === 0 ? 22 : -22), cy - 4, 18, 24, '#64748b', '#475569', false);
      drawCottage(ctx, cx - 24, cy - 10, roofA, '#f8fafc', 15);
      drawCottage(ctx, cx - 4, cy + 8, roofB, '#fef3c7', 14);
      drawPineTree(ctx, cx + 24, cy + 16, 11);
      drawPineTree(ctx, cx - 32, cy + 16, 10);
      break;
    }
  }
}

export function getIslandPixelCanvas(
  island: Island,
  variant: 'surface' | 'underwater' = 'surface'
): HTMLCanvasElement {
  const effectiveVariant =
    island.id === 'isla-hombres-pez' ? variant : 'surface';
  const key = `${island.id}:${effectiveVariant}`;
  const cached = artCache.get(key);
  if (cached) {
    artCache.delete(key);
    artCache.set(key, cached);
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = ART_SIZE;
  canvas.height = ART_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (island.id === 'isla-hombres-pez') {
    if (effectiveVariant === 'underwater') {
      renderFishmanUnderwaterArt(ctx);
    } else {
      renderFishmanTrenchSurfaceArt(ctx);
    }
  } else {
    renderCanonIslandArt(ctx, island);
  }

  if (artCache.size >= MAX_ISLAND_ART_CACHE) {
    const oldestKey = artCache.keys().next().value;
    if (oldestKey !== undefined) {
      artCache.delete(oldestKey);
    }
  }
  artCache.set(key, canvas);
  return canvas;
}
