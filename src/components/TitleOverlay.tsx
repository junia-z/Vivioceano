import React from 'react';
import type { User } from 'firebase/auth';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';

interface TitleOverlayProps {
  totalPirates: number;
  totalIslands: number;
  user: User | null;
  authBusy: boolean;
  authNotice: string | null;
  onStart: () => void;
  onAuthAction: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  totalPirates,
  totalIslands,
  user,
  authBusy,
  authNotice,
  onStart,
  onAuthAction,
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12">
      {/* Bright coastal sea-mist gradient scrim keeping 3D globe radiant on the right */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full max-w-2xl"
        style={{
          background:
            'linear-gradient(90deg, rgba(240,249,255,0.92) 0%, rgba(240,249,255,0.74) 62%, rgba(240,249,255,0) 100%)',
        }}
      />

      <div className="relative z-10 max-w-xl pt-6 md:pt-14">
        {/* Crisp Pixel-Art Straw Hat Jolly Roger Emblem */}
        <svg
          width="88"
          height="88"
          viewBox="0 0 24 24"
          shapeRendering="crispEdges"
          className="mb-5 drop-shadow-[0_10px_22px_rgba(15,23,42,0.22)]"
          aria-hidden="true"
        >
          <rect x="4" y="1" width="16" height="22" fill="#0b172a" />
          <rect x="1" y="4" width="22" height="16" fill="#0b172a" />
          <rect x="2" y="2" width="20" height="20" fill="#0b172a" />
          <rect x="6" y="0" width="12" height="1" fill="#f5b82e" />
          <rect x="6" y="23" width="12" height="1" fill="#f5b82e" />
          <rect x="0" y="6" width="1" height="12" fill="#f5b82e" />
          <rect x="23" y="6" width="1" height="12" fill="#f5b82e" />
          <rect x="3" y="2" width="3" height="1" fill="#f5b82e" />
          <rect x="18" y="2" width="3" height="1" fill="#f5b82e" />
          <rect x="3" y="21" width="3" height="1" fill="#f5b82e" />
          <rect x="18" y="21" width="3" height="1" fill="#f5b82e" />

          <rect x="4" y="17" width="3" height="2" fill="#cbd5e1" />
          <rect x="17" y="17" width="3" height="2" fill="#cbd5e1" />
          <rect x="6" y="15" width="2" height="2" fill="#cbd5e1" />
          <rect x="16" y="15" width="2" height="2" fill="#cbd5e1" />
          <rect x="5" y="6" width="2" height="2" fill="#cbd5e1" />
          <rect x="17" y="6" width="2" height="2" fill="#cbd5e1" />

          <rect x="8" y="4" width="8" height="4" fill="#facc15" />
          <rect x="7" y="6" width="10" height="2" fill="#eab308" />
          <rect x="7" y="8" width="10" height="2" fill="#dc2626" />
          <rect x="4" y="10" width="16" height="2" fill="#facc15" />

          <rect x="7" y="12" width="10" height="5" fill="#f8fafc" />
          <rect x="8" y="17" width="8" height="3" fill="#f8fafc" />
          <rect x="8" y="13" width="2" height="2" fill="#0f172a" />
          <rect x="14" y="13" width="2" height="2" fill="#0f172a" />
          <rect x="11" y="15" width="2" height="1" fill="#0f172a" />
          <rect x="9" y="18" width="6" height="1" fill="#0f172a" />
          <rect x="11" y="17" width="1" height="3" fill="#94a3b8" />
          <rect x="13" y="17" width="1" height="3" fill="#94a3b8" />
        </svg>

        <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.26em] text-teal-700">
          Grand Line · Nuevo Mundo
        </div>

        <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl leading-[1.06] [text-wrap:balance]">
          Vivid Ocean
        </h1>

        <p className="mt-4 max-w-md text-base leading-relaxed font-medium text-slate-700">
          Crea tu propio corsario pixel art, sigue únicamente su aventura por los Cuatro Mares y el
          Grand Line, y guarda tu cuenta con Google.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-bold text-amber-800 font-mono-num">
          <span>
            {totalPirates === 0
              ? 'Sin bots · Solo tus piratas'
              : `${totalPirates} ${totalPirates === 1 ? 'pirata guardado' : 'piratas guardados'}`}
          </span>
          <span aria-hidden="true">·</span>
          <span>{totalIslands} islas canónicas</span>
          <span aria-hidden="true">·</span>
          <span>Globo 3D</span>
        </div>

        <div className="pointer-events-auto mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="rounded-lg bg-[#f5b82e] px-7 py-3.5 text-base font-extrabold tracking-wide text-slate-950 shadow-[0_10px_28px_rgba(245,184,46,0.38)] hover:bg-amber-300 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            Zarpar al Mar
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={onAuthAction}
            className="flex items-center gap-2 rounded-lg border border-sky-200 bg-white/80 backdrop-blur-md px-5 py-3.5 text-sm font-bold text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.12)] hover:border-amber-500 hover:bg-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {user ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="max-w-[160px] truncate">
                  {user.displayName || user.email || 'Cuenta Google'}
                </span>
                <LogOut className="h-3.5 w-3.5 text-slate-500 ml-1" />
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 text-amber-600" />
                <span>{authBusy ? 'Conectando...' : 'Entrar con Google'}</span>
              </>
            )}
          </button>
        </div>

        {authNotice && (
          <div
            role="status"
            className="pointer-events-auto mt-3 max-w-md rounded-lg border border-amber-400/60 bg-white/88 backdrop-blur-sm px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-md"
          >
            {authNotice}
          </div>
        )}
      </div>

      <div className="relative z-10 inline-block self-start rounded-lg bg-white/70 backdrop-blur-sm border border-sky-200/70 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
        Arrastra el globo para girar · Rueda para acercar · Enter o Espacio para zarpar
      </div>
    </div>
  );
};
