import type {
  ActiveRoamingShipNpc,
  BotPirate,
  BotRoleKind,
  Pirate,
  RedDotFilterId,
} from './types';

export const MAX_IMPORTANT_RED_DOTS = 24;

export interface RedDotFilterOption {
  id: RedDotFilterId;
  label: string;
  shortLabel: string;
  group: 'level' | 'category';
  minLevel?: number;
  maxLevel?: number;
}

export const RED_DOT_FILTER_OPTIONS: RedDotFilterOption[] = [
  { id: 'lvl_1_10', label: 'Nivel 1-10', shortLabel: 'Nv 1-10', group: 'level', minLevel: 1, maxLevel: 10 },
  { id: 'lvl_10_20', label: 'Nivel 10-20', shortLabel: 'Nv 10-20', group: 'level', minLevel: 10, maxLevel: 20 },
  { id: 'lvl_20_30', label: 'Nivel 20-30', shortLabel: 'Nv 20-30', group: 'level', minLevel: 20, maxLevel: 30 },
  { id: 'lvl_30_50', label: 'Nivel 30-50', shortLabel: 'Nv 30-50', group: 'level', minLevel: 30, maxLevel: 50 },
  { id: 'lvl_50_70', label: 'Nivel 50-70', shortLabel: 'Nv 50-70', group: 'level', minLevel: 50, maxLevel: 70 },
  { id: 'lvl_70_100', label: 'Nivel 70-100', shortLabel: 'Nv 70-100', group: 'level', minLevel: 70, maxLevel: 100 },
  { id: 'special_events', label: 'Eventos especiales', shortLabel: 'Eventos', group: 'category' },
  { id: 'boss_troops', label: 'Tropas de bosses', shortLabel: 'Tropas Boss', group: 'category' },
  { id: 'only_characters', label: 'Solo personajes', shortLabel: 'Solo personajes', group: 'category' },
];

export type MapDotKind = 'player' | 'roaming_npc' | 'bot';

export interface MapDotCandidate {
  id: string;
  kind: MapDotKind;
  level: number;
  isCharacter: boolean;
  isSpecialEvent: boolean;
  isBossTroop: boolean;
  importance: number;
  pirate?: Pirate;
  roamingNpc?: ActiveRoamingShipNpc;
  bot?: BotPirate;
}

const LEVEL_OPTION_MAP = new Map<RedDotFilterId, RedDotFilterOption>(
  RED_DOT_FILTER_OPTIONS.filter((o) => o.group === 'level').map((o) => [o.id, o])
);

export function computeBotImportance(bot: Pick<BotPirate, 'level' | 'roleKind' | 'status'>): number {
  let score = bot.level;
  if (bot.roleKind === 'special_event') score += 380;
  else if (bot.roleKind === 'boss_troop') score += 220;
  if (bot.status === 'sailing') score += 25;
  return score;
}

export function buildMapDotCandidates(
  pirates: Pirate[],
  bots: BotPirate[],
  roamingNpcs: ActiveRoamingShipNpc[],
  selectedPirateId?: string | null
): MapDotCandidate[] {
  const list: MapDotCandidate[] = [];

  for (let i = 0; i < pirates.length; i++) {
    const p = pirates[i];
    const lv = Math.max(1, p.level || 1);
    const isSel = p.id === selectedPirateId;
    list.push({
      id: p.id,
      kind: 'player',
      level: lv,
      isCharacter: true,
      isSpecialEvent: false,
      isBossTroop: false,
      importance: (isSel ? 2000 : 1200) + lv * 2,
      pirate: p,
    });
  }

  for (let i = 0; i < roamingNpcs.length; i++) {
    const npc = roamingNpcs[i];
    const isTimedSpecial = npc.def.isSpecialEvent;
    list.push({
      id: npc.def.id,
      kind: 'roaming_npc',
      level: npc.def.level,
      isCharacter: true,
      isSpecialEvent: isTimedSpecial,
      isBossTroop: false,
      importance: (isTimedSpecial ? 760 : 480) + npc.def.level * 2,
      roamingNpc: npc,
    });
  }

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const roleKind: BotRoleKind = bot.roleKind ?? 'fleet';
    const level = Math.max(1, Math.min(100, bot.level ?? 1));
    list.push({
      id: bot.id,
      kind: 'bot',
      level,
      isCharacter: false,
      isSpecialEvent: roleKind === 'special_event',
      isBossTroop: roleKind === 'boss_troop',
      importance: computeBotImportance({ level, roleKind, status: bot.status }),
      bot,
    });
  }

  return list;
}

export function matchesRedDotFilters(
  candidate: Pick<MapDotCandidate, 'level' | 'isCharacter' | 'isSpecialEvent' | 'isBossTroop'>,
  activeFilters: RedDotFilterId[]
): boolean {
  if (!activeFilters || activeFilters.length === 0) return true;

  let hasLevelFilter = false;
  let matchesLevel = false;
  let hasCategoryFilter = false;
  let matchesCategory = false;

  for (let i = 0; i < activeFilters.length; i++) {
    const f = activeFilters[i];
    const lvlOpt = LEVEL_OPTION_MAP.get(f);
    if (lvlOpt) {
      hasLevelFilter = true;
      if (
        candidate.level >= (lvlOpt.minLevel ?? 1) &&
        candidate.level <= (lvlOpt.maxLevel ?? 100)
      ) {
        matchesLevel = true;
      }
      continue;
    }

    hasCategoryFilter = true;
    if (f === 'special_events' && candidate.isSpecialEvent) {
      matchesCategory = true;
    } else if (f === 'boss_troops' && candidate.isBossTroop) {
      matchesCategory = true;
    } else if (f === 'only_characters' && candidate.isCharacter) {
      matchesCategory = true;
    }
  }

  if (hasLevelFilter && !matchesLevel) return false;
  if (hasCategoryFilter && !matchesCategory) return false;
  return true;
}

export function filterAndRankMapDots(
  candidates: MapDotCandidate[],
  activeFilters: RedDotFilterId[],
  maxDots = MAX_IMPORTANT_RED_DOTS
): {
  visible: MapDotCandidate[];
  totalMatching: number;
  capped: boolean;
} {
  const matching: MapDotCandidate[] = [];
  for (let i = 0; i < candidates.length; i++) {
    if (matchesRedDotFilters(candidates[i], activeFilters)) {
      matching.push(candidates[i]);
    }
  }

  matching.sort((a, b) => b.importance - a.importance);

  const limit = Math.max(1, maxDots);
  const capped = matching.length > limit;
  return {
    visible: capped ? matching.slice(0, limit) : matching,
    totalMatching: matching.length,
    capped,
  };
}
