import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Crosshair,
  Dna,
  Eye,
  Flame,
  Footprints,
  GripHorizontal,
  Hammer,
  Hand,
  Heart,
  Info,
  Music,
  Palette,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Shield,
  Skull,
  Sparkles,
  Trash2,
  Undo2,
  Utensils,
  Wind,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { audioManager } from '../game/AudioManager';
import {
  MAX_CREATURE_COMPLEXITY,
  computeCreatureComplexity,
  computeCreatureStats,
  computeStackedMultiplier,
  getOrganComplexityCost,
  isArmAdaptation,
  isCellOnlyAdaptation,
  isFootAdaptation,
  isHandAdaptation,
  isLegAdaptation,
  isMouthAdaptation,
  normalizeAdaptationId,
} from '../game/evolutionData';
import {
  AdaptationCategory,
  BodySegmentConfig,
  BodySegmentId,
  BODY_SEGMENT_ORDER,
  CellBodyShape,
  CellColorTheme,
  CellularEvolutionSlot,
  CoatPatternType,
  CreatureBodyArchetype,
  CreatureMorphologySliders,
  CreaturePaintConfig,
  DEFAULT_CREATURE_MORPHOLOGY,
  DEFAULT_CREATURE_PAINT,
  DEFAULT_CREATURE_STATS,
  EditorPreviewAction,
  EditorSelectionTarget,
  MORPHOLOGY_SCALE_LIMITS,
  PlacedOrganMorphology,
  PlayerStats,
  SkinTextureType,
  createDefaultBodySegments,
} from '../game/types';

const CREATURE_ARCHETYPES: Array<{
  id: CreatureBodyArchetype;
  label: string;
  shortLabel: string;
  desc: string;
}> = [
  {
    id: 'bipedo_agil',
    label: 'Bípedo Ágil / Terópodo',
    shortLabel: 'Bípedo',
    desc: 'Torso estilizado de velocista con cuello erguido y cola de contrapeso',
  },
  {
    id: 'cuadrupedo_robusto',
    label: 'Cuadrúpedo Robusto / Saurópodo',
    shortLabel: 'Cuadrúpedo',
    desc: 'Cuerpo macizo, lomo ancho y soporte pesado para 4 extremidades',
  },
  {
    id: 'reptiliano_rastreador',
    label: 'Reptiliano Bajo / Rastreador',
    shortLabel: 'Reptiliano',
    desc: 'Perfil aplanado y bajo, centro de gravedad pegado al suelo',
  },
  {
    id: 'humanoide_erguido',
    label: 'Antropomorfo / Erguido',
    shortLabel: 'Erguido',
    desc: 'Torso vertical con hombros elevados para brazos prensiles',
  },
  {
    id: 'serpentino',
    label: 'Gusanoide / Serpentino',
    shortLabel: 'Serpentino',
    desc: 'Cuerpo largo, flexible y estilizado para locomoción sinuosa',
  },
];

function getSlotSporeStatBadges(
  slot: CellularEvolutionSlot,
  symmetryEnabled: boolean
): Array<{ label: string; colorClass: string }> {
  const badges: Array<{ label: string; colorClass: string }> = [];
  const cs = computeCreatureStats((id) => (id === slot.id ? 1 : 0));
  const baseCs = computeCreatureStats(() => 0);

  if (cs.speed > baseCs.speed)
    badges.push({
      label: `Velocidad Nv.${cs.speed}`,
      colorClass: 'border-sky-300/50 bg-sky-500/20 text-sky-100',
    });
  if (cs.jump > baseCs.jump)
    badges.push({
      label: `Salto Nv.${cs.jump}`,
      colorClass: 'border-sky-300/50 bg-sky-500/20 text-sky-100',
    });
  if (cs.health > baseCs.health)
    badges.push({
      label: `Salud +${cs.health - baseCs.health}`,
      colorClass: 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100',
    });
  if (cs.sneak > baseCs.sneak)
    badges.push({
      label: `Sigilo Nv.${cs.sneak}`,
      colorClass: 'border-purple-300/50 bg-purple-500/20 text-purple-100',
    });
  if (
    cs.sight > baseCs.sight ||
    slot.id === 'eye_photoreceptor' ||
    slot.id === 'eye_stalks'
  )
    badges.push({
      label: `Visión Nv.${cs.sight}`,
      colorClass: 'border-amber-300/50 bg-amber-500/20 text-amber-100',
    });
  if (cs.bite > baseCs.bite)
    badges.push({
      label: `Mordisco Nv.${cs.bite}`,
      colorClass: 'border-rose-300/50 bg-rose-500/20 text-rose-100',
    });
  if (cs.charge > baseCs.charge)
    badges.push({
      label: `Embestida Nv.${cs.charge}`,
      colorClass: 'border-rose-300/50 bg-rose-500/20 text-rose-100',
    });
  if (cs.strike > baseCs.strike)
    badges.push({
      label: `Zarpazo Nv.${cs.strike}`,
      colorClass: 'border-rose-300/50 bg-rose-500/20 text-rose-100',
    });
  if (cs.spit > baseCs.spit)
    badges.push({
      label: `Veneno Nv.${cs.spit}`,
      colorClass: 'border-lime-300/50 bg-lime-500/20 text-lime-100',
    });
  if (cs.sing > baseCs.sing)
    badges.push({
      label: `Canto Nv.${cs.sing}`,
      colorClass: 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100',
    });
  if (cs.dance > baseCs.dance)
    badges.push({
      label: `Baile Nv.${cs.dance}`,
      colorClass: 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100',
    });
  if (cs.charm > baseCs.charm)
    badges.push({
      label: `Fascinar Nv.${cs.charm}`,
      colorClass: 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100',
    });
  if (cs.pose > baseCs.pose)
    badges.push({
      label: `Posa Nv.${cs.pose}`,
      colorClass: 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100',
    });
  if (cs.hasGraspers || isHandAdaptation(slot.id))
    badges.push({
      label: 'Agarre Tribal',
      colorClass: 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100',
    });

  const compCost = getOrganComplexityCost(slot.id, symmetryEnabled);
  badges.push({
    label: `Compl. +${compCost}`,
    colorClass: 'border-cyan-300/40 bg-cyan-950/75 text-cyan-200',
  });
  return badges;
}

interface CreatureEditorModalProps {
  stats: PlayerStats;
  slots: CellularEvolutionSlot[];
  readyForLandTransition: boolean;
  selectedPlacedInstanceId: string | null;
  selectedBodySegmentId?: BodySegmentId | null;
  selectedSphereIndex?: number | null;
  editorSelectionTarget?: EditorSelectionTarget;
  canUndo?: boolean;
  canRedo?: boolean;
  editorPreviewAction?: EditorPreviewAction;
  onUnlockSlot: (slotId: string) => void;
  onRefundSlot: (slotId: string) => void;
  onStartCatalogDrag: (slotId: string) => void;
  onSelectPlacedOrgan: (instanceId: string | null) => void;
  onSelectBodySegment?: (segmentId: BodySegmentId | null) => void;
  onSelectBodySphere?: (sphereIndex: number | null) => void;
  onAdjustBodySphereRadius?: (sphereIndex: number, delta: number) => void;
  onAdjustLimbThickness?: (limbId: string, delta: number) => void;
  onSelectEditorTarget?: (target: EditorSelectionTarget) => void;
  onUpdateBodySegment?: (
    segmentId: BodySegmentId,
    partial: Partial<BodySegmentConfig>
  ) => void;
  onRemovePlacedOrgan: (instanceId: string) => void;
  onUpdatePlacedOrganMorphology: (
    instanceId: string,
    partialMorphology: Partial<PlacedOrganMorphology>
  ) => void;
  onUpdatePlacedOrganOrientation: (
    instanceId: string,
    yaw: number,
    pitch: number
  ) => void;
  onResetPlacedOrganMorphology: (instanceId: string) => void;
  onChangeSpeciesName: (name: string) => void;
  onChangeBodyShape: (shape: CellBodyShape) => void;
  onChangeColorTheme: (theme: CellColorTheme) => void;
  onChangeSpineSegments?: (segments: 1 | 2 | 3) => void;
  onSetSpineLength: (length: number) => void;
  onSetTorsoRadius: (segmentIndex: 0 | 1 | 2, radius: number) => void;
  onSetVertebraCount: (count: number) => void;
  onApplySpinePosturePreset: (
    preset: 'quadruped' | 'biped_upright' | 'predator_arch' | 'serpentine'
  ) => void;
  onUpdateCreatureMorphology?: (
    partial: Partial<CreatureMorphologySliders>
  ) => void;
  onUpdatePaintConfig: (partial: Partial<CreaturePaintConfig>) => void;
  onToggleSymmetry: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSetEditorPreviewAction?: (action: EditorPreviewAction) => void;
  onEvolveToCreatureStage: () => void;
  onRotateEditorCamera: (deltaRadians: number) => void;
  onClose: () => void;
}

const COAT_COLOR_PALETTE: Array<{ id: string; label: string; hex: string }> = [
  { id: 'cyan', label: 'Cian', hex: '#06b6d4' },
  { id: 'emerald', label: 'Esmeralda', hex: '#10b981' },
  { id: 'lime', label: 'Lima', hex: '#84cc16' },
  { id: 'gold', label: 'Oro', hex: '#eab308' },
  { id: 'tiger', label: 'Naranja Tigre', hex: '#f97316' },
  { id: 'crimson', label: 'Carmesí', hex: '#f43f5e' },
  { id: 'violet', label: 'Violeta', hex: '#a855f7' },
  { id: 'cobalt', label: 'Cobalto', hex: '#3b82f6' },
  { id: 'ivory', label: 'Marfil', hex: '#f8fafc' },
  { id: 'obsidian', label: 'Obsidiana', hex: '#1e293b' },
];

const QUICK_COAT_PRESETS: Array<{
  id: string;
  label: string;
  config: CreaturePaintConfig;
}> = [
  {
    id: 'bengal_tiger',
    label: 'Tigre Bengala',
    config: {
      baseColor: '#f97316',
      skinTexture: 'smooth',
      patternType: 'tiger_stripes',
      patternPrimaryColor: '#1e293b',
      patternSecondaryColor: '#fef08a',
      patternOpacity: 0.85,
      detailColor: '#fef3c7',
    },
  },
  {
    id: 'abyssal_leopard',
    label: 'Leopardo Abisal',
    config: {
      baseColor: '#06b6d4',
      skinTexture: 'smooth',
      patternType: 'leopard_spots',
      patternPrimaryColor: '#0f172a',
      patternSecondaryColor: '#67e8f9',
      patternOpacity: 0.82,
      detailColor: '#fde047',
    },
  },
  {
    id: 'emerald_raptor',
    label: 'Raptor Esmeralda',
    config: {
      baseColor: '#10b981',
      skinTexture: 'reptilian_scales',
      patternType: 'dorsal_gradient',
      patternPrimaryColor: '#064e3b',
      patternSecondaryColor: '#a7f3d0',
      patternOpacity: 0.8,
      detailColor: '#fef08a',
    },
  },
  {
    id: 'chitin_beetle',
    label: 'Quitina Real',
    config: {
      baseColor: '#1e293b',
      skinTexture: 'matte_chitin',
      patternType: 'tiger_stripes',
      patternPrimaryColor: '#eab308',
      patternSecondaryColor: '#f97316',
      patternOpacity: 0.78,
      detailColor: '#facc15',
    },
  },
  {
    id: 'volcanic_drake',
    label: 'Draco Volcánico',
    config: {
      baseColor: '#f43f5e',
      skinTexture: 'reptilian_scales',
      patternType: 'pale_belly',
      patternPrimaryColor: '#fde047',
      patternSecondaryColor: '#fb923c',
      patternOpacity: 0.85,
      detailColor: '#1e293b',
    },
  },
  {
    id: 'nebula_stalker',
    label: 'Acechador Violeta',
    config: {
      baseColor: '#a855f7',
      skinTexture: 'smooth',
      patternType: 'leopard_spots',
      patternPrimaryColor: '#f472b6',
      patternSecondaryColor: '#22d3ee',
      patternOpacity: 0.8,
      detailColor: '#f8fafc',
    },
  },
];

const SKIN_TEXTURE_OPTIONS: Array<{
  id: SkinTextureType;
  label: string;
  desc: string;
}> = [
  { id: 'smooth', label: 'Piel Lisa Anfibia', desc: 'Brillo húmedo orgánico' },
  {
    id: 'reptilian_scales',
    label: 'Escamas Reptilianas',
    desc: 'Relieve dérmico escamoso',
  },
  { id: 'matte_chitin', label: 'Quitina Mate', desc: 'Exoesqueleto coriáceo' },
];

const COAT_PATTERN_OPTIONS: Array<{
  id: CoatPatternType;
  label: string;
}> = [
  { id: 'none', label: 'Sin Patrón' },
  { id: 'tiger_stripes', label: 'Rayas de Tigre' },
  { id: 'leopard_spots', label: 'Motas de Leopardo' },
  { id: 'dorsal_gradient', label: 'Degradado Dorsal' },
  { id: 'pale_belly', label: 'Vientre Pálido' },
];

const ORGAN_PIGMENT_SWATCHES: Array<{
  id: string;
  label: string;
  hex?: string;
  bgClass: string;
}> = [
  {
    id: 'default',
    label: 'Original',
    hex: undefined,
    bgClass:
      'bg-gradient-to-br from-cyan-300 via-teal-500 to-slate-800 border-dashed',
  },
  {
    id: 'cyan',
    label: 'Cian',
    hex: '#22d3ee',
    bgClass: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.75)]',
  },
  {
    id: 'emerald',
    label: 'Clorofila',
    hex: '#34d399',
    bgClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]',
  },
  {
    id: 'amber',
    label: 'Ámbar',
    hex: '#fbbf24',
    bgClass: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]',
  },
  {
    id: 'crimson',
    label: 'Carmesí',
    hex: '#fb7185',
    bgClass: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.75)]',
  },
  {
    id: 'violet',
    label: 'Abisal',
    hex: '#c084fc',
    bgClass: 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.75)]',
  },
  {
    id: 'lime',
    label: 'Tóxico',
    hex: '#a3e635',
    bgClass: 'bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.75)]',
  },
  {
    id: 'pearl',
    label: 'Nacarado',
    hex: '#e2e8f0',
    bgClass: 'bg-slate-100 shadow-[0_0_8px_rgba(248,250,252,0.75)]',
  },
];

type WorkshopTabId = AdaptationCategory;

interface CategoryTabConfig {
  id: WorkshopTabId;
  label: string;
  shortLabel: string;
  icon: typeof Utensils;
}

const CELL_WORKSHOP_TABS: CategoryTabConfig[] = [
  {
    id: 'alimentacion',
    label: 'Alimentación',
    shortLabel: 'Bocas',
    icon: Utensils,
  },
  {
    id: 'ataque',
    label: 'Ataque',
    shortLabel: 'Ataque',
    icon: Crosshair,
  },
  {
    id: 'defensa',
    label: 'Defensa',
    shortLabel: 'Defensa',
    icon: Shield,
  },
  {
    id: 'movimiento',
    label: 'Movimiento',
    shortLabel: 'Motor',
    icon: Wind,
  },
  {
    id: 'sentidos',
    label: 'Sentidos',
    shortLabel: 'Visión',
    icon: Eye,
  },
  {
    id: 'metabolismo',
    label: 'Metabolismo',
    shortLabel: 'Bio',
    icon: Flame,
  },
  {
    id: 'apariencia',
    label: 'Pintura y Forma',
    shortLabel: 'Columna',
    icon: Palette,
  },
];

const CREATURE_WORKSHOP_TABS: CategoryTabConfig[] = [
  {
    id: 'alimentacion',
    label: 'Bocas',
    shortLabel: 'Bocas',
    icon: Utensils,
  },
  {
    id: 'sentidos',
    label: 'Ojos y Sentidos',
    shortLabel: 'Ojos',
    icon: Eye,
  },
  {
    id: 'piernas',
    label: 'Piernas',
    shortLabel: 'Piernas',
    icon: Footprints,
  },
  {
    id: 'pies',
    label: 'Pies y Pezuñas',
    shortLabel: 'Pies',
    icon: Footprints,
  },
  {
    id: 'brazos',
    label: 'Brazos',
    shortLabel: 'Brazos',
    icon: GripHorizontal,
  },
  {
    id: 'manos',
    label: 'Manos y Garras',
    shortLabel: 'Manos',
    icon: Hand,
  },
  {
    id: 'ataque',
    label: 'Armas y Adornos',
    shortLabel: 'Armas y Adornos',
    icon: Crosshair,
  },
];

const BODY_SHAPES: { id: CellBodyShape; label: string; desc: string }[] = [
  {
    id: 'fusiforme',
    label: 'Fusiforme',
    desc: 'Hidrodinámica equilibrada',
  },
  {
    id: 'esferico',
    label: 'Esférico',
    desc: 'Torso ancho y robusto',
  },
  {
    id: 'alargado',
    label: 'Alargado',
    desc: 'Perfil estilizado veloz',
  },
];

const COLOR_THEMES: {
  id: CellColorTheme;
  label: string;
  swatchClass: string;
  ringClass: string;
}[] = [
  {
    id: 'cyan',
    label: 'Cian Abisal',
    swatchClass: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.75)]',
    ringClass:
      'border-cyan-300/75 border-t-white/70 bg-gradient-to-b from-cyan-400/30 to-cyan-950/60 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.3)]',
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    swatchClass: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]',
    ringClass:
      'border-emerald-300/75 border-t-white/70 bg-gradient-to-b from-emerald-400/30 to-emerald-950/60 text-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.3)]',
  },
  {
    id: 'crimson',
    label: 'Carmesí',
    swatchClass: 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.75)]',
    ringClass:
      'border-rose-300/75 border-t-white/70 bg-gradient-to-b from-rose-400/30 to-rose-950/60 text-rose-100 shadow-[0_0_14px_rgba(251,113,133,0.3)]',
  },
  {
    id: 'violet',
    label: 'Violeta',
    swatchClass: 'bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.75)]',
    ringClass:
      'border-purple-300/75 border-t-white/70 bg-gradient-to-b from-purple-400/30 to-purple-950/60 text-purple-100 shadow-[0_0_14px_rgba(192,132,252,0.3)]',
  },
];

const MEMBRANE_PANEL_CLASS =
  'border border-cyan-300/30 border-t-cyan-200/55 bg-gradient-to-b from-cyan-950/70 via-[#041a29]/80 to-teal-950/75 backdrop-blur-xl shadow-[0_8px_32px_rgba(4,25,41,0.5),0_0_15px_rgba(34,211,238,0.15),inset_0_1px_2px_rgba(165,243,252,0.22)]';

/**
 * Custom SVG 3D-style miniature icon for each biological adaptation in the Spore palette.
 * Locked adaptations display as a dormant fossilized embryo under a translucent dark membrane.
 */
export function OrganThumbnail({
  slotId,
  locked,
}: {
  slotId: string;
  locked: boolean;
}) {
  if (locked) {
    return (
      <div
        title="Fósil o embrión genético latente"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 border-t-amber-300/25 bg-gradient-to-b from-[#062436]/80 via-[#03131e]/90 to-[#020c14]/95 shadow-[inset_0_2px_6px_rgba(0,0,0,0.75)]"
      >
        {/* Dormant Fossilized Embryo / Ammonite Spiral SVG */}
        <svg viewBox="0 0 40 40" className="h-7 w-7 opacity-65">
          <circle
            cx="20"
            cy="20"
            r="14"
            fill="rgba(20, 184, 166, 0.08)"
            stroke="rgba(251, 191, 36, 0.35)"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
          <path
            d="M22,20 C22,17.5 19,16.5 17.5,18.5 C15.5,21 17.5,25 21,25 C25.5,25 28,20.5 26.5,16 C24.5,10.5 17.5,9.5 13.5,13.5 C9.5,17.5 10.5,25.5 16,28.5"
            fill="none"
            stroke="rgba(251, 191, 36, 0.55)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="20.5" cy="20" r="2.2" fill="rgba(52, 211, 153, 0.55)" />
        </svg>
        {/* Subtle dark membrane sheen */}
        <div className="pointer-events-none absolute inset-x-2 top-1 h-1.5 rounded-full bg-white/10" />
      </div>
    );
  }

  const id = normalizeAdaptationId(slotId);

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/40 border-t-cyan-100/65 bg-gradient-to-b from-cyan-900/50 via-[#031624]/90 to-teal-950/85 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_0_12px_rgba(34,211,238,0.18)]">
      {/* Top bubble highlight */}
      <div className="pointer-events-none absolute inset-x-2 top-1 h-1 rounded-full bg-white/25" />
      <svg viewBox="0 0 40 40" className="h-8 w-8 overflow-visible">
        {id === 'chitin_spike' && (
          <g>
            <ellipse cx="20" cy="31" rx="9" ry="3.5" fill="#b45309" />
            <polygon points="20,5 13,30 27,30" fill="#fde047" stroke="#f59e0b" strokeWidth="1.5" />
            <polygon points="12,19 8,28 15,27" fill="#fbbf24" />
            <polygon points="28,19 32,28 25,27" fill="#fbbf24" />
          </g>
        )}
        {id === 'poison_gland' && (
          <g>
            <circle cx="20" cy="24" r="10" fill="#84cc16" fillOpacity="0.75" stroke="#bef264" strokeWidth="1.5" />
            <circle cx="20" cy="24" r="5" fill="#d9f99d" />
            <rect x="17" y="10" width="6" height="8" rx="1.5" fill="#65a30d" stroke="#bef264" strokeWidth="1.2" />
            <circle cx="16" cy="6" r="2" fill="#bef264" />
            <circle cx="23" cy="4" r="1.5" fill="#d9f99d" />
          </g>
        )}
        {id === 'mouth_jaw' && (
          <g>
            <path d="M12,32 C7,20 10,10 18,7 L19,15 L15,22 Z" fill="#fda4af" stroke="#e11d48" strokeWidth="1.5" />
            <path d="M28,32 C33,20 30,10 22,7 L21,15 L25,22 Z" fill="#fda4af" stroke="#e11d48" strokeWidth="1.5" />
            <rect x="12" y="29" width="16" height="5" rx="2" fill="#9f1239" />
          </g>
        )}
        {id === 'mouth_filter' && (
          <g>
            <path d="M9,26 A11,9 0 0,1 31,26" fill="none" stroke="#2dd4bf" strokeWidth="3" />
            <line x1="12" y1="22" x2="10" y2="10" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="19" x2="15" y2="8" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="18" x2="20" y2="7" stroke="#99f6e4" strokeWidth="2" strokeLinecap="round" />
            <line x1="24" y1="19" x2="25" y2="8" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" />
            <line x1="28" y1="22" x2="30" y2="10" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {id === 'mouth_proboscis' && (
          <g>
            <polygon points="16,33 24,33 22,11 18,11" fill="#fef08a" stroke="#10b981" strokeWidth="1.5" />
            <ellipse cx="20" cy="10" rx="4.5" ry="2.2" fill="none" stroke="#34d399" strokeWidth="2" />
            <polygon points="20,3 18,10 22,10" fill="#10b981" />
          </g>
        )}
        {id === 'simple_flagellum' && (
          <g>
            <ellipse cx="20" cy="8" rx="6" ry="2.5" fill="#14b8a6" />
            <path d="M20,10 Q27,16 19,22 T21,35" fill="none" stroke="#5eead4" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        {id === 'hydro_siphon' && (
          <g>
            <polygon points="12,10 28,10 24,26 16,26" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
            <polygon points="17,27 23,27 20,37" fill="#67e8f9" fillOpacity="0.8" />
          </g>
        )}
        {id === 'cilia_waves' && (
          <g>
            <rect x="9" y="27" width="22" height="5" rx="2.5" fill="#0891b2" />
            <path d="M12,27 Q15,17 11,9" fill="none" stroke="#67e8f9" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M17,27 Q20,17 16,9" fill="none" stroke="#67e8f9" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M23,27 Q26,17 22,9" fill="none" stroke="#67e8f9" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M28,27 Q31,17 27,9" fill="none" stroke="#67e8f9" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        )}
        {id === 'electric_cell' && (
          <g>
            <circle cx="20" cy="25" r="8" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
            <polygon points="20,7 15,15 25,15" fill="#facc15" />
            <path d="M10,12 L15,16 L11,20" fill="none" stroke="#fef08a" strokeWidth="1.8" />
            <path d="M30,12 L25,16 L29,20" fill="none" stroke="#67e8f9" strokeWidth="1.8" />
          </g>
        )}
        {id === 'eye_photoreceptor' && (
          <g>
            <circle cx="20" cy="20" r="11" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
            <circle cx="20" cy="18" r="6.5" fill="#0ea5e9" />
            <circle cx="20" cy="17.5" r="3.5" fill="#020617" />
            <circle cx="22" cy="15.5" r="1.4" fill="#ffffff" />
          </g>
        )}
        {id === 'eye_stalks' && (
          <g>
            <path d="M20,35 Q16,25 20,16" fill="none" stroke="#06b6d4" strokeWidth="4" strokeLinecap="round" />
            <circle cx="20" cy="12" r="7.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
            <circle cx="20" cy="11" r="4.2" fill="#10b981" />
            <circle cx="20" cy="10.5" r="2.2" fill="#020617" />
          </g>
        )}
        {id === 'membrane_armor' && (
          <g>
            <polygon points="20,7 31,13 31,26 20,32 9,26 9,13" fill="#4f46e5" stroke="#a5b4fc" strokeWidth="1.8" />
            <polygon points="20,12 26,16 26,23 20,27 14,23 14,16" fill="#818cf8" />
          </g>
        )}
        {id === 'neutralizer_vesicle' && (
          <g>
            <circle cx="20" cy="20" r="11" fill="#14b8a6" fillOpacity="0.6" stroke="#5eead4" strokeWidth="1.8" />
            <circle cx="17" cy="18" r="3.5" fill="#99f6e4" />
            <circle cx="24" cy="22" r="2.5" fill="#ccfbf1" />
          </g>
        )}
        {id === 'chemoreceptor' && (
          <g>
            <path d="M18,33 Q14,20 9,10" fill="none" stroke="#10b981" strokeWidth="2.5" />
            <path d="M22,33 Q26,20 31,10" fill="none" stroke="#10b981" strokeWidth="2.5" />
            <circle cx="9" cy="10" r="3" fill="#fde047" />
            <circle cx="31" cy="10" r="3" fill="#fde047" />
          </g>
        )}
        {id === 'chloroplast_1' && (
          <g>
            <ellipse cx="20" cy="20" rx="11" ry="7" transform="rotate(-25 20 20)" fill="#16a34a" stroke="#4ade80" strokeWidth="1.8" />
            <circle cx="17" cy="21" r="2.5" fill="#bbf7d0" />
            <circle cx="23" cy="18" r="2.5" fill="#bbf7d0" />
          </g>
        )}
        {(id === 'vocal_crest' ||
          id === 'grasping_arms' ||
          id === 'wings_1' ||
          id === 'acid_spit') && (
          <g>
            <circle cx="20" cy="20" r="10" fill="#0e7490" stroke="#38bdf8" strokeWidth="1.6" />
            <circle cx="20" cy="20" r="4.5" fill="#67e8f9" />
          </g>
        )}
        {/* === 25 NUEVAS ADAPTACIONES === */}
        {id === 'mouth_radula' && (
          <g>
            <path d="M10,28 C12,14 28,14 30,28 Z" fill="#b45309" stroke="#fbbf24" strokeWidth="1.5" />
            <polygon points="15,18 17,12 19,18" fill="#fef3c7" />
            <polygon points="19,17 21,11 23,17" fill="#fef3c7" />
            <polygon points="23,18 25,12 27,18" fill="#fef3c7" />
          </g>
        )}
        {id === 'mouth_suction_cup' && (
          <g>
            <circle cx="20" cy="20" r="11" fill="#ec4899" fillOpacity="0.4" stroke="#f472b6" strokeWidth="2.5" />
            <circle cx="20" cy="20" r="6" fill="#be185d" stroke="#fbcfe8" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="2.5" fill="#500724" />
          </g>
        )}
        {id === 'mouth_crusher_mandibles' && (
          <g>
            <path d="M11,32 C5,18 11,8 19,8 L18,16 L15,20 L18,24 Z" fill="#991b1b" stroke="#f87171" strokeWidth="1.5" />
            <path d="M29,32 C35,18 29,8 21,8 L22,16 L25,20 L22,24 Z" fill="#991b1b" stroke="#f87171" strokeWidth="1.5" />
            <rect x="11" y="29" width="18" height="5" rx="2" fill="#450a0a" />
          </g>
        )}
        {id === 'mouth_filter_baleen' && (
          <g>
            <path d="M7,27 Q20,17 33,27" fill="none" stroke="#0d9488" strokeWidth="3" />
            <line x1="9" y1="24" x2="7" y2="10" stroke="#99f6e4" strokeWidth="1.8" />
            <line x1="14" y1="22" x2="13" y2="8" stroke="#99f6e4" strokeWidth="1.8" />
            <line x1="20" y1="21" x2="20" y2="7" stroke="#ccfbf1" strokeWidth="2" />
            <line x1="26" y1="22" x2="27" y2="8" stroke="#99f6e4" strokeWidth="1.8" />
            <line x1="31" y1="24" x2="33" y2="10" stroke="#99f6e4" strokeWidth="1.8" />
          </g>
        )}
        {id === 'mouth_needle_proboscis' && (
          <g>
            <ellipse cx="20" cy="29" rx="7" ry="4.5" fill="#9f1239" stroke="#fb7185" strokeWidth="1.5" />
            <polygon points="18,26 22,26 20,4" fill="#ffe4e6" stroke="#f43f5e" strokeWidth="1.2" />
            <circle cx="20" cy="6" r="2" fill="#e11d48" />
          </g>
        )}
        {id === 'weapon_harpoon_cell' && (
          <g>
            <rect x="15" y="20" width="10" height="12" rx="3" fill="#0e7490" stroke="#22d3ee" strokeWidth="1.5" />
            <line x1="20" y1="20" x2="20" y2="7" stroke="#67e8f9" strokeWidth="2" strokeDasharray="2 1" />
            <polygon points="20,3 15,11 25,11" fill="#a5f3fc" />
          </g>
        )}
        {id === 'weapon_rotary_drill' && (
          <g>
            <polygon points="20,4 11,31 29,31" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            <line x1="16" y1="14" x2="24" y2="17" stroke="#38bdf8" strokeWidth="2" />
            <line x1="14" y1="21" x2="26" y2="24" stroke="#38bdf8" strokeWidth="2" />
            <line x1="12" y1="28" x2="28" y2="30" stroke="#38bdf8" strokeWidth="2" />
          </g>
        )}
        {id === 'weapon_caustic_acid_blister' && (
          <g>
            <circle cx="17" cy="23" r="8" fill="#a3e635" fillOpacity="0.8" stroke="#ecfccb" strokeWidth="1.5" />
            <circle cx="25" cy="18" r="6" fill="#84cc16" fillOpacity="0.85" stroke="#bef264" strokeWidth="1.5" />
            <circle cx="18" cy="12" r="3" fill="#d9f99d" />
          </g>
        )}
        {id === 'weapon_flash_photophore' && (
          <g>
            <circle cx="20" cy="20" r="8" fill="#fef08a" stroke="#38bdf8" strokeWidth="2" />
            <line x1="20" y1="4" x2="20" y2="9" stroke="#ffffff" strokeWidth="2" />
            <line x1="20" y1="31" x2="20" y2="36" stroke="#ffffff" strokeWidth="2" />
            <line x1="4" y1="20" x2="9" y2="20" stroke="#ffffff" strokeWidth="2" />
            <line x1="31" y1="20" x2="36" y2="20" stroke="#ffffff" strokeWidth="2" />
          </g>
        )}
        {id === 'weapon_tail_club' && (
          <g>
            <rect x="18" y="6" width="4" height="14" fill="#78350f" />
            <circle cx="20" cy="25" r="8" fill="#b45309" stroke="#fbbf24" strokeWidth="1.5" />
            <polygon points="10,25 14,22 14,28" fill="#fef3c7" />
            <polygon points="30,25 26,22 26,28" fill="#fef3c7" />
            <polygon points="20,35 17,31 23,31" fill="#fef3c7" />
          </g>
        )}
        {id === 'defense_silica_spicules' && (
          <g>
            <line x1="20" y1="5" x2="20" y2="35" stroke="#bae6fd" strokeWidth="2.2" />
            <line x1="5" y1="20" x2="35" y2="20" stroke="#bae6fd" strokeWidth="2.2" />
            <line x1="9" y1="9" x2="31" y2="31" stroke="#e0f2fe" strokeWidth="1.8" />
            <line x1="31" y1="9" x2="9" y2="31" stroke="#e0f2fe" strokeWidth="1.8" />
          </g>
        )}
        {id === 'defense_mucus_gland' && (
          <g>
            <path d="M20,7 C28,15 30,27 20,33 C10,27 12,15 20,7 Z" fill="#a855f7" fillOpacity="0.65" stroke="#e9d5ff" strokeWidth="1.6" />
            <circle cx="17" cy="23" r="3" fill="#f3e8ff" fillOpacity="0.8" />
          </g>
        )}
        {id === 'defense_hydrothermal_carapace' && (
          <g>
            <polygon points="20,6 32,14 29,31 11,31 8,14" fill="#292524" stroke="#f97316" strokeWidth="2" />
            <path d="M13,18 L20,13 L27,18 L24,27 L16,27 Z" fill="none" stroke="#fb923c" strokeWidth="1.5" />
          </g>
        )}
        {id === 'defense_chitin_shield_plate' && (
          <g>
            <path d="M8,15 C14,8 26,8 32,15 L29,28 C23,23 17,23 11,28 Z" fill="#d97706" stroke="#fde68a" strokeWidth="1.8" />
          </g>
        )}
        {id === 'defense_camouflage_chromatophores' && (
          <g>
            <circle cx="14" cy="16" r="5" fill="#22d3ee" fillOpacity="0.75" />
            <circle cx="26" cy="17" r="4.5" fill="#a855f7" fillOpacity="0.75" />
            <circle cx="20" cy="26" r="6" fill="#34d399" fillOpacity="0.75" />
          </g>
        )}
        {id === 'movement_ribbon_fin' && (
          <g>
            <path d="M7,20 Q13,10 20,20 T33,20" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
            <path d="M7,26 Q13,16 20,26 T33,26" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {id === 'movement_macro_cilia_skirt' && (
          <g>
            <path d="M9,26 Q20,22 31,26" fill="none" stroke="#0284c7" strokeWidth="3.5" />
            <line x1="10" y1="24" x2="6" y2="11" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="23" x2="14" y2="9" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="24" y1="23" x2="26" y2="9" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="30" y1="24" x2="34" y2="11" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}
        {id === 'movement_whip_flagella' && (
          <g>
            <ellipse cx="20" cy="8" rx="6" ry="2.5" fill="#0d9488" />
            <path d="M17,10 Q9,19 16,27 T12,36" fill="none" stroke="#5eead4" strokeWidth="3" strokeLinecap="round" />
            <path d="M23,10 Q31,19 24,27 T28,36" fill="none" stroke="#5eead4" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        {id === 'movement_pneumatic_vesicle' && (
          <g>
            <ellipse cx="20" cy="20" rx="11" ry="8" fill="#7dd3fc" fillOpacity="0.45" stroke="#bae6fd" strokeWidth="1.8" />
            <ellipse cx="20" cy="20" rx="6" ry="4" fill="#e0f2fe" fillOpacity="0.8" />
          </g>
        )}
        {id === 'movement_reactive_nozzle' && (
          <g>
            <polygon points="11,9 29,9 24,24 16,24" fill="#334155" stroke="#38bdf8" strokeWidth="1.6" />
            <polygon points="15,25 25,25 20,38" fill="#22d3ee" />
          </g>
        )}
        {id === 'sense_stalk_compound_eye' && (
          <g>
            <path d="M20,35 Q17,24 20,16" fill="none" stroke="#0891b2" strokeWidth="3.5" />
            <circle cx="20" cy="12" r="7" fill="#ec4899" stroke="#f9a8d4" strokeWidth="1.5" />
            <circle cx="18" cy="10" r="1.5" fill="#fbcfe8" />
            <circle cx="22" cy="10" r="1.5" fill="#fbcfe8" />
            <circle cx="20" cy="14" r="1.5" fill="#fbcfe8" />
          </g>
        )}
        {id === 'sense_antenna_chemoreceptor' && (
          <g>
            <path d="M18,34 Q10,19 8,8" fill="none" stroke="#f97316" strokeWidth="2.2" />
            <path d="M22,34 Q30,19 32,8" fill="none" stroke="#f97316" strokeWidth="2.2" />
            <circle cx="8" cy="8" r="2.8" fill="#fef08a" />
            <circle cx="32" cy="8" r="2.8" fill="#fef08a" />
          </g>
        )}
        {id === 'sense_electro_sensor_pores' && (
          <g>
            <path d="M8,24 Q20,14 32,24" fill="none" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
            <circle cx="12" cy="21" r="2.2" fill="#38bdf8" />
            <circle cx="20" cy="18" r="2.5" fill="#fde047" />
            <circle cx="28" cy="21" r="2.2" fill="#38bdf8" />
          </g>
        )}
        {id === 'sense_lateral_line_vibrissae' && (
          <g>
            <line x1="8" y1="26" x2="32" y2="26" stroke="#0284c7" strokeWidth="3" />
            <line x1="12" y1="26" x2="10" y2="12" stroke="#bae6fd" strokeWidth="1.8" />
            <line x1="20" y1="26" x2="20" y2="10" stroke="#e0f2fe" strokeWidth="1.8" />
            <line x1="28" y1="26" x2="30" y2="12" stroke="#bae6fd" strokeWidth="1.8" />
          </g>
        )}
        {id === 'sense_abyssal_biolum_probe' && (
          <g>
            <path d="M16,34 Q15,16 25,11" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
            <circle cx="27" cy="11" r="5.5" fill="#fef08a" stroke="#22d3ee" strokeWidth="1.8" />
          </g>
        )}
        {/* === 16 NUEVAS EXTREMIDADES TERRESTRES (PIERNAS, BRAZOS, MANOS, PIES) === */}
        {id === 'leg_insectoid' && (
          <g>
            <circle cx="14" cy="10" r="3.5" fill="#b45309" />
            <polyline
              points="14,10 27,16 16,28 24,35"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="27" cy="16" r="2.5" fill="#fde68a" />
            <circle cx="16" cy="28" r="2.2" fill="#fde68a" />
          </g>
        )}
        {id === 'leg_digitigrade' && (
          <g>
            <ellipse cx="16" cy="12" rx="5.5" ry="4" transform="rotate(25 16 12)" fill="#0d9488" stroke="#5eead4" strokeWidth="1.4" />
            <path d="M18,14 L25,22 L17,31 L24,34" fill="none" stroke="#2dd4bf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="25" cy="22" r="2.6" fill="#99f6e4" />
          </g>
        )}
        {id === 'leg_plantigrade' && (
          <g>
            <rect x="13" y="7" width="11" height="12" rx="4.5" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
            <rect x="14" y="18" width="9" height="11" rx="3.5" fill="#0284c7" stroke="#7dd3fc" strokeWidth="1.4" />
            <ellipse cx="20" cy="32" rx="8" ry="3.2" fill="#38bdf8" />
          </g>
        )}
        {id === 'leg_ungulate' && (
          <g>
            <ellipse cx="17" cy="11" rx="5" ry="3.8" fill="#a16207" stroke="#facc15" strokeWidth="1.4" />
            <line x1="18" y1="14" x2="22" y2="29" stroke="#eab308" strokeWidth="3.5" strokeLinecap="round" />
            <polygon points="17,35 27,35 25,29 19,29" fill="#1c1917" stroke="#fde047" strokeWidth="1.3" />
          </g>
        )}
        {id === 'leg_reptilian' && (
          <g>
            <ellipse cx="15" cy="13" rx="6.5" ry="4.5" fill="#15803d" stroke="#4ade80" strokeWidth="1.5" />
            <path d="M19,15 L26,24 L20,33" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points="24,11 28,15 23,16" fill="#bbf7d0" />
            <polygon points="27,19 31,23 26,24" fill="#bbf7d0" />
          </g>
        )}
        {id === 'arm_slender' && (
          <g>
            <circle cx="11" cy="18" r="3.5" fill="#0891b2" />
            <path d="M11,18 Q20,12 29,21" fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="20" cy="15" r="2.4" fill="#a5f3fc" />
            <circle cx="29" cy="21" r="2.8" fill="#67e8f9" />
          </g>
        )}
        {id === 'arm_brawny' && (
          <g>
            <ellipse cx="14" cy="16" rx="6" ry="4.5" fill="#be123c" stroke="#fda4af" strokeWidth="1.5" />
            <ellipse cx="25" cy="22" rx="6.5" ry="4.8" transform="rotate(20 25 22)" fill="#e11d48" stroke="#fecdd3" strokeWidth="1.5" />
            <circle cx="31" cy="26" r="3" fill="#ffe4e6" />
          </g>
        )}
        {id === 'arm_praying' && (
          <g>
            <polyline
              points="10,24 19,12 28,24"
              fill="none"
              stroke="#65a30d"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M28,24 L17,33 L23,21 Z" fill="#ecfccb" stroke="#84cc16" strokeWidth="1.3" />
          </g>
        )}
        {id === 'arm_patagium' && (
          <g>
            <path d="M8,16 L31,11 L24,31 Q15,25 8,16 Z" fill="#38bdf8" fillOpacity="0.45" stroke="#7dd3fc" strokeWidth="1.5" />
            <polyline points="8,16 20,13 31,11" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        {id === 'arm_armored' && (
          <g>
            <polygon points="10,14 23,11 26,22 14,25" fill="#b45309" stroke="#fde68a" strokeWidth="1.6" />
            <polygon points="21,18 32,20 29,30 19,27" fill="#d97706" stroke="#fef3c7" strokeWidth="1.5" />
          </g>
        )}
        {id === 'hand_primate' && (
          <g>
            <ellipse cx="20" cy="24" rx="6.5" ry="5.5" fill="#0ea5e9" stroke="#bae6fd" strokeWidth="1.5" />
            <line x1="11" y1="22" x2="7" y2="17" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="18" x2="14" y2="9" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="17" x2="20" y2="8" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="24" y1="18" x2="26" y2="9" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="27" y1="21" x2="31" y2="14" stroke="#7dd3fc" strokeWidth="2.3" strokeLinecap="round" />
          </g>
        )}
        {id === 'hand_talons' && (
          <g>
            <ellipse cx="20" cy="26" rx="6.5" ry="4.5" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.4" />
            <polygon points="13,23 9,8 17,21" fill="#fef2f2" stroke="#f87171" strokeWidth="1" />
            <polygon points="20,21 20,6 24,21" fill="#fef2f2" stroke="#f87171" strokeWidth="1" />
            <polygon points="27,23 31,8 23,21" fill="#fef2f2" stroke="#f87171" strokeWidth="1" />
          </g>
        )}
        {id === 'hand_insect_claw' && (
          <g>
            <circle cx="20" cy="28" r="5" fill="#991b1b" stroke="#f87171" strokeWidth="1.5" />
            <path d="M17,25 C8,18 10,8 18,7 L19,15 L16,20 Z" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.4" />
            <path d="M23,25 C32,18 30,8 22,7 L21,15 L24,20 Z" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.4" />
          </g>
        )}
        {id === 'foot_paw' && (
          <g>
            <ellipse cx="20" cy="25" rx="7.5" ry="5.5" fill="#0d9488" stroke="#5eead4" strokeWidth="1.5" />
            <circle cx="12" cy="15" r="2.8" fill="#99f6e4" />
            <circle cx="17.5" cy="12.5" r="2.8" fill="#99f6e4" />
            <circle cx="23" cy="12.5" r="2.8" fill="#99f6e4" />
            <circle cx="28" cy="15" r="2.8" fill="#99f6e4" />
          </g>
        )}
        {id === 'foot_hoof' && (
          <g>
            <polygon points="10,30 17,12 20,12 18,30" fill="#292524" stroke="#fde047" strokeWidth="1.5" />
            <polygon points="30,30 23,12 20,12 22,30" fill="#292524" stroke="#fde047" strokeWidth="1.5" />
            <rect x="13" y="9" width="14" height="4" rx="2" fill="#ca8a04" />
          </g>
        )}
        {id === 'foot_webbed' && (
          <g>
            <polygon points="20,29 7,12 20,15 33,12" fill="#38bdf8" fillOpacity="0.55" stroke="#7dd3fc" strokeWidth="1.4" />
            <line x1="20" y1="29" x2="9" y2="12" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="29" x2="20" y2="10" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="29" x2="31" y2="12" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function CreatureEditorModal({
  stats,
  slots,
  readyForLandTransition,
  selectedPlacedInstanceId,
  selectedBodySegmentId = null,
  selectedSphereIndex = null,
  editorSelectionTarget = 'body',
  canUndo = false,
  canRedo = false,
  editorPreviewAction = 'idle',
  onUnlockSlot,
  onRefundSlot,
  onStartCatalogDrag,
  onSelectPlacedOrgan,
  onSelectBodySegment,
  onSelectBodySphere,
  onAdjustBodySphereRadius,
  onAdjustLimbThickness,
  onSelectEditorTarget,
  onUpdateBodySegment,
  onRemovePlacedOrgan,
  onUpdatePlacedOrganMorphology,
  onUpdatePlacedOrganOrientation,
  onResetPlacedOrganMorphology,
  onChangeSpeciesName,
  onChangeBodyShape,
  onChangeColorTheme,
  onSetSpineLength,
  onSetTorsoRadius,
  onSetVertebraCount,
  onApplySpinePosturePreset,
  onUpdateCreatureMorphology,
  onUpdatePaintConfig,
  onToggleSymmetry,
  onUndo,
  onRedo,
  onSetEditorPreviewAction,
  onEvolveToCreatureStage,
  onRotateEditorCamera,
  onClose,
}: CreatureEditorModalProps) {
  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';
  const creatureMorphology: CreatureMorphologySliders =
    stats.creatureMorphology ?? DEFAULT_CREATURE_MORPHOLOGY;
  const activeArchetypeInfo =
    CREATURE_ARCHETYPES.find((a) => a.id === creatureMorphology.archetype) ??
    CREATURE_ARCHETYPES[0];
  const [editorMode, setEditorMode] = useState<
    'build' | 'paint' | 'test_drive'
  >('build');
  const [activeTab, setActiveTab] = useState<WorkshopTabId>(
    isCreatureStage ? 'piernas' : 'ataque'
  );
  const [inspectedSlotId, setInspectedSlotId] = useState<string>(
    isCreatureStage ? 'leg_digitigrade' : 'chitin_spike'
  );
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [crawlWarningAcknowledged, setCrawlWarningAcknowledged] =
    useState(false);
  const [isQuickInspectHeld, setIsQuickInspectHeld] = useState(false);
  const [isQuickInspectPinned, setIsQuickInspectPinned] = useState(false);
  const showQuickInspect = isQuickInspectHeld || isQuickInspectPinned;

  // Listen for 'I' key hold for Quick Stat Breakdown Inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.code === 'KeyI' || e.key === 'i' || e.key === 'I') {
        setIsQuickInspectHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyI' || e.key === 'i' || e.key === 'I') {
        setIsQuickInspectHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const activeWorkshopTabs = isCreatureStage
    ? CREATURE_WORKSHOP_TABS
    : CELL_WORKSHOP_TABS;

  const paintConfig: CreaturePaintConfig =
    stats.paintConfig ?? DEFAULT_CREATURE_PAINT;
  const spineNodeCount = stats.spineNodes?.length ?? 5;
  const symmetryEnabled = stats.symmetryEnabled ?? true;

  const complexityScore = useMemo(() => {
    if (typeof stats.complexityScore === 'number') {
      return stats.complexityScore;
    }
    return computeCreatureComplexity(spineNodeCount, stats.placedOrgans);
  }, [stats.complexityScore, spineNodeCount, stats.placedOrgans]);

  const maxComplexity = stats.maxComplexity ?? MAX_CREATURE_COMPLEXITY;
  const complexityPct = Math.min(
    100,
    Math.round((complexityScore / Math.max(1, maxComplexity)) * 100)
  );

  // Ensure activeTab is valid when switching to Creature Stage
  useEffect(() => {
    if (
      isCreatureStage &&
      (activeTab === 'movimiento' ||
        activeTab === 'metabolismo' ||
        activeTab === 'apariencia')
    ) {
      setActiveTab('piernas');
      setInspectedSlotId('leg_digitigrade');
    }
  }, [isCreatureStage, activeTab]);

  // Clear validation error when organs change
  useEffect(() => {
    if (validationError) {
      setValidationError(null);
    }
    setCrawlWarningAcknowledged(false);
  }, [stats.placedOrgans]);

  // Find selected placed organ instance if any
  const selectedPlacedInstance = useMemo(() => {
    if (!selectedPlacedInstanceId) return null;
    return (
      stats.placedOrgans.find(
        (o) => o.instanceId === selectedPlacedInstanceId
      ) ?? null
    );
  }, [stats.placedOrgans, selectedPlacedInstanceId]);

  const selectedIsLimb = useMemo(() => {
    if (!selectedPlacedInstance) return false;
    return (
      isLegAdaptation(selectedPlacedInstance.adaptationId) ||
      isArmAdaptation(selectedPlacedInstance.adaptationId)
    );
  }, [selectedPlacedInstance]);

  const selectedLimbId = useMemo(() => {
    if (selectedPlacedInstance) {
      const norm = normalizeAdaptationId(selectedPlacedInstance.adaptationId);
      if (
        isLegAdaptation(norm) ||
        isFootAdaptation(norm) ||
        isArmAdaptation(norm) ||
        isHandAdaptation(norm)
      ) {
        return selectedPlacedInstance.instanceId;
      }
    }
    if (editorSelectionTarget === 'legs') return 'legs';
    if (editorSelectionTarget === 'arms') return 'arms';
    return null;
  }, [selectedPlacedInstance, editorSelectionTarget]);

  const bodySegments = useMemo(
    () =>
      stats.bodySegments && stats.bodySegments.length === 5
        ? stats.bodySegments
        : createDefaultBodySegments(),
    [stats.bodySegments]
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY === 0) return;
    const direction = e.deltaY < 0 ? 1 : -1;

    // 1. Si hay una esfera del cuerpo seleccionada -> Escalar solo su radio dentro de los límites
    if (selectedSphereIndex !== null) {
      const delta = direction * MORPHOLOGY_SCALE_LIMITS.bodySegment.step;
      onAdjustBodySphereRadius?.(selectedSphereIndex, delta);
      return;
    }

    // 2. Si hay una extremidad seleccionada (pata o brazo) -> Escalar dentro de sus límites
    if (selectedLimbId !== null) {
      const delta = direction * MORPHOLOGY_SCALE_LIMITS.limbThickness.step;
      onAdjustLimbThickness?.(selectedLimbId, delta);
      return;
    }

    // 3. Si hay otro órgano externo seleccionado
    if (selectedPlacedInstance) {
      const curScale = selectedPlacedInstance.morphology?.scaleOverall ?? 1.0;
      const nextScale = Math.min(
        MORPHOLOGY_SCALE_LIMITS.organScale.max,
        Math.max(
          MORPHOLOGY_SCALE_LIMITS.organScale.min,
          curScale + direction * MORPHOLOGY_SCALE_LIMITS.organScale.step
        )
      );
      onUpdatePlacedOrganMorphology(selectedPlacedInstance.instanceId, {
        scaleOverall: nextScale,
      });
    }
  };

  // Keep inspector synced when user clicks a 3D organ on the cell
  useEffect(() => {
    if (selectedPlacedInstance) {
      setInspectedSlotId(
        normalizeAdaptationId(selectedPlacedInstance.adaptationId)
      );
    }
  }, [selectedPlacedInstance]);

  // Track pointer position while dragging a catalog piece for floating cursor badge
  useEffect(() => {
    if (!draggingSlotId) return;
    const handleMove = (e: PointerEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });
    };
    const handleUp = () => {
      setDraggingSlotId(null);
      setPointerPos(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingSlotId]);

  // Filter catalog slots for current tab (retiring strictly cellular parts in Creature Stage)
  const filteredSlots = useMemo(() => {
    if (activeTab === 'apariencia') return [];
    return slots.filter((slot) => {
      if (isCreatureStage) {
        if (isCellOnlyAdaptation(slot.id)) {
          return false;
        }
        if (activeTab === 'ataque') {
          return slot.category === 'ataque' || slot.category === 'defensa';
        }
        return slot.category === activeTab;
      } else {
        if (slot.stage === 'creature_stage') {
          return false;
        }
        return slot.category === activeTab;
      }
    });
  }, [slots, activeTab, isCreatureStage]);

  const inspectedSlot = useMemo(() => {
    return (
      slots.find((s) => s.id === inspectedSlotId) ??
      filteredSlots[0] ??
      slots[0] ??
      null
    );
  }, [slots, inspectedSlotId, filteredSlots]);

  const creatureStats = useMemo(() => {
    if (stats.creatureStats) return stats.creatureStats;
    const getStacks = (id: string) =>
      slots.find((s) => s.id === id)?.installedStacks ?? 0;
    return computeCreatureStats(getStacks) ?? DEFAULT_CREATURE_STATS;
  }, [stats.creatureStats, slots]);

  // Compute speed & turn rating for Top-Right Attributes Panel (Cellular Stage)
  const { speedRatingPct, turnRatingPct } = useMemo(() => {
    const getStacks = (id: string) =>
      slots.find((s) => s.id === id)?.installedStacks ?? 0;

    const flagStacks = getStacks('simple_flagellum');
    const whipFlagStacks = getStacks('movement_whip_flagella');
    const ciliaStacks = getStacks('cilia_waves');
    const macroCiliaStacks = getStacks('movement_macro_cilia_skirt');
    const ribbonFinStacks = getStacks('movement_ribbon_fin');
    const nozzleStacks = getStacks('movement_reactive_nozzle');
    const siphonStacks = getStacks('hydro_siphon');
    const armorStacks = getStacks('membrane_armor');
    const spikeStacks = getStacks('chitin_spike');
    const crusherStacks = getStacks('mouth_crusher_mandibles');
    const baleenStacks = getStacks('mouth_filter_baleen');
    const tailClubStacks = getStacks('weapon_tail_club');
    const hydroCarapaceStacks = getStacks('defense_hydrothermal_carapace');

    const flagFactor =
      flagStacks === 0 && whipFlagStacks === 0
        ? 0.85
        : flagStacks === 1 && whipFlagStacks === 0
        ? 1.0
        : 1.0 +
          0.25 * computeStackedMultiplier(Math.max(0, flagStacks - 1)) +
          0.35 * computeStackedMultiplier(whipFlagStacks);
    const netSpeed = Math.max(
      0.55,
      flagFactor +
        0.08 * computeStackedMultiplier(ciliaStacks) +
        0.18 * computeStackedMultiplier(macroCiliaStacks) +
        0.15 * computeStackedMultiplier(ribbonFinStacks) +
        (siphonStacks > 0 ? 0.1 : 0) +
        (nozzleStacks > 0 ? 0.15 : 0) -
        0.05 * armorStacks -
        0.03 * spikeStacks -
        0.08 * crusherStacks -
        0.06 * baleenStacks -
        0.12 * hydroCarapaceStacks
    );
    const netTurn = Math.max(
      0.5,
      1.0 +
        0.35 * computeStackedMultiplier(ciliaStacks) +
        0.5 * computeStackedMultiplier(macroCiliaStacks) +
        0.2 * computeStackedMultiplier(ribbonFinStacks) +
        (flagStacks >= 2 ? 0.15 : 0) -
        0.12 * whipFlagStacks -
        0.08 * tailClubStacks -
        0.15 * nozzleStacks
    );

    return {
      speedRatingPct: Math.round(netSpeed * 100),
      turnRatingPct: Math.round(netTurn * 100),
    };
  }, [slots]);

  const dietBadge =
    stats.diet === 'carnivore'
      ? {
          label: 'Carnívoro',
          cls: 'border-rose-300/50 bg-rose-500/20 text-rose-100',
        }
      : stats.diet === 'omnivore'
      ? {
          label: 'Omnívoro',
          cls: 'border-amber-300/50 bg-amber-500/20 text-amber-100',
        }
      : {
          label: 'Herbívoro',
          cls: 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100',
        };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Taller Evolutivo 3D de EvoLife"
    >
      {/* Floating Drag Cursor Bubble Badge when dragging a piece from the Left Palette */}
      {draggingSlotId && pointerPos && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/85 bg-gradient-to-b from-cyan-400/35 via-[#041a29]/90 to-teal-900/85 px-4 py-1.5 text-xs font-extrabold text-cyan-50 backdrop-blur-md shadow-[0_0_24px_rgba(34,211,238,0.55)]"
          style={{ left: pointerPos.x, top: pointerPos.y - 24 }}
        >
          {isCreatureStage
            ? 'Suelta sobre el torso 3D o muñeca/tobillo distal'
            : 'Suelta sobre la membrana de tu célula 3D'}
        </div>
      )}

      {/* MAIN PERIPHERAL WORKSPACE: Left Palette + 60% Open Center + Right Dual Panels */}
      <div className="pointer-events-none flex min-h-0 flex-1 items-stretch justify-between gap-4 overflow-hidden">
        {/* ==================== 1. LEFT PANEL: ORGANIC SPORE PART PALETTE (~356px) ==================== */}
        <aside
          className={`pointer-events-auto flex w-[328px] sm:w-[360px] shrink-0 flex-col overflow-hidden rounded-[28px] ${MEMBRANE_PANEL_CLASS}`}
        >
          {/* Palette Header + Top Mode Switcher ([ Construir ] / [ Pintar ] / [ Probar ]) */}
          <div className="border-b border-cyan-300/20 px-3.5 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-200/60 bg-gradient-to-b from-cyan-300/35 to-teal-700/40 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                  <Dna className="h-4 w-4" />
                </div>
                <h2 className="truncate font-display text-xs sm:text-sm font-extrabold tracking-wide text-white uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                  {isCreatureStage ? 'Editor Spore 3D' : 'Taller 3D'}
                </h2>
              </div>

              <div className="flex items-center gap-1">
                {/* Undo / Redo Buttons [Ctrl+Z / Ctrl+Y] */}
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={() => onUndo?.()}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                    canUndo
                      ? 'border-cyan-300/60 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/35 cursor-pointer active:scale-90'
                      : 'border-cyan-500/15 bg-cyan-950/40 text-cyan-300/30 cursor-not-allowed'
                  }`}
                  title="Deshacer última acción [Ctrl+Z]"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={() => onRedo?.()}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                    canRedo
                      ? 'border-cyan-300/60 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/35 cursor-pointer active:scale-90'
                      : 'border-cyan-500/15 bg-cyan-950/40 text-cyan-300/30 cursor-not-allowed'
                  }`}
                  title="Rehacer acción [Ctrl+Y]"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>

                {/* Quick Stat Breakdown Inspector Toggle [I] */}
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    setIsQuickInspectPinned((prev) => !prev);
                  }}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                    showQuickInspect
                      ? 'border-amber-200/85 bg-amber-400/30 text-amber-50 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                      : 'border-cyan-300/35 bg-cyan-950/60 text-cyan-200/80 hover:text-white'
                  }`}
                  title="Desglose rápido de estadísticas Spore por pieza (Mantén pulsada la tecla [I] o haz clic)"
                >
                  <Info className="h-3 w-3" />
                  <span>[I]</span>
                </button>

                {/* Symmetry Toggle Button [Tab / A] */}
                <button
                  type="button"
                  onPointerEnter={() => audioManager.playButtonHover()}
                  onClick={() => {
                    audioManager.playButtonClick();
                    onToggleSymmetry();
                  }}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                    symmetryEnabled
                      ? 'border-cyan-200/80 bg-cyan-400/25 text-cyan-50 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                      : 'border-amber-300/50 bg-amber-500/20 text-amber-100'
                  }`}
                  title="Alternar colocación Simétrica (Doble pieza) o Asimétrica (Pieza única) con [Tab] o [A]"
                >
                  {symmetryEnabled ? 'Sim. [Tab]' : 'Asim. [Tab]'}
                </button>
              </div>
            </div>

            {/* Spore Top Mode Selector: [ Construir ] vs [ Pintar ] vs [ Probar ] */}
            <div className="grid grid-cols-3 gap-1 rounded-full border border-cyan-300/25 bg-[#021019]/80 p-1">
              <button
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={() => {
                  audioManager.playButtonClick();
                  setEditorMode('build');
                  onSetEditorPreviewAction?.('idle');
                }}
                className={`flex items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                  editorMode === 'build'
                    ? 'border border-cyan-200/85 bg-gradient-to-b from-cyan-300/45 via-teal-500/35 to-cyan-700/45 text-white shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                    : 'text-cyan-200/75 hover:text-white'
                }`}
              >
                <Footprints className="h-3.5 w-3.5" />
                <span>Construir</span>
              </button>
              <button
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={() => {
                  audioManager.playButtonClick();
                  setEditorMode('paint');
                  onSelectPlacedOrgan(null);
                  onSetEditorPreviewAction?.('idle');
                }}
                className={`flex items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                  editorMode === 'paint'
                    ? 'border border-amber-200/85 bg-gradient-to-b from-amber-300/45 via-amber-500/35 to-amber-700/45 text-white shadow-[0_0_14px_rgba(251,191,36,0.4)]'
                    : 'text-cyan-200/75 hover:text-white'
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                <span>Pintar</span>
              </button>
              <button
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={() => {
                  audioManager.playButtonClick();
                  setEditorMode('test_drive');
                  onSelectPlacedOrgan(null);
                  if (editorPreviewAction === 'idle') {
                    onSetEditorPreviewAction?.('walk');
                  }
                }}
                className={`flex items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                  editorMode === 'test_drive'
                    ? 'border border-emerald-200/85 bg-gradient-to-b from-emerald-300/45 via-teal-500/35 to-emerald-700/45 text-white shadow-[0_0_14px_rgba(52,211,153,0.45)]'
                    : 'text-cyan-200/75 hover:text-white'
                }`}
              >
                <Play className="h-3.5 w-3.5" />
                <span>Probar</span>
              </button>
            </div>
          </div>

          {/* Floating Bioluminescent Bubble Category Tabs (only in Build mode) */}
          {editorMode === 'build' && (
            <div className="grid grid-cols-4 gap-1.5 border-b border-cyan-300/20 bg-[#031521]/55 p-2">
              {activeWorkshopTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => {
                      audioManager.playButtonClick();
                      setActiveTab(tab.id);
                      onSelectPlacedOrgan(null);
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-1.5 py-1.5 text-[10px] font-bold cursor-pointer hover:scale-[1.04] active:scale-95 transition-all duration-150 ${
                      isActive
                        ? 'border-cyan-200/80 border-t-white/90 bg-gradient-to-b from-cyan-300/40 via-teal-400/30 to-cyan-600/35 text-white shadow-[0_0_16px_rgba(34,211,238,0.42),inset_0_1px_2px_rgba(255,255,255,0.5)]'
                        : 'border-cyan-400/20 bg-cyan-950/40 text-cyan-200/75 hover:border-cyan-300/45 hover:bg-cyan-500/20 hover:text-cyan-50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ARK-Style Pre-Built Creature Body Archetypes & 3 Parametric Sliders (Only in Creature Stage) */}
          {editorMode === 'build' && isCreatureStage && (
            <div className="border-b border-cyan-300/20 bg-[#02121d]/85 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono font-extrabold text-cyan-200 uppercase">
                  Arquetipo Corporal (Estilo ARK)
                </span>
                <span className="font-mono font-bold text-emerald-300 truncate max-w-[165px]">
                  {activeArchetypeInfo.label}
                </span>
              </div>

              {/* 5 Pre-Built Creature Body Archetype Selector Pills */}
              <div className="grid grid-cols-5 gap-1">
                {CREATURE_ARCHETYPES.map((arch) => {
                  const isArchActive =
                    creatureMorphology.archetype === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => {
                        audioManager.playButtonClick();
                        onUpdateCreatureMorphology?.({ archetype: arch.id });
                      }}
                      className={`rounded-xl border px-1 py-1 text-[10px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                        isArchActive
                          ? 'border-cyan-200 bg-cyan-400/35 text-white shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                          : 'border-cyan-300/25 bg-cyan-950/55 text-cyan-100/80 hover:border-cyan-200/65 hover:bg-cyan-500/20'
                      }`}
                      title={`${arch.label}: ${arch.desc}`}
                    >
                      {arch.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* 3 ARK-Style Parametric Sliders: Altura, Anchura, Musculatura */}
              <div className="grid grid-cols-3 gap-2 pt-0.5 text-[10px]">
                <label className="block">
                  <div className="flex justify-between text-cyan-100/85">
                    <span>Altura</span>
                    <span className="font-mono font-bold text-cyan-200">
                      {Math.round(creatureMorphology.heightScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.6}
                    step={0.03}
                    value={creatureMorphology.heightScale}
                    onChange={(e) =>
                      onUpdateCreatureMorphology?.({
                        heightScale: Number(e.target.value),
                      })
                    }
                    className="mt-0.5 w-full accent-cyan-300 cursor-pointer"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-cyan-100/85">
                    <span>Anchura</span>
                    <span className="font-mono font-bold text-emerald-300">
                      {Math.round(creatureMorphology.widthScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.8}
                    step={0.03}
                    value={creatureMorphology.widthScale}
                    onChange={(e) =>
                      onUpdateCreatureMorphology?.({
                        widthScale: Number(e.target.value),
                      })
                    }
                    className="mt-0.5 w-full accent-emerald-300 cursor-pointer"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-cyan-100/85">
                    <span>Músculo</span>
                    <span className="font-mono font-bold text-amber-200">
                      {Math.round(creatureMorphology.musculatureScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.9}
                    step={0.03}
                    value={creatureMorphology.musculatureScale}
                    onChange={(e) =>
                      onUpdateCreatureMorphology?.({
                        musculatureScale: Number(e.target.value),
                      })
                    }
                    className="mt-0.5 w-full accent-amber-300 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Palette Body: Test Drive Mode OR 3-Layer Paint Studio OR 2-Column Organ Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {editorMode === 'test_drive' ? (
              <div className="space-y-3.5">
                <div className="rounded-3xl border border-emerald-300/40 bg-[#031521]/80 p-3.5 space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-extrabold tracking-wider text-emerald-200 uppercase">
                      Simulador de Animación en Vivo (Test Drive)
                    </span>
                    <span className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-100">
                      Activo
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-cyan-100/85">
                    Pon a prueba la biomecánica procedural de tu especie sobre
                    el Nido Costero. Observa cómo la cinemática inversa (IK), la
                    columna spline y las extremidades reaccionan en tiempo real.
                  </p>

                  {/* 5 Interactive Preview Action Buttons */}
                  <div className="space-y-1.5 pt-1">
                    {(
                      [
                        {
                          id: 'idle' as EditorPreviewAction,
                          label: 'Reposo y Respiración (Idle)',
                          desc: 'Respiración torácica, balanceo de cadera y micro-gestos',
                        },
                        {
                          id: 'walk' as EditorPreviewAction,
                          label: 'Marcha Procedural (Caminar)',
                          desc: 'Ciclo de paso coordinado o reptación peristáltica',
                        },
                        {
                          id: 'run' as EditorPreviewAction,
                          label: 'Galope / Sprint (Correr)',
                          desc: 'Zancada rápida con inclinación dinámica de torso',
                        },
                        {
                          id: 'attack' as EditorPreviewAction,
                          label: 'Ataque de Combate (Mordisco / Zarpazo)',
                          desc: 'Embestida agresiva, cierre mandibular y golpe de garras',
                        },
                        {
                          id: 'social' as EditorPreviewAction,
                          label: 'Llamada Social (Canto / Pose)',
                          desc: 'Reverencia vocal, pose tribal y onda armónica',
                        },
                      ] as const
                    ).map((act) => {
                      const active = editorPreviewAction === act.id;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => onSetEditorPreviewAction?.(act.id)}
                          className={`flex w-full flex-col rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer active:scale-[0.98] ${
                            active
                              ? 'border-emerald-200/90 bg-gradient-to-r from-emerald-500/35 via-teal-600/30 to-cyan-900/45 text-white shadow-[0_0_16px_rgba(52,211,153,0.35)]'
                              : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-200/60 hover:bg-cyan-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold">
                              {act.label}
                            </span>
                            {active && (
                              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />
                            )}
                          </div>
                          <span className="mt-0.5 text-[10px] text-cyan-200/75">
                            {act.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Biomechanical Gait & Locomotion Telemetry Card */}
                <div className="rounded-3xl border border-cyan-300/30 bg-[#031521]/75 p-3.5 space-y-2">
                  <span className="block font-mono text-[10px] font-extrabold tracking-wider text-cyan-200 uppercase">
                    Diagnóstico Biomecánico de Locomoción
                  </span>
                  {(() => {
                    const legCount = stats.placedOrgans.filter((o) =>
                      isLegAdaptation(o.adaptationId)
                    ).length;
                    const armCount = stats.placedOrgans.filter((o) =>
                      isArmAdaptation(o.adaptationId)
                    ).length;
                    const gaitLabel =
                      legCount === 0
                        ? 'Modo Babosa (Reptación Peristáltica)'
                        : legCount === 1
                        ? 'Marcha Bípeda Erguida (IK 2 segmentos)'
                        : legCount === 2
                        ? 'Marcha Cuadrúpeda Coordinada'
                        : `Marcha Polípoda Articulada (${legCount * 2} patas)`;
                    return (
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between rounded-xl bg-cyan-950/60 px-2.5 py-1.5">
                          <span className="text-cyan-200/80">Tipo de Paso:</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {gaitLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-cyan-950/60 px-2.5 py-1.5">
                          <span className="text-cyan-200/80">
                            Pares de Piernas / Brazos:
                          </span>
                          <span className="font-mono font-bold text-cyan-100">
                            {legCount} pares piernas · {armCount} pares brazos
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-cyan-950/60 px-2.5 py-1.5">
                          <span className="text-cyan-200/80">
                            Vértebras en Spline:
                          </span>
                          <span className="font-mono font-bold text-amber-200">
                            {spineNodeCount} nodos activos
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : editorMode === 'paint' ? (
              <div className="space-y-3.5">
                {/* Quick Complete Coat Presets */}
                <div className="rounded-3xl border border-amber-300/35 bg-[#031521]/75 p-3 space-y-2">
                  <span className="block font-mono text-[10px] font-extrabold tracking-wider text-amber-200 uppercase">
                    Pelajes Rápidos (3 Capas Combinadas)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_COAT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          audioManager.playButtonClick();
                          onUpdatePaintConfig(preset.config);
                        }}
                        className="flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-950/55 hover:border-amber-200/75 hover:bg-amber-500/20 px-2.5 py-1.5 text-left text-[11px] font-bold text-cyan-50 cursor-pointer active:scale-95 transition-all"
                      >
                        <span className="flex items-center -space-x-1 shrink-0">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/60"
                            style={{ backgroundColor: preset.config.baseColor }}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/60"
                            style={{
                              backgroundColor:
                                preset.config.patternPrimaryColor,
                            }}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/60"
                            style={{
                              backgroundColor: preset.config.detailColor,
                            }}
                          />
                        </span>
                        <span className="truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* LAYER 1: BASE SKIN COLOR & PBR SURFACE TEXTURE */}
                <div className="rounded-3xl border border-cyan-300/30 bg-[#031521]/75 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-extrabold tracking-wider text-cyan-200 uppercase">
                      Capa 1 · Piel Base y Relieve PBR
                    </span>
                    <span
                      className="h-4 w-4 rounded-full border border-white/75 shadow"
                      style={{ backgroundColor: paintConfig.baseColor }}
                    />
                  </div>

                  {/* Base Color Swatches */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {COAT_COLOR_PALETTE.map((c) => {
                      const active =
                        paintConfig.baseColor.toLowerCase() ===
                        c.hex.toLowerCase();
                      return (
                        <button
                          key={`base-${c.id}`}
                          type="button"
                          onClick={() => {
                            audioManager.playButtonClick();
                            onUpdatePaintConfig({ baseColor: c.hex });
                          }}
                          className={`flex items-center justify-center rounded-xl border py-1.5 cursor-pointer transition-all ${
                            active
                              ? 'border-white ring-2 ring-cyan-300 scale-105'
                              : 'border-cyan-300/25 hover:border-white/70'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={`Piel Base: ${c.label}`}
                        >
                          <span className="sr-only">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* PBR Surface Texture Selector */}
                  <div className="space-y-1 pt-1">
                    <span className="block text-[10px] font-bold text-cyan-100/80">
                      Textura Superficial de Dermis:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SKIN_TEXTURE_OPTIONS.map((tex) => {
                        const active = paintConfig.skinTexture === tex.id;
                        return (
                          <button
                            key={tex.id}
                            type="button"
                            onClick={() => {
                              audioManager.playButtonClick();
                              onUpdatePaintConfig({ skinTexture: tex.id });
                            }}
                            className={`rounded-2xl border px-2 py-1.5 text-center text-[10px] font-extrabold cursor-pointer transition-all ${
                              active
                                ? 'border-cyan-200 bg-cyan-400/30 text-white shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                                : 'border-cyan-300/20 bg-cyan-950/50 text-cyan-200/75 hover:border-cyan-300/50'
                            }`}
                            title={tex.desc}
                          >
                            {tex.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* LAYER 2: PROCEDURAL COAT PATTERN & COLORS */}
                <div className="rounded-3xl border border-cyan-300/30 bg-[#031521]/75 p-3 space-y-2.5">
                  <span className="block font-mono text-[10px] font-extrabold tracking-wider text-emerald-200 uppercase">
                    Capa 2 · Patrón Procedimental de Pelaje
                  </span>

                  <div className="grid grid-cols-2 gap-1.5">
                    {COAT_PATTERN_OPTIONS.map((pat) => {
                      const active = paintConfig.patternType === pat.id;
                      return (
                        <button
                          key={pat.id}
                          type="button"
                          onClick={() => {
                            audioManager.playButtonClick();
                            onUpdatePaintConfig({ patternType: pat.id });
                          }}
                          className={`rounded-2xl border px-2.5 py-1.5 text-left text-[10px] font-extrabold cursor-pointer transition-all ${
                            active
                              ? 'border-emerald-200 bg-emerald-500/30 text-white shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                              : 'border-cyan-300/20 bg-cyan-950/50 text-cyan-200/75 hover:border-cyan-300/50'
                          }`}
                        >
                          {pat.label}
                        </button>
                      );
                    })}
                  </div>

                  {paintConfig.patternType !== 'none' && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <span className="mb-1 block text-[10px] font-bold text-cyan-100/80">
                          Color Primario del Patrón:
                        </span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {COAT_COLOR_PALETTE.map((c) => {
                            const active =
                              paintConfig.patternPrimaryColor.toLowerCase() ===
                              c.hex.toLowerCase();
                            return (
                              <button
                                key={`pat1-${c.id}`}
                                type="button"
                                onClick={() => {
                                  audioManager.playButtonClick();
                                  onUpdatePaintConfig({
                                    patternPrimaryColor: c.hex,
                                  });
                                }}
                                className={`h-6 rounded-xl border cursor-pointer transition-all ${
                                  active
                                    ? 'border-white ring-2 ring-emerald-300 scale-105'
                                    : 'border-cyan-300/25 hover:border-white/70'
                                }`}
                                style={{ backgroundColor: c.hex }}
                                title={c.label}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="mb-1 block text-[10px] font-bold text-cyan-100/80">
                          Color Secundario / Contorno:
                        </span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {COAT_COLOR_PALETTE.map((c) => {
                            const active =
                              paintConfig.patternSecondaryColor.toLowerCase() ===
                              c.hex.toLowerCase();
                            return (
                              <button
                                key={`pat2-${c.id}`}
                                type="button"
                                onClick={() => {
                                  audioManager.playButtonClick();
                                  onUpdatePaintConfig({
                                    patternSecondaryColor: c.hex,
                                  });
                                }}
                                className={`h-6 rounded-xl border cursor-pointer transition-all ${
                                  active
                                    ? 'border-white ring-2 ring-emerald-300 scale-105'
                                    : 'border-cyan-300/25 hover:border-white/70'
                                }`}
                                style={{ backgroundColor: c.hex }}
                                title={c.label}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* LAYER 3: ACCENT DETAILS (CLAWS, HORNS, TEETH, JOINTS) */}
                <div className="rounded-3xl border border-cyan-300/30 bg-[#031521]/75 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-extrabold tracking-wider text-amber-200 uppercase">
                      Capa 3 · Detalles (Garras, Cuernos y Articulaciones)
                    </span>
                    <span
                      className="h-4 w-4 rounded-full border border-white/75 shadow"
                      style={{ backgroundColor: paintConfig.detailColor }}
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {COAT_COLOR_PALETTE.map((c) => {
                      const active =
                        paintConfig.detailColor.toLowerCase() ===
                        c.hex.toLowerCase();
                      return (
                        <button
                          key={`det-${c.id}`}
                          type="button"
                          onClick={() => {
                            audioManager.playButtonClick();
                            onUpdatePaintConfig({ detailColor: c.hex });
                          }}
                          className={`h-6 rounded-xl border cursor-pointer transition-all ${
                            active
                              ? 'border-white ring-2 ring-amber-300 scale-105'
                              : 'border-cyan-300/25 hover:border-white/70'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={`Detalle: ${c.label}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeTab === 'apariencia' ? (
              <div className="space-y-4">
                {/* Color Theme Selector */}
                <div>
                  <span className="mb-2 block font-mono text-[10px] font-bold tracking-wider text-cyan-200/85 uppercase">
                    Pigmentación Bioluminiscente
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_THEMES.map((theme) => {
                      const active = stats.colorTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onPointerEnter={() => audioManager.playButtonHover()}
                          onClick={() => {
                            audioManager.playButtonClick();
                            onChangeColorTheme(theme.id);
                          }}
                          className={`flex items-center gap-2.5 rounded-full border px-3.5 py-2.5 text-left text-xs font-bold cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 ${
                            active
                              ? theme.ringClass
                              : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-300/50 hover:bg-cyan-500/20'
                          }`}
                        >
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full border border-white/50 ${theme.swatchClass}`}
                          />
                          <span className="truncate">{theme.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Body Silhouette Selector */}
                <div>
                  <span className="mb-2 block font-mono text-[10px] font-bold tracking-wider text-cyan-200/85 uppercase">
                    Morfología Base de Membrana
                  </span>
                  <div className="space-y-2">
                    {BODY_SHAPES.map((shape) => {
                      const active = stats.bodyShape === shape.id;
                      return (
                        <button
                          key={shape.id}
                          type="button"
                          onPointerEnter={() => audioManager.playButtonHover()}
                          onClick={() => {
                            audioManager.playButtonClick();
                            onChangeBodyShape(shape.id);
                          }}
                          className={`flex w-full items-center justify-between rounded-full border px-4 py-2.5 text-left cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150 ${
                            active
                              ? 'border-cyan-200/80 border-t-white/80 bg-gradient-to-b from-cyan-400/30 to-teal-900/55 text-white shadow-[0_0_16px_rgba(34,211,238,0.3)]'
                              : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-300/50 hover:bg-cyan-500/20'
                          }`}
                        >
                          <span className="text-xs font-extrabold">
                            {shape.label}
                          </span>
                          <span className="text-[11px] text-cyan-200/75">
                            {shape.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Classic Cellular Membrane Proportions (Longitud y Grosor Zonal) */}
                <div className="rounded-3xl border border-cyan-300/30 border-t-cyan-200/50 bg-[#031521]/65 p-3.5 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-200 uppercase">
                      Proporciones de la Membrana Celular
                    </span>
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-200">
                      {Math.round(stats.spineLength * 100)}%
                    </span>
                  </div>

                  {/* Global Membrane Length */}
                  <label className="block">
                    <div className="flex justify-between text-[11px] text-cyan-100/85">
                      <span>Longitud Axial de la Célula</span>
                      <span className="font-mono font-bold text-cyan-200">
                        {Math.round(stats.spineLength * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.75}
                      step={0.03}
                      value={stats.spineLength}
                      onChange={(e) => onSetSpineLength(Number(e.target.value))}
                      className="mt-1 w-full accent-cyan-300 cursor-pointer"
                    />
                  </label>

                  {/* 3 Zonal Radii (Anterior, Central, Posterior) */}
                  {(
                    [
                      { idx: 0 as const, label: 'Polo Anterior (Cabeza)' },
                      { idx: 1 as const, label: 'Citoplasma Central (Torso)' },
                      { idx: 2 as const, label: 'Polo Posterior (Cola)' },
                    ] as const
                  ).map((zone) => {
                    const rVal = stats.torsoRadii?.[zone.idx] ?? 1.0;
                    return (
                      <label key={zone.idx} className="block">
                        <div className="flex justify-between text-[11px] text-cyan-100/85">
                          <span>{zone.label}</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {Math.round(rVal * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={1.55}
                          step={0.03}
                          value={rVal}
                          onChange={(e) =>
                            onSetTorsoRadius(zone.idx, Number(e.target.value))
                          }
                          className="mt-1 w-full accent-emerald-300 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {filteredSlots.map((slot) => {
                  const isLocked = slot.discoveryState === 'locked_hidden';
                  const isMaxed = slot.installedStacks >= slot.maxStacks;
                  const canAfford = stats.adn >= slot.costAdn;
                  const organComplexity = getOrganComplexityCost(slot.id);
                  const complexityFull =
                    complexityScore + organComplexity > maxComplexity;
                  const canDragOrInstall =
                    !isLocked && !isMaxed && canAfford && !complexityFull;
                  const isSelected = inspectedSlot?.id === slot.id;

                  return (
                    <div
                      key={slot.id}
                      onPointerEnter={() => {
                        audioManager.playButtonHover();
                        if (!selectedPlacedInstanceId) {
                          setInspectedSlotId(slot.id);
                        }
                      }}
                      onPointerDown={(e) => {
                        audioManager.playButtonClick();
                        onSelectPlacedOrgan(null);
                        setInspectedSlotId(slot.id);
                        if (canDragOrInstall && e.button === 0) {
                          setDraggingSlotId(slot.id);
                          setPointerPos({ x: e.clientX, y: e.clientY });
                          onStartCatalogDrag(slot.id);
                        }
                      }}
                      className={`group relative flex flex-col justify-between rounded-3xl border p-3 transition-all duration-150 ${
                        isLocked
                          ? 'border-cyan-500/15 bg-gradient-to-b from-[#041b2a]/60 to-[#020e17]/80 text-cyan-200/50 cursor-pointer hover:border-amber-300/35'
                          : canDragOrInstall
                          ? 'border-cyan-300/40 border-t-cyan-100/65 bg-gradient-to-b from-cyan-500/20 via-[#052438]/75 to-teal-950/75 text-white hover:border-cyan-200 hover:scale-[1.02] cursor-grab active:cursor-grabbing shadow-[0_4px_16px_rgba(4,25,41,0.45),inset_0_1px_1px_rgba(255,255,255,0.2)]'
                          : 'border-cyan-400/20 bg-cyan-950/45 text-cyan-100/80 cursor-pointer'
                      } ${
                        isSelected
                          ? 'ring-2 ring-cyan-300/90 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                          : ''
                      }`}
                    >
                      {/* Top row: Organic Vacuole Thumbnail + Amber Droplet Cost Badge */}
                      <div className="flex items-start justify-between gap-1.5">
                        <OrganThumbnail slotId={slot.id} locked={isLocked} />
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-extrabold ${
                              isLocked
                                ? 'border border-amber-300/25 bg-amber-950/40 text-amber-200/65'
                                : canAfford || isMaxed
                                ? 'border border-amber-300/50 bg-gradient-to-b from-amber-400/30 to-amber-700/30 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.25)]'
                                : 'border border-rose-400/40 bg-rose-950/70 text-rose-200'
                            }`}
                          >
                            {isLocked ? 'Fósil' : `${slot.costAdn} ADN`}
                          </span>
                          <span className="font-mono text-[10px] font-semibold text-cyan-200/70">
                            {slot.installedStacks}/{slot.maxStacks}
                          </span>
                        </div>
                      </div>

                      {/* Organ Name */}
                      <div className="mt-2">
                        <p className="line-clamp-1 font-display text-xs font-extrabold leading-tight">
                          {isLocked ? 'Embrión Fosilizado' : slot.name}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-cyan-200/70">
                          {isLocked
                            ? 'Aísla fósil o caza especie'
                            : isMaxed
                            ? 'Máximo instalado'
                            : complexityFull
                            ? 'Límite de Complejidad'
                            : 'Arrastra al cuerpo 3D'}
                        </p>
                      </div>

                      {/* Quick Stat Breakdown Pills when holding [I] or Quick Inspect is active */}
                      {!isLocked && showQuickInspect && (
                        <div className="mt-1.5 flex flex-wrap gap-1 border-t border-cyan-300/15 pt-1.5">
                          {getSlotSporeStatBadges(slot, symmetryEnabled).map(
                            (b) => (
                              <span
                                key={b.label}
                                className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-extrabold ${b.colorClass}`}
                              >
                                {b.label}
                              </span>
                            )
                          )}
                        </div>
                      )}

                      {/* Quick Action Footer (Bubble + Install / - Refund) */}
                      {!isLocked && (
                        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-cyan-300/15 pt-2">
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPlacedOrgan(null);
                              setInspectedSlotId(slot.id);
                              if (canDragOrInstall) {
                                onUnlockSlot(slot.id);
                              }
                            }}
                            disabled={!canDragOrInstall}
                            className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1 text-[10px] font-extrabold transition-all duration-150 ${
                              canDragOrInstall
                                ? 'border border-amber-200/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_2px_8px_rgba(251,191,36,0.35)] hover:scale-[1.03] active:scale-95 cursor-pointer'
                                : 'border border-cyan-500/15 bg-cyan-950/50 text-cyan-300/40 cursor-not-allowed'
                            }`}
                            title={
                              complexityFull
                                ? 'Complejímetro al límite (100/100)'
                                : 'Añadir pieza a la criatura'
                            }
                          >
                            <Plus className="h-3 w-3" />
                            <span>
                              {complexityFull ? 'Complejo' : 'Añadir'}
                            </span>
                          </button>
                          {slot.installedStacks > 0 && (
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRefundSlot(slot.id);
                              }}
                              className="flex items-center justify-center rounded-full border border-rose-300/45 bg-rose-500/20 hover:bg-rose-500/35 px-2.5 py-1 text-[10px] font-bold text-rose-100 cursor-pointer active:scale-95 transition-all duration-150"
                              title={`Quitar copia (+${slot.costAdn} ADN)`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ==================== 2. CENTER 3D VIEWPORT (60% OPEN) ==================== */}
        <div
          onWheel={handleWheel}
          className="pointer-events-none flex flex-1 flex-col items-center justify-end pb-1"
        >
          {isCreatureStage && (
            <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-3xl border border-cyan-300/35 bg-[#031521]/85 px-3.5 py-2 backdrop-blur-md shadow-[0_4px_20px_rgba(2,12,24,0.75)]">
              {/* Row 1: 5 Body Spheres with Local Radius % (45% - 220%) */}
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span className="font-mono text-[10px] font-extrabold text-cyan-200/85 uppercase mr-1">
                  Esferas Cuerpo (Rueda):
                </span>
                {BODY_SEGMENT_ORDER.map((segId, idx) => {
                  const segCfg = bodySegments[idx];
                  const isSphereSelected =
                    selectedSphereIndex === idx ||
                    (selectedSphereIndex === null &&
                      selectedBodySegmentId === segId);
                  const pct = Math.round((segCfg?.radius ?? 1.0) * 100);
                  return (
                    <button
                      key={segId}
                      type="button"
                      onClick={() => {
                        if (onSelectBodySphere) {
                          onSelectBodySphere(idx);
                        } else {
                          onSelectBodySegment?.(segId);
                        }
                      }}
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                        isSphereSelected
                          ? 'border-amber-200/90 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                          : 'border-cyan-300/25 bg-cyan-950/60 text-cyan-100/80 hover:border-cyan-200/60 hover:bg-cyan-500/20'
                      }`}
                      title={`Seleccionar esfera ${segCfg?.label ?? segId} y girar la rueda del ratón para escalar su radio (45% - 220%) sin alterar la altura Y`}
                    >
                      {segCfg?.label ?? segId} ({pct}%)
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Extremidades & Cámara */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-cyan-300/15 pt-1">
                <span className="font-mono text-[10px] font-extrabold text-cyan-200/85 uppercase mr-1">
                  Extremidades / Vista:
                </span>
                {(
                  [
                    {
                      id: 'legs' as EditorSelectionTarget,
                      label: 'Piernas (Escala 50%-180%)',
                    },
                    {
                      id: 'arms' as EditorSelectionTarget,
                      label: 'Brazos (Escala 50%-180%)',
                    },
                    {
                      id: null as EditorSelectionTarget,
                      label: 'Cámara (Zoom)',
                    },
                  ] as const
                ).map((item) => {
                  const isActive =
                    selectedSphereIndex === null &&
                    editorSelectionTarget === item.id;
                  return (
                    <button
                      key={item.id ?? 'none'}
                      type="button"
                      onClick={() => {
                        audioManager.playButtonClick();
                        onSelectEditorTarget?.(item.id);
                      }}
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                        isActive
                          ? 'border-amber-200/90 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                          : 'border-cyan-300/25 bg-cyan-950/60 text-cyan-100/80 hover:border-cyan-200/60 hover:bg-cyan-500/20'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ==================== 3. RIGHT DUAL COLUMN: TOP ATTRIBUTES + BOTTOM INSPECTOR ==================== */}
        <aside className="pointer-events-none flex w-[328px] sm:w-[368px] shrink-0 flex-col justify-between gap-3 overflow-hidden">
          {/* 3A. TOP-RIGHT PANEL: TOTAL SPECIES ATTRIBUTES + VERTICAL COMPLEJÍMETRO */}
          <section
            className={`pointer-events-auto rounded-[28px] p-4 ${MEMBRANE_PANEL_CLASS}`}
          >
            {/* Species Name Input + Available Amber DNA Counter */}
            <div className="flex items-center justify-between gap-2.5 border-b border-cyan-300/20 pb-3">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="species-name-input"
                  className="block font-mono text-[10px] font-bold tracking-wider text-cyan-200/85 uppercase"
                >
                  Nombre de la Especie
                </label>
                <input
                  id="species-name-input"
                  type="text"
                  maxLength={28}
                  value={stats.speciesName}
                  onChange={(e) => onChangeSpeciesName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    audioManager.playKeyType();
                  }}
                  className="mt-1 w-full rounded-full border border-cyan-300/35 bg-[#031521]/80 px-3.5 py-1.5 font-display text-sm font-extrabold text-white outline-none focus:border-cyan-200 focus:shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                  placeholder="Organismo Primigenio"
                />
              </div>

              <div className="flex flex-col items-end rounded-3xl border border-amber-300/55 border-t-amber-100/80 bg-gradient-to-b from-amber-300/25 via-amber-500/20 to-amber-950/50 px-3.5 py-1.5 shadow-[0_0_16px_rgba(251,191,36,0.3)]">
                <span className="font-mono text-[10px] font-bold text-amber-200 uppercase">
                  Ámbar ADN
                </span>
                <div className="flex items-center gap-1 font-mono text-lg font-extrabold text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                  <Dna className="h-4 w-4 text-amber-300" />
                  <span>{stats.adn}</span>
                </div>
              </div>
            </div>

            {/* Quantitative Attributes OR Spore Creature Stage Stats Grid + Vertical Complejímetro */}
            {isCreatureStage ? (
              <div className="mt-2.5 flex items-stretch gap-2.5 text-[11px]">
                {/* Left Stats Content */}
                <div className="flex-1 space-y-2 min-w-0">
                  {/* Supervivencia Bar (Velocidad, Salud, Salto, Sigilo, Visión) */}
                  <div className="rounded-2xl border border-sky-300/30 bg-[#031521]/75 p-2">
                    <div className="flex items-center justify-between font-mono text-[9px] font-extrabold text-sky-300 uppercase mb-1">
                      <span className="flex items-center gap-1">
                        <Footprints className="h-3 w-3" />
                        <span>Supervivencia</span>
                      </span>
                      <span className="text-emerald-300">
                        PV {Math.round(stats.maxHealth)} · Arm.{' '}
                        {stats.defensePercent}%
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                      <div className="rounded-xl bg-cyan-950/60 px-1 py-0.5">
                        <span className="block text-[9px] text-cyan-200/70">
                          Veloc.
                        </span>
                        <span className="font-mono font-extrabold text-sky-200">
                          {creatureStats.speed}/5
                        </span>
                      </div>
                      <div className="rounded-xl bg-cyan-950/60 px-1 py-0.5">
                        <span className="block text-[9px] text-cyan-200/70">
                          Salud
                        </span>
                        <span className="font-mono font-extrabold text-emerald-300">
                          {creatureStats.health}/5
                        </span>
                      </div>
                      <div className="rounded-xl bg-cyan-950/60 px-1 py-0.5">
                        <span className="block text-[9px] text-cyan-200/70">
                          Salto
                        </span>
                        <span className="font-mono font-extrabold text-sky-200">
                          {creatureStats.jump}/5
                        </span>
                      </div>
                      <div className="rounded-xl bg-cyan-950/60 px-1 py-0.5">
                        <span className="block text-[9px] text-cyan-200/70">
                          Sigilo
                        </span>
                        <span className="font-mono font-extrabold text-sky-200">
                          {creatureStats.sneak}/5
                        </span>
                      </div>
                      <div className="rounded-xl bg-cyan-950/60 px-1 py-0.5">
                        <span className="block text-[9px] text-cyan-200/70">
                          Visión
                        </span>
                        <span className="font-mono font-extrabold text-amber-200">
                          {creatureStats.sight}/5
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Combate & Social Columns */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Combate */}
                    <div className="rounded-2xl border border-rose-300/30 bg-[#031521]/75 p-2 space-y-0.5">
                      <div className="flex items-center gap-1 font-mono text-[9px] font-extrabold text-rose-300 uppercase">
                        <Crosshair className="h-3 w-3" />
                        <span>Combate</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Mordisco</span>
                        <span className="font-mono font-bold text-rose-200">
                          {creatureStats.bite}/5
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Embestida</span>
                        <span className="font-mono font-bold text-rose-200">
                          {creatureStats.charge}/5
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Zarpazo</span>
                        <span className="font-mono font-bold text-rose-200">
                          {creatureStats.strike}/5
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Veneno</span>
                        <span className="font-mono font-bold text-rose-200">
                          {creatureStats.spit}/5
                        </span>
                      </div>
                    </div>

                    {/* Social / Tribal */}
                    <div className="rounded-2xl border border-emerald-300/30 bg-[#031521]/75 p-2 space-y-0.5">
                      <div className="flex items-center gap-1 font-mono text-[9px] font-extrabold text-emerald-300 uppercase">
                        <Music className="h-3 w-3" />
                        <span>Social</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Canto</span>
                        <span className="font-mono font-bold text-emerald-200">
                          {creatureStats.sing}/5
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Baile</span>
                        <span className="font-mono font-bold text-emerald-200">
                          {creatureStats.dance}/5
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Fascinar</span>
                        <span className="font-mono font-bold text-emerald-200">
                          {creatureStats.charm}/5
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-100/80">Posa</span>
                        <span className="font-mono font-bold text-emerald-200">
                          {creatureStats.pose}/5
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Diet, Graspers Hand Icon & Placed Organs Count Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5 text-[10px]">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono font-bold ${dietBadge.cls}`}
                    >
                      {dietBadge.label}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono font-bold ${
                        creatureStats.hasGraspers
                          ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                          : 'border-slate-500/30 bg-slate-900/50 text-slate-300/70'
                      }`}
                      title="Capacidad de sostener herramientas en la Fase Tribal"
                    >
                      <Hand className="h-3 w-3" />
                      <span>
                        {creatureStats.hasGraspers
                          ? 'Agarre: Sí'
                          : 'Agarre: No'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Vertical Spore Complexity Meter (Complejímetro) */}
                <div
                  className="flex w-11 shrink-0 flex-col items-center justify-between rounded-2xl border border-cyan-300/30 bg-[#021019]/85 p-1.5"
                  title={`Complejímetro ADN: ${complexityScore}/${maxComplexity} (Vértebras + Extremidades + Órganos)`}
                >
                  <span className="font-mono text-[8px] font-extrabold tracking-tighter text-cyan-200 uppercase">
                    Compl.
                  </span>
                  <div className="relative my-1 flex h-28 w-3.5 items-end overflow-hidden rounded-full border border-cyan-300/35 bg-slate-950/90 p-0.5">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-emerald-400 via-amber-400 to-rose-500 transition-all duration-200"
                      style={{ height: `${complexityPct}%` }}
                    />
                  </div>
                  <span
                    className={`font-mono text-[9px] font-extrabold ${
                      complexityPct >= 90
                        ? 'text-rose-300'
                        : complexityPct >= 70
                        ? 'text-amber-200'
                        : 'text-emerald-300'
                    }`}
                  >
                    {complexityScore}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {/* Max Health */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Heart className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Vitalidad</span>
                    </span>
                    <span className="font-mono font-extrabold text-emerald-300">
                      {Math.round(stats.maxHealth)}
                    </span>
                  </div>

                  {/* Max Energy */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Flame className="h-3.5 w-3.5 text-cyan-300" />
                      <span>Bioenergía</span>
                    </span>
                    <span className="font-mono font-extrabold text-cyan-200">
                      {Math.round(stats.maxEnergy)}
                    </span>
                  </div>

                  {/* Attack Power */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Crosshair className="h-3.5 w-3.5 text-rose-400" />
                      <span>Ataque</span>
                    </span>
                    <span className="font-mono font-extrabold text-rose-200">
                      {stats.attackPower} pts
                    </span>
                  </div>

                  {/* Poison / Toxicity Level */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Skull className="h-3.5 w-3.5 text-lime-400" />
                      <span>Toxina</span>
                    </span>
                    <span className="font-mono font-extrabold text-lime-300">
                      Nv. {stats.poisonLevel}
                    </span>
                  </div>

                  {/* Bioelectric Charge */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Zap className="h-3.5 w-3.5 text-amber-300" />
                      <span>Bioeléctrico</span>
                    </span>
                    <span className="font-mono font-extrabold text-amber-200">
                      Nv. {stats.electricLevel}
                    </span>
                  </div>

                  {/* Defense / Armor % */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Shield className="h-3.5 w-3.5 text-teal-300" />
                      <span>Membrana</span>
                    </span>
                    <span className="font-mono font-extrabold text-teal-200">
                      {stats.defensePercent}%
                    </span>
                  </div>

                  {/* Speed & Turn */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Wind className="h-3.5 w-3.5 text-sky-300" />
                      <span>Nado / Giro</span>
                    </span>
                    <span className="font-mono font-extrabold text-sky-200">
                      {speedRatingPct}% / {turnRatingPct}%
                    </span>
                  </div>

                  {/* Sensory / Vision */}
                  <div className="flex items-center justify-between rounded-full border border-cyan-300/25 bg-[#031521]/65 px-3 py-1.5 shadow-inner">
                    <span className="flex items-center gap-1.5 text-cyan-100/90">
                      <Compass className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Sentidos</span>
                    </span>
                    <span className="font-mono font-extrabold text-emerald-200">
                      Nv. {stats.visionLevel}
                    </span>
                  </div>
                </div>

                {/* Diet & Placed Organs Count Footer */}
                <div className="mt-2.5 flex items-center justify-between pt-1 text-[11px]">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono font-bold ${dietBadge.cls}`}
                  >
                    Dieta: {dietBadge.label}
                  </span>
                  <span className="font-mono font-semibold text-cyan-200/80">
                    Complejidad: {complexityScore}/{maxComplexity}
                  </span>
                </div>
              </>
            )}
          </section>

          {/* 3B. BOTTOM-RIGHT PANEL: SELECTED PART INSPECTOR + LIMB RIGGING GIZMO CONTROLS */}
          {inspectedSlot && (
            <section
              className={`pointer-events-auto flex min-h-0 flex-1 flex-col justify-between overflow-y-auto rounded-[28px] p-4 ${MEMBRANE_PANEL_CLASS}`}
            >
              {inspectedSlot.discoveryState === 'locked_hidden' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <OrganThumbnail slotId={inspectedSlot.id} locked={true} />
                    <div>
                      <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-200 uppercase">
                        Embrión Fosilizado Latente
                      </span>
                      <h3 className="mt-1 font-display text-base font-extrabold text-white">
                        Adaptación No Aislada (???)
                      </h3>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-amber-300/35 bg-amber-950/35 p-3.5 shadow-inner">
                    <p className="font-mono text-[10px] font-bold tracking-wider text-amber-200 uppercase">
                      Rastro Biológico en el Océano:
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-100/95">
                      {inspectedSlot.discoveryHint}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <OrganThumbnail
                        slotId={inspectedSlot.id}
                        locked={false}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-100 uppercase">
                            {selectedPlacedInstance
                              ? 'Órgano 3D Seleccionado'
                              : inspectedSlot.statSummary}
                          </span>
                          <span className="rounded-full border border-amber-300/45 bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] font-extrabold text-amber-200">
                            {inspectedSlot.costAdn} ADN
                          </span>
                        </div>
                        <h3 className="mt-1 font-display text-base font-extrabold text-white">
                          {inspectedSlot.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Biological Description */}
                  <p className="text-xs leading-relaxed text-cyan-100/90">
                    {inspectedSlot.description}
                  </p>

                  {/* Spore Exact Skill Level Breakdown Badges (Always visible in Inspector, highlighted when [I] is active) */}
                  <div
                    className={`flex flex-wrap items-center gap-1 rounded-2xl border p-2 transition-all ${
                      showQuickInspect
                        ? 'border-amber-300/70 bg-amber-950/35 shadow-[0_0_14px_rgba(251,191,36,0.25)]'
                        : 'border-cyan-300/25 bg-[#02121d]/75'
                    }`}
                  >
                    <span className="mr-1 font-mono text-[9px] font-extrabold text-cyan-200/80 uppercase">
                      Stats [I]:
                    </span>
                    {getSlotSporeStatBadges(inspectedSlot, symmetryEnabled).map(
                      (b) => (
                        <span
                          key={b.label}
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold ${b.colorClass}`}
                        >
                          {b.label}
                        </span>
                      )
                    )}
                  </div>

                  {/* Pros & Tradeoffs Organic Vacuole */}
                  <div className="space-y-1 rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-3 text-[11px] shadow-inner">
                    {inspectedSlot.pros.map((pro) => (
                      <div
                        key={pro}
                        className="flex items-center gap-1.5 font-semibold text-emerald-300"
                      >
                        <Activity className="h-3 w-3 shrink-0" />
                        <span>{pro}</span>
                      </div>
                    ))}
                    {inspectedSlot.tradeoffs.map((con) => (
                      <div
                        key={con}
                        className="flex items-center gap-1.5 font-medium text-amber-200/90"
                      >
                        <span>• {con}</span>
                      </div>
                    ))}
                  </div>

                  {/* Advanced 3D Per-Organ Morphology, Limb Joint Rigging & Individual Pigment Panel */}
                  {selectedPlacedInstance && (
                    <div className="space-y-2.5 rounded-3xl border border-cyan-200/45 border-t-cyan-100/70 bg-gradient-to-b from-cyan-500/15 via-[#031521]/80 to-[#02101a]/90 p-3 shadow-[0_0_18px_rgba(34,211,238,0.2)]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-extrabold tracking-wider text-cyan-200 uppercase">
                          {selectedIsLimb
                            ? 'Rigging Articular 3D y Escala'
                            : 'Morfología y Pigmento 3D'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onResetPlacedOrganMorphology(
                              selectedPlacedInstance.instanceId
                            )
                          }
                          className="rounded-full border border-cyan-300/35 bg-cyan-500/15 hover:bg-cyan-500/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-100 cursor-pointer active:scale-95 transition-all"
                          title="Restablecer articulaciones, escala y color de la pieza"
                        >
                          Restablecer
                        </button>
                      </div>

                      {/* 3-Node Limb Joint Sliders (when a Leg or Arm is selected) */}
                      {selectedIsLimb && (
                        <div className="rounded-2xl border border-emerald-300/35 bg-[#02121d]/85 p-2.5 space-y-1.5 text-[11px]">
                          <span className="block font-mono text-[9px] font-extrabold text-emerald-300 uppercase">
                            Esferas Articulares 3D (o arrastra los aros en el
                            modelo)
                          </span>
                          {/* Proximal Joint (Hip / Shoulder) */}
                          <label className="block">
                            <div className="flex justify-between text-cyan-100/90">
                              <span>Articulación Cadera / Hombro</span>
                              <span className="font-mono font-bold text-cyan-200">
                                {Math.round(
                                  ((selectedPlacedInstance.morphology
                                    ?.upperJointAngle ?? 0) *
                                    180) /
                                    Math.PI
                                )}
                                °
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-0.95}
                              max={0.95}
                              step={0.04}
                              value={
                                selectedPlacedInstance.morphology
                                  ?.upperJointAngle ?? 0
                              }
                              onChange={(e) =>
                                onUpdatePlacedOrganMorphology(
                                  selectedPlacedInstance.instanceId,
                                  { upperJointAngle: Number(e.target.value) }
                                )
                              }
                              className="mt-0.5 w-full accent-cyan-300 cursor-pointer"
                            />
                          </label>

                          {/* Middle Joint (Knee / Elbow) */}
                          <label className="block">
                            <div className="flex justify-between text-cyan-100/90">
                              <span>Flexión Rodilla / Codo</span>
                              <span className="font-mono font-bold text-emerald-300">
                                {Math.round(
                                  ((selectedPlacedInstance.morphology
                                    ?.middleJointAngle ?? 0) *
                                    180) /
                                    Math.PI
                                )}
                                °
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-1.15}
                              max={1.15}
                              step={0.04}
                              value={
                                selectedPlacedInstance.morphology
                                  ?.middleJointAngle ?? 0
                              }
                              onChange={(e) =>
                                onUpdatePlacedOrganMorphology(
                                  selectedPlacedInstance.instanceId,
                                  { middleJointAngle: Number(e.target.value) }
                                )
                              }
                              className="mt-0.5 w-full accent-emerald-300 cursor-pointer"
                            />
                          </label>

                          {/* Distal Bone Segment Length */}
                          <label className="block">
                            <div className="flex justify-between text-cyan-100/90">
                              <span>Longitud de Huesos</span>
                              <span className="font-mono font-bold text-amber-200">
                                {Math.round(
                                  (selectedPlacedInstance.morphology
                                    ?.boneLength ?? 1.0) * 100
                                )}
                                %
                              </span>
                            </div>
                            <input
                              type="range"
                              min={MORPHOLOGY_SCALE_LIMITS.limbThickness.min}
                              max={MORPHOLOGY_SCALE_LIMITS.limbThickness.max}
                              step={MORPHOLOGY_SCALE_LIMITS.limbThickness.step}
                              value={
                                selectedPlacedInstance.morphology?.boneLength ??
                                1.0
                              }
                              onChange={(e) =>
                                onUpdatePlacedOrganMorphology(
                                  selectedPlacedInstance.instanceId,
                                  { boneLength: Number(e.target.value) }
                                )
                              }
                              className="mt-0.5 w-full accent-amber-300 cursor-pointer"
                            />
                          </label>
                        </div>
                      )}

                      {/* 3 Non-Uniform Scale Sliders */}
                      <div className="space-y-1.5 text-[11px]">
                        {/* Escala General */}
                        <label className="block">
                          <div className="flex justify-between text-cyan-100/90">
                            <span>Escala General (o Rueda 3D)</span>
                            <span className="font-mono font-bold text-cyan-200">
                              {Math.round(
                                (selectedPlacedInstance.morphology
                                  ?.scaleOverall ?? 1.0) * 100
                              )}
                              %
                            </span>
                          </div>
                          <input
                            type="range"
                            min={
                              selectedIsLimb
                                ? MORPHOLOGY_SCALE_LIMITS.limbThickness.min
                                : MORPHOLOGY_SCALE_LIMITS.organScale.min
                            }
                            max={
                              selectedIsLimb
                                ? MORPHOLOGY_SCALE_LIMITS.limbThickness.max
                                : MORPHOLOGY_SCALE_LIMITS.organScale.max
                            }
                            step={
                              selectedIsLimb
                                ? MORPHOLOGY_SCALE_LIMITS.limbThickness.step
                                : MORPHOLOGY_SCALE_LIMITS.organScale.step
                            }
                            value={
                              selectedPlacedInstance.morphology?.scaleOverall ??
                              1.0
                            }
                            onChange={(e) =>
                              onUpdatePlacedOrganMorphology(
                                selectedPlacedInstance.instanceId,
                                { scaleOverall: Number(e.target.value) }
                              )
                            }
                            className="mt-0.5 w-full accent-cyan-300 cursor-pointer"
                          />
                        </label>

                        {/* Anchura / Grosor Transversal */}
                        <label className="block">
                          <div className="flex justify-between text-cyan-100/90">
                            <span>Anchura / Grosor Muscular</span>
                            <span className="font-mono font-bold text-emerald-300">
                              {Math.round(
                                (selectedPlacedInstance.morphology?.scaleWidth ??
                                  1.0) * 100
                              )}
                              %
                            </span>
                          </div>
                          <input
                            type="range"
                            min={
                              selectedIsLimb
                                ? MORPHOLOGY_SCALE_LIMITS.limbThickness.min
                                : MORPHOLOGY_SCALE_LIMITS.organScale.min
                            }
                            max={
                              selectedIsLimb
                                ? MORPHOLOGY_SCALE_LIMITS.limbThickness.max
                                : MORPHOLOGY_SCALE_LIMITS.organScale.max
                            }
                            step={
                              selectedIsLimb
                                ? MORPHOLOGY_SCALE_LIMITS.limbThickness.step
                                : MORPHOLOGY_SCALE_LIMITS.organScale.step
                            }
                            value={
                              selectedPlacedInstance.morphology?.scaleWidth ??
                              1.0
                            }
                            onChange={(e) =>
                              onUpdatePlacedOrganMorphology(
                                selectedPlacedInstance.instanceId,
                                { scaleWidth: Number(e.target.value) }
                              )
                            }
                            className="mt-0.5 w-full accent-emerald-300 cursor-pointer"
                          />
                        </label>

                        {/* Orientación (Yaw & Pitch) coordinated with 3D Gizmo */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <label className="block">
                            <div className="flex justify-between text-[10px] text-cyan-100/85">
                              <span>Giro (Tirador)</span>
                              <span className="font-mono font-bold text-cyan-200">
                                {Math.round(
                                  ((selectedPlacedInstance.orientationYaw ??
                                    selectedPlacedInstance.localYaw ??
                                    0) *
                                    180) /
                                    Math.PI
                                )}
                                °
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-1.8}
                              max={1.8}
                              step={0.05}
                              value={
                                selectedPlacedInstance.orientationYaw ??
                                selectedPlacedInstance.localYaw ??
                                0
                              }
                              onChange={(e) =>
                                onUpdatePlacedOrganOrientation(
                                  selectedPlacedInstance.instanceId,
                                  Number(e.target.value),
                                  selectedPlacedInstance.orientationPitch ??
                                    selectedPlacedInstance.localPitch ??
                                    0
                                )
                              }
                              className="mt-0.5 w-full accent-cyan-300 cursor-pointer"
                            />
                          </label>

                          <label className="block">
                            <div className="flex justify-between text-[10px] text-cyan-100/85">
                              <span>Inclinación</span>
                              <span className="font-mono font-bold text-cyan-200">
                                {Math.round(
                                  ((selectedPlacedInstance.orientationPitch ??
                                    selectedPlacedInstance.localPitch ??
                                    0) *
                                    180) /
                                    Math.PI
                                )}
                                °
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-1.1}
                              max={1.1}
                              step={0.05}
                              value={
                                selectedPlacedInstance.orientationPitch ??
                                selectedPlacedInstance.localPitch ??
                                0
                              }
                              onChange={(e) =>
                                onUpdatePlacedOrganOrientation(
                                  selectedPlacedInstance.instanceId,
                                  selectedPlacedInstance.orientationYaw ??
                                    selectedPlacedInstance.localYaw ??
                                    0,
                                  Number(e.target.value)
                                )
                              }
                              className="mt-0.5 w-full accent-cyan-300 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Individual Bioluminescent Pigment Swatches */}
                      <div className="border-t border-cyan-300/20 pt-2">
                        <span className="mb-1.5 block font-mono text-[10px] font-bold tracking-wider text-cyan-200/90 uppercase">
                          Pigmento Individual de la Pieza
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ORGAN_PIGMENT_SWATCHES.map((swatch) => {
                            const currentOverride =
                              selectedPlacedInstance.morphology?.colorOverride;
                            const isActive =
                              (swatch.hex === undefined && !currentOverride) ||
                              (swatch.hex !== undefined &&
                                currentOverride?.toLowerCase() ===
                                  swatch.hex.toLowerCase());
                            return (
                              <button
                                key={swatch.id}
                                type="button"
                                onClick={() =>
                                  onUpdatePlacedOrganMorphology(
                                    selectedPlacedInstance.instanceId,
                                    { colorOverride: swatch.hex }
                                  )
                                }
                                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                                  isActive
                                    ? 'border-white bg-cyan-400/30 text-white ring-2 ring-cyan-200/80'
                                    : 'border-cyan-300/25 bg-[#031521]/75 text-cyan-100/80 hover:border-cyan-200/50'
                                }`}
                                title={`Pigmento: ${swatch.label}`}
                              >
                                <span
                                  className={`h-3 w-3 rounded-full border border-white/60 ${swatch.bgClass}`}
                                />
                                <span>{swatch.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Inspector Action Buttons (Sell/Remove Placed Instance OR Install Copy) */}
              {inspectedSlot.discoveryState !== 'locked_hidden' && (
                <div className="mt-3 flex items-center gap-2 border-t border-cyan-300/20 pt-3">
                  {selectedPlacedInstance ? (
                    <button
                      type="button"
                      onClick={() =>
                        onRemovePlacedOrgan(selectedPlacedInstance.instanceId)
                      }
                      title={
                        isFootAdaptation(selectedPlacedInstance.adaptationId) ||
                        isHandAdaptation(selectedPlacedInstance.adaptationId)
                          ? 'Desacopla únicamente esta mano o pie sin retirar la pierna ni el brazo'
                          : 'Reabsorbe esta pieza y reembolsa su coste de ADN'
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-300/55 bg-gradient-to-b from-rose-500/35 to-rose-900/60 px-4 py-2 text-xs font-extrabold text-rose-100 hover:from-rose-500/50 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>
                        {isFootAdaptation(selectedPlacedInstance.adaptationId) ||
                        isHandAdaptation(selectedPlacedInstance.adaptationId)
                          ? `Desacoplar extremidad distal (+${inspectedSlot.costAdn} ADN)`
                          : `Reabsorber pieza (+${inspectedSlot.costAdn} ADN)`}
                      </span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onUnlockSlot(inspectedSlot.id)}
                        disabled={
                          inspectedSlot.installedStacks >=
                            inspectedSlot.maxStacks ||
                          stats.adn < inspectedSlot.costAdn ||
                          complexityScore +
                            getOrganComplexityCost(inspectedSlot.id) >
                            maxComplexity
                        }
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-extrabold transition-all duration-150 ${
                          inspectedSlot.installedStacks <
                            inspectedSlot.maxStacks &&
                          stats.adn >= inspectedSlot.costAdn &&
                          complexityScore +
                            getOrganComplexityCost(inspectedSlot.id) <=
                            maxComplexity
                            ? 'border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.4),inset_0_1px_2px_rgba(255,255,255,0.75)] hover:scale-[1.02] active:scale-95 cursor-pointer'
                            : 'border border-cyan-500/20 bg-cyan-950/50 text-cyan-300/40 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        <span>
                          {inspectedSlot.installedStacks >=
                          inspectedSlot.maxStacks
                            ? 'Máximo alcanzado'
                            : complexityScore +
                                getOrganComplexityCost(inspectedSlot.id) >
                              maxComplexity
                            ? 'Complejímetro lleno'
                            : `Ensamblar (${inspectedSlot.costAdn} ADN)`}
                        </span>
                      </button>

                      {inspectedSlot.installedStacks > 0 && (
                        <button
                          type="button"
                          onClick={() => onRefundSlot(inspectedSlot.id)}
                          className="flex items-center justify-center gap-1 rounded-full border border-rose-300/45 bg-rose-500/20 hover:bg-rose-500/35 px-3.5 py-2.5 text-xs font-bold text-rose-100 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>+{inspectedSlot.costAdn}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* ==================== 4. BOTTOM-CENTER ORGANIC CAPSULE WORKSHOP BAR ==================== */}
      <footer
        className={`pointer-events-auto mt-3 flex flex-wrap items-center justify-between gap-3 rounded-full px-5 py-2.5 ${MEMBRANE_PANEL_CLASS}`}
      >
        {/* Left: 3D Camera Orbit Droplet Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onRotateEditorCamera(-0.45);
            }}
            className="flex items-center gap-1.5 rounded-full border border-cyan-400/40 border-t-cyan-200/60 bg-cyan-500/20 hover:bg-cyan-500/35 px-3.5 py-1.5 text-xs font-bold text-cyan-100 shadow-[0_2px_10px_rgba(34,211,238,0.2)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
            title="Rotar cámara a la izquierda"
          >
            <RotateCcw className="h-3.5 w-3.5 text-cyan-200" />
            <span className="hidden sm:inline">Girar</span>
          </button>
          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onRotateEditorCamera(0.45);
            }}
            className="flex items-center gap-1.5 rounded-full border border-cyan-400/40 border-t-cyan-200/60 bg-cyan-500/20 hover:bg-cyan-500/35 px-3.5 py-1.5 text-xs font-bold text-cyan-100 shadow-[0_2px_10px_rgba(34,211,238,0.2)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
            title="Rotar cámara a la derecha"
          >
            <RotateCw className="h-3.5 w-3.5 text-cyan-200" />
            <span className="hidden sm:inline">Girar</span>
          </button>
        </div>

        {/* Center: Spore Workshop Direct Manipulation Instructions OR Validation Alert */}
        <div className="flex items-center gap-2 text-center text-[11px] text-cyan-100/90">
          {validationError ? (
            <div className="flex items-center gap-2 rounded-full border border-amber-300/80 bg-rose-950/90 px-4 py-1 text-xs font-extrabold text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.45)]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              <span>{validationError}</span>
            </div>
          ) : (
            <>
              <GripHorizontal className="hidden h-4 w-4 text-cyan-300 md:inline" />
              <span>
                <strong className="text-amber-300">
                  {isCreatureStage
                    ? 'Editor Spore 3D:'
                    : 'Taller Celular 3D:'}
                </strong>{' '}
                <strong className="text-cyan-200">Clic izq.</strong> selecciona esfera/pieza ·{' '}
                <strong className="text-cyan-200">Rueda</strong>{' '}
                {isCreatureStage
                  ? selectedSphereIndex !== null
                    ? `radio ${bodySegments[selectedSphereIndex]?.label ?? 'esfera'} (45%-220%)`
                    : selectedLimbId !== null
                    ? 'escala extremidad (50%-180%)'
                    : selectedPlacedInstance
                    ? 'escala órgano (40%-200%)'
                    : 'zoom cámara'
                  : 'grosor/escala'}{' '}
                · <strong className="text-emerald-300">[Tab/A]</strong> Simetría ·{' '}
                <strong className="text-amber-200">Alt+Clic</strong> duplicar ·{' '}
                <strong className="text-cyan-200">Clic der.</strong> orbitar
              </span>
            </>
          )}
        </div>

        {/* Right: Terrestrial Evolution Jump (if ready) + Golden Bubble Confirm Button */}
        <div className="flex items-center gap-2">
          {readyForLandTransition && !isCreatureStage && (
            <button
              type="button"
              onPointerEnter={() => audioManager.playButtonHover()}
              onClick={() => {
                audioManager.playButtonClick();
                onEvolveToCreatureStage();
              }}
              className="flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-gradient-to-b from-emerald-300 via-teal-400 to-emerald-500 px-4 py-2 font-display text-xs font-extrabold text-slate-950 shadow-[0_4px_16px_rgba(52,211,153,0.45),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
            >
              <Footprints className="h-4 w-4" />
              <span>Evolucionar a Criatura Terrestre</span>
            </button>
          )}

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              if (isCreatureStage) {
                const hasMouth = stats.placedOrgans.some((o) =>
                  isMouthAdaptation(o.adaptationId)
                );
                const hasSupportLimbs = stats.placedOrgans.some(
                  (o) =>
                    isLegAdaptation(o.adaptationId) ||
                    isFootAdaptation(o.adaptationId)
                );
                if (!hasMouth) {
                  setEditorMode('build');
                  setActiveTab('alimentacion');
                  setValidationError(
                    'Tu criatura necesita al menos 1 Boca funcional para alimentarse.'
                  );
                  return;
                }
                if (!hasSupportLimbs && !crawlWarningAcknowledged) {
                  setCrawlWarningAcknowledged(true);
                  setValidationError(
                    'Criatura sin extremidades motoras: reptará lentamente por el suelo (Pulsa de nuevo para confirmar).'
                  );
                  return;
                }
              }
              onClose();
            }}
            className="flex items-center gap-2 rounded-full border border-amber-100/85 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-5 py-2 font-display text-xs font-extrabold text-slate-950 shadow-[0_4px_16px_rgba(251,191,36,0.45),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isCreatureStage
                ? crawlWarningAcknowledged
                  ? 'Confirmar y Reptar'
                  : 'Confirmar Evolución y Salir al Mundo'
                : 'Eclosionar al Océano'}
            </span>
          </button>
        </div>
      </footer>
    </motion.div>
  );
}

