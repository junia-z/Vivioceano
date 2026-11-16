import {
  getNavigationPathCoords,
  sampleNavigationPathXYZ,
  xyzToLatLon,
} from './sim';
import type {
  ActiveRoamingShipNpc,
  Island,
  RoamingShipNpcDef,
} from './types';

export const ROAMING_SHIP_NPCS: RoamingShipNpcDef[] = [
  // 4 Emperors / Legends: each strictly sails for 15 minutes every hour
  {
    id: 'roam-shanks',
    name: 'Shanks',
    epithet: 'El Pelirrojo',
    shipName: 'Red Force',
    faction: 'piratas',
    level: 96,
    bounty: 4_048_900_000,
    flagColor: '#dc2626',
    routeIslandIds: ['elbaph', 'pais-de-wano', 'totto-land', 'archipielago-sabaody', 'isla-dawn'],
    legSeconds: 150,
    isSpecialEvent: true,
    windowStartMinute: 0,
    windowDurationMinutes: 15,
    appearance: {
      race: 'humano',
      hatStyle: 'none',
      hairStyle: 'short',
      hairColor: '#b91c1c',
      outfitStyle: 'shirt',
      outfitColor: '#f8fafc',
      skinTone: '#f3c18c',
      bodyBuild: 'normal',
      accessory: 'scar',
      accessoryColor: '#7f1d1d',
      capeStyle: 'cape',
      capeColor: '#1e293b',
      weaponStyle: 'sword',
    },
  },
  {
    id: 'roam-mihawk',
    name: 'Dracule Mihawk',
    epithet: 'Ojos de Halcón',
    shipName: 'Ataúd Errante',
    faction: 'piratas',
    level: 94,
    bounty: 3_590_000_000,
    flagColor: '#7c2d12',
    routeIslandIds: ['isla-kuraigana', 'marineford', 'water-7', 'islas-polestar', 'reino-arabasta'],
    legSeconds: 140,
    isSpecialEvent: true,
    windowStartMinute: 15,
    windowDurationMinutes: 15,
    appearance: {
      race: 'humano',
      hatStyle: 'tricorn',
      hatColor: '#1e293b',
      hairStyle: 'short',
      hairColor: '#1c1917',
      outfitStyle: 'coat',
      outfitColor: '#7f1d1d',
      skinTone: '#fde0c4',
      bodyBuild: 'normal',
      accessory: 'goatee',
      accessoryColor: '#1c1917',
      capeStyle: 'coat_cape',
      capeColor: '#1e293b',
      weaponStyle: 'sword',
    },
  },
  {
    id: 'roam-gaban',
    name: 'Scopper Gaban',
    epithet: 'Ala Izquierda del Rey',
    shipName: 'Navío de Elbaph',
    faction: 'aventureros',
    level: 92,
    bounty: 2_250_000_000,
    flagColor: '#eab308',
    routeIslandIds: ['elbaph', 'archipielago-sabaody', 'water-7', 'jaya', 'elbaph'],
    legSeconds: 135,
    isSpecialEvent: true,
    windowStartMinute: 30,
    windowDurationMinutes: 15,
    appearance: {
      race: 'humano',
      hatStyle: 'none',
      hairStyle: 'ponytail',
      hairColor: '#cbd5e1',
      outfitStyle: 'vest',
      outfitColor: '#f8fafc',
      skinTone: '#f3c18c',
      bodyBuild: 'normal',
      accessory: 'glasses',
      accessoryColor: '#f59e0b',
      capeStyle: 'cape',
      capeColor: '#475569',
      weaponStyle: 'sword',
    },
  },
  {
    id: 'roam-teach',
    name: 'Marshall D. Teach',
    epithet: 'Barbanegra',
    shipName: 'Saber of Xebec',
    faction: 'piratas',
    level: 90,
    bounty: 3_996_000_000,
    flagColor: '#1e1b4b',
    routeIslandIds: ['hachinosu', 'punk-hazard', 'dressrosa', 'impel-down', 'nuevo-marineford'],
    legSeconds: 145,
    isSpecialEvent: true,
    windowStartMinute: 45,
    windowDurationMinutes: 15,
    appearance: {
      race: 'humano',
      hatStyle: 'tricorn',
      hatColor: '#1e293b',
      hairStyle: 'curly',
      hairColor: '#1c1917',
      outfitStyle: 'coat',
      outfitColor: '#1e293b',
      skinTone: '#b67848',
      bodyBuild: 'robust',
      accessory: 'beard',
      accessoryColor: '#1c1917',
      capeStyle: 'coat_cape',
      capeColor: '#7f1d1d',
      weaponStyle: 'none',
    },
  },
  // Continuous ship-only travelers across the seas
  {
    id: 'roam-law',
    name: 'Trafalgar Law',
    epithet: 'Cirujano de la Muerte',
    shipName: 'Polar Tang',
    faction: 'piratas',
    level: 68,
    bounty: 3_000_000_000,
    flagColor: '#facc15',
    routeIslandIds: ['punk-hazard', 'dressrosa', 'zou', 'pais-de-wano', 'egghead'],
    legSeconds: 185,
    isSpecialEvent: false,
    appearance: {
      race: 'humano',
      hatStyle: 'bandana',
      hatColor: '#f8fafc',
      hairStyle: 'short',
      hairColor: '#1c1917',
      outfitStyle: 'coat',
      outfitColor: '#1e293b',
      skinTone: '#f3c18c',
      bodyBuild: 'slim',
      accessory: 'goatee',
      accessoryColor: '#1c1917',
      capeStyle: 'none',
      weaponStyle: 'sword',
    },
  },
  {
    id: 'roam-smoker',
    name: 'Smoker',
    epithet: 'Cazador Blanco G-5',
    shipName: 'Buque Interceptor G-5',
    faction: 'marines',
    level: 46,
    bounty: 0,
    flagColor: '#3b82f6',
    routeIslandIds: ['islas-polestar', 'reino-arabasta', 'punk-hazard', 'marineford', 'nuevo-marineford'],
    legSeconds: 175,
    isSpecialEvent: false,
    appearance: {
      race: 'humano',
      hatStyle: 'none',
      hairStyle: 'slick',
      hairColor: '#e2e8f0',
      outfitStyle: 'marine',
      outfitColor: '#f8fafc',
      skinTone: '#f3c18c',
      bodyBuild: 'robust',
      accessory: 'cigar',
      accessoryColor: '#b45309',
      capeStyle: 'justice_coat',
      capeColor: '#f8fafc',
      weaponStyle: 'jitte',
    },
  },
  {
    id: 'roam-bartolomeo',
    name: 'Bartolomeo',
    epithet: 'El Caníbal',
    shipName: 'Going Luffy-senpai',
    faction: 'piratas',
    level: 38,
    bounty: 200_000_000,
    flagColor: '#16a34a',
    routeIslandIds: ['islas-polestar', 'dressrosa', 'water-7', 'islas-conomi', 'isla-dawn'],
    legSeconds: 195,
    isSpecialEvent: false,
    appearance: {
      race: 'humano',
      hatStyle: 'none',
      hairStyle: 'mohawk',
      hairColor: '#16a34a',
      outfitStyle: 'coat',
      outfitColor: '#6d28d9',
      skinTone: '#f3c18c',
      bodyBuild: 'normal',
      accessory: 'none',
      capeStyle: 'none',
      weaponStyle: 'none',
    },
  },
  {
    id: 'roam-buggy',
    name: 'Buggy',
    epithet: 'El Payaso Estrella',
    shipName: 'Big Top',
    faction: 'piratas',
    level: 18,
    bounty: 15_000_000,
    flagColor: '#ef4444',
    routeIslandIds: ['islas-organ', 'isla-tesoro-buggy', 'islas-polestar', 'jaya', 'isla-goat'],
    legSeconds: 165,
    isSpecialEvent: false,
    appearance: {
      race: 'humano',
      hatStyle: 'tricorn',
      hatColor: '#dc2626',
      hairStyle: 'twintails',
      hairColor: '#2563eb',
      outfitStyle: 'striped',
      outfitColor: '#dc2626',
      skinTone: '#fde0c4',
      bodyBuild: 'normal',
      accessory: 'clown_nose',
      accessoryColor: '#ef4444',
      capeStyle: 'cape',
      capeColor: '#dc2626',
      weaponStyle: 'none',
    },
  },
  {
    id: 'roam-alvida',
    name: 'Alvida',
    epithet: 'Maza de Hierro',
    shipName: 'Miss Love Duck',
    faction: 'piratas',
    level: 8,
    bounty: 5_000_000,
    flagColor: '#ec4899',
    routeIslandIds: ['isla-dawn', 'isla-goat', 'islas-organ', 'islas-gecko', 'islas-conomi'],
    legSeconds: 155,
    isSpecialEvent: false,
    appearance: {
      race: 'humano',
      hatStyle: 'tricorn',
      hatColor: '#ec4899',
      hairStyle: 'long',
      hairColor: '#1c1917',
      outfitStyle: 'coat',
      outfitColor: '#ec4899',
      skinTone: '#fde0c4',
      bodyBuild: 'normal',
      accessory: 'none',
      capeStyle: 'feather_boa',
      capeColor: '#ec4899',
      weaponStyle: 'mace',
    },
  },
];

export function isRoamingWindowActive(
  def: RoamingShipNpcDef,
  nowMs: number
): { active: boolean; remainingMinutes: number | null; elapsedWindowSec: number } {
  if (def.windowStartMinute === undefined || def.windowDurationMinutes === undefined) {
    return { active: true, remainingMinutes: null, elapsedWindowSec: Math.floor(nowMs / 1000) };
  }
  const d = new Date(nowMs);
  const minuteFloat = d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60_000;
  const start = ((def.windowStartMinute % 60) + 60) % 60;
  const dur = Math.max(1, Math.min(60, def.windowDurationMinutes));
  const delta = (minuteFloat - start + 60) % 60;
  if (delta < dur) {
    return {
      active: true,
      remainingMinutes: Math.max(1, Math.ceil(dur - delta)),
      elapsedWindowSec: delta * 60,
    };
  }
  return {
    active: false,
    remainingMinutes: null,
    elapsedWindowSec: 0,
  };
}

export function formatRoamingScheduleLabel(def: RoamingShipNpcDef): string {
  if (def.windowStartMinute === undefined || def.windowDurationMinutes === undefined) {
    return 'En ruta continua por los mares';
  }
  const startStr = String(def.windowStartMinute).padStart(2, '0');
  const endMin = (def.windowStartMinute + def.windowDurationMinutes) % 60;
  const endStr = String(endMin).padStart(2, '0');
  return `${def.windowDurationMinutes} min cada hora (:${startStr} - :${endStr})`;
}

export function getActiveRoamingShipNpcs(
  allIslands: Island[],
  nowMs = Date.now()
): ActiveRoamingShipNpc[] {
  if (allIslands.length === 0) return [];
  const islandMap = new Map<string, Island>();
  for (let i = 0; i < allIslands.length; i++) {
    islandMap.set(allIslands[i].id, allIslands[i]);
  }

  const activeList: ActiveRoamingShipNpc[] = [];
  for (let idx = 0; idx < ROAMING_SHIP_NPCS.length; idx++) {
    const def = ROAMING_SHIP_NPCS[idx];
    const win = isRoamingWindowActive(def, nowMs);
    if (!win.active) continue;

    const route: Island[] = [];
    for (let r = 0; r < def.routeIslandIds.length; r++) {
      const isl = islandMap.get(def.routeIslandIds[r]);
      if (isl) route.push(isl);
    }
    if (route.length < 2) {
      route.push(allIslands[0], allIslands[Math.min(1, allIslands.length - 1)]);
    }

    const totalLegs = route.length;
    const totalCycleSec = totalLegs * def.legSeconds;
    const tSec = ((win.elapsedWindowSec % totalCycleSec) + totalCycleSec) % totalCycleSec;
    const legIndex = Math.floor(tSec / def.legSeconds) % totalLegs;
    const nextIndex = (legIndex + 1) % totalLegs;
    const legProgress = (tSec % def.legSeconds) / def.legSeconds;

    const fromIsland = route[legIndex];
    const toIsland = route[nextIndex];
    const coords = getNavigationPathCoords(fromIsland, toIsland);
    const posXYZ = sampleNavigationPathXYZ(coords, legProgress, 1);
    const [lat, lon] = xyzToLatLon(posXYZ);
    const aheadXYZ = sampleNavigationPathXYZ(coords, Math.min(1, legProgress + 0.025), 1);
    const headingLatLon = xyzToLatLon(aheadXYZ);

    activeList.push({
      def,
      lat,
      lon,
      headingLatLon,
      fromIsland,
      toIsland,
      legProgress,
      remainingWindowMinutes: win.remainingMinutes,
    });
  }

  return activeList;
}
