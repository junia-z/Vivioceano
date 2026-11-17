import React from 'react';
import { formatBounty } from '../game/sim';
import type { Pirate, WorldState } from '../game/types';

interface PauseModalProps {
  world: WorldState;
  activePirate: Pirate | null;
  onResume: () => void;
  onGoMenu: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  world,
  activePirate,
  onResume,
  onGoMenu,
  onReturnTitle,
}) => {
  const playerCount = world.pirates.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/84 backdrop-blur-md p-6 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
        <h2 id="pause-title" className="font-display text-2xl font-black text-amber-700">
          Simulación en Pausa
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Los vientos del Grand Line esperan tus órdenes.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Día Actual</div>
            <div className="mt-1 font-mono-num text-xl font-bold text-slate-900">
              Día {world.day}
            </div>
          </div>
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tus Piratas</div>
            <div className="mt-1 font-mono-num text-xl font-bold text-amber-700">
              {playerCount}
            </div>
          </div>
          {activePirate && (
            <div className="col-span-2 rounded-xl border border-sky-200/80 bg-sky-50/80 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Personaje Actual
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-slate-900">{activePirate.name}</span>
                <span className="font-mono-num text-sm font-bold text-amber-700">
                  {formatBounty(activePirate.bounty)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-xl bg-[#f5b82e] py-2.5 font-display text-sm font-black text-slate-950 hover:bg-amber-300 cursor-pointer shadow-sm"
          >
            Reanudar Navegación
          </button>
          <button
            type="button"
            onClick={onGoMenu}
            className="w-full rounded-xl border border-sky-200 bg-white/85 py-2.5 text-sm font-semibold text-slate-800 hover:bg-white hover:border-amber-400 cursor-pointer"
          >
            Ir al Menú de Personajes
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full rounded-xl border border-sky-200/70 bg-sky-50/60 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/80 cursor-pointer"
          >
            Volver a Portada
          </button>
        </div>
      </div>
    </div>
  );
};
