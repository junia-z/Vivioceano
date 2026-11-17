import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dices,
  Eye,
  Flame,
  Scissors,
  Shield,
  Shirt,
  Skull,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import {
  MAX_TRAITS_PER_CATEGORY,
  getRoleEvolutionInfo,
  validateCreatePirateInput,
} from '../game/sim';
import {
  ACCESSORY_OPTIONS,
  BODY_BUILDS,
  CAPE_OPTIONS,
  FACTIONS,
  HAIR_COLORS,
  HAIR_STYLES,
  HAT_OPTIONS,
  MENTAL_TRAITS,
  ORIGIN_SEAS,
  OUTFIT_COLORS,
  OUTFIT_STYLES,
  PHYSICAL_TRAITS,
  RACE_OPTIONS,
  SKIN_TONES,
  getFactionInfo,
  getItemColorLabel,
  getNextCycleColor,
  getRaceInfo,
} from '../game/worldData';
import type {
  AccessoryStyle,
  BodyBuild,
  CapeStyle,
  CreatePirateInput,
  Faction,
  HairStyle,
  HatStyle,
  OriginSea,
  OutfitStyle,
  Pirate,
  PirateRace,
} from '../game/types';
import { HorizontalOptionRail } from './HorizontalOptionRail';
import { PirateAvatarSvg } from './PirateAvatarSvg';

interface CreatePirateModalProps {
  editingPirate?: Pirate | null;
  onClose: () => void;
  onCreate: (input: CreatePirateInput) => void;
}

type WizardStep = 'apariencia' | 'bando' | 'rasgos';
type AppearanceTab = 'pelo' | 'cuerpo' | 'ropa' | 'extras';

const WIZARD_STEPS: Array<{ id: WizardStep; num: number; label: string }> = [
  { id: 'apariencia', num: 1, label: 'Apariencia' },
  { id: 'bando', num: 2, label: 'Bando y Origen' },
  { id: 'rasgos', num: 3, label: 'Rasgos' },
];

const APPEARANCE_TABS: Array<{ id: AppearanceTab; label: string; icon: React.ReactNode }> = [
  { id: 'pelo', label: 'Pelo y Color', icon: <Scissors className="h-3.5 w-3.5" /> },
  { id: 'cuerpo', label: 'Piel y Cuerpo', icon: <User className="h-3.5 w-3.5" /> },
  { id: 'ropa', label: 'Ropa', icon: <Shirt className="h-3.5 w-3.5" /> },
  { id: 'extras', label: 'Sombrero y Marcas', icon: <Eye className="h-3.5 w-3.5" /> },
];

const DREAM_PRESETS = [
  'Encontrar el tesoro legendario de Vivid Ocean.',
  'Imponer justicia en los Cuatro Mares.',
  'Liberar cada reino del mundo.',
  'Cartografiar todas las islas del Grand Line.',
];

const SEA_HINTS: Record<OriginSea, string> = {
  'Mar del Este': 'Aguas tranquilas donde nacen grandes leyendas como Isla Dawn.',
  'Mar del Norte': 'Corrientes heladas, tecnología del Reino de Germa y duelos tácticos.',
  'Mar del Sur': 'Islas festivas, bosques antiguos y bravos constructores navales.',
  'Mar del Oeste': 'Rutas comerciales agitadas, ruinas misteriosas y viajeros audaces.',
};

function renderFactionIcon(id: Faction) {
  switch (id) {
    case 'marines':
      return <Shield className="h-4 w-4 text-sky-600" />;
    case 'revolucionarios':
      return <Flame className="h-4 w-4 text-teal-600" />;
    case 'aventureros':
      return <Compass className="h-4 w-4 text-purple-600" />;
    default:
      return <Skull className="h-4 w-4 text-amber-600" />;
  }
}

export const CreatePirateModal: React.FC<CreatePirateModalProps> = ({
  editingPirate,
  onClose,
  onCreate,
}) => {
  const isEditing = Boolean(editingPirate);
  const [step, setStep] = useState<WizardStep>('apariencia');
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTab>(
    editingPirate ? 'ropa' : 'pelo'
  );

  // Identity & Faction
  const [name, setName] = useState(editingPirate?.name ?? '');
  const [faction, setFaction] = useState<Faction>(editingPirate?.faction ?? 'piratas');
  const [epithet, setEpithet] = useState(
    editingPirate?.epithet ?? FACTIONS[0].defaultEpithet
  );
  const [originSea, setOriginSea] = useState<OriginSea>(
    editingPirate?.originSea ?? 'Mar del Este'
  );
  const [dream, setDream] = useState(editingPirate?.dream ?? DREAM_PRESETS[0]);

  // Retro Pixel Art Appearance & Race
  const [race, setRace] = useState<PirateRace>(editingPirate?.race ?? 'humano');
  const [hairStyle, setHairStyle] = useState<HairStyle>(editingPirate?.hairStyle ?? 'ponytail');
  const [hairColor, setHairColor] = useState(editingPirate?.hairColor ?? HAIR_COLORS[1].hex);
  const [skinTone, setSkinTone] = useState(editingPirate?.skinTone ?? SKIN_TONES[1].hex);
  const [bodyBuild, setBodyBuild] = useState<BodyBuild>(editingPirate?.bodyBuild ?? 'normal');
  const [outfitStyle, setOutfitStyle] = useState<OutfitStyle>(
    editingPirate?.outfitStyle ?? 'shirt'
  );
  const [outfitColor, setOutfitColor] = useState(
    editingPirate?.outfitColor ?? OUTFIT_COLORS[0].hex
  );
  const [hatStyle, setHatStyle] = useState<HatStyle>(editingPirate?.hatStyle ?? 'none');
  const [hatColor, setHatColor] = useState<string>(
    editingPirate?.hatColor ?? HAT_OPTIONS[0].defaultColor
  );
  const [accessory, setAccessory] = useState<AccessoryStyle>(editingPirate?.accessory ?? 'none');
  const [accessoryColor, setAccessoryColor] = useState<string>(
    editingPirate?.accessoryColor ?? ACCESSORY_OPTIONS[0].defaultColor
  );
  const [capeStyle, setCapeStyle] = useState<CapeStyle>(editingPirate?.capeStyle ?? 'none');
  const [capeColor, setCapeColor] = useState<string>(
    editingPirate?.capeColor ?? CAPE_OPTIONS[0].defaultColor
  );

  // Physical & Psychological traits with clear advantages/disadvantages
  const [physicalTraits, setPhysicalTraits] = useState<string[]>(
    editingPirate?.physicalTraits?.length ? editingPirate.physicalTraits : ['rapido', 'grandes_reflejos']
  );
  const [mentalTraits, setMentalTraits] = useState<string[]>(
    editingPirate?.mentalTraits?.length ? editingPirate.mentalTraits : ['astuto', 'instinto_haki']
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingPirate) return;
    setName(editingPirate.name);
    setFaction(editingPirate.faction);
    setEpithet(editingPirate.epithet);
    setOriginSea(editingPirate.originSea);
    setDream(editingPirate.dream);
    setRace(editingPirate.race ?? 'humano');
    setHairStyle(editingPirate.hairStyle);
    setHairColor(editingPirate.hairColor);
    setSkinTone(editingPirate.skinTone);
    setBodyBuild(editingPirate.bodyBuild);
    setOutfitStyle(editingPirate.outfitStyle);
    setOutfitColor(editingPirate.outfitColor);
    setHatStyle(editingPirate.hatStyle);
    const matchingHat = HAT_OPTIONS.find((h) => h.id === editingPirate.hatStyle);
    setHatColor(editingPirate.hatColor ?? matchingHat?.defaultColor ?? '#1e293b');
    setAccessory(editingPirate.accessory);
    const matchingAcc = ACCESSORY_OPTIONS.find((a) => a.id === editingPirate.accessory);
    setAccessoryColor(editingPirate.accessoryColor ?? matchingAcc?.defaultColor ?? '#b91c1c');
    setCapeStyle(editingPirate.capeStyle ?? 'none');
    const matchingCape = CAPE_OPTIONS.find((c) => c.id === (editingPirate.capeStyle ?? 'none'));
    setCapeColor(editingPirate.capeColor ?? matchingCape?.defaultColor ?? '#1e293b');
    setPhysicalTraits(editingPirate.physicalTraits);
    setMentalTraits(editingPirate.mentalTraits);
    setAppearanceTab('ropa');
    setErrorMsg(null);
  }, [editingPirate]);

  const toggleTrait = (
    traitId: string,
    selected: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setErrorMsg(null);
    if (selected.includes(traitId)) {
      if (selected.length <= 1) return;
      setter(selected.filter((id) => id !== traitId));
      return;
    }
    if (selected.length >= MAX_TRAITS_PER_CATEGORY) {
      setter([...selected.slice(1), traitId]);
      return;
    }
    setter([...selected, traitId]);
  };

  const selectFaction = (nextFaction: Faction) => {
    const prevDefault = getFactionInfo(faction).defaultEpithet;
    const nextInfo = getFactionInfo(nextFaction);
    setFaction(nextFaction);
    if (!epithet.trim() || epithet === prevDefault) {
      setEpithet(nextInfo.defaultEpithet);
    }
  };

  const selectHatWithColorCycle = (opt: (typeof HAT_OPTIONS)[number]) => {
    if (hatStyle === opt.id && opt.id !== 'none') {
      setHatColor((prev) => getNextCycleColor(prev, opt.defaultColor));
      return;
    }
    setHatStyle(opt.id);
    setHatColor(opt.defaultColor);
  };

  const selectAccessoryWithColorCycle = (opt: (typeof ACCESSORY_OPTIONS)[number]) => {
    if (accessory === opt.id && opt.id !== 'none') {
      setAccessoryColor((prev) => getNextCycleColor(prev, opt.defaultColor));
      return;
    }
    setAccessory(opt.id);
    setAccessoryColor(opt.defaultColor);
  };

  const selectCapeWithColorCycle = (opt: (typeof CAPE_OPTIONS)[number]) => {
    if (capeStyle === opt.id && opt.id !== 'none') {
      setCapeColor((prev) => getNextCycleColor(prev, opt.defaultColor));
      return;
    }
    setCapeStyle(opt.id);
    setCapeColor(opt.defaultColor);
  };

  const randomizeAppearance = () => {
    if (!isEditing) {
      setRace(RACE_OPTIONS[Math.floor(Math.random() * RACE_OPTIONS.length)].id);
      setHairStyle(HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)].id);
      setHairColor(HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].hex);
      setSkinTone(SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].hex);
      setBodyBuild(BODY_BUILDS[Math.floor(Math.random() * BODY_BUILDS.length)].id);
    }
    setOutfitStyle(OUTFIT_STYLES[Math.floor(Math.random() * OUTFIT_STYLES.length)].id);
    setOutfitColor(OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)].hex);
    const nextHat = HAT_OPTIONS[Math.floor(Math.random() * HAT_OPTIONS.length)];
    setHatStyle(nextHat.id);
    setHatColor(nextHat.defaultColor);
    const nextAcc = ACCESSORY_OPTIONS[Math.floor(Math.random() * ACCESSORY_OPTIONS.length)];
    setAccessory(nextAcc.id);
    setAccessoryColor(nextAcc.defaultColor);
    const nextCape = CAPE_OPTIONS[Math.floor(Math.random() * CAPE_OPTIONS.length)];
    setCapeStyle(nextCape.id);
    setCapeColor(nextCape.defaultColor);
    setErrorMsg(null);
  };

  const visibleAppearanceTabs = isEditing
    ? APPEARANCE_TABS.filter((t) => t.id === 'ropa' || t.id === 'extras')
    : APPEARANCE_TABS;
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
  const tabIndex = visibleAppearanceTabs.findIndex((t) => t.id === appearanceTab);
  const activeFactionInfo = getFactionInfo(faction);
  const activeRaceInfo = getRaceInfo(race);
  const previewRoleInfo = getRoleEvolutionInfo({
    level: editingPirate?.level ?? 1,
    wins: editingPirate?.wins ?? 0,
    bossesDefeated: editingPirate?.bossesDefeated ?? 0,
    devilFruit: editingPirate?.devilFruit ?? '',
    physicalTraits,
    mentalTraits,
    bodyBuild: editingPirate ? editingPirate.bodyBuild : bodyBuild,
    race: editingPirate ? editingPirate.race ?? 'humano' : race,
    equipped: editingPirate?.equipped ?? {},
    weaponStyle: editingPirate?.weaponStyle ?? 'none',
    crewName: editingPirate?.crewName ?? 'Sin tripulación',
    roleAffinities: editingPirate?.roleAffinities,
  });
  const role = previewRoleInfo.role;

  const goToStep = (target: WizardStep) => {
    setErrorMsg(null);
    if (target !== 'apariencia' && name.trim().length < 2) {
      setErrorMsg('Escribe un nombre de al menos 2 caracteres antes de continuar.');
      setStep('apariencia');
      nameInputRef.current?.focus();
      return;
    }
    setStep(target);
  };

  const handleContinue = () => {
    setErrorMsg(null);
    if (step === 'apariencia') {
      if (tabIndex < visibleAppearanceTabs.length - 1) {
        setAppearanceTab(visibleAppearanceTabs[tabIndex + 1].id);
        return;
      }
      if (name.trim().length < 2) {
        setErrorMsg('Escribe el nombre de tu personaje a la izquierda (mín. 2 letras) para continuar.');
        nameInputRef.current?.focus();
        return;
      }
      setStep('bando');
      return;
    }

    if (step === 'bando') {
      setStep('rasgos');
      return;
    }

    handleLaunch();
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (step === 'apariencia') {
      if (tabIndex > 0) {
        setAppearanceTab(visibleAppearanceTabs[tabIndex - 1].id);
      }
      return;
    }
    if (step === 'bando') {
      setStep('apariencia');
      setAppearanceTab('extras');
      return;
    }
    if (stepIndex > 0) {
      setStep(WIZARD_STEPS[stepIndex - 1].id);
    }
  };

  const handleLaunch = () => {
    const payload: CreatePirateInput = {
      name,
      epithet,
      faction,
      originSea,
      dream,
      physicalTraits,
      mentalTraits,
      flagColor: editingPirate?.flagColor || activeFactionInfo.defaultColor,
      race: editingPirate ? editingPirate.race ?? 'humano' : race,
      hatStyle,
      hatColor: hatStyle === 'none' ? undefined : hatColor,
      skinTone: editingPirate ? editingPirate.skinTone : skinTone,
      hairStyle: editingPirate ? editingPirate.hairStyle : hairStyle,
      hairColor: editingPirate ? editingPirate.hairColor : hairColor,
      bodyBuild: editingPirate ? editingPirate.bodyBuild : bodyBuild,
      outfitStyle,
      outfitColor,
      accessory,
      accessoryColor: accessory === 'none' ? undefined : accessoryColor,
      capeStyle,
      capeColor: capeStyle === 'none' ? undefined : capeColor,
    };
    const err = validateCreatePirateInput(payload);
    if (err) {
      setErrorMsg(err);
      if (err.includes('nombre')) {
        setStep('apariencia');
        nameInputRef.current?.focus();
      }
      return;
    }
    onCreate(payload);
  };

  const isFirstSubStep = step === 'apariencia' && tabIndex <= 0;
  const nextLabelHint = (() => {
    if (step === 'apariencia') {
      if (tabIndex >= 0 && tabIndex < visibleAppearanceTabs.length - 1) {
        return `Siguiente: ${visibleAppearanceTabs[tabIndex + 1].label}`;
      }
      return name.trim().length < 2
        ? 'Escribe su nombre para elegir Bando y Origen'
        : 'Siguiente: Bando y Origen';
    }
    if (step === 'bando') return 'Siguiente: Rasgos Físicos y Psicológicos';
    return isEditing ? 'Listo para guardar cambios' : '¡Listo para entrar al mundo!';
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-pirate-title"
    >
      <div className="wizard-blueprint-grid flex h-[92vh] max-h-[780px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/80 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        {/* Top Stepper Header */}
        <div className="flex items-center justify-between border-b border-sky-200/80 bg-white/75 backdrop-blur-md px-4 py-3 sm:px-6">
          <nav aria-label="Pasos de creación" className="flex flex-1 items-center gap-1.5 overflow-x-auto pr-2">
            {WIZARD_STEPS.map((s, idx) => {
              const isActive = s.id === step;
              const isDone = idx < stepIndex;
              return (
                <React.Fragment key={s.id}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.id)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'text-slate-950 font-bold'
                        : isDone
                        ? 'text-teal-700 hover:text-slate-950'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-black ${
                        isActive
                          ? 'bg-[#f5b82e] text-slate-950 shadow-[0_0_12px_rgba(245,184,46,0.35)]'
                          : isDone
                          ? 'bg-teal-500/15 text-teal-800 border border-teal-500/40'
                          : 'bg-sky-50/90 text-slate-500 border border-sky-200'
                      }`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : s.num}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <span aria-hidden="true" className="text-sky-300 tracking-widest select-none">
                      ···
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar creador de personaje"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-white/80 text-slate-600 hover:bg-white hover:text-slate-950 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main 2-Column Stage + Step Panel */}
        <div className="grid flex-1 min-h-0 md:grid-cols-[300px_1fr]">
          {/* Left Character Pedestal Stage */}
          <div className="flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-sky-200/80 bg-sky-50/65 px-5 py-5 overflow-y-auto nautical-scroll">
            <div className="relative flex flex-col items-center justify-center pt-2 pb-4 w-full">
              <div className="relative flex flex-col items-center justify-center rounded-xl border border-sky-200 bg-white/85 px-6 pt-5 pb-4 w-full shadow-sm">
                <div className="relative z-10" style={{ imageRendering: 'pixelated' }}>
                  <PirateAvatarSvg
                    name={name || 'Pirata'}
                    flagColor={activeFactionInfo.defaultColor}
                    race={race}
                    hatStyle={hatStyle}
                    hatColor={hatColor}
                    skinTone={skinTone}
                    hairStyle={hairStyle}
                    hairColor={hairColor}
                    bodyBuild={bodyBuild}
                    outfitStyle={outfitStyle}
                    outfitColor={outfitColor}
                    accessory={accessory}
                    accessoryColor={accessoryColor}
                    capeStyle={capeStyle}
                    capeColor={capeColor}
                    role={role}
                    hasEquippedWeapon={Boolean(editingPirate?.equipped?.arma)}
                    variant="stage"
                    size={168}
                  />
                </div>
                <svg
                  width="156"
                  height="16"
                  viewBox="0 0 39 4"
                  shapeRendering="crispEdges"
                  style={{ imageRendering: 'pixelated' }}
                  className="-mt-1"
                  aria-hidden="true"
                >
                  <rect x={4} y={0} width={31} height={1} fill="#cbd5e1" />
                  <rect x={2} y={1} width={35} height={2} fill="#94a3b8" />
                  <rect x={4} y={3} width={31} height={1} fill="#64748b" />
                </svg>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                <span
                  className="rounded border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${activeFactionInfo.badgeColor}1a`,
                    borderColor: `${activeFactionInfo.badgeColor}45`,
                    color: activeFactionInfo.badgeColor,
                  }}
                >
                  {activeFactionInfo.label}
                </span>
                <span className="rounded border border-teal-500/35 bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  {activeRaceInfo.label}
                </span>
                <span className="rounded border border-sky-200 bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-800">
                  {role}
                </span>
              </div>
            </div>

            {/* Name + Epithet + Randomize */}
            <div className="w-full space-y-3">
              <div>
                <label
                  htmlFor="pirate-name"
                  className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1"
                >
                  Tu nombre en el mar *
                </label>
                <input
                  ref={nameInputRef}
                  id="pirate-name"
                  type="text"
                  maxLength={32}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Ej. Monkey D. Mateo"
                  className="w-full border-b-2 border-sky-300 bg-white/55 rounded-t-md px-2 py-1.5 text-base font-bold text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="pirate-epithet"
                  className="block font-mono-num text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1"
                >
                  Apodo
                </label>
                <input
                  id="pirate-epithet"
                  type="text"
                  maxLength={40}
                  value={epithet}
                  onChange={(e) => setEpithet(e.target.value)}
                  placeholder={activeFactionInfo.defaultEpithet}
                  className="w-full rounded-lg border border-sky-200 bg-white/85 px-2.5 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={randomizeAppearance}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white/85 px-3 py-2 text-xs font-bold text-slate-800 hover:border-teal-500 hover:bg-white transition-colors cursor-pointer"
              >
                <Dices className="h-4 w-4 text-teal-600" />
                <span>Aspecto al azar</span>
              </button>
            </div>
          </div>

          {/* Right Wizard Content Area */}
          <div className="flex flex-col min-h-0 overflow-y-auto nautical-scroll px-5 py-5 sm:px-8 sm:py-6">
            {/* STEP 1: APARIENCIA */}
            {step === 'apariencia' && (
              <div className="space-y-5">
                <div>
                  <span className="inline-block rounded bg-teal-600 px-2.5 py-0.5 font-mono-num text-[11px] font-black uppercase tracking-wider text-white">
                    {isEditing ? `EDITANDO · ${editingPirate?.name}` : 'PASO 1 · SU ASPECTO'}
                  </span>
                  <h2 id="create-pirate-title" className="mt-2 font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                    {isEditing ? (
                      <>
                        PERSONALIZA SU <span className="text-amber-700">SPRITE RETRO</span>
                      </>
                    ) : (
                      <>
                        ¿CÓMO ES <span className="text-amber-700">POR FUERA</span>?
                      </>
                    )}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600">
                    {isEditing
                      ? 'Edición básica en el mapa: cambia su ropa, sombrero y cicatrices. La raza y el pelo se fijan al crear.'
                      : 'Elige su pelo, raza, complexión y atuendo en pixel art retro de 16 bits.'}
                  </p>
                  {isEditing && (
                    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-50/90 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
                      Raza ({activeRaceInfo.label}) y pelo ({HAIR_STYLES.find((h) => h.id === hairStyle)?.label ?? hairStyle}) fijados al crear el personaje.
                    </div>
                  )}
                </div>

                <div role="tablist" aria-label="Categorías de aspecto" className="flex flex-wrap gap-2">
                  {visibleAppearanceTabs.map((t) => {
                    const active = appearanceTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setAppearanceTab(t.id);
                          setErrorMsg(null);
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? 'bg-teal-600 text-white shadow-[0_6px_16px_rgba(13,148,136,0.28)]'
                            : 'bg-white/80 text-slate-700 border border-sky-200 hover:border-teal-400 hover:bg-white'
                        }`}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-tab 1: Pelo y Color (Creation Only) */}
                {!isEditing && appearanceTab === 'pelo' && (
                  <div className="space-y-5">
                    <div>
                      <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2.5">
                        Color de pelo
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {HAIR_COLORS.map((c) => {
                          const selected = hairColor === c.hex;
                          return (
                            <button
                              key={c.hex}
                              type="button"
                              aria-label={`Color de pelo ${c.label}`}
                              aria-pressed={selected}
                              onClick={() => setHairColor(c.hex)}
                              className={`h-9 w-9 rounded-md border-2 transition-transform cursor-pointer ${
                                selected
                                  ? 'scale-110 border-[#d97706] ring-2 ring-amber-400/60'
                                  : 'border-slate-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2.5">
                        Estilo de pelo
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {HAIR_STYLES.map((hs) => {
                          const selected = hairStyle === hs.id;
                          return (
                            <button
                              key={hs.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => {
                                setHairStyle(hs.id);
                                if (hatStyle !== 'none') setHatStyle('none');
                              }}
                              className={`relative flex flex-col items-center rounded-xl border-2 p-3 transition-all cursor-pointer ${
                                selected
                                  ? 'border-[#d97706] bg-amber-50/90 shadow-[0_8px_20px_rgba(245,158,11,0.18)]'
                                  : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                              }`}
                            >
                              {selected && (
                                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </span>
                              )}
                              <PirateAvatarSvg
                                name={name || 'Pirata'}
                                flagColor={activeFactionInfo.defaultColor}
                                race={race}
                                hatStyle="none"
                                skinTone={skinTone}
                                hairStyle={hs.id}
                                hairColor={hairColor}
                                bodyBuild={bodyBuild}
                                outfitStyle={outfitStyle}
                                outfitColor={outfitColor}
                                accessory={accessory}
                                accessoryColor={accessoryColor}
                                capeStyle={capeStyle}
                                capeColor={capeColor}
                                role={role}
                                variant="stage"
                                size={64}
                              />
                              <span className="mt-1.5 text-xs font-bold text-slate-900">
                                {hs.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Raza, Piel y Cuerpo (Creation Only) */}
                {!isEditing && appearanceTab === 'cuerpo' && (
                  <div className="space-y-5">
                    <div>
                      <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2.5">
                        Raza en los Mares
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {RACE_OPTIONS.map((rOpt) => {
                          const selected = race === rOpt.id;
                          const bonusParts = [
                            rOpt.fuerzaBonus !== 0 ? `${rOpt.fuerzaBonus > 0 ? '+' : ''}${rOpt.fuerzaBonus} Fue` : null,
                            rOpt.agilidadBonus !== 0 ? `${rOpt.agilidadBonus > 0 ? '+' : ''}${rOpt.agilidadBonus} Agi` : null,
                            rOpt.aguanteBonus !== 0 ? `${rOpt.aguanteBonus > 0 ? '+' : ''}${rOpt.aguanteBonus} Agu` : null,
                            rOpt.ingenioBonus !== 0 ? `${rOpt.ingenioBonus > 0 ? '+' : ''}${rOpt.ingenioBonus} Ing` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ');
                          return (
                            <button
                              key={rOpt.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setRace(rOpt.id)}
                              className={`relative flex flex-col items-center rounded-xl border-2 p-2.5 text-center transition-all cursor-pointer ${
                                selected
                                  ? 'border-[#d97706] bg-amber-50/90 shadow-[0_8px_20px_rgba(245,158,11,0.18)]'
                                  : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                              }`}
                            >
                              {selected && (
                                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </span>
                              )}
                              <PirateAvatarSvg
                                name={name || 'Pirata'}
                                flagColor={activeFactionInfo.defaultColor}
                                race={rOpt.id}
                                hatStyle={hatStyle}
                                hatColor={hatColor}
                                skinTone={skinTone}
                                hairStyle={hairStyle}
                                hairColor={hairColor}
                                bodyBuild={bodyBuild}
                                outfitStyle={outfitStyle}
                                outfitColor={outfitColor}
                                accessory={accessory}
                                accessoryColor={accessoryColor}
                                capeStyle={capeStyle}
                                capeColor={capeColor}
                                role={role}
                                variant="stage"
                                size={54}
                              />
                              <span className="mt-1 text-xs font-bold text-slate-900">{rOpt.label}</span>
                              <span className="mt-0.5 text-[10px] font-mono-num font-bold text-teal-700">
                                {bonusParts}
                              </span>
                              <span className="mt-0.5 text-[10px] text-slate-600 leading-tight line-clamp-2">
                                {rOpt.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2.5">
                        Tono de piel
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {SKIN_TONES.map((s) => {
                          const selected = skinTone === s.hex;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              aria-label={`Tono de piel ${s.label}`}
                              aria-pressed={selected}
                              onClick={() => setSkinTone(s.hex)}
                              className={`h-9 w-9 rounded-md border-2 transition-transform cursor-pointer ${
                                selected
                                  ? 'scale-110 border-[#d97706] ring-2 ring-amber-400/60'
                                  : 'border-slate-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: s.hex }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2.5">
                        Complexión
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        {BODY_BUILDS.map((b) => {
                          const selected = bodyBuild === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setBodyBuild(b.id)}
                              className={`relative flex flex-col items-center rounded-xl border-2 p-3 text-center transition-all cursor-pointer ${
                                selected
                                  ? 'border-[#d97706] bg-amber-50/90 shadow-[0_8px_20px_rgba(245,158,11,0.18)]'
                                  : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                              }`}
                            >
                              {selected && (
                                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </span>
                              )}
                              <PirateAvatarSvg
                                name={name || 'Pirata'}
                                flagColor={activeFactionInfo.defaultColor}
                                race={race}
                                hatStyle={hatStyle}
                                hatColor={hatColor}
                                skinTone={skinTone}
                                hairStyle={hairStyle}
                                hairColor={hairColor}
                                bodyBuild={b.id}
                                outfitStyle={outfitStyle}
                                outfitColor={outfitColor}
                                accessory={accessory}
                                accessoryColor={accessoryColor}
                                capeStyle={capeStyle}
                                capeColor={capeColor}
                                role={role}
                                variant="stage"
                                size={64}
                              />
                              <span className="mt-1.5 text-xs font-bold text-slate-900">{b.label}</span>
                              <span className="mt-0.5 text-[10px] text-slate-600 leading-tight hidden sm:block">
                                {b.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 3: Ropa, Abrigos y Capas */}
                {appearanceTab === 'ropa' && (
                  <div className="space-y-5">
                    <div>
                      <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2.5">
                        Color plano de atuendo
                      </span>
                      <div className="flex flex-wrap gap-2.5">
                        {OUTFIT_COLORS.map((c) => {
                          const selected = outfitColor === c.hex;
                          return (
                            <button
                              key={c.hex}
                              type="button"
                              aria-label={`Color de ropa ${c.label}`}
                              aria-pressed={selected}
                              onClick={() => setOutfitColor(c.hex)}
                              className={`h-8 w-8 rounded-md border-2 transition-transform cursor-pointer ${
                                selected
                                  ? 'scale-110 border-[#d97706] ring-2 ring-amber-400/60'
                                  : 'border-slate-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <HorizontalOptionRail label="Estilo de ropa" testId="create-rail-outfit">
                      {OUTFIT_STYLES.map((os) => {
                        const selected = outfitStyle === os.id;
                        return (
                          <button
                            key={os.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setOutfitStyle(os.id)}
                            className={`relative flex w-[114px] shrink-0 flex-col items-center rounded-xl border-2 p-2.5 transition-all cursor-pointer ${
                              selected
                                ? 'border-[#d97706] bg-amber-50/90 shadow-[0_8px_18px_rgba(245,158,11,0.18)]'
                                : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                            }`}
                          >
                            {selected && (
                              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </span>
                            )}
                            <PirateAvatarSvg
                              name={name || 'Pirata'}
                              flagColor={activeFactionInfo.defaultColor}
                              race={race}
                              hatStyle={hatStyle}
                              hatColor={hatColor}
                              skinTone={skinTone}
                              hairStyle={hairStyle}
                              hairColor={hairColor}
                              bodyBuild={bodyBuild}
                              outfitStyle={os.id}
                              outfitColor={outfitColor}
                              accessory={accessory}
                              accessoryColor={accessoryColor}
                              capeStyle={capeStyle}
                              capeColor={capeColor}
                              role={role}
                              variant="stage"
                              size={56}
                            />
                            <span className="mt-1.5 text-[11px] font-bold text-slate-900 text-center leading-tight">
                              {os.label}
                            </span>
                          </button>
                        );
                      })}
                    </HorizontalOptionRail>

                    <HorizontalOptionRail
                      label="Capa o abrigo en espalda"
                      testId="create-rail-cape"
                      rightHint={
                        capeStyle !== 'none' ? (
                          <span
                            data-testid="create-cape-color-hint"
                            className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-400"
                              style={{ backgroundColor: capeColor }}
                            />
                            <span>{getItemColorLabel(capeColor)} · Clic de nuevo para color</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            Pulsa otra vez el elegido para cambiar color
                          </span>
                        )
                      }
                    >
                      {CAPE_OPTIONS.map((cOpt) => {
                        const selected = capeStyle === cOpt.id;
                        const effectiveColor = selected ? capeColor : cOpt.defaultColor;
                        return (
                          <button
                            key={cOpt.id}
                            type="button"
                            data-testid={`create-cape-${cOpt.id}`}
                            aria-pressed={selected}
                            onClick={() => selectCapeWithColorCycle(cOpt)}
                            className={`relative flex w-[116px] shrink-0 flex-col items-center rounded-xl border-2 p-2.5 transition-all cursor-pointer ${
                              selected
                                ? 'border-[#d97706] bg-amber-50/90 shadow-[0_8px_18px_rgba(245,158,11,0.18)]'
                                : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                            }`}
                          >
                            {selected && cOpt.id !== 'none' && (
                              <span
                                className="absolute left-1.5 top-1.5 h-3 w-3 rounded-sm border border-slate-400"
                                style={{ backgroundColor: capeColor }}
                              />
                            )}
                            {selected && (
                              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </span>
                            )}
                            <PirateAvatarSvg
                              name={name || 'Pirata'}
                              flagColor={activeFactionInfo.defaultColor}
                              race={race}
                              hatStyle={hatStyle}
                              hatColor={hatColor}
                              skinTone={skinTone}
                              hairStyle={hairStyle}
                              hairColor={hairColor}
                              bodyBuild={bodyBuild}
                              outfitStyle={outfitStyle}
                              outfitColor={outfitColor}
                              accessory={accessory}
                              accessoryColor={accessoryColor}
                              capeStyle={cOpt.id}
                              capeColor={effectiveColor}
                              role={role}
                              variant="stage"
                              size={56}
                            />
                            <span className="mt-1.5 text-[11px] font-bold text-slate-900 text-center leading-tight">
                              {cOpt.label}
                            </span>
                          </button>
                        );
                      })}
                    </HorizontalOptionRail>
                  </div>
                )}

                {/* Sub-tab 4: Sombrero y Marcas */}
                {appearanceTab === 'extras' && (
                  <div className="space-y-5">
                    <HorizontalOptionRail
                      label="Sombrero o corona"
                      testId="create-rail-hat"
                      rightHint={
                        hatStyle !== 'none' ? (
                          <span
                            data-testid="create-hat-color-hint"
                            className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-400"
                              style={{ backgroundColor: hatColor }}
                            />
                            <span>{getItemColorLabel(hatColor)} · Clic de nuevo para color</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            Pulsa otra vez el elegido para cambiar color
                          </span>
                        )
                      }
                    >
                      {HAT_OPTIONS.map((hOpt) => {
                        const selected = hatStyle === hOpt.id;
                        const effectiveColor = selected ? hatColor : hOpt.defaultColor;
                        return (
                          <button
                            key={hOpt.id}
                            type="button"
                            data-testid={`create-hat-${hOpt.id}`}
                            aria-pressed={selected}
                            onClick={() => selectHatWithColorCycle(hOpt)}
                            className={`relative flex w-[112px] shrink-0 flex-col items-center rounded-xl border-2 p-2.5 transition-all cursor-pointer ${
                              selected
                                ? 'border-[#d97706] bg-amber-50/90 shadow-[0_8px_18px_rgba(245,158,11,0.18)]'
                                : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                            }`}
                          >
                            {selected && hOpt.id !== 'none' && (
                              <span
                                className="absolute left-1.5 top-1.5 h-3 w-3 rounded-sm border border-slate-400"
                                style={{ backgroundColor: hatColor }}
                              />
                            )}
                            {selected && (
                              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </span>
                            )}
                            <PirateAvatarSvg
                              name={name || 'Pirata'}
                              flagColor={activeFactionInfo.defaultColor}
                              race={race}
                              hatStyle={hOpt.id}
                              hatColor={effectiveColor}
                              skinTone={skinTone}
                              hairStyle={hairStyle}
                              hairColor={hairColor}
                              bodyBuild={bodyBuild}
                              outfitStyle={outfitStyle}
                              outfitColor={outfitColor}
                              accessory={accessory}
                              accessoryColor={accessoryColor}
                              capeStyle={capeStyle}
                              capeColor={capeColor}
                              role={role}
                              variant="stage"
                              size={54}
                            />
                            <span className="mt-1 text-[11px] font-bold text-slate-900 text-center leading-tight">
                              {hOpt.label}
                            </span>
                          </button>
                        );
                      })}
                    </HorizontalOptionRail>

                    <HorizontalOptionRail
                      label="Marcas y accesorios faciales"
                      testId="create-rail-accessory"
                      rightHint={
                        accessory !== 'none' ? (
                          <span
                            data-testid="create-acc-color-hint"
                            className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-400"
                              style={{ backgroundColor: accessoryColor }}
                            />
                            <span>{getItemColorLabel(accessoryColor)} · Clic de nuevo para color</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            Pulsa otra vez el elegido para cambiar color
                          </span>
                        )
                      }
                    >
                      {ACCESSORY_OPTIONS.map((acc) => {
                        const selected = accessory === acc.id;
                        const effectiveColor = selected ? accessoryColor : acc.defaultColor;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            data-testid={`create-acc-${acc.id}`}
                            aria-pressed={selected}
                            onClick={() => selectAccessoryWithColorCycle(acc)}
                            className={`relative flex w-[112px] shrink-0 flex-col items-center rounded-xl border-2 p-2.5 transition-all cursor-pointer ${
                              selected
                                ? 'border-[#d97706] bg-amber-50/90 shadow-[0_8px_18px_rgba(245,158,11,0.18)]'
                                : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                            }`}
                          >
                            {selected && acc.id !== 'none' && (
                              <span
                                className="absolute left-1.5 top-1.5 h-3 w-3 rounded-sm border border-slate-400"
                                style={{ backgroundColor: accessoryColor }}
                              />
                            )}
                            {selected && (
                              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </span>
                            )}
                            <PirateAvatarSvg
                              name={name || 'Pirata'}
                              flagColor={activeFactionInfo.defaultColor}
                              race={race}
                              hatStyle="none"
                              skinTone={skinTone}
                              hairStyle={hairStyle}
                              hairColor={hairColor}
                              bodyBuild={bodyBuild}
                              outfitStyle={outfitStyle}
                              outfitColor={outfitColor}
                              accessory={acc.id}
                              accessoryColor={effectiveColor}
                              capeStyle="none"
                              role={role}
                              variant="stage"
                              size={52}
                            />
                            <span className="mt-1 text-[11px] font-bold text-slate-900 text-center leading-tight">
                              {acc.label}
                            </span>
                          </button>
                        );
                      })}
                    </HorizontalOptionRail>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: BANDO Y ORIGEN */}
            {step === 'bando' && (
              <div className="space-y-5">
                <div>
                  <span className="inline-block rounded bg-teal-600 px-2.5 py-0.5 font-mono-num text-[11px] font-black uppercase tracking-wider text-white">
                    PASO 2 · BANDO Y ORIGEN
                  </span>
                  <h2 id="create-pirate-title" className="mt-2 font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                    ¿EN QUÉ <span className="text-amber-700">BANDO</span> LUCHAS?
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600">
                    Elige el bando de {name.trim() || 'tu personaje'} y su mar natal. Podrás formar tu tripulación al entrar al mundo.
                  </p>
                </div>

                {/* Faction Selector */}
                <div>
                  <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2">
                    Bando en los Mares
                  </span>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {FACTIONS.map((fac) => {
                      const selected = faction === fac.id;
                      return (
                        <button
                          key={fac.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => selectFaction(fac.id)}
                          className={`rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                            selected
                              ? 'border-[#d97706] bg-amber-50/90'
                              : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {renderFactionIcon(fac.id)}
                              <span className="text-sm font-black text-slate-900">{fac.label}</span>
                            </div>
                            {selected && <Check className="h-4 w-4 text-amber-700" />}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                            {fac.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Automatic role evolution note */}
                <div className="rounded-xl border border-teal-500/35 bg-teal-50/85 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-800">
                      Rol en Tripulación (Evolución Automática)
                    </span>
                    <span className="rounded border border-amber-400/60 bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                      {previewRoleInfo.role}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-700 leading-snug">
                    No eliges un rol fijo: tu personaje evoluciona por sí solo según sus estadísticas y acciones (Ingenio → Navegante/Arqueólogo, Fuerza → Luchador/Espadachín, Agilidad → Ladrón, Aguante → Timonel/Médico).
                  </p>
                </div>

                {/* Origin Sea */}
                <div>
                  <span className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-2">
                    Mar de Origen
                  </span>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {ORIGIN_SEAS.map((sea) => {
                      const selected = originSea === sea;
                      return (
                        <button
                          key={sea}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setOriginSea(sea)}
                          className={`rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                            selected
                              ? 'border-[#d97706] bg-amber-50/90'
                              : 'border-sky-200/85 bg-white/75 hover:border-sky-400 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-900">{sea}</span>
                            {selected && <Check className="h-4 w-4 text-amber-700" />}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                            {SEA_HINTS[sea]}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dream / Goal */}
                <div>
                  <label
                    htmlFor="pirate-dream"
                    className="block font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1.5"
                  >
                    Sueño en el Mar
                  </label>
                  <input
                    id="pirate-dream"
                    type="text"
                    maxLength={120}
                    value={dream}
                    onChange={(e) => setDream(e.target.value)}
                    className="w-full rounded-xl border border-sky-200 bg-white/85 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {DREAM_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDream(preset)}
                        className="rounded-md border border-sky-200 bg-white/80 px-2.5 py-1 text-[11px] text-slate-700 hover:border-amber-500 hover:text-amber-800 cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: RASGOS (3 filas físicas + 3 filas psicológicas con ventaja y desventaja) */}
            {step === 'rasgos' && (
              <div className="space-y-4">
                <div>
                  <span className="inline-block rounded bg-teal-600 px-2.5 py-0.5 font-mono-num text-[11px] font-black uppercase tracking-wider text-white">
                    PASO 3 · RASGOS Y EQUILIBRIO
                  </span>
                  <h2 id="create-pirate-title" className="mt-1.5 font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                    ¿QUÉ LE HACE <span className="text-amber-700">ÚNICO</span>?
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                    Cada rasgo aporta una ventaja real en combate, viaje o botín a cambio de una desventaja.
                  </p>
                </div>

                {/* Physical Traits (3 rows x 3 cols = 9 traits) */}
                <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-num text-xs font-black uppercase tracking-wider text-amber-800">
                      1. Rasgos Físicos
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Elige 1 o 2 ({physicalTraits.length}/{MAX_TRAITS_PER_CATEGORY})
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PHYSICAL_TRAITS.map((trait) => {
                      const active = physicalTraits.includes(trait.id);
                      return (
                        <button
                          key={trait.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleTrait(trait.id, physicalTraits, setPhysicalTraits)}
                          className={`flex items-start justify-between gap-1.5 rounded-xl border-2 p-2.5 text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#d97706] bg-amber-50/90'
                              : 'border-sky-200/85 bg-white/80 hover:border-sky-400 hover:bg-white'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="text-xs font-black text-slate-900">{trait.label}</div>
                            <div className="text-[10px] font-semibold text-emerald-700 leading-tight">
                              + {trait.advantage}
                            </div>
                            <div className="text-[10px] font-medium text-rose-700 leading-tight">
                              - {trait.disadvantage}
                            </div>
                          </div>
                          {active && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f5b82e] text-slate-950">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Psychological Traits (3 rows x 3 cols = 9 traits) */}
                <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-num text-xs font-black uppercase tracking-wider text-sky-700">
                      2. Rasgos Psicológicos
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Elige 1 o 2 ({mentalTraits.length}/{MAX_TRAITS_PER_CATEGORY})
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {MENTAL_TRAITS.map((trait) => {
                      const active = mentalTraits.includes(trait.id);
                      return (
                        <button
                          key={trait.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleTrait(trait.id, mentalTraits, setMentalTraits)}
                          className={`flex items-start justify-between gap-1.5 rounded-xl border-2 p-2.5 text-left transition-all cursor-pointer ${
                            active
                              ? 'border-sky-500 bg-sky-50/95'
                              : 'border-sky-200/85 bg-white/80 hover:border-sky-400 hover:bg-white'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="text-xs font-black text-slate-900">{trait.label}</div>
                            <div className="text-[10px] font-semibold text-emerald-700 leading-tight">
                              + {trait.advantage}
                            </div>
                            <div className="text-[10px] font-medium text-rose-700 leading-tight">
                              - {trait.disadvantage}
                            </div>
                          </div>
                          {active && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-300 bg-rose-50/95 px-3.5 py-2.5 text-xs font-semibold text-rose-800"
              >
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Wizard Navigation Bar */}
        <div className="flex items-center justify-between gap-3 border-t border-sky-200/80 bg-white/75 backdrop-blur-md px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstSubStep}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
              isFirstSubStep
                ? 'border-sky-100 bg-white/40 text-slate-400 cursor-not-allowed'
                : 'border-sky-200 bg-white/85 text-slate-800 hover:bg-white cursor-pointer'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Atrás</span>
          </button>

          <div className="hidden sm:block text-center text-xs font-medium text-slate-600">
            {nextLabelHint}
          </div>

          {step !== 'rasgos' ? (
            <button
              type="button"
              onClick={handleContinue}
              className="flex items-center gap-1.5 rounded-xl bg-[#f5b82e] px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 shadow-[0_6px_20px_rgba(245,184,46,0.28)] hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Continuar</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              className="flex items-center gap-2 rounded-xl bg-[#f5b82e] px-6 py-2.5 text-xs sm:text-sm font-black text-slate-950 shadow-[0_6px_24px_rgba(245,184,46,0.38)] hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isEditing ? 'Guardar cambios' : '¡Entrar al Mundo!'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
