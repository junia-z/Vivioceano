import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Anchor,
  Compass,
  Edit3,
  LogIn,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatBounty, getSeaBadgeColor } from '../game/sim';
import { getFactionInfo, getTraitLabel } from '../game/worldData';
import type { Island, Pirate } from '../game/types';
import { PirateAvatarSvg } from './PirateAvatarSvg';

interface CharacterMenuProps {
  pirates: Pirate[];
  islands: Island[];
  user: User | null;
  authBusy: boolean;
  authNotice: string | null;
  muted: boolean;
  onCreateNew: () => void;
  onSelectCharacter: (pirate: Pirate) => void;
  onEditCharacter: (pirate: Pirate) => void;
  onDeleteCharacter: (pirateId: string) => void;
  onAuthAction: () => void;
  onToggleMute: () => void;
  onReturnTitle: () => void;
}

export const CharacterMenu: React.FC<CharacterMenuProps> = ({
  pirates,
  islands,
  user,
  authBusy,
  authNotice,
  muted,
  onCreateNew,
  onSelectCharacter,
  onEditCharacter,
  onDeleteCharacter,
  onAuthAction,
  onToggleMute,
  onReturnTitle,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-sky-200/80 bg-white/82 backdrop-blur-md px-3.5 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
          <button
            type="button"
            onClick={onReturnTitle}
            className="font-display text-sm font-black tracking-wide text-amber-700 hover:text-amber-600 cursor-pointer whitespace-nowrap"
          >
            VIVID OCEAN
          </button>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="font-mono-num text-xs font-semibold text-slate-700 whitespace-nowrap">
            Menú de Personajes ({pirates.length})
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-sky-200/80 bg-white/82 backdrop-blur-md px-2.5 py-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Activar sonido [M]' : 'Silenciar sonido [M]'}
            className="rounded-lg p-1.5 text-slate-700 hover:bg-sky-100/80 cursor-pointer shrink-0"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-600" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={onAuthAction}
            className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/85 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-amber-400 hover:bg-white cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {user ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="max-w-[140px] truncate">
                  {user.displayName || user.email || 'Cuenta Google'}
                </span>
                <LogOut className="h-3.5 w-3.5 text-slate-500 ml-0.5" />
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5 text-amber-600" />
                <span>{authBusy ? 'Conectando...' : 'Entrar con Google'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Character Hub Panel */}
      <div className="flex flex-1 items-start sm:items-center pt-3 overflow-hidden">
        <section
          aria-label="Menú de tus personajes"
          className="pointer-events-auto flex max-h-[calc(100vh-110px)] w-full max-w-xl flex-col rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.18)] overflow-hidden"
        >
          {/* Header + Create CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/80 bg-sky-50/85 px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-slate-900">
                Tus Personajes
              </h2>
              <p className="text-xs text-slate-600">
                Elige un personaje para entrar en su mundo o crea uno nuevo.
              </p>
            </div>

            <button
              type="button"
              onClick={onCreateNew}
              className="flex items-center gap-2 rounded-xl bg-[#f5b82e] px-4 py-2.5 text-xs sm:text-sm font-black text-slate-950 shadow-[0_6px_20px_rgba(245,184,46,0.3)] hover:bg-amber-300 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Nuevo personaje</span>
            </button>
          </div>

          {/* Google Account Persistence Banner */}
          <div className="border-b border-sky-200/70 bg-white/60 px-4 py-2.5 sm:px-5">
            {user ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-emerald-700">Cuenta guardada con Google: </span>
                    <span className="text-slate-700 truncate">{user.email || user.displayName}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onAuthAction}
                  className="rounded-lg border border-sky-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-rose-400 hover:text-rose-700 cursor-pointer whitespace-nowrap"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <p className="text-xs font-medium text-slate-700">
                  Guarda tus personajes en tu cuenta de Google.
                </p>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={onAuthAction}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-400/20 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-400/30 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>{authBusy ? 'Conectando...' : 'Guardar con Google'}</span>
                </button>
              </div>
            )}
            {authNotice && (
              <p role="status" className="mt-1.5 text-[11px] font-semibold text-amber-800">
                {authNotice}
              </p>
            )}
          </div>

          {/* Character List */}
          <div className="flex-1 overflow-y-auto nautical-scroll p-4 sm:p-5 space-y-3">
            {pirates.length === 0 ? (
              <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 p-6 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/40 bg-amber-400/20 text-amber-700">
                  <Anchor className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-base font-black text-slate-900">
                    Aún no tienes ningún personaje
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                    Aquí gestionas a tus propios personajes mientras ~50 barcos rivales recorren los mares de
                    Vivid Ocean. Crea el primero para comenzar su travesía.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#f5b82e] px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Crear primer personaje</span>
                </button>
              </div>
            ) : (
              pirates.map((p) => {
                const currIsland = islands.find((i) => i.id === p.islandId);
                const destIsland = p.sailingToIslandId
                  ? islands.find((i) => i.id === p.sailingToIslandId)
                  : null;
                const confirming = confirmDeleteId === p.id;
                const factionInfo = getFactionInfo(p.faction);
                const hasCrew = Boolean(p.crewName && p.crewName !== 'Sin tripulación');

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-sky-200/80 bg-sky-50/75 p-3.5 shadow-sm transition-colors hover:border-amber-400 hover:bg-white/90"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0 rounded-xl border border-sky-200 bg-white/90 p-1.5 shadow-inner">
                          <PirateAvatarSvg
                            name={p.name}
                            flagColor={p.flagColor}
                            hatStyle={p.hatStyle}
                            hatColor={p.hatColor}
                            race={p.race}
                            skinTone={p.skinTone}
                            hairStyle={p.hairStyle}
                            hairColor={p.hairColor}
                            bodyBuild={p.bodyBuild}
                            outfitStyle={p.outfitStyle}
                            outfitColor={p.outfitColor}
                            accessory={p.accessory}
                            accessoryColor={p.accessoryColor}
                            capeStyle={p.capeStyle}
                            capeColor={p.capeColor}
                            weaponStyle={p.weaponStyle}
                            role={p.role}
                            hasEquippedWeapon={Boolean(p.equipped?.arma)}
                            variant="stage"
                            size={64}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-display truncate text-base font-black text-slate-900">
                              {p.name}
                            </span>
                            <span
                              className="rounded border px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: `${factionInfo.badgeColor}18`,
                                borderColor: `${factionInfo.badgeColor}45`,
                                color: factionInfo.badgeColor,
                              }}
                            >
                              {factionInfo.label}
                            </span>
                            <span
                              className="rounded border px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: `${getSeaBadgeColor(p.originSea)}18`,
                                borderColor: `${getSeaBadgeColor(p.originSea)}45`,
                                color: getSeaBadgeColor(p.originSea),
                              }}
                            >
                              {p.originSea}
                            </span>
                          </div>

                          <div className="truncate text-xs font-medium text-slate-700">
                            «{p.epithet}» · {hasCrew ? `${p.crewName} (${p.role})` : `En solitario · ${p.role}`}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono-num">
                            <span className="font-bold text-amber-700">
                              {formatBounty(p.bounty)}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="font-semibold text-emerald-700">{p.berries} monedones</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-700">
                              {p.wins}V / {p.losses}D
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                            <Compass className="h-3 w-3 text-sky-600 shrink-0" />
                            <span className="truncate">
                              {destIsland
                                ? `Rumbo a ${destIsland.name}`
                                : `En ${currIsland?.name ?? 'alta mar'}`}
                              {p.devilFruit ? ` · ${p.devilFruit}` : ''}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-500">
                            {[...p.physicalTraits, ...p.mentalTraits].map(getTraitLabel).join(' · ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectCharacter(p)}
                          className="rounded-lg bg-[#f5b82e] px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                        >
                          Ver personaje
                        </button>

                        {confirming ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                onDeleteCharacter(p.id);
                              }}
                              aria-label={`Confirmar borrar a ${p.name}`}
                              className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer whitespace-nowrap"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEditCharacter(p)}
                              aria-label={`Editar a ${p.name}`}
                              className="flex items-center gap-1 rounded-lg border border-teal-500/35 bg-teal-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-500/20 cursor-pointer whitespace-nowrap"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)}
                              aria-label={`Borrar a ${p.name}`}
                              className="flex items-center gap-1 rounded-lg border border-rose-400/45 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-500/20 cursor-pointer whitespace-nowrap"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Borrar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
