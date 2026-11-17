import React from 'react';
import { Compass, X } from 'lucide-react';
import { formatShortBounty, getSeaBadgeColor } from '../game/sim';
import { getTraitLabel } from '../game/worldData';
import type { Island, Pirate, WorldEvent } from '../game/types';

interface IslandInspectorProps {
  island: Island | null;
  piratesHere: Pirate[];
  recentEvents: WorldEvent[];
  selectedPirate: Pirate | null;
  onFocusIsland: (island: Island) => void;
  onSelectPirate: (pirate: Pirate) => void;
  onClose: () => void;
}

export const IslandInspector: React.FC<IslandInspectorProps> = ({
  island,
  piratesHere,
  recentEvents,
  selectedPirate,
  onFocusIsland,
  onSelectPirate,
  onClose,
}) => {
  if (!island && !selectedPirate) return null;

  if (selectedPirate && !island) {
    return (
      <div className="pointer-events-auto w-80 rounded-2xl border border-white/80 bg-white/82 backdrop-blur-md p-4 text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display truncate text-base font-black text-slate-900">
              {selectedPirate.name}
            </div>
            <div className="text-xs text-slate-600">
              «{selectedPirate.epithet}» · {selectedPirate.role}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar inspector de barco"
            className="rounded p-1 text-slate-500 hover:bg-sky-100/80 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-3 text-xs font-mono-num">
          <span className="font-bold text-amber-700">
            {formatShortBounty(selectedPirate.bounty)}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-700">
            {selectedPirate.wins}V / {selectedPirate.losses}D
          </span>
        </div>

        <div className="mt-2 space-y-0.5 text-[11px] text-slate-700">
          <div>
            <span className="text-amber-700 font-semibold">Físico:</span>{' '}
            {selectedPirate.physicalTraits.map(getTraitLabel).join(' · ')}
          </div>
          <div>
            <span className="text-sky-700 font-semibold">Destreza:</span>{' '}
            {selectedPirate.mentalTraits.map(getTraitLabel).join(' · ')}
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-700">
          {selectedPirate.crewName}
          {selectedPirate.devilFruit ? ` · ${selectedPirate.devilFruit}` : ''}
        </p>
        <p className="mt-1 text-[11px] italic text-slate-500">
          “{selectedPirate.dream}”
        </p>
      </div>
    );
  }

  if (!island) return null;

  return (
    <div className="pointer-events-auto w-80 sm:w-96 rounded-2xl border border-white/80 bg-white/82 backdrop-blur-md p-4 text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span style={{ color: getSeaBadgeColor(island.sea) }}>{island.sea}</span>
            <span className="text-slate-400">·</span>
            <span className="text-amber-700">Peligro Nivel {island.dangerTier}</span>
          </div>
          <h3 className="font-display truncate text-lg font-black text-slate-900 mt-0.5">
            {island.name}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onFocusIsland(island)}
            aria-label={`Centrar cámara en ${island.name}`}
            className="rounded p-1.5 text-amber-700 hover:bg-sky-100/80 cursor-pointer"
          >
            <Compass className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar inspector de isla"
            className="rounded p-1.5 text-slate-500 hover:bg-sky-100/80 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{island.description}</p>

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Piratas en puerto ({piratesHere.length})
        </div>
        {piratesHere.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">Todos los barcos zarparon rumbo a otra isla.</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {piratesHere.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPirate(p)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer transition-colors ${
                  p.isPlayerOwned
                    ? 'border-amber-400 bg-amber-50/90 text-amber-900'
                    : 'border-sky-200 bg-sky-50/80 text-slate-800 hover:border-amber-400'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {recentEvents.length > 0 && (
        <div className="mt-3 border-t border-sky-200/75 pt-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Último suceso local
          </div>
          <p className="mt-1 text-xs text-slate-700">{recentEvents[0].message}</p>
        </div>
      )}
    </div>
  );
};
