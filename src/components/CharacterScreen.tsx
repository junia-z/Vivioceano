import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Backpack,
  Check,
  Clock,
  CloudFog,
  CloudLightning,
  CloudRain,
  Coins,
  Compass,
  Edit3,
  Filter,
  Flame,
  Hand,
  LocateFixed,
  Map as MapIcon,
  MoreHorizontal,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Shield,
  Ship,
  Skull,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  Target,
  Trash2,
  User as UserIcon,
  Users,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  type PirateBuildPatch,
  computePirateStats,
  computeWeatherDebuff,
  estimateRemainingVoyageSec,
  estimateVoyageDurationSec,
  formatBounty,
  formatClock,
  formatShortBounty,
  formatVoyageEta,
  getEquippedItems,
  getIslandWeather,
  getNavigationPathCoords,
  getRankInfo,
  getRoleEvolutionInfo,
  getSeaBadgeColor,
  getWeekAndDay,
  xpForNextLevel,
} from '../game/sim';
import {
  MAX_IMPORTANT_RED_DOTS,
  RED_DOT_FILTER_OPTIONS,
  buildMapDotCandidates,
  filterAndRankMapDots,
} from '../game/mapFilters';
import {
  ROAMING_SHIP_NPCS,
  formatRoamingScheduleLabel,
  getActiveRoamingShipNpcs,
  isRoamingWindowActive,
} from '../game/roamingNpcs';
import {
  ACCESSORY_OPTIONS,
  CAPE_OPTIONS,
  FLAG_COLORS,
  HAIR_STYLES,
  HAT_OPTIONS,
  OUTFIT_COLORS,
  OUTFIT_STYLES,
  getBossDropPool,
  getBossForIsland,
  getEquipmentItem,
  getFactionInfo,
  getIslandMissions,
  getIslandRecommendedDays,
  getIslandSizeTier,
  getItemColorLabel,
  getMiniBossesForIsland,
  getNextCycleColor,
  getNpcsForIsland,
  getRaceInfo,
  getTraitOption,
} from '../game/worldData';
import type {
  BotPirate,
  EquipmentItem,
  EquipmentRarity,
  EquipmentSlot,
  Faction,
  Island,
  IslandMissionId,
  IslandZoneId,
  Pirate,
  RedDotFilterId,
  SeaName,
  WeatherType,
  WorldEvent,
} from '../game/types';
import { HorizontalOptionRail } from './HorizontalOptionRail';
import { IslandSceneView } from './IslandSceneView';
import { PirateAvatarSvg } from './PirateAvatarSvg';
import { WorldMapCanvas, type WorldMapFocusRequest } from './WorldMapCanvas';

export type CharacterTab =
  | 'estado'
  | 'inventario'
  | 'build'
  | 'misiones'
  | 'noticias'
  | 'mapa'
  | 'mas';

interface CharacterScreenProps {
  pirate: Pirate;
  allPirates: Pirate[];
  islands: Island[];
  miniIslands: Island[];
  bots: BotPirate[];
  events: WorldEvent[];
  day: number;
  minuteOfDay: number;
  muted: boolean;
  user: User | null;
  authBusy: boolean;
  authNotice: string | null;
  mapView: 'island' | 'globe' | 'map';
  inspectedIslandId?: string | null;
  mapFocusTarget?: WorldMapFocusRequest | null;
  mapSelectedIslandId?: string | null;
  selectedRoamingNpcId?: string | null;
  redDotFilters?: RedDotFilterId[];
  voyageNotice?: string | null;
  characterSideOpen: boolean;
  onChangeCharacterSideOpen: (open: boolean) => void;
  onChangeRedDotFilters?: (filters: RedDotFilterId[]) => void;
  onSelectRoamingNpc?: (npcId: string | null) => void;
  onFocusLatLon?: (lat: number, lon: number, zoom?: number, globeDist?: number) => void;
  onChangeMapView: (mode: 'island' | 'globe' | 'map') => void;
  onSelectMapIsland?: (islandId: string) => void;
  onZoomInToIsland?: (island: Island) => void;
  onZoomOutToMap?: (island: Island) => void;
  onZoomOutToGlobe?: (lat: number, lon: number) => void;
  onCoatShipBubble: (pirateId: string) => void;
  onClearVoyageNotice?: () => void;
  onBackToMenu: () => void;
  onFocusMyShip: () => void;
  onFocusFullGlobe: () => void;
  onFocusWorldCenter: () => void;
  onFocusIsland: (islandId: string) => void;
  onToggleManualMode: (pirateId: string, manualMode: boolean) => void;
  onMoveInIsland: (pirateId: string, zone: IslandZoneId) => void;
  onRunMission: (pirateId: string, missionId: IslandMissionId) => void;
  onRunNpcQuest: (pirateId: string, questId: string) => void;
  onChallengeMiniBoss: (pirateId: string, miniBossId: string) => void;
  onStartVoyage: (pirateId: string, destIslandId: string) => void;
  onUpdateCrew: (
    pirateId: string,
    payload: { crewName: string; flagColor: string }
  ) => void;
  onUpdateBuild: (pirateId: string, patch: PirateBuildPatch) => void;
  onEquipItem: (pirateId: string, itemId: string) => void;
  onUnequipSlot: (pirateId: string, slot: EquipmentSlot) => void;
  onEditCharacter: (pirate: Pirate) => void;
  onDeleteCharacter: (pirateId: string) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onAuthAction: () => void;
}

const SEAS_ORDER: SeaName[] = [
  'Mar del Este',
  'Mar del Norte',
  'Mar del Sur',
  'Mar del Oeste',
  'Paraíso',
  'Nuevo Mundo',
];

const RARITY_STYLES: Record<
  EquipmentRarity,
  { badge: string; border: string; label: string }
> = {
  comun: {
    badge: 'bg-slate-200/90 text-slate-800 border border-slate-300',
    border: 'border-slate-300',
    label: 'Común',
  },
  raro: {
    badge: 'bg-sky-500/15 text-sky-800 border border-sky-400/50',
    border: 'border-sky-400/60',
    label: 'Raro',
  },
  epico: {
    badge: 'bg-purple-500/15 text-purple-800 border border-purple-400/50',
    border: 'border-purple-400/60',
    label: 'Épico',
  },
  legendario: {
    badge: 'bg-amber-500/20 text-amber-800 border border-amber-500/55',
    border: 'border-amber-500/65',
    label: 'Legendario',
  },
};

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  arma: 'Arma',
  armadura: 'Armadura',
  amuleto: 'Amuleto',
};

function renderFactionMiniIcon(faction: Faction) {
  switch (faction) {
    case 'marines':
      return <Shield className="h-3.5 w-3.5 text-sky-600 shrink-0" />;
    case 'revolucionarios':
      return <Flame className="h-3.5 w-3.5 text-teal-600 shrink-0" />;
    case 'aventureros':
      return <Compass className="h-3.5 w-3.5 text-purple-600 shrink-0" />;
    default:
      return <Skull className="h-3.5 w-3.5 text-rose-600 shrink-0" />;
  }
}

function renderWeatherIcon(type: WeatherType, color: string) {
  switch (type) {
    case 'lluvia':
      return <CloudRain className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'tormenta':
      return <CloudLightning className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'nieve':
      return <Snowflake className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'niebla':
      return <CloudFog className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'viento':
      return <Wind className="h-4 w-4 shrink-0" style={{ color }} />;
    default:
      return <Sun className="h-4 w-4 shrink-0" style={{ color }} />;
  }
}

function formatItemStatTags(item: EquipmentItem): string[] {
  const tags: string[] = [];
  if (item.fuerzaBonus) tags.push(`+${item.fuerzaBonus} Fue`);
  if (item.agilidadBonus) tags.push(`+${item.agilidadBonus} Agi`);
  if (item.aguanteBonus) tags.push(`+${item.aguanteBonus} Agu`);
  if (item.ingenioBonus) tags.push(`+${item.ingenioBonus} Ing`);
  if (item.combatBonus) tags.push(`+${item.combatBonus} Comb`);
  return tags;
}

export const CharacterScreen: React.FC<CharacterScreenProps> = ({
  pirate,
  allPirates,
  islands,
  miniIslands,
  bots,
  events,
  day,
  minuteOfDay,
  muted,
  user,
  authBusy,
  authNotice,
  mapView,
  inspectedIslandId = null,
  mapFocusTarget,
  mapSelectedIslandId,
  selectedRoamingNpcId = null,
  redDotFilters = [],
  voyageNotice,
  characterSideOpen,
  onChangeCharacterSideOpen,
  onChangeRedDotFilters,
  onSelectRoamingNpc,
  onFocusLatLon,
  onChangeMapView,
  onSelectMapIsland,
  onZoomInToIsland,
  onZoomOutToMap,
  onZoomOutToGlobe,
  onCoatShipBubble,
  onClearVoyageNotice,
  onBackToMenu,
  onFocusMyShip,
  onFocusFullGlobe,
  onFocusWorldCenter,
  onFocusIsland,
  onToggleManualMode,
  onMoveInIsland,
  onRunMission,
  onRunNpcQuest,
  onChallengeMiniBoss,
  onStartVoyage,
  onUpdateCrew,
  onUpdateBuild,
  onEquipItem,
  onUnequipSlot,
  onEditCharacter,
  onDeleteCharacter,
  onToggleMute,
  onPause,
  onAuthAction,
}) => {
  const allIslands = useMemo(() => [...islands, ...miniIslands], [islands, miniIslands]);
  const [activeTab, setActiveTab] = useState<CharacterTab>('estado');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [nowBucketMs, setNowBucketMs] = useState(() => Math.floor(Date.now() / 4000) * 4000);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingCrew, setEditingCrew] = useState(false);
  const [crewInput, setCrewInput] = useState(
    pirate.crewName === 'Sin tripulación' ? '' : pirate.crewName
  );
  const [colorInput, setColorInput] = useState(pirate.flagColor);
  const [selectedSeaFilter, setSelectedSeaFilter] = useState<SeaName>(
    allIslands.find((i) => i.id === pirate.islandId)?.sea ?? 'Mar del Este'
  );

  useEffect(() => {
    setCrewInput(pirate.crewName === 'Sin tripulación' ? '' : pirate.crewName);
    setColorInput(pirate.flagColor);
    setEditingCrew(false);
  }, [pirate.id, pirate.crewName, pirate.flagColor]);

  const currIsland = allIslands.find((i) => i.id === pirate.islandId) ?? allIslands[0];
  const destIsland = pirate.sailingToIslandId
    ? allIslands.find((i) => i.id === pirate.sailingToIslandId)
    : null;

  const sameIslandPeers = useMemo(
    () =>
      allPirates.filter(
        (other) =>
          other.id !== pirate.id && !other.sailingToIslandId && other.islandId === currIsland.id
      ),
    [allPirates, pirate.id, currIsland.id]
  );

  const characterEvents = useMemo(
    () => events.filter((ev) => ev.pirateId === pirate.id || ev.targetPirateId === pirate.id),
    [events, pirate.id]
  );

  const factionInfo = getFactionInfo(pirate.faction);
  const raceInfo = getRaceInfo(pirate.race);
  const hasCrew = Boolean(pirate.crewName && pirate.crewName !== 'Sin tripulación');
  const level = pirate.level || 1;
  const xp = pirate.xp || 0;
  const xpNeeded = xpForNextLevel(level);
  const xpPct = Math.min(100, Math.round((xp / xpNeeded) * 100));
  const rank = getRankInfo(level);

  const weather = useMemo(
    () => getIslandWeather(currIsland, day, minuteOfDay),
    [currIsland, day, minuteOfDay]
  );
  const weatherDebuff = useMemo(
    () => computeWeatherDebuff(weather, pirate),
    [weather, pirate]
  );
  const stats = computePirateStats(pirate, weather);
  const roleEvolution = useMemo(
    () => getRoleEvolutionInfo(pirate, weather),
    [pirate, weather]
  );
  const equippedItems = useMemo(() => getEquippedItems(pirate.equipped), [pirate.equipped]);
  const inventoryItems = useMemo(
    () =>
      (pirate.inventory ?? [])
        .map((id) => getEquipmentItem(id))
        .filter((it): it is EquipmentItem => Boolean(it)),
    [pirate.inventory]
  );

  const boss = getBossForIsland(currIsland);
  const bossDrops = useMemo(
    () =>
      getBossDropPool(currIsland, boss)
        .map((id) => getEquipmentItem(id))
        .filter((it): it is EquipmentItem => Boolean(it)),
    [currIsland, boss]
  );
  const islandMissions = useMemo(() => getIslandMissions(currIsland), [currIsland]);
  const npcQuests = useMemo(() => getNpcsForIsland(currIsland), [currIsland]);
  const miniBosses = useMemo(() => getMiniBossesForIsland(currIsland), [currIsland]);
  const sizeTier = getIslandSizeTier(currIsland);
  const recommendedDays = getIslandRecommendedDays(currIsland);
  const daysHere = Math.max(1, day - (pirate.arrivedDay ?? 1) + 1);
  const completedQuestsSet = useMemo(
    () => new Set(pirate.completedQuestIds ?? []),
    [pirate.completedQuestIds]
  );
  const defeatedMiniBossesSet = useMemo(
    () => new Set(pirate.defeatedMiniBossIds ?? []),
    [pirate.defeatedMiniBossIds]
  );
  const doneQuestsCount = npcQuests.filter((q) => completedQuestsSet.has(q.id)).length;
  const weekInfo = getWeekAndDay(day);

  const isGrandLine = currIsland.sea === 'Paraíso' || currIsland.sea === 'Nuevo Mundo';
  const targetLevelGate = currIsland.sea === 'Paraíso' ? 20 : 10;
  const levelsMissing = Math.max(0, targetLevelGate - level);
  const gatePct = Math.min(100, Math.round((level / targetLevelGate) * 100));

  const stageIsland = useMemo(
    () =>
      (inspectedIslandId && allIslands.find((i) => i.id === inspectedIslandId)) ||
      currIsland,
    [allIslands, currIsland, inspectedIslandId]
  );
  const isPlayerDockedHere = !pirate.sailingToIslandId && stageIsland.id === currIsland.id;

  const showFlatMap = mapView === 'map';
  const showGlobeViewport = mapView === 'globe';
  const showIslandViewport = mapView === 'island';
  const hasEquippedWeapon = Boolean(pirate.equipped?.arma);

  useEffect(() => {
    if (!showFlatMap && !showGlobeViewport) return;
    setNowBucketMs(Math.floor(Date.now() / 4000) * 4000);
    const id = window.setInterval(() => {
      setNowBucketMs(Math.floor(Date.now() / 4000) * 4000);
    }, 4000);
    return () => window.clearInterval(id);
  }, [showFlatMap, showGlobeViewport]);

  const activeRoamingNpcs = useMemo(
    () => getActiveRoamingShipNpcs(allIslands, nowBucketMs),
    [allIslands, nowBucketMs]
  );

  const dotSummary = useMemo(() => {
    const cands = buildMapDotCandidates(allPirates, bots, activeRoamingNpcs, pirate.id);
    const ranked = filterAndRankMapDots(cands, redDotFilters, MAX_IMPORTANT_RED_DOTS);
    return {
      visible: ranked.visible.length,
      totalMatching: ranked.totalMatching,
      totalAll: cands.length,
      capped: ranked.capped,
    };
  }, [allPirates, bots, activeRoamingNpcs, pirate.id, redDotFilters]);

  const selectedRoamingNpc = useMemo(
    () => activeRoamingNpcs.find((n) => n.def.id === selectedRoamingNpcId) ?? null,
    [activeRoamingNpcs, selectedRoamingNpcId]
  );

  const toggleRedDotFilter = (id: RedDotFilterId) => {
    if (!onChangeRedDotFilters) return;
    const next = redDotFilters.includes(id)
      ? redDotFilters.filter((x) => x !== id)
      : [...redDotFilters, id];
    onChangeRedDotFilters(next);
  };

  const handleTabSelect = (tab: CharacterTab) => {
    if (tab === 'mapa') {
      if (characterSideOpen && activeTab === 'mapa') {
        onChangeCharacterSideOpen(false);
      } else {
        setActiveTab('mapa');
        onChangeCharacterSideOpen(true);
        if (mapView === 'island') {
          if (onZoomOutToMap) {
            onZoomOutToMap(stageIsland);
          } else {
            onChangeMapView('map');
          }
        } else {
          onFocusMyShip();
        }
      }
      return;
    }

    if (characterSideOpen && activeTab === tab) {
      onChangeCharacterSideOpen(false);
      return;
    }

    setActiveTab(tab);
    onChangeCharacterSideOpen(true);
  };

  const handleSaveCrew = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCrew(pirate.id, {
      crewName: crewInput.trim() || 'Sin tripulación',
      flagColor: colorInput,
    });
    setEditingCrew(false);
  };

  const statMax = Math.max(25, stats.fuerza, stats.agilidad, stats.aguante, stats.ingenio);

  const gearTotals = equippedItems.reduce(
    (acc, item) => ({
      fuerza: acc.fuerza + (item.fuerzaBonus ?? 0),
      agilidad: acc.agilidad + (item.agilidadBonus ?? 0),
      aguante: acc.aguante + (item.aguanteBonus ?? 0),
      ingenio: acc.ingenio + (item.ingenioBonus ?? 0),
    }),
    { fuerza: 0, agilidad: 0, aguante: 0, ingenio: 0 }
  );

  const navItems: Array<{
    id: CharacterTab;
    label: string;
    icon: React.ReactNode;
    badge: string | null;
  }> = [
    {
      id: 'estado',
      label: 'Estado',
      icon: <UserIcon className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: <Backpack className="h-4 w-4" />,
      badge: inventoryItems.length > 0 ? String(inventoryItems.length) : null,
    },
    {
      id: 'build',
      label: 'Build',
      icon: <SlidersHorizontal className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'misiones',
      label: 'Misiones',
      icon: <Target className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'noticias',
      label: 'Noticias',
      icon: <Newspaper className="h-4 w-4" />,
      badge:
        characterEvents.length > 9
          ? '9+'
          : characterEvents.length > 0
            ? String(characterEvents.length)
            : null,
    },
    {
      id: 'mapa',
      label: 'Mapa',
      icon: <MapIcon className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'mas',
      label: 'Más',
      icon: <MoreHorizontal className="h-4 w-4" />,
      badge: null,
    },
  ];

  const renderPanelContent = () => (
    <div className="flex-1 overflow-y-auto nautical-scroll p-3.5 space-y-3">
      {/* Character Identity Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white/90 p-1 shadow-sm">
            <PirateAvatarSvg
              name={pirate.name}
              flagColor={pirate.flagColor}
              race={pirate.race}
              hatStyle={pirate.hatStyle}
              hatColor={pirate.hatColor}
              skinTone={pirate.skinTone}
              hairStyle={pirate.hairStyle}
              hairColor={pirate.hairColor}
              bodyBuild={pirate.bodyBuild}
              outfitStyle={pirate.outfitStyle}
              outfitColor={pirate.outfitColor}
              accessory={pirate.accessory}
              accessoryColor={pirate.accessoryColor}
              capeStyle={pirate.capeStyle}
              capeColor={pirate.capeColor}
              role={pirate.role}
              hasEquippedWeapon={hasEquippedWeapon}
              variant="stage"
              size={54}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="font-display truncate text-lg font-black tracking-wide text-slate-900 uppercase">
                {pirate.name}
              </h1>
              <span className="font-mono-num text-[11px] font-black text-amber-700">
                {formatBounty(pirate.bounty)}
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-700">
              {renderFactionMiniIcon(pirate.faction)}
              <span>
                {factionInfo.singular} · {raceInfo.label} · {rank.title}
              </span>
            </div>

            <div className="mt-0.5 truncate text-[11px] text-slate-600">
              {hasCrew ? `${pirate.crewName} (${pirate.role})` : `En solitario · ${pirate.role}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEditCharacter(pirate)}
            aria-label={`Editar aspecto y rasgos de ${pirate.name}`}
            title="Editar ficha completa"
            className="flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-50/90 px-2 py-1 text-[10px] font-bold text-teal-800 hover:bg-teal-100 cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="h-3 w-3" />
            <span className="hidden sm:inline">Ficha</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeCharacterSideOpen(false)}
            aria-label="Ocultar panel de personaje"
            title="Ocultar panel lateral"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-white/80 text-slate-600 hover:bg-white hover:text-slate-950 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Location Strip + Manual Mode Toggle */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-sky-200/85 bg-sky-50/80 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-slate-900">
            {pirate.islandActivity || `En la taberna de ${currIsland.name}`}
          </div>
          <div className="truncate text-[10px] text-slate-600">
            {currIsland.name} ({currIsland.sea} · {sizeTier}) · Día {daysHere}/{recommendedDays} ·{' '}
            {doneQuestsCount}/{npcQuests.length} encargos
          </div>
        </div>

        <button
          type="button"
          aria-pressed={pirate.manualMode}
          onClick={() => onToggleManualMode(pirate.id, !pirate.manualMode)}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            pirate.manualMode
              ? 'bg-[#f5b82e] text-slate-950 shadow-sm'
              : 'border border-teal-500/40 bg-teal-500/15 text-teal-800 hover:bg-teal-500/25'
          }`}
        >
          {pirate.manualMode ? (
            <>
              <Hand className="h-3 w-3" />
              <span>Manual</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              <span>Auto</span>
            </>
          )}
        </button>
      </div>

      {/* Section Title Strip */}
      <div className="flex items-center justify-between border-b border-sky-200/80 pb-1.5">
        <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">
          {activeTab === 'estado' && 'Estado, Clima y Estadísticas'}
          {activeTab === 'inventario' && 'Inventario, Equipo y Rasgos'}
          {activeTab === 'build' && 'Build: Ropa, Cicatrices y Equipo'}
          {activeTab === 'misiones' && `Misiones y Rutas · ${currIsland.name}`}
          {activeTab === 'noticias' && 'Noticias y Bitácora'}
          {activeTab === 'mapa' && 'Mapa y Navegación'}
          {activeTab === 'mas' && 'Opciones del Personaje'}
        </span>
        <span className="text-[10px] font-mono-num font-bold text-slate-600">
          {pirate.berries} monedones
        </span>
      </div>

      {/* TAB: ESTADO */}
      {activeTab === 'estado' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-sky-200/85 bg-white/75 p-3 space-y-2.5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-black uppercase tracking-wide text-slate-900">
                  {rank.title} · {raceInfo.label}
                </div>
                <span
                  data-testid="estado-evolved-role"
                  className="rounded-md border border-teal-500/40 bg-teal-50/90 px-2 py-0.5 text-[10px] font-black text-teal-800"
                >
                  Rol: {pirate.role}
                </span>
              </div>
              <div className="text-[11px] text-slate-700">{rank.nextHint}</div>
              <div className="mt-0.5 text-[10px] font-medium text-teal-700 leading-snug">
                {roleEvolution.reason}
              </div>
            </div>

            {/* LEVEL + XP BAR */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-display text-base font-black text-amber-700 whitespace-nowrap">
                  NIVEL {level}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-sky-200/80">
                  <div
                    className="h-full rounded-full bg-[#f5b82e] transition-all duration-300"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
                <span className="font-mono-num text-[11px] font-bold text-slate-700 whitespace-nowrap">
                  {xp} / {xpNeeded}
                </span>
              </div>
            </div>

            {/* Sea Crossing Gate Progress */}
            <div>
              <div className="text-[11px] text-slate-700">
                {currIsland.sea === 'Nuevo Mundo' ? (
                  <>Dominando el Nuevo Mundo · Nivel {level}</>
                ) : (
                  <>
                    {isGrandLine
                      ? 'Para cruzar al Nuevo Mundo: nivel 20 · '
                      : 'Para cruzar al Paraíso: nivel 10 · '}
                    <span className="font-semibold text-teal-700">
                      {levelsMissing === 0 ? '¡Listo para zarpar!' : `le faltan ${levelsMissing}`}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sky-200/80">
                <div
                  className="h-full rounded-full bg-[#0d9488] transition-all duration-300"
                  style={{ width: `${currIsland.sea === 'Nuevo Mundo' ? 100 : gatePct}%` }}
                />
              </div>
            </div>

            {/* Regional Weather & Devil Fruit Status */}
            <div
              data-testid="estado-weather-card"
              className="rounded-lg border border-sky-200/85 bg-sky-50/80 p-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  {renderWeatherIcon(weather.type, weather.color)}
                  <span>Clima en {currIsland.name}: {weather.label}</span>
                </span>
              </div>
              <p className="text-[10px] leading-snug text-slate-600">{weather.description}</p>

              {weatherDebuff.active ? (
                <div
                  data-testid="estado-weather-debuff"
                  className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                    weatherDebuff.combatDelta < 0
                      ? 'border border-rose-300 bg-rose-50/90 text-rose-800'
                      : 'border border-emerald-300 bg-emerald-50/90 text-emerald-800'
                  }`}
                >
                  <div>{weatherDebuff.label}</div>
                  <div className="mt-0.5 font-mono-num text-[10px] opacity-90">
                    {[
                      weatherDebuff.fuerzaDelta !== 0
                        ? `Fuerza ${weatherDebuff.fuerzaDelta > 0 ? '+' : ''}${weatherDebuff.fuerzaDelta}`
                        : null,
                      weatherDebuff.agilidadDelta !== 0
                        ? `Agilidad ${weatherDebuff.agilidadDelta > 0 ? '+' : ''}${weatherDebuff.agilidadDelta}`
                        : null,
                      weatherDebuff.aguanteDelta !== 0
                        ? `Aguante ${weatherDebuff.aguanteDelta > 0 ? '+' : ''}${weatherDebuff.aguanteDelta}`
                        : null,
                      weatherDebuff.ingenioDelta !== 0
                        ? `Ingenio ${weatherDebuff.ingenioDelta > 0 ? '+' : ''}${weatherDebuff.ingenioDelta}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              ) : pirate.devilFruit ? (
                <div className="text-[10px] text-purple-700 font-medium">
                  Usuario de <strong>{pirate.devilFruit}</strong>: sin penalización en este clima (la lluvia/tormenta te debilitan).
                </div>
              ) : null}
            </div>

            {/* 4 RPG Stats Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-0.5">
              {[
                {
                  label: 'Fuerza',
                  val: stats.fuerza,
                  gear: gearTotals.fuerza,
                  wDelta: weatherDebuff.fuerzaDelta,
                },
                {
                  label: 'Agilidad',
                  val: stats.agilidad,
                  gear: gearTotals.agilidad,
                  wDelta: weatherDebuff.agilidadDelta,
                },
                {
                  label: 'Aguante',
                  val: stats.aguante,
                  gear: gearTotals.aguante,
                  wDelta: weatherDebuff.aguanteDelta,
                },
                {
                  label: 'Ingenio',
                  val: stats.ingenio,
                  gear: gearTotals.ingenio,
                  wDelta: weatherDebuff.ingenioDelta,
                },
              ].map((st) => (
                <div key={st.label} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{st.label}</span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {st.val}
                      {st.gear > 0 && (
                        <span className="ml-1 text-[9px] text-amber-700">(+{st.gear})</span>
                      )}
                      {st.wDelta !== 0 && (
                        <span
                          className={`ml-1 text-[9px] ${
                            st.wDelta < 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          ({st.wDelta > 0 ? '+' : ''}
                          {st.wDelta})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-200/80">
                    <div
                      className="h-full rounded-full bg-[#0d9488]"
                      style={{ width: `${Math.min(100, Math.round((st.val / statMax) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Active Equipment Summary */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-sky-200/80 text-[10px]">
              <span className="text-slate-600 truncate">
                Equipo: {equippedItems.length > 0 ? equippedItems.map((i) => i.name).join(', ') : 'Sin equipo'}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('inventario')}
                className="shrink-0 font-bold text-amber-800 hover:underline cursor-pointer"
              >
                Abrir inventario
              </button>
            </div>

            {/* Quick Mission Shortcut */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-sky-200/80">
              <span className="text-[11px] text-slate-600 truncate">
                Jefe local: <strong className="text-rose-700">{boss.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('misiones')}
                className="rounded-lg bg-[#f5b82e] px-2.5 py-1 text-[11px] font-black text-slate-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
              >
                Elegir misión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: INVENTARIO (Gear Slots, Boss Drops, Devil Fruit & Traits) */}
      {activeTab === 'inventario' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-sky-200/85 bg-white/75 p-2">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Monedones</div>
              <div className="mt-0.5 font-mono-num text-sm font-black text-emerald-700">
                {pirate.berries}
              </div>
            </div>
            <div className="rounded-xl border border-sky-200/85 bg-white/75 p-2">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Jefes</div>
              <div className="mt-0.5 font-mono-num text-sm font-black text-rose-700">
                {pirate.bossesDefeated || 0}
              </div>
            </div>
            <div className="rounded-xl border border-sky-200/85 bg-white/75 p-2">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Fruta</div>
              <div className="mt-0.5 truncate text-[11px] font-bold text-purple-700">
                {pirate.devilFruit || 'Ninguna'}
              </div>
            </div>
          </div>

          {/* Equipped Slots */}
          <section className="rounded-xl border border-sky-200/85 bg-white/75 p-3 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-amber-800">
              Equipo Activo (3 ranuras)
            </div>
            {(['arma', 'armadura', 'amuleto'] as EquipmentSlot[]).map((slot) => {
              const equippedId = pirate.equipped?.[slot];
              const item = getEquipmentItem(equippedId);
              const style = item ? RARITY_STYLES[item.rarity] : null;
              return (
                <div
                  key={slot}
                  data-testid={`equipped-slot-${slot}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                    style ? `${style.border} bg-sky-50/85` : 'border-sky-200/75 bg-sky-50/55'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-white/90 border border-sky-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-700">
                        {SLOT_LABELS[slot]}
                      </span>
                      {item ? (
                        <>
                          <span className="truncate text-xs font-bold text-slate-900">{item.name}</span>
                          {style && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${style.badge}`}>
                              {style.label}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500">Ranura vacía</span>
                      )}
                    </div>
                    {item && (
                      <div className="mt-0.5 text-[10px] font-mono-num font-semibold text-teal-700">
                        {formatItemStatTags(item).join(' · ')}
                      </div>
                    )}
                  </div>

                  {item && (
                    <button
                      type="button"
                      onClick={() => onUnequipSlot(pirate.id, slot)}
                      className="shrink-0 rounded-md border border-sky-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:border-rose-400 hover:text-rose-700 cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              );
            })}
          </section>

          {/* Obtained Inventory Loot */}
          <section className="rounded-xl border border-sky-200/85 bg-white/75 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-teal-700">
                Botín Obtenido ({inventoryItems.length})
              </span>
            </div>

            {inventoryItems.length === 0 ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-2.5 text-[11px] text-slate-600 leading-relaxed">
                Aún no tienes piezas de equipo. Derrota a <strong className="text-rose-700">{boss.name}</strong> o a los Subjefes en <strong className="text-amber-800">Misiones</strong> para conseguir espadas, armaduras y amuletos.
              </div>
            ) : (
              <div className="space-y-2">
                {inventoryItems.map((item) => {
                  const isEquipped = pirate.equipped?.[item.slot] === item.id;
                  const style = RARITY_STYLES[item.rarity];
                  return (
                    <div
                      key={item.id}
                      data-testid={`inventory-item-${item.id}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 bg-sky-50/85 ${style.border}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">{item.name}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className="rounded bg-white/90 border border-sky-200 px-1.5 py-0.5 text-[9px] text-slate-700">
                            {SLOT_LABELS[item.slot]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-600">{item.description}</p>
                        <div className="mt-0.5 text-[10px] font-mono-num font-bold text-teal-700">
                          {formatItemStatTags(item).join(' · ')}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isEquipped}
                        onClick={() => onEquipItem(pirate.id, item.id)}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/40 cursor-default'
                            : 'bg-[#f5b82e] text-slate-950 hover:bg-amber-300'
                        }`}
                      >
                        {isEquipped ? 'Equipado' : 'Equipar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Local Boss Possible Drops Hint */}
            {bossDrops.length > 0 && (
              <div className="pt-1.5 border-t border-sky-200/80">
                <div className="text-[10px] font-bold text-slate-600 mb-1">
                  Drops posibles de {boss.name} en {currIsland.name}:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bossDrops.map((drop) => (
                    <span
                      key={drop.id}
                      className="rounded border border-sky-200 bg-sky-50/85 px-2 py-0.5 text-[10px] text-slate-700"
                    >
                      {drop.name} ({SLOT_LABELS[drop.slot]})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Traits with Advantage & Disadvantage */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Rasgos de Personaje
            </div>
            {[...pirate.physicalTraits, ...pirate.mentalTraits].map((id) => {
              const opt = getTraitOption(id);
              if (!opt) return null;
              return (
                <div
                  key={id}
                  className="rounded-xl border border-sky-200/85 bg-white/75 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{opt.label}</span>
                    <span className="text-[10px] uppercase text-slate-500">
                      {opt.category === 'physical' ? 'Físico' : 'Psicológico'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-emerald-700">+ {opt.advantage}</div>
                  <div className="text-[10px] font-medium text-rose-700">- {opt.disadvantage}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: BUILD (In-Map Basic Editing: Clothes, Hats, Scars & Crew; Race & Hair locked at creation) */}
      {activeTab === 'build' && (
        <div className="space-y-3">
          {/* Live Stage Preview + Read-Only Creation Traits */}
          <div className="flex items-center gap-3 rounded-xl border border-sky-200/85 bg-sky-50/80 p-3">
            <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white/95">
              <PirateAvatarSvg
                name={pirate.name}
                flagColor={pirate.flagColor}
                race={pirate.race}
                hatStyle={pirate.hatStyle}
                hatColor={pirate.hatColor}
                skinTone={pirate.skinTone}
                hairStyle={pirate.hairStyle}
                hairColor={pirate.hairColor}
                bodyBuild={pirate.bodyBuild}
                outfitStyle={pirate.outfitStyle}
                outfitColor={pirate.outfitColor}
                accessory={pirate.accessory}
                accessoryColor={pirate.accessoryColor}
                capeStyle={pirate.capeStyle}
                capeColor={pirate.capeColor}
                role={pirate.role}
                hasEquippedWeapon={hasEquippedWeapon}
                variant="stage"
                size={74}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-black text-slate-900">
                {raceInfo.label} ·{' '}
                {HAIR_STYLES.find((h) => h.id === pirate.hairStyle)?.label ?? pirate.hairStyle}
              </div>
              <p className="text-[10px] text-amber-800 font-semibold leading-snug" data-testid="build-locked-notice">
                Raza y pelo fijados al crear el personaje
              </p>
              <p className="text-[10px] text-slate-600 leading-snug">{raceInfo.hint}</p>
              <div className="text-[10px] font-bold text-teal-700">
                {[
                  raceInfo.fuerzaBonus !== 0
                    ? `${raceInfo.fuerzaBonus > 0 ? '+' : ''}${raceInfo.fuerzaBonus} Fue`
                    : null,
                  raceInfo.agilidadBonus !== 0
                    ? `${raceInfo.agilidadBonus > 0 ? '+' : ''}${raceInfo.agilidadBonus} Agi`
                    : null,
                  raceInfo.aguanteBonus !== 0
                    ? `${raceInfo.aguanteBonus > 0 ? '+' : ''}${raceInfo.aguanteBonus} Agu`
                    : null,
                  raceInfo.ingenioBonus !== 0
                    ? `${raceInfo.ingenioBonus > 0 ? '+' : ''}${raceInfo.ingenioBonus} Ing`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>

          {/* Ropa, Color y Capa */}
          <div className="rounded-xl border border-sky-200/85 bg-white/75 p-2.5 space-y-2.5">
            <HorizontalOptionRail label="Ropa y Atuendo" testId="build-rail-outfit">
              {OUTFIT_STYLES.map((out) => (
                <button
                  key={out.id}
                  type="button"
                  data-testid={`build-outfit-${out.id}`}
                  onClick={() => onUpdateBuild(pirate.id, { outfitStyle: out.id })}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                    pirate.outfitStyle === out.id
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-sky-200 bg-sky-50/85 text-slate-800 hover:bg-white'
                  }`}
                >
                  {out.label}
                </button>
              ))}
            </HorizontalOptionRail>

            <div className="flex flex-wrap gap-1.5">
              {OUTFIT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  aria-label={`Color de ropa ${c.label}`}
                  onClick={() => onUpdateBuild(pirate.id, { outfitColor: c.hex })}
                  className={`h-5 w-5 rounded-full border-2 cursor-pointer ${
                    pirate.outfitColor === c.hex ? 'border-amber-600 scale-110 ring-1 ring-amber-400' : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="pt-1.5 border-t border-sky-200/80">
              <HorizontalOptionRail
                label="Capa o Abrigo en Espalda"
                testId="build-rail-cape"
                rightHint={
                  (pirate.capeStyle ?? 'none') !== 'none' ? (
                    <span
                      data-testid="build-cape-color-hint"
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-800"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-400"
                        style={{
                          backgroundColor:
                            pirate.capeColor ??
                            CAPE_OPTIONS.find((c) => c.id === pirate.capeStyle)?.defaultColor ??
                            '#1e293b',
                        }}
                      />
                      <span>
                        {getItemColorLabel(
                          pirate.capeColor ??
                            CAPE_OPTIONS.find((c) => c.id === pirate.capeStyle)?.defaultColor
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-500">Re-clic para color</span>
                  )
                }
              >
                {CAPE_OPTIONS.map((cOpt) => {
                  const activeCape = pirate.capeStyle ?? 'none';
                  const selected = activeCape === cOpt.id;
                  return (
                    <button
                      key={cOpt.id}
                      type="button"
                      data-testid={`build-cape-${cOpt.id}`}
                      onClick={() => {
                        if (selected && cOpt.id !== 'none') {
                          onUpdateBuild(pirate.id, {
                            capeColor: getNextCycleColor(pirate.capeColor, cOpt.defaultColor),
                          });
                        } else {
                          onUpdateBuild(pirate.id, {
                            capeStyle: cOpt.id,
                            capeColor: cOpt.id === 'none' ? undefined : cOpt.defaultColor,
                          });
                        }
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'border-amber-600 bg-[#f5b82e] text-slate-950'
                          : 'border-sky-200 bg-sky-50/85 text-slate-800 hover:bg-white'
                      }`}
                    >
                      {selected && cOpt.id !== 'none' && (
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-slate-950/60"
                          style={{ backgroundColor: pirate.capeColor ?? cOpt.defaultColor }}
                        />
                      )}
                      <span>{cOpt.label}</span>
                    </button>
                  );
                })}
              </HorizontalOptionRail>
            </div>
          </div>

          {/* Sombrero, Cicatrices y Marcas (Re-click cycles color) */}
          <div className="rounded-xl border border-sky-200/85 bg-white/75 p-2.5 space-y-2.5">
            <HorizontalOptionRail
              label="Sombrero o Corona"
              testId="build-rail-hat"
              rightHint={
                pirate.hatStyle !== 'none' ? (
                  <span
                    data-testid="build-hat-color-hint"
                    className="flex items-center gap-1 text-[10px] font-bold text-teal-800"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-400"
                      style={{
                        backgroundColor:
                          pirate.hatColor ??
                          HAT_OPTIONS.find((h) => h.id === pirate.hatStyle)?.defaultColor ??
                          '#1e293b',
                      }}
                    />
                    <span>
                      {getItemColorLabel(
                        pirate.hatColor ??
                          HAT_OPTIONS.find((h) => h.id === pirate.hatStyle)?.defaultColor
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-500">Re-clic para color</span>
                )
              }
            >
              {HAT_OPTIONS.map((hat) => {
                const selected = pirate.hatStyle === hat.id;
                return (
                  <button
                    key={hat.id}
                    type="button"
                    data-testid={`build-hat-${hat.id}`}
                    onClick={() => {
                      if (selected && hat.id !== 'none') {
                        onUpdateBuild(pirate.id, {
                          hatColor: getNextCycleColor(pirate.hatColor, hat.defaultColor),
                        });
                      } else {
                        onUpdateBuild(pirate.id, {
                          hatStyle: hat.id,
                          hatColor: hat.id === 'none' ? undefined : hat.defaultColor,
                        });
                      }
                    }}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'border-teal-700 bg-teal-600 text-white'
                        : 'border-sky-200 bg-sky-50/85 text-slate-800 hover:bg-white'
                    }`}
                  >
                    {selected && hat.id !== 'none' && (
                      <span
                        className="h-2.5 w-2.5 rounded-sm border border-white/70"
                        style={{ backgroundColor: pirate.hatColor ?? hat.defaultColor }}
                      />
                    )}
                    <span>{hat.label}</span>
                  </button>
                );
              })}
            </HorizontalOptionRail>

            <div className="pt-1.5 border-t border-sky-200/80">
              <HorizontalOptionRail
                label="Cicatrices y Accesorios"
                testId="build-rail-accessory"
                rightHint={
                  pirate.accessory !== 'none' ? (
                    <span
                      data-testid="build-acc-color-hint"
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-800"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-400"
                        style={{
                          backgroundColor:
                            pirate.accessoryColor ??
                            ACCESSORY_OPTIONS.find((a) => a.id === pirate.accessory)
                              ?.defaultColor ??
                            '#b91c1c',
                        }}
                      />
                      <span>
                        {getItemColorLabel(
                          pirate.accessoryColor ??
                            ACCESSORY_OPTIONS.find((a) => a.id === pirate.accessory)?.defaultColor
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-500">Re-clic para color</span>
                  )
                }
              >
                {ACCESSORY_OPTIONS.map((acc) => {
                  const selected = pirate.accessory === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      data-testid={`build-acc-${acc.id}`}
                      onClick={() => {
                        if (selected && acc.id !== 'none') {
                          onUpdateBuild(pirate.id, {
                            accessoryColor: getNextCycleColor(
                              pirate.accessoryColor,
                              acc.defaultColor
                            ),
                          });
                        } else {
                          onUpdateBuild(pirate.id, {
                            accessory: acc.id,
                            accessoryColor: acc.id === 'none' ? undefined : acc.defaultColor,
                          });
                        }
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'border-amber-600 bg-[#f5b82e] text-slate-950'
                          : 'border-sky-200 bg-sky-50/85 text-slate-800 hover:bg-white'
                      }`}
                    >
                      {selected && acc.id !== 'none' && (
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-slate-950/60"
                          style={{ backgroundColor: pirate.accessoryColor ?? acc.defaultColor }}
                        />
                      )}
                      <span>{acc.label}</span>
                    </button>
                  );
                })}
              </HorizontalOptionRail>
            </div>
          </div>

          {/* In-World Crew Management & Auto Role */}
          <section className="rounded-xl border border-teal-500/35 bg-teal-50/75 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-teal-800">
                <Users className="h-3.5 w-3.5" />
                Tripulación y Rol Evolutivo
              </span>
              {!editingCrew && (
                <button
                  type="button"
                  onClick={() => setEditingCrew(true)}
                  className="flex items-center gap-1 rounded-lg border border-teal-500/40 bg-white/85 px-2 py-0.5 text-[10px] font-bold text-teal-800 hover:bg-white cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>{hasCrew ? 'Editar' : 'Formar'}</span>
                </button>
              )}
            </div>

            {editingCrew ? (
              <form onSubmit={handleSaveCrew} className="space-y-2">
                <input
                  type="text"
                  maxLength={48}
                  value={crewInput}
                  onChange={(e) => setCrewInput(e.target.value)}
                  placeholder={`Ej. Banda de ${pirate.name}`}
                  className="w-full rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
                <p className="text-[10px] text-slate-700 leading-snug">
                  Rol actual: <strong className="text-amber-800">{pirate.role}</strong> — evoluciona automáticamente con tus estadísticas y acciones.
                </p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex gap-1.5">
                    {FLAG_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={c.label}
                        onClick={() => setColorInput(c.hex)}
                        className={`h-4 w-4 rounded-full border-2 cursor-pointer ${
                          colorInput === c.hex ? 'border-amber-600 scale-110 ring-1 ring-amber-400' : 'border-slate-300'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingCrew(false)}
                      className="rounded-md border border-sky-200 bg-white px-2 py-1 text-[10px] text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1 rounded-md bg-teal-600 px-2 py-1 text-[10px] font-black text-white cursor-pointer"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                      Guardar
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 truncate">
                    {hasCrew ? pirate.crewName : 'En solitario'}
                  </span>
                  <span className="rounded border border-amber-400/50 bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {pirate.role}
                  </span>
                </div>
                <p className="text-[10px] text-slate-700 leading-snug">
                  {roleEvolution.reason}. {roleEvolution.nextHint}
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB: NOTICIAS */}
      {activeTab === 'noticias' && (
        <div className="space-y-2">
          {characterEvents.length === 0 ? (
            <div className="rounded-xl border border-sky-200/85 bg-white/75 p-4 text-xs text-slate-600">
              Aún no hay sucesos registrados. Selecciona una misión o deja que explore la isla.
            </div>
          ) : (
            characterEvents.slice(0, 25).map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  if (mapView === 'island') {
                    onChangeMapView('map');
                  }
                  onFocusIsland(ev.islandId);
                }}
                className={`w-full text-left rounded-xl border p-2.5 transition-colors cursor-pointer ${
                  ev.type === 'drop'
                    ? 'border-amber-400 bg-amber-50/90 hover:border-amber-500'
                    : 'border-sky-200/85 bg-white/75 hover:border-amber-400 hover:bg-white/95'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-bold" style={{ color: getSeaBadgeColor(ev.sea) }}>
                    {ev.sea} · Día {ev.day} ({ev.timeLabel})
                  </span>
                  {ev.bountyDelta > 0 && (
                    <span className="font-mono-num font-black text-amber-800">
                      +{formatShortBounty(ev.bountyDelta)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-800">{ev.message}</p>
              </button>
            ))
          )}
        </div>
      )}

      {/* TAB: MISIONES */}
      {activeTab === 'misiones' && (
        <div className="space-y-3.5">
          {/* Island Canon Size & Multi-Day Stay Banner */}
          <div className="rounded-xl border border-teal-500/35 bg-teal-50/80 px-3 py-2 text-[11px] text-slate-700 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-black text-teal-800 capitalize">Isla {sizeTier}</span>
              <span className="text-slate-600">
                {' '}
                · {currIsland.canonSizeNote || currIsland.description}
              </span>
            </div>
            <span className="font-mono-num font-black text-amber-800 shrink-0 whitespace-nowrap">
              Día {daysHere}/{recommendedDays}
            </span>
          </div>

          {/* NPC Quests Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-800">
              <span>Encargos de Habitantes (NPC)</span>
              <span className="font-mono-num text-slate-600">
                {doneQuestsCount}/{npcQuests.length}
              </span>
            </div>
            {npcQuests.map((q) => {
              const done = completedQuestsSet.has(q.id);
              return (
                <div
                  key={q.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-2 ${
                    done
                      ? 'border-emerald-300 bg-emerald-50/80'
                      : 'border-sky-200/85 bg-white/75'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-white/95">
                      <PirateAvatarSvg
                        name={q.npcName}
                        flagColor={q.outfitColor}
                        race={q.race}
                        hatStyle={q.hatStyle}
                        hatColor={q.hatColor}
                        skinTone={q.skinTone}
                        hairStyle={q.hairStyle}
                        hairColor={q.hairColor}
                        bodyBuild={q.bodyBuild}
                        outfitStyle={q.outfitStyle}
                        outfitColor={q.outfitColor}
                        accessory={q.accessory}
                        accessoryColor={q.accessoryColor}
                        capeStyle={q.capeStyle}
                        capeColor={q.capeColor}
                        weaponStyle={q.weaponStyle}
                        size={34}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-xs font-black text-slate-900">
                        <span className="truncate">{q.title}</span>
                        {done && (
                          <span className="rounded bg-emerald-500/15 border border-emerald-400/50 px-1 py-0.5 text-[9px] text-emerald-800 shrink-0">
                            Hecha
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 truncate">
                        {q.npcName} ({q.npcRole})
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[9px] font-mono-num font-bold">
                        <span className="text-sky-700">+{q.xpReward} XP</span>
                        <span className="text-emerald-700">+{q.berriesReward} mon</span>
                        {q.bountyReward > 0 && (
                          <span className="text-amber-700">
                            +{formatShortBounty(q.bountyReward)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(pirate.sailingToIslandId)}
                    onClick={() => onRunNpcQuest(pirate.id, q.id)}
                    className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-black cursor-pointer disabled:opacity-50 ${
                      done
                        ? 'border border-emerald-400/60 bg-white/90 text-emerald-800 hover:bg-emerald-50'
                        : 'bg-teal-600 text-white hover:bg-teal-500'
                    }`}
                  >
                    {done ? 'Repetir' : 'Cumplir'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Mini-Bosses Section */}
          {miniBosses.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                Subjefes de {currIsland.name}
              </div>
              {miniBosses.map((mb) => {
                const defeated = defeatedMiniBossesSet.has(mb.id);
                const mbDrops = (mb.dropPool ?? [])
                  .map((id) => getEquipmentItem(id)?.name)
                  .filter(Boolean);
                return (
                  <div
                    key={mb.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2 ${
                      defeated
                        ? 'border-emerald-300 bg-emerald-50/80'
                        : 'border-orange-300 bg-orange-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-300 bg-white/95">
                        <PirateAvatarSvg
                          name={mb.name}
                          flagColor={mb.outfitColor}
                          race={mb.race}
                          hatStyle={mb.hatStyle}
                          hatColor={mb.hatColor}
                          skinTone={mb.skinTone}
                          hairStyle={mb.hairStyle ?? 'spiky'}
                          hairColor={mb.hairColor}
                          bodyBuild={mb.bodyBuild}
                          outfitStyle={mb.outfitStyle ?? 'coat'}
                          outfitColor={mb.outfitColor}
                          accessory={mb.accessory}
                          accessoryColor={mb.accessoryColor}
                          capeStyle={mb.capeStyle}
                          capeColor={mb.capeColor}
                          weaponStyle={mb.weaponStyle}
                          hasEquippedWeapon
                          size={34}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs font-black text-slate-900">
                          <span className="truncate">{mb.name}</span>
                          {defeated && (
                            <span className="rounded bg-emerald-500/15 border border-emerald-400/50 px-1 py-0.5 text-[9px] text-emerald-800">
                              Vencido
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-600 truncate">
                          {mb.title} · Poder {mb.power}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[9px] font-mono-num font-bold">
                          <span className="text-sky-700">+{mb.xpReward} XP</span>
                          <span className="text-amber-700">
                            +{formatShortBounty(mb.bountyReward)}
                          </span>
                          {mbDrops.length > 0 && (
                            <span className="text-purple-700 truncate">Drop: {mbDrops[0]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(pirate.sailingToIslandId)}
                      onClick={() => onChallengeMiniBoss(pirate.id, mb.id)}
                      className="shrink-0 rounded-lg bg-orange-500 px-2 py-1.5 text-[10px] font-black text-white hover:bg-orange-400 cursor-pointer disabled:opacity-50"
                    >
                      Desafiar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* General Missions */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Misiones generales en {currIsland.name}
            </div>
            {islandMissions.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
                  m.id === 'jefe'
                    ? 'border-rose-300 bg-rose-50/85'
                    : 'border-sky-200/85 bg-white/75'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                    {m.id === 'jefe' && <Skull className="h-3.5 w-3.5 text-rose-600 shrink-0" />}
                    {m.id === 'duelo' && <Swords className="h-3.5 w-3.5 text-amber-700 shrink-0" />}
                    <span className="truncate">{m.title}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-600 leading-snug">{m.subtitle}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-mono-num font-bold">
                    <span className="text-sky-700">+{m.xpReward} XP</span>
                    <span className="text-emerald-700">+{m.berriesReward} mon</span>
                    <span
                      className={
                        m.id === 'jefe' || m.id === 'duelo' ? 'text-amber-800' : 'text-slate-500'
                      }
                    >
                      {m.bountyNote}
                    </span>
                    {m.id === 'jefe' && bossDrops.length > 0 && (
                      <span className="text-purple-700">
                        Botín: {bossDrops.map((d) => d.name).join(' / ')}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(pirate.sailingToIslandId)}
                  onClick={() => onRunMission(pirate.id, m.id)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer disabled:opacity-50 ${
                    m.id === 'jefe'
                      ? 'bg-rose-600 text-white hover:bg-rose-500'
                      : 'bg-[#f5b82e] text-slate-950 hover:bg-amber-300'
                  }`}
                >
                  Aceptar
                </button>
              </div>
            ))}
          </div>

          {/* Sabaody Bubble Coating Quick Action */}
          {currIsland.id === 'archipielago-sabaody' && !pirate.sailingToIslandId && (
            <div className="rounded-xl border border-cyan-300 bg-cyan-50/85 p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-black text-cyan-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-700 shrink-0" />
                  <span>Burbuja Yarukiman</span>
                </div>
                <p className="text-[10px] text-cyan-800">
                  {pirate.bubbleCoated
                    ? 'Tu barco ya está revestido para bajar a la Isla de los Hombres-Pez.'
                    : 'Envuelve tu barco en resina Yarukiman para descender a Isla de los Hombres-Pez.'}
                </p>
              </div>
              {pirate.bubbleCoated ? (
                <span className="shrink-0 rounded-lg bg-white/90 border border-cyan-400 px-2 py-1 text-[10px] font-black text-cyan-800">
                  Activa ✓
                </span>
              ) : (
                <button
                  type="button"
                  data-testid="panel-sabaody-bubble-btn"
                  onClick={() => onCoatShipBubble(pirate.id)}
                  className="shrink-0 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-cyan-500 cursor-pointer"
                >
                  Entrar en burbuja
                </button>
              )}
            </div>
          )}

          {/* Voyage Selector */}
          <div className="rounded-xl border border-sky-200/85 bg-white/75 p-2.5 space-y-2">
            <span className="text-xs font-black text-sky-700 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              Zarpar a otra isla e islas menores
            </span>

            <div className="flex flex-wrap gap-1">
              {SEAS_ORDER.map((sea) => (
                <button
                  key={sea}
                  type="button"
                  onClick={() => setSelectedSeaFilter(sea)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                    selectedSeaFilter === sea
                      ? 'bg-[#f5b82e] text-slate-950'
                      : 'bg-sky-50 border border-sky-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  {sea}
                </button>
              ))}
            </div>

            <div className="max-h-40 overflow-y-auto nautical-scroll space-y-1.5 pr-1">
              {allIslands
                .filter((isl) => isl.sea === selectedSeaFilter && isl.id !== currIsland.id)
                .map((isl) => {
                  const viaCenter = getNavigationPathCoords(currIsland, isl).length > 2;
                  const islTier = getIslandSizeTier(isl);
                  const islDays = getIslandRecommendedDays(isl);
                  const etaLabel = formatVoyageEta(estimateVoyageDurationSec(pirate, currIsland, isl));
                  const needsBubble = isl.id === 'isla-hombres-pez' && !pirate.bubbleCoated;
                  return (
                    <div
                      key={isl.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-sky-200/85 bg-sky-50/75 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-bold text-slate-900 flex items-center gap-1">
                          <span className="truncate">
                            {isl.canonOrder ? `#${isl.canonOrder} ` : ''}
                            {isl.name}
                          </span>
                          {isl.isMiniIsland && (
                            <span className="rounded bg-amber-100 border border-amber-300 px-1 py-0.2 text-[8px] font-black text-amber-800 shrink-0">
                              ✦ Mini-isla
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-600">
                          <span className="capitalize font-semibold text-teal-700">{islTier}</span> · ~{islDays}d ·{' '}
                          <span className="text-sky-700 font-semibold">~{etaLabel}</span> · Peligro{' '}
                          {isl.dangerTier}/5
                          {viaCenter ? ' · Centro' : ''}
                          {isl.id === 'isla-hombres-pez' && (
                            <span className={needsBubble ? 'text-rose-700 font-bold' : 'text-cyan-700 font-bold'}>
                              {needsBubble ? ' · Requiere burbuja Sabaody' : ' · Burbuja lista ✓'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`zarpar-btn-${isl.id}`}
                        disabled={Boolean(pirate.sailingToIslandId)}
                        onClick={() => {
                          onStartVoyage(pirate.id, isl.id);
                          if (!needsBubble) {
                            setActiveTab('mapa');
                          }
                        }}
                        className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black cursor-pointer disabled:opacity-50 ${
                          needsBubble
                            ? 'border border-cyan-400 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                            : 'bg-sky-600 text-white hover:bg-sky-500'
                        }`}
                      >
                        Zarpar
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: MAPA */}
      {activeTab === 'mapa' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-sky-200/85 bg-white/75 p-3 text-xs space-y-2">
            <div className="font-bold text-amber-800">Zoom Continuo (Globo ↔ Mapa ↔ Isla)</div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Usa la rueda del ratón o los botones <strong>+ / −</strong> en la esquina inferior
              derecha para pasar sin cortes del <strong>Globo 3D</strong> al <strong>Mapa 2D</strong>{' '}
              y entrar directamente al interior de cualquier isla.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={onFocusMyShip}
                className="rounded-lg bg-[#f5b82e] px-2.5 py-1.5 text-[11px] font-black text-slate-950 cursor-pointer"
              >
                Centrar en mi barco
              </button>
              <button
                type="button"
                onClick={onFocusWorldCenter}
                className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 hover:bg-white cursor-pointer"
              >
                Centro (0°, 0°)
              </button>
              <button
                type="button"
                onClick={onFocusFullGlobe}
                className="rounded-lg border border-sky-200 bg-white/85 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-white cursor-pointer"
              >
                Vista panorámica
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('misiones')}
            className="w-full rounded-xl border border-amber-400/60 bg-amber-50/90 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
          >
            Elegir isla destino para zarpar
          </button>
        </div>
      )}

      {/* TAB: MÁS */}
      {activeTab === 'mas' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-white/80 py-2 text-xs font-bold text-slate-800 hover:border-amber-500 hover:bg-white cursor-pointer"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-rose-600" />
              ) : (
                <Volume2 className="h-4 w-4 text-teal-600" />
              )}
              <span>{muted ? 'Sonido off' : 'Sonido on'}</span>
            </button>
            <button
              type="button"
              onClick={onPause}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-white/80 py-2 text-xs font-bold text-slate-800 hover:border-amber-500 hover:bg-white cursor-pointer"
            >
              <Pause className="h-4 w-4 text-amber-700" />
              <span>Pausar</span>
            </button>
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={onAuthAction}
            className="w-full rounded-xl border border-sky-200 bg-white/80 px-3 py-2 text-xs font-bold text-slate-800 hover:border-amber-500 hover:bg-white cursor-pointer text-left flex items-center justify-between gap-2"
          >
            <span className="truncate">
              {user
                ? `Google: ${user.email || user.displayName}`
                : 'Conectar Google para guardar progreso'}
            </span>
            <span className="text-amber-700 font-black shrink-0">
              {user ? 'Salir' : 'Conectar'}
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-200/80">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEditCharacter(pirate)}
                className="flex items-center gap-1 rounded-xl border border-teal-500/45 bg-teal-50/90 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Editar ficha</span>
              </button>
              <button
                type="button"
                onClick={onBackToMenu}
                className="flex items-center gap-1 rounded-xl border border-sky-200 bg-white/85 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-white cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Menú</span>
              </button>
            </div>

            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onDeleteCharacter(pirate.id)}
                  className="rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-xs text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50/85 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Borrar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Full-Viewport Seamless Island Interior Backdrop */}
      {showIslandViewport && (
        <div
          data-testid="island-viewport-layer"
          className="pointer-events-auto absolute inset-0 z-0 transition-opacity duration-200"
        >
          <IslandSceneView
            island={stageIsland}
            pirate={pirate}
            day={day}
            minuteOfDay={minuteOfDay}
            sidePanelOpen={characterSideOpen}
            isPlayerDockedHere={isPlayerDockedHere}
            sameIslandPeers={isPlayerDockedHere ? sameIslandPeers : []}
            onMoveToSpot={(zone) => onMoveInIsland(pirate.id, zone)}
            onSelectSpotMission={(_, missionId) => {
              onRunMission(pirate.id, missionId);
            }}
            onSelectNpcQuest={(questId) => {
              onRunNpcQuest(pirate.id, questId);
            }}
            onChallengeMiniBoss={(miniBossId) => {
              onChallengeMiniBoss(pirate.id, miniBossId);
            }}
            onCoatShipBubble={() => onCoatShipBubble(pirate.id)}
            onZoomOutToMap={onZoomOutToMap}
            onSailToInspectedIsland={(destId) => onStartVoyage(pirate.id, destId)}
            onFocusMyShip={onFocusMyShip}
          />
        </div>
      )}

      {/* Full-Viewport Interactive 2D World Zoom Map */}
      {showFlatMap && (
        <div
          data-testid="map-viewport-layer"
          className="pointer-events-auto absolute inset-0 z-10 transition-opacity duration-200"
        >
          <WorldMapCanvas
            islands={allIslands}
            pirates={allPirates}
            bots={bots}
            events={events}
            selectedIslandId={mapSelectedIslandId ?? currIsland.id}
            selectedPirateId={pirate.id}
            selectedRoamingNpcId={selectedRoamingNpcId}
            redDotFilters={redDotFilters}
            initialFocus={mapFocusTarget}
            day={day}
            minuteOfDay={minuteOfDay}
            sidePanelOpen={characterSideOpen}
            onSelectIsland={(islId) => {
              onSelectMapIsland?.(islId);
            }}
            onSelectPirate={() => {
              onSelectRoamingNpc?.(null);
              onFocusMyShip();
            }}
            onSelectRoamingNpc={(npcId) => {
              onSelectRoamingNpc?.(npcId);
            }}
            onZoomOutToGlobe={onZoomOutToGlobe}
            onZoomInToIsland={onZoomInToIsland}
            onSailToIsland={(islId) => onStartVoyage(pirate.id, islId)}
            onGoToSabaody={() => {
              onStartVoyage(pirate.id, 'archipielago-sabaody');
            }}
          />
        </div>
      )}

      {/* Top Floating HUD Bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2.5 sm:p-3.5">
        {/* Left Compact Brand + Badge + Day/Clock */}
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/80 bg-white/82 backdrop-blur-sm px-3 py-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
          <button
            type="button"
            onClick={onBackToMenu}
            aria-label="Volver al menú de personajes"
            className="flex items-center gap-1.5 text-left hover:opacity-85 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-400/60 bg-amber-100/90 font-display text-[10px] font-black text-amber-800">
              VO
            </span>
            <span className="hidden sm:inline font-display text-xs font-black tracking-wide text-slate-900 leading-tight">
              VIVID OCEAN
            </span>
          </button>

          <span className="rounded-full bg-amber-400/25 border border-amber-500/55 px-2.5 py-0.5 font-mono-num text-xs font-black text-amber-800 whitespace-nowrap">
            {formatShortBounty(pirate.bounty)}
          </span>

          <div className="border-l border-sky-200 pl-2.5 font-mono-num text-[11px] leading-tight text-slate-600 whitespace-nowrap">
            <div>
              Sem {weekInfo.week} · D{weekInfo.dayOfWeek}/7
            </div>
            <div className="font-bold text-slate-900">{formatClock(minuteOfDay)}</div>
          </div>
        </div>

        {/* Right Action Cluster: Audio + Google G */}
        <div className="pointer-events-auto flex items-center gap-1.5">

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Activar sonido [M]' : 'Silenciar sonido [M]'}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-white/80 bg-white/82 backdrop-blur-sm text-slate-700 hover:border-amber-500 hover:bg-white cursor-pointer shadow-[0_10px_28px_rgba(15,23,42,0.14)]"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-600" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={onAuthAction}
            title={
              user
                ? `Conectado: ${user.displayName || user.email} (clic para cerrar sesión)`
                : 'Entrar con Google para guardar tu cuenta'
            }
            aria-label={user ? 'Cuenta Google conectada' : 'Entrar con Google'}
            className={`flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm font-black shadow-lg cursor-pointer transition-transform active:scale-95 ${
              user
                ? 'border border-emerald-400/60 bg-emerald-600 text-white'
                : 'bg-[#ea5a3a] text-white hover:bg-[#f16a4c]'
            }`}
          >
            <span>G</span>
            {user && (
              <span className="hidden md:inline max-w-[90px] truncate text-xs font-semibold">
                {user.displayName?.split(' ')[0] || 'Google'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sailing Progress Overlay when sailing on 3D Globe or 2D Map */}
      {destIsland && (
        <div
          className={`pointer-events-auto fixed bottom-16 md:bottom-4 right-4 z-30 w-[90%] max-w-sm rounded-xl border border-amber-400/70 bg-white/86 backdrop-blur-sm px-3.5 py-2 shadow-[0_14px_38px_rgba(15,23,42,0.16)] ${
            characterSideOpen ? 'md:left-[445px] md:right-auto' : 'md:left-[88px] md:right-auto'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span className="flex items-center gap-1.5 truncate">
              <Compass className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              Rumbo a {destIsland.name} ({destIsland.sea})
            </span>
            <span className="font-mono-num text-slate-900 ml-2 shrink-0">
              {Math.min(100, Math.round(pirate.sailProgress * 100))}% · ~
              {formatVoyageEta(estimateRemainingVoyageSec(pirate, allIslands))}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sky-200/80">
            <div
              className="h-full rounded-full bg-[#f5b82e] transition-all"
              style={{ width: `${Math.min(100, Math.round(pirate.sailProgress * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Red Dot Filters & Ship-Only Travelers Toolbar (visible in Mapa 2D & Globo 3D) */}
      {(showFlatMap || showGlobeViewport) && (
        <div className="pointer-events-none fixed right-3 top-[60px] z-30 flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/84 backdrop-blur-sm px-2.5 py-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
            <button
              type="button"
              data-testid="red-dot-filter-toggle"
              aria-expanded={filterPanelOpen}
              onClick={() => setFilterPanelOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 hover:text-amber-700 cursor-pointer"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444] border border-amber-500/80 shrink-0" />
              <Filter className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span data-testid="red-dot-count-badge" className="font-mono-num">
                Puntos: {dotSummary.visible}/{dotSummary.totalMatching}
              </span>
              {redDotFilters.length > 0 && (
                <span className="rounded bg-[#f5b82e] px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                  {redDotFilters.length}
                </span>
              )}
            </button>
            {redDotFilters.length > 0 && onChangeRedDotFilters && (
              <button
                type="button"
                data-testid="red-dot-clear-btn"
                onClick={() => onChangeRedDotFilters([])}
                className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:border-amber-500 hover:text-slate-950 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {filterPanelOpen && (
            <div
              data-testid="red-dot-filter-panel"
              className={`pointer-events-auto w-[340px] sm:w-[376px] ${
                selectedRoamingNpc ? 'max-h-[calc(100vh-295px)]' : 'max-h-[calc(100vh-145px)]'
              } overflow-y-auto nautical-scroll rounded-2xl border border-white/85 bg-white/86 backdrop-blur-md p-3 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.2)] space-y-2.5`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-sky-200/80 pb-2">
                <div>
                  <div className="text-xs font-black text-amber-800">
                    Filtros de Puntos Rojos
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Máx. {MAX_IMPORTANT_RED_DOTS} importantes en pantalla ({dotSummary.visible} de {dotSummary.totalMatching})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterPanelOpen(false)}
                  aria-label="Cerrar filtros"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-white/85 text-slate-600 hover:text-slate-950 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Level Multi-Select Chips */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Por Nivel (Multi-selección)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RED_DOT_FILTER_OPTIONS.filter((o) => o.group === 'level').map((opt) => {
                    const active = redDotFilters.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`red-dot-filter-${opt.id}`}
                        aria-pressed={active}
                        onClick={() => toggleRedDotFilter(opt.id)}
                        className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-600 bg-[#f5b82e] text-slate-950 font-black'
                            : 'border-sky-200 bg-sky-50/85 text-slate-800 hover:border-amber-500 hover:bg-white'
                        }`}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Multi-Select Chips */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Por Categoría (Multi-selección)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RED_DOT_FILTER_OPTIONS.filter((o) => o.group === 'category').map((opt) => {
                    const active = redDotFilters.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`red-dot-filter-${opt.id}`}
                        aria-pressed={active}
                        onClick={() => toggleRedDotFilter(opt.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
                          active
                            ? 'border-sky-700 bg-sky-600 text-white font-black'
                            : 'border-sky-200 bg-sky-50/85 text-slate-800 hover:border-sky-500 hover:bg-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ship-Only Traveling NPCs */}
              <div className="space-y-1.5 border-t border-sky-200/80 pt-2.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-teal-700">
                  <span className="flex items-center gap-1">
                    <Ship className="h-3.5 w-3.5" />
                    Viajeros en Barco ({activeRoamingNpcs.length} activos)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {activeRoamingNpcs.map((npc) => (
                    <div
                      key={npc.def.id}
                      data-testid={`roaming-row-${npc.def.id}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 ${
                        npc.def.isSpecialEvent
                          ? 'border-amber-300 bg-amber-50/90'
                          : 'border-sky-200 bg-sky-50/75'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-900 truncate">
                          <span className="truncate">{npc.def.name}</span>
                          <span className="rounded bg-white border border-sky-200 px-1 py-0.5 text-[9px] font-mono-num text-amber-800 shrink-0">
                            Nv {npc.def.level}
                          </span>
                          {npc.remainingWindowMinutes !== null && (
                            <span className="rounded bg-amber-200/80 px-1 py-0.5 text-[9px] font-bold text-amber-900 shrink-0">
                              {npc.remainingWindowMinutes}m
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[9px] text-slate-600">
                          {npc.def.shipName} · {npc.fromIsland.name} → {npc.toIsland.name}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`locate-roaming-${npc.def.id}`}
                        onClick={() => {
                          onSelectRoamingNpc?.(npc.def.id);
                          onFocusLatLon?.(npc.lat, npc.lon, 4.5, 9.0);
                          setFilterPanelOpen(false);
                        }}
                        className="flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-[10px] font-black text-white hover:bg-sky-500 cursor-pointer shrink-0"
                      >
                        <LocateFixed className="h-3 w-3" />
                        <span>Ver</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Timed 15m/h Legend Schedules (Shanks, Mihawk, Rayleigh, Teach) */}
                <div className="rounded-lg border border-sky-200 bg-sky-50/75 p-2 space-y-1">
                  <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-800">
                    <Clock className="h-3 w-3" />
                    <span>Horarios Especiales (15 min / hora)</span>
                  </div>
                  {ROAMING_SHIP_NPCS.filter((r) => r.isSpecialEvent).map((def) => {
                    const win = isRoamingWindowActive(def, nowBucketMs);
                    return (
                      <div
                        key={def.id}
                        data-testid={`schedule-${def.id}`}
                        className="flex items-center justify-between gap-2 text-[10px]"
                      >
                        <span className={win.active ? 'font-bold text-amber-800' : 'text-slate-600'}>
                          {def.name} ({def.shipName})
                        </span>
                        <span
                          className={`font-mono-num text-[9px] shrink-0 ${
                            win.active ? 'font-black text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {win.active ? `ACTIVO (${win.remainingMinutes}m)` : formatRoamingScheduleLabel(def)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Ship-Only Roaming NPC Detail Card (2D Map & 3D Globe) */}
      {(showFlatMap || showGlobeViewport) && selectedRoamingNpc && (
        <div
          data-testid="roaming-npc-card"
          className="pointer-events-auto fixed bottom-20 md:bottom-16 right-3 z-30 w-80 rounded-2xl border border-amber-300 bg-white/86 backdrop-blur-md p-3.5 text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                {selectedRoamingNpc.def.isSpecialEvent
                  ? 'Evento Especial · Solo en Barco'
                  : 'Viajero Marítimo · Solo en Barco'}
              </div>
              <h3 className="font-display text-sm font-black text-slate-900 truncate">
                {selectedRoamingNpc.def.name} · «{selectedRoamingNpc.def.epithet}»
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onSelectRoamingNpc?.(null)}
              aria-label="Cerrar ficha de barco"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-sky-200 bg-white/85 text-slate-600 hover:text-slate-950 cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-700">
            <div className="flex items-center justify-between">
              <span>Navío: <strong className="text-slate-900">{selectedRoamingNpc.def.shipName}</strong></span>
              <span className="font-mono-num font-black text-amber-800">
                Nv {selectedRoamingNpc.def.level}
              </span>
            </div>
            <div>
              Ruta actual: <strong className="text-sky-700">{selectedRoamingNpc.fromIsland.name}</strong> →{' '}
              <strong className="text-sky-700">{selectedRoamingNpc.toIsland.name}</strong>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-600">
                {formatRoamingScheduleLabel(selectedRoamingNpc.def)}
              </span>
              {selectedRoamingNpc.def.bounty > 0 && (
                <span className="font-mono-num font-bold text-amber-800">
                  {formatBounty(selectedRoamingNpc.def.bounty)}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onFocusLatLon?.(selectedRoamingNpc.lat, selectedRoamingNpc.lon, 5.2, 8.2)
              }
              className="flex items-center gap-1 rounded-lg bg-[#f5b82e] px-2.5 py-1.5 text-[11px] font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              <span>Seguir navío</span>
            </button>
          </div>
        </div>
      )}

      {voyageNotice && (
        <div
          role="alert"
          data-testid="voyage-notice-banner"
          className="pointer-events-auto fixed right-3 top-28 z-40 flex max-w-sm items-start gap-2 rounded-xl border border-cyan-300 bg-white/88 backdrop-blur-md px-3.5 py-2.5 text-xs font-semibold text-cyan-900 shadow-[0_14px_38px_rgba(15,23,42,0.18)]"
        >
          <Sparkles className="h-4 w-4 text-cyan-700 shrink-0 mt-0.5" />
          <span className="flex-1 leading-snug">{voyageNotice}</span>
          {onClearVoyageNotice && (
            <button
              type="button"
              onClick={onClearVoyageNotice}
              aria-label="Cerrar aviso"
              className="text-slate-500 hover:text-slate-950 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {authNotice && (
        <div
          role="status"
          className="pointer-events-auto fixed right-3 top-40 z-30 max-w-xs rounded-lg border border-amber-300 bg-white/88 backdrop-blur-md px-3 py-1.5 text-[11px] text-amber-900 shadow-lg"
        >
          {authNotice}
        </div>
      )}

      {/* DESKTOP: Left-Side Docked Vertical Tab Rail + Collapsible Character Card */}
      <div className="pointer-events-none hidden md:flex fixed left-2.5 top-[68px] bottom-3 z-30 items-stretch gap-2">
        {/* Vertical Tab Rail */}
        <nav
          aria-label="Secciones del personaje"
          className="pointer-events-auto flex w-[62px] shrink-0 flex-col items-center justify-between rounded-2xl border border-white/80 bg-white/82 backdrop-blur-md py-2 px-1 shadow-[0_14px_38px_rgba(15,23,42,0.16)]"
        >
          <button
            type="button"
            data-testid="toggle-side-panel"
            onClick={() => onChangeCharacterSideOpen(!characterSideOpen)}
            title={characterSideOpen ? 'Contraer panel' : 'Desplegar panel de personaje'}
            aria-label={characterSideOpen ? 'Contraer panel' : 'Desplegar panel'}
            className="flex h-8 w-11 items-center justify-center rounded-lg border border-sky-200 bg-sky-50/90 text-amber-700 hover:border-amber-500 hover:bg-white cursor-pointer mb-1"
          >
            {characterSideOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>

          <div className="flex flex-1 flex-col items-center justify-start gap-1 w-full overflow-y-auto">
            {navItems.map((tab) => {
              const isSelected = characterSideOpen && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`tab-${tab.id}`}
                  aria-current={isSelected ? 'page' : undefined}
                  onClick={() => handleTabSelect(tab.id)}
                  className={`relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-0.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#f5b82e]/30 text-amber-900 border border-amber-500/60'
                      : 'text-slate-600 hover:bg-sky-50 hover:text-slate-950 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    {tab.icon}
                    {tab.badge && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[8px] font-black text-white">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold leading-none tracking-tight">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-1 border-t border-sky-200/80 w-full flex flex-col items-center">
            <span className="font-mono-num text-[9px] font-bold text-emerald-700 flex items-center gap-0.5">
              <Coins className="h-2.5 w-2.5" />
              {pirate.berries}
            </span>
          </div>
        </nav>

        {/* Collapsible Side Character Card */}
        {characterSideOpen && (
          <section
            data-testid="character-side-panel"
            aria-label={`Panel lateral de ${pirate.name}`}
            className="pointer-events-auto flex w-[348px] lg:w-[366px] flex-col rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.18)] overflow-hidden"
          >
            {renderPanelContent()}
          </section>
        )}
      </div>

      {/* MOBILE: Collapsible Bottom Drawer + Compact Horizontal Tab Bar */}
      <div className="pointer-events-none md:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col">
        {characterSideOpen ? (
          <section
            data-testid="character-mobile-panel"
            aria-label={`Panel de ${pirate.name}`}
            className="pointer-events-auto mx-2 mb-1.5 flex max-h-[44vh] flex-col rounded-2xl border border-white/80 bg-white/84 backdrop-blur-md text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.18)] overflow-hidden"
          >
            {renderPanelContent()}
          </section>
        ) : (
          <div className="pointer-events-auto mb-1.5 flex justify-center">
            <button
              type="button"
              onClick={() => onChangeCharacterSideOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/86 backdrop-blur-sm px-3 py-1 text-[11px] font-bold text-amber-800 shadow-lg cursor-pointer"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
              <span>Abrir {pirate.name}</span>
            </button>
          </div>
        )}

        <nav
          aria-label="Navegación móvil del personaje"
          className="pointer-events-auto grid grid-cols-7 border-t border-white/80 bg-white/86 backdrop-blur-md px-1 py-1.5 shadow-[0_-8px_28px_rgba(15,23,42,0.12)]"
        >
          {navItems.map((tab) => {
            const active = characterSideOpen && activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`mobile-tab-${tab.id}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => handleTabSelect(tab.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors cursor-pointer ${
                  active
                    ? 'text-amber-800 bg-amber-400/20 font-bold'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge && (
                    <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ef4444] px-0.5 text-[8px] font-black text-white">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold leading-none truncate max-w-full px-0.5">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
