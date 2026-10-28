import React from 'react';
import {
  CheckCircle2,
  Dna,
  Footprints,
  Lock,
  Palette,
  Play,
  Shapes,
  Shield,
  Sparkles,
  Wind,
  Zap,
} from 'lucide-react';
import {
  CellBodyShape,
  CellColorTheme,
  CellularEvolutionSlot,
  EvolutionCategory,
  PlayerStats,
} from '../game/types';

interface CreatureEditorModalProps {
  stats: PlayerStats;
  slots: CellularEvolutionSlot[];
  readyForLandTransition: boolean;
  onUnlockSlot: (slotId: string) => void;
  onRefundSlot: (slotId: string) => void;
  onChangeSpeciesName: (name: string) => void;
  onChangeBodyShape: (shape: CellBodyShape) => void;
  onChangeColorTheme: (theme: CellColorTheme) => void;
  onEvolveToCreatureStage: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<EvolutionCategory, string> = {
  locomocion: 'Locomoción',
  metabolismo: 'Metabolismo',
  defensa: 'Defensa y Combate',
};

const BODY_SHAPES: { id: CellBodyShape; label: string; desc: string }[] = [
  { id: 'fusiforme', label: 'Fusiforme', desc: 'Hidrodinámico equilibrado' },
  { id: 'esferico', label: 'Esférico', desc: 'Membrana globular compacta' },
  { id: 'alargado', label: 'Alargado', desc: 'Perfil estilizado de caza' },
];

const COLOR_THEMES: {
  id: CellColorTheme;
  label: string;
  swatchClass: string;
}[] = [
  { id: 'cyan', label: 'Cian', swatchClass: 'bg-cyan-400 border-cyan-200' },
  {
    id: 'emerald',
    label: 'Esmeralda',
    swatchClass: 'bg-emerald-400 border-emerald-200',
  },
  {
    id: 'crimson',
    label: 'Carmesí',
    swatchClass: 'bg-rose-500 border-rose-200',
  },
  {
    id: 'violet',
    label: 'Violeta',
    swatchClass: 'bg-violet-400 border-violet-200',
  },
];

export const CreatureEditorModal: React.FC<CreatureEditorModalProps> = ({
  stats,
  slots,
  readyForLandTransition,
  onUnlockSlot,
  onRefundSlot,
  onChangeSpeciesName,
  onChangeBodyShape,
  onChangeColorTheme,
  onEvolveToCreatureStage,
  onClose,
}) => {
  const unlockedCount = slots.filter((s) => s.unlocked).length;
  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';

  const stageLabel = isCreatureStage
    ? 'Estadio de Criatura Terrestre · Cuadrúpedo Anfibio'
    : stats.growthStage === 3
    ? 'Fase 3/3 · Organismo Macrocelular'
    : stats.growthStage === 2
    ? 'Fase 2/3 · Célula Desarrollada'
    : 'Fase 1/3 · Microcélula';

  const renderCategoryIcon = (category: EvolutionCategory) => {
    switch (category) {
      case 'locomocion':
        return <Wind className="h-4 w-4 text-cyan-400" />;
      case 'metabolismo':
        return <Zap className="h-4 w-4 text-emerald-400" />;
      case 'defensa':
        return <Shield className="h-4 w-4 text-amber-400" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
      className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between lg:flex-row lg:items-stretch p-3 sm:p-5"
    >
      {/* Left Side: Unobstructed 3D Live Creature Inspection Viewport Badge */}
      <div className="pointer-events-none flex flex-col justify-between lg:w-[42%] xl:w-[46%] p-2">
        <div className="pointer-events-auto inline-flex max-w-md flex-col gap-1.5 rounded-xl border border-cyan-500/30 bg-[#041524]/85 px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>Vista de Inspección 3D en Tiempo Real</span>
          </div>
          <div className="font-display text-lg font-bold text-white">
            {stats.speciesName || 'Organismo Primigenio'}
          </div>
          <p className="text-xs text-slate-300">
            Observa tu criatura respirar y articular sus órganos en vivo mientras personalizas su forma, color y adaptaciones.
          </p>
        </div>

        {/* Terrestrial Creature Stage Transition Card on Bottom-Left */}
        <div className="pointer-events-auto mt-3 max-w-md rounded-xl border border-amber-400/40 bg-[#061c2e]/92 p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-950/70 text-amber-300">
                <Footprints className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {isCreatureStage
                    ? 'Estadio de Criatura Terrestre Activo'
                    : readyForLandTransition
                    ? '¡Cerebro Primitivo Completado!'
                    : 'Salto Evolutivo Terrestre'}
                </div>
                <p className="text-xs text-slate-300">
                  {isCreatureStage
                    ? '4 extremidades articuladas activas · Nido Costero en (0,0) · Canto Social (Tecla C)'
                    : readyForLandTransition
                    ? 'Tu macrocélula está lista para desarrollar 4 patas anfibias y salir a la Costa Terrestre.'
                    : `Alcanza Fase 3 y 200 ADN totales (${stats.totalAdnEarned}/200 ADN) o inicia la transición ahora.`}
                </p>
              </div>
            </div>
          </div>

          {!isCreatureStage && (
            <button
              type="button"
              onClick={onEvolveToCreatureStage}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                readyForLandTransition
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg'
                  : 'border border-amber-400/50 bg-amber-950/70 text-amber-200 hover:bg-amber-900/80'
              }`}
            >
              <Footprints className="h-4 w-4" />
              <span>
                {readyForLandTransition
                  ? '¡Evolucionar a Criatura Terrestre Ahora!'
                  : 'Evolucionar a Criatura Terrestre (Desarrollar 4 Patas)'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Right Side: Docked Genetic & Morphological Editor Panel */}
      <div className="pointer-events-auto flex max-h-[88vh] lg:max-h-full w-full lg:w-[58%] xl:w-[54%] flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#051829]/95 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-pink-400/40 bg-pink-950/70 text-pink-300">
              <Dna className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="editor-modal-title"
                className="font-display text-xl font-bold text-white"
              >
                Editor Genético y Morfológico 3D
              </h2>
              <p className="text-xs text-pink-200/90">{stageLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2">
            <div>
              <div className="text-[11px] text-slate-400">ADN Disponible</div>
              <div className="font-mono text-lg font-bold tabular-nums text-amber-300">
                {stats.adn}{' '}
                <span className="text-xs font-normal text-amber-200/80">
                  ADN
                </span>
              </div>
            </div>
            <div className="border-l border-slate-800 pl-3.5">
              <div className="text-[11px] text-slate-400">Órganos</div>
              <div className="font-mono text-sm font-bold tabular-nums text-cyan-300">
                {unlockedCount} / {slots.length}
              </div>
            </div>
          </div>
        </div>

        {/* Morphology Customization Bar: Species Name, Body Shape, and Bioluminescent Color */}
        <div className="grid grid-cols-1 gap-3 border-b border-slate-800 bg-slate-950/50 px-5 py-3.5 sm:grid-cols-3">
          {/* Species Name Input */}
          <div>
            <label
              htmlFor="species-name-input"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-300"
            >
              Nombre de la Especie
            </label>
            <input
              id="species-name-input"
              type="text"
              maxLength={28}
              value={stats.speciesName}
              onChange={(e) => onChangeSpeciesName(e.target.value)}
              placeholder="Ej.Organismo Primigenio"
              className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Body Shape Selector */}
          <div>
            <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              <Shapes className="h-3.5 w-3.5 text-cyan-400" />
              <span>Forma Corporal</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {BODY_SHAPES.map((shape) => {
                const active = stats.bodyShape === shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    title={shape.desc}
                    onClick={() => onChangeBodyShape(shape.id)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {shape.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bioluminescent Color Theme Selector */}
          <div>
            <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              <Palette className="h-3.5 w-3.5 text-pink-400" />
              <span>Pigmentación</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {COLOR_THEMES.map((theme) => {
                const active = stats.colorTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onChangeColorTheme(theme.id)}
                    className={`flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'border-white bg-slate-800 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full border ${theme.swatchClass}`}
                    />
                    <span className="truncate">{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body: 8 Evolution Slots Grid */}
        <div className="grid grid-cols-1 gap-3.5 overflow-y-auto p-5 sm:grid-cols-2">
          {slots.map((slot) => {
            const canAfford = !slot.unlocked && stats.adn >= slot.costAdn;

            return (
              <div
                key={slot.id}
                className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                  slot.unlocked
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : canAfford
                    ? 'border-cyan-400/40 bg-slate-900/90'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                      {renderCategoryIcon(slot.category)}
                      {CATEGORY_LABELS[slot.category]}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {slot.unlocked ? (
                        <span className="text-emerald-400">Instalada</span>
                      ) : canAfford ? (
                        <span className="text-amber-300">
                          Disponible · {slot.costAdn} ADN
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Requiere {slot.costAdn} ADN
                        </span>
                      )}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-white">
                    {slot.name}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    {slot.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                  <div className="mb-2.5 text-[11px] font-mono font-medium text-cyan-300">
                    Efecto: {slot.statSummary}
                  </div>

                  {slot.unlocked ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-2 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Activo</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRefundSlot(slot.id)}
                        className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-900/80 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Quitar (+{slot.costAdn} ADN)
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onUnlockSlot(slot.id)}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                        canAfford
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                          : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Evolucionar ({slot.costAdn} ADN)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          <span>Faltan {slot.costAdn - stats.adn} ADN</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/70 px-5 py-3.5">
          <div className="text-xs text-slate-400">
            Dieta:{' '}
            <span className="font-semibold text-amber-300">
              {stats.diet === 'omnivore'
                ? 'Omnívoro'
                : stats.diet === 'carnivore'
                ? 'Carnívoro'
                : 'Herbívoro'}
            </span>
            <span className="mx-2">·</span>
            Vida Máx:{' '}
            <span className="font-mono font-semibold text-emerald-400 tabular-nums">
              {stats.maxHealth}
            </span>
            <span className="mx-2">·</span>
            Energía Máx:{' '}
            <span className="font-mono font-semibold text-cyan-400 tabular-nums">
              {stats.maxEnergy}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Volver al Ecosistema (E)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
