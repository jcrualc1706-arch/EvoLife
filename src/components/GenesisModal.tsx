import React, { useState } from 'react';
import {
  Dna,
  Eye,
  Flame,
  Leaf,
  Magnet,
  Play,
  Shield,
  Shuffle,
  Skull,
  Sparkles,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { audioManager } from '../game/AudioManager';
import {
  CellBodyShape,
  CellColorTheme,
  DietType,
  GenesisConfig,
  InnateTraitId,
} from '../game/types';

interface GenesisModalProps {
  onConfirmGenesis: (config: GenesisConfig) => void;
  onCancel: () => void;
}

const ABYSSAL_SPECIES_NAMES = [
  'Abyssalis Vorax',
  'Chloropyra Luminis',
  'Thalassoma Sultani',
  'Nematocella Prime',
  'Xenophora Vitrina',
  'Pyrocystis Noctiluca',
  'Bathynomus Radians',
  'Pelagica Aurelia',
  'Ciliophora Ignis',
  'Vorticella Rex',
  'Siphonophora Azurea',
  'Halocynthia Solaris',
];

const DIET_OPTIONS: Array<{
  id: DietType;
  title: string;
  subtitle: string;
  equippedOrgan: string;
  description: string;
  statsSummary: string;
  accentColor: string;
  borderClass: string;
  badgeClass: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'herbivore',
    title: 'Herbívoro',
    subtitle: 'Filtrador de Cloroplastos',
    equippedOrgan: 'Boca Filtradora (Preinstalada)',
    description:
      'Especializado en pastar entre los Árboles de Cloroplastos submarinos y absorber fitoplancton con alta eficiencia energética.',
    statsSummary: '+20% eficiencia energética vegetal · Sin daño de mordida inicial',
    accentColor: 'from-emerald-400/30 via-teal-600/25 to-emerald-950/60',
    borderClass: 'border-emerald-300/65 shadow-[0_0_22px_rgba(16,185,129,0.28)]',
    badgeClass: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40',
    icon: <Leaf className="h-5 w-5 text-emerald-300" />,
  },
  {
    id: 'carnivore',
    title: 'Carnívoro',
    subtitle: 'Depredador de Membrana',
    equippedOrgan: 'Mandíbula Aserrada (Preinstalada)',
    description:
      'Cazador activo dotado de pinzas quitinosas frontales capaces de desgarrar otras células y digerir carne celular rica en proteínas.',
    statsSummary: '+15% daño de mordida · Digiere carne celular y caza presas',
    accentColor: 'from-rose-500/30 via-red-700/25 to-rose-950/60',
    borderClass: 'border-rose-300/65 shadow-[0_0_22px_rgba(244,63,94,0.28)]',
    badgeClass: 'bg-rose-400/20 text-rose-200 border-rose-300/40',
    icon: <Skull className="h-5 w-5 text-rose-300" />,
  },
  {
    id: 'omnivore',
    title: 'Omnívoro',
    subtitle: 'Adaptable con Probóscide',
    equippedOrgan: 'Probóscide Succionadora (Preinstalada)',
    description:
      'Versatilidad trófica total mediante un estilete perforador capaz de extraer nutrientes tanto de cloroplastos como de tejido cárnico.',
    statsSummary: 'Digiere plantas y carne (+25% jugos) · +10% gasto metabólico basal',
    accentColor: 'from-amber-400/30 via-orange-600/25 to-amber-950/60',
    borderClass: 'border-amber-300/65 shadow-[0_0_22px_rgba(245,158,11,0.28)]',
    badgeClass: 'bg-amber-400/20 text-amber-200 border-amber-300/40',
    icon: <Dna className="h-5 w-5 text-amber-300" />,
  },
];

const INNATE_TRAIT_OPTIONS: Array<{
  id: InnateTraitId;
  title: string;
  effectBadge: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'elastic_membrane',
    title: 'Membrana Elástica',
    effectBadge: '-20% Daño Físico · Rebote Elástico',
    description:
      'Pared celular flexible que amortigua embestidas y mordiscos enemigos con mayor impulso de escape.',
    icon: <Shield className="h-4 w-4 text-cyan-300" />,
  },
  {
    id: 'thermophilic_cytoplasm',
    title: 'Citoplasma Termófilo',
    effectBadge: '+25% Regen Energía · +15 Energía Máx',
    description:
      'Enzimas adaptadas al calor hidrotermal que optimizan el metabolismo y amplían tus reservas bioenergéticas.',
    icon: <Flame className="h-4 w-4 text-amber-300" />,
  },
  {
    id: 'voracious_chemotaxis',
    title: 'Quimiotaxis Voraz',
    effectBadge: '+1.8m Atracción Magnética de Nutrientes',
    description:
      'Corrientes ciliares peribucales que atraen suavemente cloroplastos, carne y esporas cercanas hacia tu boca.',
    icon: <Magnet className="h-4 w-4 text-emerald-300" />,
  },
  {
    id: 'abyssal_bioluminescence',
    title: 'Bioluminiscencia Abisal',
    effectBadge: '+15% Velocidad Base · +1 Visión Abisal',
    description:
      'Orgánulos fotóforos internos que iluminan las aguas profundas e impulsan la contractilidad locomotora.',
    icon: <Eye className="h-4 w-4 text-violet-300" />,
  },
];

const BODY_SHAPES: Array<{ id: CellBodyShape; label: string }> = [
  { id: 'fusiforme', label: 'Fusiforme' },
  { id: 'esferico', label: 'Esférico' },
  { id: 'alargado', label: 'Alargado' },
];

const COLOR_THEMES: Array<{
  id: CellColorTheme;
  label: string;
  swatchClass: string;
}> = [
  { id: 'cyan', label: 'Cian Abisal', swatchClass: 'bg-cyan-400' },
  { id: 'emerald', label: 'Clorofila', swatchClass: 'bg-emerald-400' },
  { id: 'crimson', label: 'Carmesí', swatchClass: 'bg-rose-500' },
  { id: 'violet', label: 'Violeta', swatchClass: 'bg-violet-400' },
];

export const GenesisModal: React.FC<GenesisModalProps> = ({
  onConfirmGenesis,
  onCancel,
}) => {
  const [speciesName, setSpeciesName] = useState<string>('Chloropyra Luminis');
  const [initialDiet, setInitialDiet] = useState<DietType>('herbivore');
  const [innateTrait, setInnateTrait] = useState<InnateTraitId>(
    'voracious_chemotaxis'
  );
  const [bodyShape, setBodyShape] = useState<CellBodyShape>('fusiforme');
  const [colorTheme, setColorTheme] = useState<CellColorTheme>('emerald');

  const handleRandomizeName = () => {
    audioManager.playButtonClick();
    const candidates = ABYSSAL_SPECIES_NAMES.filter((n) => n !== speciesName);
    const pick =
      candidates[Math.floor(Math.random() * candidates.length)] ??
      'Abyssalis Prime';
    setSpeciesName(pick);
  };

  const handleDietSelect = (diet: DietType) => {
    audioManager.playButtonClick();
    setInitialDiet(diet);
    if (diet === 'herbivore') setColorTheme('emerald');
    else if (diet === 'carnivore') setColorTheme('crimson');
    else setColorTheme('cyan');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    audioManager.playButtonClick();
    onConfirmGenesis({
      speciesName: speciesName.trim() || 'Organismo Primigenio',
      initialDiet,
      innateTrait,
      bodyShape,
      colorTheme,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="genesis-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 pointer-events-auto overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#020d16]/80 backdrop-blur-md"
        onClick={onCancel}
        aria-hidden="true"
      />

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.93, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative z-10 my-auto w-full max-w-3xl rounded-[34px] border border-cyan-300/35 border-t-cyan-200/70 bg-gradient-to-b from-cyan-950/90 via-[#041a29]/95 to-teal-950/90 p-5 sm:p-7 backdrop-blur-2xl shadow-[0_16px_54px_rgba(2,12,22,0.85),0_0_36px_rgba(34,211,238,0.22),inset_0_1px_2px_rgba(165,243,252,0.35)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-cyan-300/20 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-500/15 px-3 py-0.5 text-[11px] font-bold tracking-wide text-cyan-200 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>GÉNESIS CELULAR · ETAPA 1 DE 5</span>
            </div>
            <h2
              id="genesis-modal-title"
              className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white"
            >
              Síntesis del Primer Organismo
            </h2>
            <p className="text-xs sm:text-sm text-cyan-100/80 mt-0.5">
              Configura el genoma fundacional de tu estirpe antes de eclosionar junto a los Árboles de Cloroplastos.
            </p>
          </div>

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onCancel();
            }}
            aria-label="Volver al menú principal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-800/60 hover:text-white cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {/* 1. Species Name & Quick Morphology */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end rounded-3xl border border-cyan-300/25 bg-[#031320]/75 p-4">
            <div className="md:col-span-6">
              <label
                htmlFor="genesis-species-name"
                className="block text-[11px] font-extrabold uppercase tracking-wider text-cyan-200/90 mb-1.5"
              >
                1. Identidad Científica de la Especie
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="genesis-species-name"
                  type="text"
                  maxLength={28}
                  value={speciesName}
                  onChange={(e) => setSpeciesName(e.target.value)}
                  onKeyDown={() => audioManager.playKeyType()}
                  placeholder="Ej. Abyssalis Vorax"
                  className="w-full rounded-full border border-cyan-300/40 bg-cyan-950/70 px-4 py-2 text-sm font-bold text-white placeholder-cyan-300/40 focus:border-amber-300 focus:outline-none"
                />
                <button
                  type="button"
                  onPointerEnter={() => audioManager.playButtonHover()}
                  onClick={handleRandomizeName}
                  title="Generar nombre científico abisal aleatorio"
                  className="flex items-center gap-1.5 rounded-full border border-cyan-300/40 bg-cyan-500/20 hover:bg-cyan-500/35 px-3.5 py-2 text-xs font-extrabold text-cyan-100 shrink-0 cursor-pointer active:scale-95 transition-all"
                >
                  <Shuffle className="h-3.5 w-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Aleatorio</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-3">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-cyan-200/90 mb-1.5">
                Morfología Base
              </span>
              <div className="grid grid-cols-2 gap-1">
                {BODY_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => {
                      audioManager.playButtonClick();
                      setBodyShape(shape.id);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold truncate cursor-pointer transition-all ${
                      bodyShape === shape.id
                        ? 'bg-cyan-300 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                        : 'bg-cyan-950/60 text-cyan-200/80 hover:text-white border border-cyan-400/20'
                    }`}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-cyan-200/90 mb-1.5">
                Pigmento Celular
              </span>
              <div className="flex items-center gap-2 py-1">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => {
                      audioManager.playButtonClick();
                      setColorTheme(theme.id);
                    }}
                    title={theme.label}
                    aria-label={theme.label}
                    className={`h-7 w-7 rounded-full ${theme.swatchClass} cursor-pointer transition-transform ${
                      colorTheme === theme.id
                        ? 'scale-115 ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                        : 'opacity-65 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 2. Selector de Dieta Inicial */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-200">
                2. Dieta Inicial (Equipa tu Órgano Bucal Fundacional Gratis)
              </span>
              <span className="text-[11px] font-semibold text-amber-200/90">
                Puedes cambiar o combinar bocas más adelante en el Editor 3D
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DIET_OPTIONS.map((option) => {
                const selected = initialDiet === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => handleDietSelect(option.id)}
                    className={`text-left rounded-3xl border p-4 transition-all cursor-pointer flex flex-col justify-between ${
                      selected
                        ? `bg-gradient-to-b ${option.accentColor} ${option.borderClass} scale-[1.01]`
                        : 'border-cyan-300/20 bg-[#031320]/65 hover:border-cyan-300/45 hover:bg-[#041b2c]/75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/15 bg-black/25">
                            {option.icon}
                          </div>
                          <div>
                            <div className="font-display text-sm font-black text-white">
                              {option.title}
                            </div>
                            <div className="text-[11px] font-semibold text-cyan-200/80">
                              {option.subtitle}
                            </div>
                          </div>
                        </div>
                        {selected && (
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase text-slate-950">
                            Activo
                          </span>
                        )}
                      </div>

                      <div
                        className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${option.badgeClass}`}
                      >
                        {option.equippedOrgan}
                      </div>

                      <p className="mt-2 text-xs text-cyan-100/85 leading-relaxed">
                        {option.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/10 text-[11px] font-bold text-amber-200/95">
                      {option.statsSummary}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Selector de Rasgo Genético Innato */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-200">
                3. Rasgo Genético Innato (Especialización Biológica Permanente)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {INNATE_TRAIT_OPTIONS.map((trait) => {
                const selected = innateTrait === trait.id;
                return (
                  <button
                    key={trait.id}
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => {
                      audioManager.playButtonClick();
                      setInnateTrait(trait.id);
                    }}
                    className={`text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
                      selected
                        ? 'border-amber-300/75 bg-gradient-to-r from-amber-500/20 via-cyan-900/50 to-teal-900/50 shadow-[0_0_18px_rgba(251,191,36,0.22)]'
                        : 'border-cyan-300/20 bg-[#031320]/65 hover:border-cyan-300/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/30">
                          {trait.icon}
                        </div>
                        <span className="font-display text-xs sm:text-sm font-extrabold text-white">
                          {trait.title}
                        </span>
                      </div>
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-950/75 px-2.5 py-0.5 text-[10px] font-bold text-amber-200">
                        {trait.effectBadge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-cyan-100/80 leading-snug">
                      {trait.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-300/20 pt-4">
          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onCancel();
            }}
            className="rounded-full border border-cyan-300/35 bg-cyan-950/60 hover:bg-cyan-900/70 px-5 py-2.5 text-xs font-bold text-cyan-100 cursor-pointer transition-all"
          >
            Cancelar
          </button>

          <button
            type="submit"
            onPointerEnter={() => audioManager.playButtonHover()}
            className="flex items-center gap-2.5 rounded-full border border-amber-100/90 bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 px-7 py-3 text-sm font-black text-slate-950 shadow-[0_6px_24px_rgba(34,211,238,0.45),inset_0_1px_2px_rgba(255,255,255,0.9)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Eclosionar en la Sopa Primigenia</span>
          </button>
        </div>
      </motion.form>
    </div>
  );
};
