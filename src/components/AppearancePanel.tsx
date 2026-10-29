import React from 'react';
import { CellBodyShape, CellColorTheme } from '../game/types';

interface AppearancePanelProps {
  speciesName: string;
  bodyShape: CellBodyShape;
  colorTheme: CellColorTheme;
  spineSegments: 1 | 2 | 3;
  onChangeSpeciesName: (name: string) => void;
  onChangeBodyShape: (shape: CellBodyShape) => void;
  onChangeColorTheme: (theme: CellColorTheme) => void;
  onChangeSpineSegments: (segments: 1 | 2 | 3) => void;
}

const BODY_SHAPES: {
  id: CellBodyShape;
  label: string;
  desc: string;
}[] = [
  { id: 'fusiforme', label: 'Fusiforme', desc: 'Hidrodinámico equilibrado' },
  { id: 'esferico', label: 'Esférico', desc: 'Membrana globular compacta' },
  { id: 'alargado', label: 'Alargado', desc: 'Perfil estilizado de caza' },
];

const COLOR_THEMES: {
  id: CellColorTheme;
  label: string;
  desc: string;
  swatchClass: string;
}[] = [
  {
    id: 'cyan',
    label: 'Cian Abisal',
    desc: 'Bioluminiscencia eléctrica',
    swatchClass:
      'bg-cyan-400 border-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.65)]',
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    desc: 'Pigmento fotosintético',
    swatchClass:
      'bg-emerald-400 border-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.65)]',
  },
  {
    id: 'crimson',
    label: 'Carmesí',
    desc: 'Coloración de depredador',
    swatchClass:
      'bg-rose-500 border-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.65)]',
  },
  {
    id: 'violet',
    label: 'Violeta',
    desc: 'Frecuencia abisal profunda',
    swatchClass:
      'bg-violet-400 border-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.65)]',
  },
];

const SPINE_OPTIONS: {
  id: 1 | 2 | 3;
  label: string;
  sublabel: string;
}[] = [
  { id: 1, label: 'Corta (1)', sublabel: 'Torso compacto (1.0x)' },
  { id: 2, label: 'Media (2)', sublabel: 'Columna media (1.28x)' },
  { id: 3, label: 'Larga (3)', sublabel: 'Vertebrada larga (1.55x)' },
];

const renderShapeSilhouette = (shape: CellBodyShape) => {
  if (shape === 'esferico') {
    return (
      <svg
        viewBox="0 0 48 32"
        className="h-8 w-12 text-current"
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="16"
          r="12"
          fill="currentColor"
          fillOpacity="0.28"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="24" cy="16" r="4" fill="currentColor" />
      </svg>
    );
  }
  if (shape === 'alargado') {
    return (
      <svg
        viewBox="0 0 48 32"
        className="h-8 w-12 text-current"
        aria-hidden="true"
      >
        <ellipse
          cx="24"
          cy="16"
          rx="20"
          ry="7.5"
          fill="currentColor"
          fillOpacity="0.28"
          stroke="currentColor"
          strokeWidth="2"
        />
        <ellipse cx="24" cy="16" rx="7" ry="3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 48 32"
      className="h-8 w-12 text-current"
      aria-hidden="true"
    >
      <ellipse
        cx="24"
        cy="16"
        rx="16"
        ry="10"
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="24" cy="16" r="4.5" fill="currentColor" />
    </svg>
  );
};

const renderSpineDiagram = (segments: 1 | 2 | 3) => {
  const circles =
    segments === 1 ? [24] : segments === 2 ? [17, 31] : [12, 24, 36];
  return (
    <svg
      viewBox="0 0 48 24"
      className="h-6 w-12 text-current"
      aria-hidden="true"
    >
      <line
        x1={circles[0]}
        y1="12"
        x2={circles[circles.length - 1]}
        y2="12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {circles.map((cx) => (
        <circle
          key={cx}
          cx={cx}
          cy="12"
          r="4.5"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
};

export const AppearancePanel: React.FC<AppearancePanelProps> = React.memo(
  ({
    speciesName,
    bodyShape,
    colorTheme,
    spineSegments,
    onChangeSpeciesName,
    onChangeBodyShape,
    onChangeColorTheme,
    onChangeSpineSegments,
  }) => {
    return (
      <div className="space-y-5 p-5">
        {/* 1. Species Name with Character Counter */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <label
              htmlFor="species-name-input"
              className="font-bold text-cyan-100"
            >
              Nombre de la especie
            </label>
            <span className="font-mono text-xs tabular-nums text-cyan-200/80">
              {speciesName.length} / 28
            </span>
          </div>
          <input
            id="species-name-input"
            type="text"
            maxLength={28}
            value={speciesName}
            onChange={(e) => onChangeSpeciesName(e.target.value)}
            placeholder="Ej. Organismo Primigenio"
            className="w-full rounded-full border border-cyan-300/35 bg-[#031521]/85 px-4 py-2.5 text-sm font-bold text-white placeholder-cyan-300/40 focus:border-cyan-200 focus:outline-none"
          />
        </div>

        {/* 2. Body Shape Selector with Mini SVG Silhouettes */}
        <div>
          <div className="mb-2 text-xs font-bold text-cyan-100">
            Forma corporal
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {BODY_SHAPES.map((shape) => {
              const active = bodyShape === shape.id;
              return (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => onChangeBodyShape(shape.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-3xl border p-3 text-center cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 ${
                    active
                      ? 'border-cyan-200/80 border-t-white/80 bg-gradient-to-b from-cyan-400/30 to-teal-900/55 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                      : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-300/50 hover:text-white'
                  }`}
                >
                  {renderShapeSilhouette(shape.id)}
                  <span className="font-display text-xs font-extrabold text-white">
                    {shape.label}
                  </span>
                  <span className="text-xs text-cyan-200/75 leading-tight">
                    {shape.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Pigmentation Swatches */}
        <div>
          <div className="mb-2 text-xs font-bold text-cyan-100">
            Pigmentación bioluminiscente
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {COLOR_THEMES.map((theme) => {
              const active = colorTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onChangeColorTheme(theme.id)}
                  className={`flex items-center gap-3 rounded-full border p-3 text-left cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 ${
                    active
                      ? 'border-cyan-200/80 bg-gradient-to-b from-cyan-400/30 to-teal-900/60 text-white shadow-md'
                      : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-300/50 hover:text-white'
                  }`}
                >
                  <span
                    className={`h-6 w-6 shrink-0 rounded-full border-2 ${theme.swatchClass}`}
                  />
                  <div className="min-w-0">
                    <div className="font-display text-xs font-extrabold text-white truncate">
                      {theme.label}
                    </div>
                    <div className="text-xs text-cyan-200/75 truncate">
                      {theme.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Spine Column Segments (1, 2, 3) */}
        <div>
          <div className="mb-2 text-xs font-bold text-cyan-100">
            Columna vertebral (longitud axial 3D)
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {SPINE_OPTIONS.map((seg) => {
              const active = spineSegments === seg.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => onChangeSpineSegments(seg.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-3xl border p-3 text-center cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 ${
                    active
                      ? 'border-amber-300/80 bg-gradient-to-b from-amber-400/25 to-amber-900/50 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.2)]'
                      : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-300/50 hover:text-white'
                  }`}
                >
                  {renderSpineDiagram(seg.id)}
                  <span className="font-display text-xs font-extrabold text-white">
                    {seg.label}
                  </span>
                  <span className="text-xs text-cyan-200/75 leading-tight">
                    {seg.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

AppearancePanel.displayName = 'AppearancePanel';
