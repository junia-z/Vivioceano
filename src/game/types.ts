export type GameState = 'title' | 'playing' | 'paused';

export type SeaName =
  | 'Mar del Este'
  | 'Mar del Norte'
  | 'Mar del Sur'
  | 'Mar del Oeste'
  | 'Paraíso'
  | 'Nuevo Mundo';

export type OriginSea =
  | 'Mar del Este'
  | 'Mar del Norte'
  | 'Mar del Sur'
  | 'Mar del Oeste';

export type Faction = 'piratas' | 'marines' | 'revolucionarios' | 'aventureros';

export type PirateRole =
  | 'Capitán'
  | 'Espadachín'
  | 'Navegante'
  | 'Cocinero'
  | 'Artillero'
  | 'Médico'
  | 'Músico';

export type FlagEmblem = 'skull' | 'sun' | 'heart' | 'anchor' | 'flame' | 'crown';

export type Directive = 'libre' | 'tesoros' | 'duelos' | 'grand_line' | 'descansar';

export type IslandSizeTier = 'pequeña' | 'mediana' | 'grande' | 'colosal';

export type IslandBiome =
  | 'village'
  | 'fortress'
  | 'volcano'
  | 'desert'
  | 'pagoda'
  | 'sky'
  | 'candy'
  | 'treasure'
  | 'colosseum'
  | 'fire_ice'
  | 'marine';

export type IslandZoneId = 'taberna' | 'dojo' | 'puerto' | 'ruinas' | 'jefe';

export type IslandMissionId = 'taberna' | 'entrenar' | 'explorar' | 'duelo' | 'jefe';

export interface IslandMissionOption {
  id: IslandMissionId;
  zone: IslandZoneId;
  title: string;
  subtitle: string;
  xpReward: number;
  berriesReward: number;
  bountyNote: string;
}

export type WeatherType =
  | 'despejado'
  | 'lluvia'
  | 'tormenta'
  | 'viento'
  | 'calor'
  | 'nieve'
  | 'niebla';

export interface WeatherStatus {
  type: WeatherType;
  label: string;
  description: string;
  color: string;
  affectsDevilFruit: boolean;
}

export interface WeatherDebuffSummary {
  active: boolean;
  label: string;
  fuerzaDelta: number;
  agilidadDelta: number;
  aguanteDelta: number;
  ingenioDelta: number;
  combatDelta: number;
}

export type PirateRace =
  | 'humano'
  | 'gyojin'
  | 'mink'
  | 'skypiea'
  | 'lunaria'
  | 'oni'
  | 'gigante';

export type EquipmentSlot = 'arma' | 'armadura' | 'amuleto';

export type EquipmentRarity = 'comun' | 'raro' | 'epico' | 'legendario';

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  tier: 1 | 2 | 3 | 4 | 5;
  description: string;
  fuerzaBonus?: number;
  agilidadBonus?: number;
  aguanteBonus?: number;
  ingenioBonus?: number;
  combatBonus?: number;
  islandOriginId?: string;
}

export interface EquippedGear {
  arma?: string | null;
  armadura?: string | null;
  amuleto?: string | null;
}

export interface IslandNpcQuest {
  id: string;
  npcName: string;
  npcRole: string;
  title: string;
  description: string;
  zone: IslandZoneId;
  xpReward: number;
  berriesReward: number;
  bountyReward: number;
  race?: PirateRace;
  hatStyle?: HatStyle;
  hatColor?: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  outfitStyle?: OutfitStyle;
  outfitColor: string;
  skinTone?: string;
  bodyBuild?: BodyBuild;
  accessory?: AccessoryStyle;
  accessoryColor?: string;
  capeStyle?: CapeStyle;
  capeColor?: string;
  weaponStyle?: WeaponStyle;
}

export interface IslandMiniBoss {
  id: string;
  name: string;
  title: string;
  zone: IslandZoneId;
  power: number;
  xpReward: number;
  berriesReward: number;
  bountyReward: number;
  race?: PirateRace;
  hatStyle?: HatStyle;
  hatColor?: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  outfitStyle?: OutfitStyle;
  outfitColor: string;
  skinTone?: string;
  bodyBuild?: BodyBuild;
  accessory?: AccessoryStyle;
  accessoryColor?: string;
  capeStyle?: CapeStyle;
  capeColor?: string;
  weaponStyle?: WeaponStyle;
  dropPool?: string[];
}

export interface IslandBoss {
  id: string;
  name: string;
  title: string;
  power: number;
  bountyReward: number;
  xpReward: number;
  berriesReward: number;
  race?: PirateRace;
  outfitStyle?: OutfitStyle;
  outfitColor: string;
  hatStyle?: HatStyle;
  hatColor?: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  skinTone?: string;
  bodyBuild?: BodyBuild;
  accessory?: AccessoryStyle;
  accessoryColor?: string;
  capeStyle?: CapeStyle;
  capeColor?: string;
  weaponStyle?: WeaponStyle;
  dropPool?: string[];
}

export interface PirateStats {
  fuerza: number;
  agilidad: number;
  aguante: number;
  ingenio: number;
}

export interface TraitEffects {
  combatDelta?: number;
  speedMult?: number;
  treasureBonus?: number;
  treasureWeightDelta?: number;
  duelWeightDelta?: number;
  fruitChanceDelta?: number;
  duelRiskDelta?: number;
  bountyMult?: number;
}

export interface TraitOption {
  id: string;
  label: string;
  category: 'physical' | 'mental';
  advantage: string;
  disadvantage: string;
  battlePhrase: string;
  effects: TraitEffects;
}

export interface Island {
  id: string;
  name: string;
  sea: SeaName;
  lat: number; // -85..85 degrees
  lon: number; // -180..180 degrees
  biome: IslandBiome;
  dangerTier: 1 | 2 | 3 | 4 | 5;
  description: string;
  portColor: string;
  hasRainbow?: boolean;
  scale?: number;
  sizeTier?: IslandSizeTier;
  canonOrder?: number;
  canonSizeNote?: string;
  recommendedDays?: number;
  baseClimate?: WeatherType;
  isMiniIsland?: boolean;
  isUnderwaterTrench?: boolean;
}

export type HatStyle =
  | 'none'
  | 'straw'
  | 'tricorn'
  | 'bicorn'
  | 'tophat'
  | 'bandana'
  | 'marine'
  | 'crown'
  | 'afro'
  | 'viking'
  | 'hood';

export type HairStyle =
  | 'spiky'
  | 'short'
  | 'ponytail'
  | 'long'
  | 'curly'
  | 'bob'
  | 'mohawk'
  | 'slick'
  | 'twintails'
  | 'topknot'
  | 'mane';

export type BodyBuild = 'normal' | 'robust' | 'slim';

export type OutfitStyle =
  | 'shirt'
  | 'coat'
  | 'striped'
  | 'suit'
  | 'kimono'
  | 'marine'
  | 'vest';

export type AccessoryStyle =
  | 'none'
  | 'scar'
  | 'cross_scar'
  | 'glasses'
  | 'sunglasses'
  | 'eyepatch'
  | 'beard'
  | 'mustache'
  | 'goatee'
  | 'cigar'
  | 'clown_nose'
  | 'scarf'
  | 'mask'
  | 'bandage'
  | 'earrings';

export type CapeStyle =
  | 'none'
  | 'cape'
  | 'coat_cape'
  | 'justice_coat'
  | 'feather_boa'
  | 'raijin_drums'
  | 'sash_cloak';

export type WeaponStyle =
  | 'none'
  | 'sword'
  | 'hook'
  | 'mace'
  | 'axe'
  | 'trident'
  | 'kanabo'
  | 'jitte';

export interface Pirate {
  id: string;
  ownerId: string;
  isPlayerOwned: boolean;
  name: string;
  epithet: string;
  faction: Faction;
  role: PirateRole;
  race?: PirateRace;
  originSea: OriginSea;
  dream: string;
  physicalTraits: string[]; // 1-2 trait IDs
  mentalTraits: string[]; // 1-2 trait IDs
  bounty: number;
  berries: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  bossesDefeated: number;
  devilFruit: string;
  crewName: string;
  islandId: string;
  islandSpot: IslandZoneId;
  islandActivity: string;
  manualMode: boolean;
  flagColor: string;
  flagEmblem: FlagEmblem;
  directive: Directive;
  status: 'active' | 'resting';
  sailingToIslandId: string | null;
  sailProgress: number;
  sailSpeed: number;
  cooldownSec: number;
  hatStyle: HatStyle;
  hatColor?: string;
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  bodyBuild: BodyBuild;
  outfitStyle: OutfitStyle;
  outfitColor: string;
  accessory: AccessoryStyle;
  accessoryColor?: string;
  capeStyle?: CapeStyle;
  capeColor?: string;
  weaponStyle?: WeaponStyle;
  inventory?: string[];
  equipped?: EquippedGear;
  createdAtMs: number;
  arrivedDay?: number;
  completedQuestIds?: string[];
  defeatedMiniBossIds?: string[];
  bubbleCoated?: boolean;
}

export type WorldEventType =
  | 'duel'
  | 'boss'
  | 'treasure'
  | 'voyage'
  | 'dock'
  | 'devil_fruit'
  | 'crew'
  | 'launch'
  | 'level_up'
  | 'drop';

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  sea: SeaName;
  islandId: string;
  pirateId: string;
  pirateName: string;
  targetPirateId?: string;
  isPlayerRelated: boolean;
  message: string;
  bountyDelta: number;
  day: number;
  timeLabel: string;
  createdAtMs: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  sea: string;
  text: string;
  isMine: boolean;
  createdAtMs: number;
}

export type BotRoleKind = 'fleet' | 'boss_troop' | 'special_event';

export type RedDotFilterId =
  | 'lvl_1_10'
  | 'lvl_10_20'
  | 'lvl_20_30'
  | 'lvl_30_50'
  | 'lvl_50_70'
  | 'lvl_70_100'
  | 'special_events'
  | 'boss_troops'
  | 'only_characters';

export interface BotPirate {
  id: string;
  factionIdx: number;
  flagColor: string;
  level: number;
  roleKind: BotRoleKind;
  fromIslandId: string;
  toIslandId: string;
  sailProgress: number;
  sailSpeed: number;
  status: 'sailing' | 'docked';
  dockTimerSec: number;
  ttlSec: number;
  seed: number;
}

export interface RoamingShipNpcDef {
  id: string;
  name: string;
  epithet: string;
  shipName: string;
  faction: Faction;
  level: number;
  bounty: number;
  flagColor: string;
  routeIslandIds: string[];
  legSeconds: number;
  isSpecialEvent: boolean;
  /** Minute within every real hour (0..59) when this traveler enters the sea; omitted if always active */
  windowStartMinute?: number;
  /** Duration in minutes per hour (e.g. 15 => active 15 min every hour) */
  windowDurationMinutes?: number;
  appearance: {
    race?: PirateRace;
    hatStyle?: HatStyle;
    hatColor?: string;
    hairStyle?: HairStyle;
    hairColor?: string;
    outfitStyle?: OutfitStyle;
    outfitColor?: string;
    skinTone?: string;
    bodyBuild?: BodyBuild;
    accessory?: AccessoryStyle;
    accessoryColor?: string;
    capeStyle?: CapeStyle;
    capeColor?: string;
    weaponStyle?: WeaponStyle;
  };
}

export interface ActiveRoamingShipNpc {
  def: RoamingShipNpcDef;
  lat: number;
  lon: number;
  headingLatLon: [number, number];
  fromIsland: Island;
  toIsland: Island;
  legProgress: number;
  remainingWindowMinutes: number | null;
}

export interface WorldState {
  day: number;
  minuteOfDay: number;
  totalPiratesCount: number;
  islands: Island[];
  miniIslands: Island[];
  pirates: Pirate[];
  bots: BotPirate[];
  events: WorldEvent[];
  lastCameraFocusEventId: string | null;
}

export interface CreatePirateInput {
  name: string;
  epithet: string;
  faction: Faction;
  role?: PirateRole;
  race?: PirateRace;
  originSea: OriginSea;
  dream: string;
  physicalTraits: string[];
  mentalTraits: string[];
  flagColor?: string;
  flagEmblem?: FlagEmblem;
  crewName?: string;
  hatStyle?: HatStyle;
  hatColor?: string;
  skinTone?: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  bodyBuild?: BodyBuild;
  outfitStyle?: OutfitStyle;
  outfitColor?: string;
  accessory?: AccessoryStyle;
  accessoryColor?: string;
  capeStyle?: CapeStyle;
  capeColor?: string;
  weaponStyle?: WeaponStyle;
}
