import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { CharacterMenu } from './components/CharacterMenu';
import { CharacterScreen } from './components/CharacterScreen';
import { CreatePirateModal } from './components/CreatePirateModal';
import { GlobeCanvas, type CameraTargetRequest } from './components/GlobeCanvas';
import type { WorldMapFocusRequest } from './components/WorldMapCanvas';
import { PauseModal } from './components/PauseModal';
import { TitleOverlay } from './components/TitleOverlay';
import { soundEngine } from './game/audio';
import {
  type PirateBuildPatch,
  challengeMiniBoss,
  coatPirateShipWithBubble,
  compactPirateForStorage,
  createInitialWorld,
  equipPirateItem,
  getAllMapIslands,
  getPirateLatLon,
  hydratePirateFromStorage,
  movePirateInIsland,
  removePirateFromWorld,
  runIslandMission,
  runNpcQuest,
  setPirateManualMode,
  spawnPlayerPirate,
  startPirateVoyage,
  stepSimulation,
  unequipPirateSlot,
  updatePirateBuild,
  updatePirateCrew,
  updatePirateProfile,
} from './game/sim';
import {
  GLOBE_ENTRY_DIST_FROM_MAP,
  MAP_ENTRY_ZOOM_FROM_GLOBE,
  MAP_ENTRY_ZOOM_FROM_ISLAND,
} from './game/zoomContinuum';
import type {
  CreatePirateInput,
  EquipmentSlot,
  GameState,
  Island,
  IslandMissionId,
  IslandZoneId,
  Pirate,
  RedDotFilterId,
  WorldState,
} from './game/types';
import {
  deletePirateFromFirestore,
  publishWorldEventToFirestore,
  savePirateToFirestore,
  signInWithGoogle,
  signOutCaptain,
  subscribeAuth,
  subscribeUserPirates,
  syncPirateProgressToFirestore,
  updatePirateBuildInFirestore,
  updatePirateCrewInFirestore,
  updatePirateInventoryInFirestore,
  updatePirateProfileInFirestore,
} from './services/firebase';

const LOCAL_STORAGE_PREFIX = 'vivid_ocean_player_pirates_v2_';

function getStorageKey(uid: string | null): string {
  return `${LOCAL_STORAGE_PREFIX}${uid ?? 'guest'}`;
}

function loadSavedPlayerPirates(uid: string | null): Pirate[] {
  try {
    const raw =
      localStorage.getItem(getStorageKey(uid)) ??
      (uid === null ? localStorage.getItem('vivid_ocean_player_pirates_v1') : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const hydrated: Pirate[] = [];
    for (const item of parsed) {
      const p = hydratePirateFromStorage(item, uid);
      if (p) hydrated.push(p);
    }
    return hydrated;
  } catch {
    return [];
  }
}

function formatGoogleAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Se cerró la ventana de Google antes de completar el inicio de sesión.';
  }
  if (code === 'auth/popup-blocked') {
    return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este dominio aún no está autorizado en Firebase Auth.';
  }
  return 'No se pudo iniciar sesión con Google en este navegador.';
}

type ViewMode = 'menu' | 'character';

export default function App() {
  const initialAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [gameState, setGameState] = useState<GameState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('menu');
  const [mapView, setMapView] = useState<'island' | 'globe' | 'map'>('island');
  const [activePirateId, setActivePirateId] = useState<string | null>(null);

  const [world, setWorld] = useState<WorldState>(() => {
    const base = createInitialWorld();
    const saved = loadSavedPlayerPirates(null);
    return {
      ...base,
      totalPiratesCount: saved.length,
      pirates: saved,
    };
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPirate, setEditingPirate] = useState<Pirate | null>(null);
  const [characterSideOpen, setCharacterSideOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<CameraTargetRequest | null>(null);
  const [mapFocusTarget, setMapFocusTarget] = useState<WorldMapFocusRequest | null>(null);
  const [mapSelectedIslandId, setMapSelectedIslandId] = useState<string | null>(null);
  const [inspectedIslandId, setInspectedIslandId] = useState<string | null>(null);
  const [selectedRoamingNpcId, setSelectedRoamingNpcId] = useState<string | null>(null);
  const [redDotFilters, setRedDotFilters] = useState<RedDotFilterId[]>([]);
  const [voyageNotice, setVoyageNotice] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const cameraNonceRef = useRef(1);
  const migratedGuestIdsRef = useRef<Set<string>>(new Set());
  const lastSyncedProgressRef = useRef<Map<string, string>>(new Map());
  const lastSimTickRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now());

  const allMapIslands = useMemo(() => getAllMapIslands(world), [world]);

  // Mirror state machine onto document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const flyToLatLon = useCallback((lat: number, lon: number, distance = 8.8) => {
    cameraNonceRef.current += 1;
    setCameraTarget({
      lat,
      lon,
      distance,
      nonce: cameraNonceRef.current,
    });
  }, []);

  const focusIslandById = useCallback(
    (islandId: string, distance?: number) => {
      const isl = allMapIslands.find((i) => i.id === islandId);
      if (!isl) return;
      const dist =
        distance ??
        Math.min(7.5, Math.max(6.85, 6.8 + (isl.scale ?? 1.0) * 0.45));
      flyToLatLon(isl.lat, isl.lon, dist);
      cameraNonceRef.current += 1;
      setMapSelectedIslandId(isl.id);
      setMapFocusTarget({
        lat: isl.lat,
        lon: isl.lon,
        zoom: isl.isMiniIsland ? 6.5 : 5.2,
        nonce: cameraNonceRef.current,
      });
    },
    [allMapIslands, flyToLatLon]
  );

  const focusPirate = useCallback(
    (pirate: Pirate) => {
      setInspectedIslandId(null);
      const [pLat, pLon] = getPirateLatLon(pirate, allMapIslands);
      const isl = allMapIslands.find((i) => i.id === pirate.islandId);
      const dist = pirate.sailingToIslandId
        ? 9.2
        : Math.min(7.5, Math.max(6.85, 6.8 + (isl?.scale ?? 1.0) * 0.45));
      flyToLatLon(pLat, pLon, dist);
      cameraNonceRef.current += 1;
      setMapSelectedIslandId(pirate.islandId);
      setMapFocusTarget({
        lat: pLat,
        lon: pLon,
        zoom: pirate.sailingToIslandId ? 4.2 : 6.0,
        nonce: cameraNonceRef.current,
      });
    },
    [allMapIslands, flyToLatLon]
  );

  const handleFocusLatLon = useCallback(
    (lat: number, lon: number, zoom = 4.5, globeDist = 9.0) => {
      flyToLatLon(lat, lon, globeDist);
      cameraNonceRef.current += 1;
      setMapFocusTarget({
        lat,
        lon,
        zoom,
        nonce: cameraNonceRef.current,
      });
    },
    [flyToLatLon]
  );

  // Firebase Auth listener
  useEffect(() => {
    const unsubAuth = subscribeAuth((u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  // Load & sync pirates for the signed-in Google account (or guest local storage)
  useEffect(() => {
    if (!user) {
      const guestPirates = loadSavedPlayerPirates(null);
      setWorld((prev) => ({
        ...prev,
        pirates: guestPirates,
        totalPiratesCount: guestPirates.length,
        events: prev.events.filter((ev) =>
          guestPirates.some((gp) => gp.id === ev.pirateId)
        ),
      }));
      setActivePirateId((curr) =>
        curr && guestPirates.some((p) => p.id === curr) ? curr : null
      );
      return;
    }

    const guestPirates = loadSavedPlayerPirates(null);
    if (guestPirates.length > 0) {
      guestPirates.forEach((gp) => {
        if (!migratedGuestIdsRef.current.has(gp.id)) {
          migratedGuestIdsRef.current.add(gp.id);
          const owned: Pirate = { ...gp, ownerId: user.uid, isPlayerOwned: true };
          void savePirateToFirestore(owned, user).catch((err) => {
            console.warn('Guest pirate migration notice:', err);
          });
        }
      });
      localStorage.removeItem(getStorageKey(null));
    }

    const cachedUserPirates = loadSavedPlayerPirates(user.uid);
    const cachedMap = new Map(cachedUserPirates.map((cp) => [cp.id, cp]));
    if (cachedUserPirates.length > 0) {
      setWorld((prev) => {
        const existingIds = new Set(prev.pirates.map((p) => p.id));
        const merged = [
          ...prev.pirates.map((p) => ({ ...p, ownerId: user.uid, isPlayerOwned: true })),
          ...cachedUserPirates.filter((cp) => !existingIds.has(cp.id)),
        ];
        return {
          ...prev,
          pirates: merged,
          totalPiratesCount: merged.length,
        };
      });
    }

    const unsubPirates = subscribeUserPirates(user.uid, (cloudPirates) => {
      setWorld((prev) => {
        const prevMap = new Map(prev.pirates.map((p) => [p.id, p]));
        const nextPirates: Pirate[] = cloudPirates.map((cp) => {
          const live = prevMap.get(cp.id) ?? cachedMap.get(cp.id);
          if (live) {
            return {
              ...cp,
              bounty: Math.max(cp.bounty, live.bounty),
              berries: Math.max(cp.berries, live.berries),
              wins: Math.max(cp.wins, live.wins),
              losses: Math.max(cp.losses, live.losses),
              level: Math.max(cp.level, live.level || 1),
              xp: live.xp || cp.xp,
              bossesDefeated: Math.max(cp.bossesDefeated, live.bossesDefeated || 0),
              manualMode: live.manualMode,
              islandSpot: live.islandSpot || cp.islandSpot,
              islandActivity: live.islandActivity || cp.islandActivity,
              devilFruit: live.devilFruit || cp.devilFruit,
              islandId: live.islandId || cp.islandId,
              sailingToIslandId: live.sailingToIslandId,
              sailProgress: live.sailProgress,
              cooldownSec: live.cooldownSec,
              arrivedDay: live.arrivedDay ?? 1,
              completedQuestIds: live.completedQuestIds ?? [],
              defeatedMiniBossIds: live.defeatedMiniBossIds ?? [],
              bubbleCoated: Boolean(live.bubbleCoated),
              inventory:
                (live.inventory?.length ?? 0) >= (cp.inventory?.length ?? 0)
                  ? live.inventory ?? []
                  : cp.inventory ?? [],
              equipped: live.equipped ?? cp.equipped ?? {},
              race: live.race || cp.race || 'humano',
            };
          }
          return cp;
        });

        for (const p of prev.pirates) {
          if (
            p.ownerId === user.uid &&
            !nextPirates.some((np) => np.id === p.id) &&
            Date.now() - p.createdAtMs < 15000
          ) {
            nextPirates.unshift(p);
          }
        }

        return {
          ...prev,
          pirates: nextPirates,
          totalPiratesCount: nextPirates.length,
        };
      });
    });

    return () => {
      unsubPirates();
    };
  }, [user]);

  // Persist player pirates locally under current account scope (compacted)
  useEffect(() => {
    try {
      const key = getStorageKey(user?.uid ?? null);
      localStorage.setItem(key, JSON.stringify(world.pirates.map(compactPirateForStorage)));
    } catch {
      // Ignore storage quota errors
    }
  }, [world.pirates, user?.uid]);

  // Sync character progress to Firestore when signed in
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    for (const p of world.pirates) {
      if (p.ownerId !== user.uid) continue;
      const sig = `${p.bounty}|${p.berries}|${p.wins}|${p.losses}|${p.devilFruit}|${p.islandId}|${(p.inventory ?? []).join(',')}|${p.equipped?.arma ?? ''},${p.equipped?.armadura ?? ''},${p.equipped?.amuleto ?? ''}`;
      const prevSig = lastSyncedProgressRef.current.get(p.id);
      if (prevSig === undefined) {
        lastSyncedProgressRef.current.set(p.id, sig);
        continue;
      }
      if (prevSig !== sig) {
        lastSyncedProgressRef.current.set(p.id, sig);
        void syncPirateProgressToFirestore(p, user).catch((err) => {
          console.warn('Firestore progress sync notice:', err);
        });
      }
    }
  }, [world.pirates, user]);

  // Exact Real-Time Autonomous Simulation Loop (12 real hours = 1 in-game week; advances ~50 bot ships continuously!)
  useEffect(() => {
    if (gameState !== 'playing') return;
    lastSimTickRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const interval = window.setInterval(() => {
      const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsedSec = Math.max(0.1, Math.min(5, (nowPerf - lastSimTickRef.current) / 1000));
      lastSimTickRef.current = nowPerf;

      setWorld((prev) => {
        const { world: nextWorld, newEvents } = stepSimulation(
          prev,
          elapsedSec,
          Math.random,
          Date.now()
        );
        if (newEvents.length > 0) {
          const topEv = newEvents[0];
          if (topEv.pirateId === activePirateId) {
            if (topEv.type === 'duel' || topEv.type === 'boss') soundEngine.playDuelClash();
            else if (
              topEv.type === 'treasure' ||
              topEv.type === 'devil_fruit' ||
              topEv.type === 'drop'
            ) {
              soundEngine.playCoinChime();
            }
          }
        }
        return nextWorld;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState, activePirateId]);

  const handleStart = useCallback(() => {
    soundEngine.playStartFanfare();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameState('playing');
    setViewMode('menu');
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isTyping) return;

      if (gameState === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleStart();
        return;
      }

      if (e.key === 'Escape') {
        if (showCreateModal) {
          setShowCreateModal(false);
          setEditingPirate(null);
          return;
        }
        if (gameState === 'playing' && viewMode === 'character') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        if (gameState === 'playing' && viewMode === 'character') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, viewMode, showCreateModal, handleStart, handleToggleMute]);

  const handleCreateOrSavePirate = async (input: CreatePirateInput) => {
    if (editingPirate) {
      soundEngine.playClick();
      const targetId = editingPirate.id;
      const result = updatePirateProfile(world, targetId, input, Date.now());
      setWorld(result.world);
      setEditingPirate(null);
      setShowCreateModal(false);

      if (user && result.pirate && result.pirate.ownerId === user.uid) {
        try {
          await updatePirateProfileInFirestore(result.pirate, user);
        } catch (err) {
          console.warn('Firestore profile update notice:', err);
        }
      }
      return;
    }

    soundEngine.playStartFanfare();
    const result = spawnPlayerPirate(
      world,
      input,
      user?.uid ?? 'local-player',
      Date.now()
    );
    setWorld(result.world);
    setShowCreateModal(false);

    // Stay inside the new character's solo screen immediately after creating!
    setActivePirateId(result.pirate.id);
    setInspectedIslandId(null);
    setViewMode('character');
    setMapView('island');
    setGameState('playing');

    const startIsl = result.world.islands.find((i) => i.id === result.pirate.islandId);
    if (startIsl) {
      flyToLatLon(startIsl.lat, startIsl.lon, 8.2);
    }

    if (user) {
      try {
        await savePirateToFirestore(result.pirate, user);
        await publishWorldEventToFirestore(result.event, user);
      } catch (err) {
        console.warn('Firestore save notice:', err);
      }
    }
  };

  const handleOpenEditCharacter = (pirate: Pirate) => {
    soundEngine.playClick();
    setEditingPirate(pirate);
    setShowCreateModal(true);
  };

  const handleSelectCharacter = (pirate: Pirate) => {
    soundEngine.playClick();
    setInspectedIslandId(null);
    setActivePirateId(pirate.id);
    setViewMode('character');
    setMapView(pirate.sailingToIslandId ? 'map' : 'island');
    focusPirate(pirate);
  };

  const handleDeleteCharacter = async (pirateId: string) => {
    soundEngine.playClick();
    setWorld((prev) => removePirateFromWorld(prev, pirateId));
    lastSyncedProgressRef.current.delete(pirateId);

    if (activePirateId === pirateId) {
      setActivePirateId(null);
      setViewMode('menu');
    }

    if (user) {
      try {
        await deletePirateFromFirestore(pirateId, user);
      } catch (err) {
        console.warn('Firestore delete notice:', err);
      }
    }
  };

  const handleToggleManualMode = (pirateId: string, manualMode: boolean) => {
    soundEngine.playClick();
    setWorld((prev) => setPirateManualMode(prev, pirateId, manualMode));
  };

  const handleMoveInIsland = (pirateId: string, zone: IslandZoneId) => {
    soundEngine.playClick();
    setWorld((prev) => movePirateInIsland(prev, pirateId, zone));
  };

  const handleRunMission = (pirateId: string, missionId: IslandMissionId) => {
    setWorld((prev) => {
      const res = runIslandMission(prev, pirateId, missionId, Math.random, Date.now());
      if (res.event) {
        if (res.event.type === 'duel' || res.event.type === 'boss') {
          soundEngine.playDuelClash();
        } else {
          soundEngine.playCoinChime();
        }
      }
      return res.world;
    });
  };

  const handleRunNpcQuest = (pirateId: string, questId: string) => {
    setWorld((prev) => {
      const res = runNpcQuest(prev, pirateId, questId, Math.random, Date.now());
      if (res.event) {
        soundEngine.playCoinChime();
      }
      return res.world;
    });
  };

  const handleChallengeMiniBoss = (pirateId: string, miniBossId: string) => {
    setWorld((prev) => {
      const res = challengeMiniBoss(prev, pirateId, miniBossId, Math.random, Date.now());
      if (res.event) {
        soundEngine.playDuelClash();
      }
      return res.world;
    });
  };

  const handleCoatShipBubble = useCallback((pirateId: string) => {
    soundEngine.playCoinChime();
    setWorld((prev) => {
      const res = coatPirateShipWithBubble(prev, pirateId, Date.now());
      if (!res.coated && res.reason) {
        setVoyageNotice(res.reason);
      } else if (res.coated) {
        setVoyageNotice(
          '¡Barco cubierto con burbuja Yarukiman! Ya puedes descender a Isla de los Hombres-Pez.'
        );
      }
      return res.world;
    });
  }, []);

  const handleStartVoyage = (pirateId: string, destIslandId: string) => {
    let voyageStarted = false;
    let shipLat = 0;
    let shipLon = 0;
    setWorld((prev) => {
      const res = startPirateVoyage(prev, pirateId, destIslandId, Date.now());
      if (!res.started && res.reason) {
        setVoyageNotice(res.reason);
      } else if (res.started) {
        voyageStarted = true;
        setVoyageNotice(null);
        const updatedPirate = res.world.pirates.find((p) => p.id === pirateId);
        if (updatedPirate) {
          const [pLat, pLon] = getPirateLatLon(updatedPirate, allMapIslands);
          shipLat = pLat;
          shipLon = pLon;
        }
      }
      return res.world;
    });
    if (voyageStarted) {
      soundEngine.playStartFanfare();
      setInspectedIslandId(null);
      setMapSelectedIslandId(destIslandId);
      if (mapView === 'island') {
        cameraNonceRef.current += 1;
        setMapFocusTarget({
          lat: shipLat,
          lon: shipLon,
          zoom: 3.2,
          nonce: cameraNonceRef.current,
        });
        setMapView('map');
      }
      flyToLatLon(shipLat, shipLon, 9.8);
    }
  };

  const handleZoomToMap = useCallback((lat: number, lon: number) => {
    cameraNonceRef.current += 1;
    setMapFocusTarget({
      lat,
      lon,
      zoom: MAP_ENTRY_ZOOM_FROM_GLOBE,
      nonce: cameraNonceRef.current,
    });
    setMapView('map');
  }, []);

  const handleZoomInToIsland = useCallback((island: Island) => {
    setInspectedIslandId(island.id);
    setMapSelectedIslandId(island.id);
    setMapView('island');
  }, []);

  const handleZoomOutToMapFromIsland = useCallback((island: Island) => {
    cameraNonceRef.current += 1;
    setMapSelectedIslandId(island.id);
    setMapFocusTarget({
      lat: island.lat,
      lon: island.lon,
      zoom: MAP_ENTRY_ZOOM_FROM_ISLAND,
      nonce: cameraNonceRef.current,
    });
    setMapView('map');
  }, []);

  const handleZoomOutToGlobe = useCallback(
    (lat: number, lon: number) => {
      flyToLatLon(lat, lon, GLOBE_ENTRY_DIST_FROM_MAP);
      setMapView('globe');
    },
    [flyToLatLon]
  );

  const handleUpdateCrew = async (
    pirateId: string,
    payload: { crewName: string; flagColor: string }
  ) => {
    soundEngine.playClick();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = updatePirateCrew(prev, pirateId, payload, Date.now());
      updatedPirate = res.pirate;
      return res.world;
    });

    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      try {
        await updatePirateCrewInFirestore(updatedPirate, user);
      } catch (err) {
        console.warn('Firestore crew sync notice:', err);
      }
    }
  };

  const handleEquipItem = (pirateId: string, itemId: string) => {
    soundEngine.playCoinChime();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = equipPirateItem(prev, pirateId, itemId);
      updatedPirate = res.pirate;
      return res.world;
    });
    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      void updatePirateInventoryInFirestore(updatedPirate, user).catch((err) => {
        console.warn('Firestore equip sync notice:', err);
      });
    }
  };

  const handleUnequipSlot = (pirateId: string, slot: EquipmentSlot) => {
    soundEngine.playClick();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = unequipPirateSlot(prev, pirateId, slot);
      updatedPirate = res.pirate;
      return res.world;
    });
    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      void updatePirateInventoryInFirestore(updatedPirate, user).catch((err) => {
        console.warn('Firestore unequip sync notice:', err);
      });
    }
  };

  const handleUpdateBuild = (pirateId: string, patch: PirateBuildPatch) => {
    soundEngine.playClick();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = updatePirateBuild(prev, pirateId, patch);
      updatedPirate = res.pirate;
      return res.world;
    });
    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      void updatePirateBuildInFirestore(updatedPirate, user).catch((err) => {
        console.warn('Firestore build sync notice:', err);
      });
    }
  };

  const handleAuthAction = async () => {
    setAuthNotice(null);
    setAuthBusy(true);
    try {
      if (user) {
        await signOutCaptain();
      } else {
        await signInWithGoogle();
      }
    } catch (err) {
      setAuthNotice(formatGoogleAuthError(err));
      console.warn('Auth error:', err);
    } finally {
      setAuthBusy(false);
    }
  };

  const activePirate: Pirate | null = useMemo(
    () => world.pirates.find((p) => p.id === activePirateId) ?? null,
    [world.pirates, activePirateId]
  );

  useEffect(() => {
    if (viewMode === 'character' && !activePirate) {
      setViewMode('menu');
    }
  }, [viewMode, activePirate]);

  const visibleGlobePirates = useMemo(() => {
    if (gameState === 'title') return [];
    return world.pirates;
  }, [gameState, world.pirates]);

  const visibleGlobeEvents = useMemo(() => {
    if (gameState === 'title') return [];
    if (viewMode === 'character' && activePirate) {
      return world.events.filter((ev) => ev.pirateId === activePirate.id);
    }
    return world.events;
  }, [gameState, viewMode, activePirate, world.events]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#060d18] select-none">
      {/* Isolated Full-Bleed 3D Vivid Ocean Globe */}
      <GlobeCanvas
        islands={allMapIslands}
        pirates={visibleGlobePirates}
        bots={gameState === 'title' ? [] : world.bots}
        events={visibleGlobeEvents}
        selectedIslandId={
          viewMode === 'character' && activePirate
            ? mapSelectedIslandId ?? activePirate.islandId
            : null
        }
        selectedPirateId={
          viewMode === 'character' && activePirate ? activePirate.id : null
        }
        redDotFilters={viewMode === 'character' ? redDotFilters : []}
        cameraTarget={cameraTarget}
        isTitleScreen={gameState === 'title'}
        drawerOpen={false}
        leftMenuOpen={gameState !== 'title' && viewMode === 'menu'}
        characterFocus={gameState !== 'title' && viewMode === 'character'}
        characterSideOpen={characterSideOpen}
        day={world.day}
        minuteOfDay={world.minuteOfDay}
        paused={gameState !== 'title' && viewMode === 'character' && mapView !== 'globe'}
        onSelectIsland={(id) => {
          soundEngine.playClick();
          setSelectedRoamingNpcId(null);
          focusIslandById(id);
        }}
        onSelectPirate={(id) => {
          soundEngine.playClick();
          setSelectedRoamingNpcId(null);
          const p = world.pirates.find((x) => x.id === id);
          if (p) {
            if (viewMode === 'menu') {
              handleSelectCharacter(p);
            } else {
              focusPirate(p);
            }
          }
        }}
        onSelectRoamingNpc={(npcId) => {
          soundEngine.playClick();
          setMapSelectedIslandId(null);
          setSelectedRoamingNpcId(npcId);
        }}
        onZoomTransitionToMap={viewMode === 'character' ? handleZoomToMap : undefined}
        onFocusMyShip={
          viewMode === 'character' && activePirate
            ? () => {
                soundEngine.playClick();
                focusPirate(activePirate);
              }
            : undefined
        }
      />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleOverlay
          totalPirates={world.pirates.length}
          totalIslands={world.islands.length}
          user={user}
          authBusy={authBusy}
          authNotice={authNotice}
          onStart={handleStart}
          onAuthAction={handleAuthAction}
        />
      )}

      {/* Character Hub Menu */}
      {gameState !== 'title' && viewMode === 'menu' && (
        <CharacterMenu
          pirates={world.pirates}
          islands={allMapIslands}
          user={user}
          authBusy={authBusy}
          authNotice={authNotice}
          muted={muted}
          onCreateNew={() => {
            soundEngine.playClick();
            setEditingPirate(null);
            setShowCreateModal(true);
          }}
          onSelectCharacter={handleSelectCharacter}
          onEditCharacter={handleOpenEditCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onAuthAction={handleAuthAction}
          onToggleMute={handleToggleMute}
          onReturnTitle={() => {
            soundEngine.playClick();
            setGameState('title');
          }}
        />
      )}

      {/* Dedicated Single-Character Screen (Island Interior + New Reference UI) */}
      {gameState !== 'title' && viewMode === 'character' && activePirate && (
        <CharacterScreen
          pirate={activePirate}
          allPirates={world.pirates}
          islands={world.islands}
          miniIslands={world.miniIslands}
          bots={world.bots}
          events={world.events}
          day={world.day}
          minuteOfDay={world.minuteOfDay}
          muted={muted}
          user={user}
          authBusy={authBusy}
          authNotice={authNotice}
          mapView={mapView}
          inspectedIslandId={inspectedIslandId}
          mapFocusTarget={mapFocusTarget}
          mapSelectedIslandId={mapSelectedIslandId}
          selectedRoamingNpcId={selectedRoamingNpcId}
          redDotFilters={redDotFilters}
          voyageNotice={voyageNotice}
          characterSideOpen={characterSideOpen}
          onChangeCharacterSideOpen={setCharacterSideOpen}
          onChangeRedDotFilters={setRedDotFilters}
          onSelectRoamingNpc={(npcId) => {
            if (npcId) {
              soundEngine.playClick();
              setMapSelectedIslandId(null);
            }
            setSelectedRoamingNpcId(npcId);
          }}
          onFocusLatLon={handleFocusLatLon}
          onChangeMapView={(nextView) => {
            setMapView(nextView);
            if (nextView === 'map') {
              setMapSelectedIslandId((curr) => curr ?? activePirate.islandId);
            }
          }}
          onSelectMapIsland={(id) => {
            soundEngine.playClick();
            setSelectedRoamingNpcId(null);
            setMapSelectedIslandId(id);
            focusIslandById(id);
          }}
          onZoomInToIsland={handleZoomInToIsland}
          onZoomOutToMap={handleZoomOutToMapFromIsland}
          onZoomOutToGlobe={handleZoomOutToGlobe}
          onCoatShipBubble={handleCoatShipBubble}
          onClearVoyageNotice={() => setVoyageNotice(null)}
          onBackToMenu={() => {
            soundEngine.playClick();
            setInspectedIslandId(null);
            setViewMode('menu');
            setActivePirateId(null);
            flyToLatLon(14, 32, 14.8);
          }}
          onFocusMyShip={() => {
            soundEngine.playClick();
            focusPirate(activePirate);
          }}
          onFocusFullGlobe={() => {
            soundEngine.playClick();
            setMapView('globe');
            flyToLatLon(14, 32, 15.2);
          }}
          onFocusWorldCenter={() => {
            soundEngine.playClick();
            handleFocusLatLon(0, 0, 1.4, 11.2);
          }}
          onFocusIsland={(id) => {
            soundEngine.playClick();
            focusIslandById(id);
          }}
          onToggleManualMode={handleToggleManualMode}
          onMoveInIsland={handleMoveInIsland}
          onRunMission={handleRunMission}
          onRunNpcQuest={handleRunNpcQuest}
          onChallengeMiniBoss={handleChallengeMiniBoss}
          onStartVoyage={handleStartVoyage}
          onUpdateCrew={handleUpdateCrew}
          onUpdateBuild={handleUpdateBuild}
          onEquipItem={handleEquipItem}
          onUnequipSlot={handleUnequipSlot}
          onEditCharacter={handleOpenEditCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onToggleMute={handleToggleMute}
          onPause={() => setGameState('paused')}
          onAuthAction={handleAuthAction}
        />
      )}

      {/* Character Creator / Editor Modal */}
      {showCreateModal && (
        <CreatePirateModal
          editingPirate={editingPirate}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPirate(null);
          }}
          onCreate={handleCreateOrSavePirate}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          world={world}
          activePirate={activePirate}
          onResume={() => setGameState('playing')}
          onGoMenu={() => {
            setGameState('playing');
            setViewMode('menu');
            setActivePirateId(null);
          }}
          onReturnTitle={() => setGameState('title')}
        />
      )}
    </div>
  );
}
