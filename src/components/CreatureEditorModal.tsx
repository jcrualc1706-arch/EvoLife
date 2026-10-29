import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Compass,
  Crosshair,
  Dna,
  Eye,
  Flame,
  Footprints,
  GripHorizontal,
  Heart,
  Palette,
  Plus,
  RotateCcw,
  RotateCw,
  Shield,
  Skull,
  Sparkles,
  Trash2,
  Utensils,
  Wind,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  computeStackedMultiplier,
  normalizeAdaptationId,
} from '../game/evolutionData';
import {
  AdaptationCategory,
  CellBodyShape,
  CellColorTheme,
  CellularEvolutionSlot,
  PlacedOrganMorphology,
  PlayerStats,
} from '../game/types';

interface CreatureEditorModalProps {
  stats: PlayerStats;
  slots: CellularEvolutionSlot[];
  readyForLandTransition: boolean;
  selectedPlacedInstanceId: string | null;
  onUnlockSlot: (slotId: string) => void;
  onRefundSlot: (slotId: string) => void;
  onStartCatalogDrag: (slotId: string) => void;
  onSelectPlacedOrgan: (instanceId: string | null) => void;
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
  onChangeSpineSegments: (segments: 1 | 2 | 3) => void;
  onSetSpineLength: (length: number) => void;
  onSetTorsoRadius: (segmentIndex: 0 | 1 | 2, radius: number) => void;
  onEvolveToCreatureStage: () => void;
  onRotateEditorCamera: (deltaRadians: number) => void;
  onClose: () => void;
}

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

const WORKSHOP_TABS: CategoryTabConfig[] = [
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
    shortLabel: 'Pintura',
    icon: Palette,
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
      </svg>
    </div>
  );
}

export function CreatureEditorModal({
  stats,
  slots,
  readyForLandTransition,
  selectedPlacedInstanceId,
  onUnlockSlot,
  onRefundSlot,
  onStartCatalogDrag,
  onSelectPlacedOrgan,
  onRemovePlacedOrgan,
  onUpdatePlacedOrganMorphology,
  onUpdatePlacedOrganOrientation,
  onResetPlacedOrganMorphology,
  onChangeSpeciesName,
  onChangeBodyShape,
  onChangeColorTheme,
  onSetSpineLength,
  onSetTorsoRadius,
  onEvolveToCreatureStage,
  onRotateEditorCamera,
  onClose,
}: CreatureEditorModalProps) {
  const [activeTab, setActiveTab] = useState<WorkshopTabId>('ataque');
  const [inspectedSlotId, setInspectedSlotId] = useState<string>('chitin_spike');
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';

  // Find selected placed organ instance if any
  const selectedPlacedInstance = useMemo(() => {
    if (!selectedPlacedInstanceId) return null;
    return (
      stats.placedOrgans.find(
        (o) => o.instanceId === selectedPlacedInstanceId
      ) ?? null
    );
  }, [stats.placedOrgans, selectedPlacedInstanceId]);

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

  // Filter catalog slots for current tab
  const filteredSlots = useMemo(() => {
    if (activeTab === 'apariencia') return [];
    return slots.filter((slot) => {
      if (slot.stage === 'creature_stage' && !isCreatureStage) {
        return false;
      }
      return slot.category === activeTab;
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

  // Compute speed & turn rating for Top-Right Attributes Panel
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
          Suelta sobre la membrana de tu célula 3D
        </div>
      )}

      {/* MAIN PERIPHERAL WORKSPACE: Left Palette + 60% Open Center + Right Dual Panels */}
      <div className="pointer-events-none flex min-h-0 flex-1 items-stretch justify-between gap-4 overflow-hidden">
        {/* ==================== 1. LEFT PANEL: ORGANIC SPORE PART PALETTE (~348px) ==================== */}
        <aside
          className={`pointer-events-auto flex w-[320px] sm:w-[352px] shrink-0 flex-col overflow-hidden rounded-[28px] ${MEMBRANE_PANEL_CLASS}`}
        >
          {/* Palette Header */}
          <div className="border-b border-cyan-300/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200/60 bg-gradient-to-b from-cyan-300/35 to-teal-700/40 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                  <Dna className="h-4 w-4" />
                </div>
                <h2 className="font-display text-sm font-extrabold tracking-wide text-white uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                  Nido de Órganos 3D
                </h2>
              </div>
              <span className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-100">
                Arrastrar a Célula
              </span>
            </div>
            <p className="mt-1 text-[11px] text-cyan-100/75">
              Arrastra adaptaciones vivas hacia tu organismo o pulsa Añadir
            </p>
          </div>

          {/* 7 Floating Bioluminescent Bubble Category Tabs */}
          <div className="grid grid-cols-4 gap-1.5 border-b border-cyan-300/20 bg-[#031521]/55 p-2.5">
            {WORKSHOP_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    onSelectPlacedOrgan(null);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-1.5 text-[10px] font-bold cursor-pointer hover:scale-[1.04] active:scale-95 transition-all duration-150 ${
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

          {/* Palette Body: 2-Column Grid of Organic Cellular Nodes OR Paint/Sculpt Tab */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'apariencia' ? (
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
                          onClick={() => onChangeColorTheme(theme.id)}
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
                          onClick={() => onChangeBodyShape(shape.id)}
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

                {/* Spine Length & Torso Width Fine Sliders (synced with 3D arrows & wheel) */}
                <div className="rounded-3xl border border-cyan-300/30 border-t-cyan-200/50 bg-[#031521]/65 p-3.5 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-200 uppercase">
                      Escultura de Columna 3D
                    </span>
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-200">
                      {Math.round(stats.spineLength * 100)}%
                    </span>
                  </div>
                  <label className="block">
                    <span className="text-[11px] text-cyan-100/85">
                      Longitud Axial (o arrastra las flechas 3D)
                    </span>
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

                  {(
                    [
                      'Anterior (Cabeza)',
                      'Central (Torso)',
                      'Posterior (Cola)',
                    ] as const
                  ).map((label, idx) => {
                    const segIdx = idx as 0 | 1 | 2;
                    return (
                      <label key={label} className="block">
                        <div className="flex justify-between text-[11px] text-cyan-100/85">
                          <span>Grosor {label}</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {Math.round(stats.torsoRadii[segIdx] * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={1.55}
                          step={0.04}
                          value={stats.torsoRadii[segIdx]}
                          onChange={(e) =>
                            onSetTorsoRadius(segIdx, Number(e.target.value))
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
                  const canDragOrInstall = !isLocked && !isMaxed && canAfford;
                  const isSelected = inspectedSlot?.id === slot.id;

                  return (
                    <div
                      key={slot.id}
                      onPointerEnter={() => {
                        if (!selectedPlacedInstanceId) {
                          setInspectedSlotId(slot.id);
                        }
                      }}
                      onPointerDown={(e) => {
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
                            : 'Arrastra a tu célula'}
                        </p>
                      </div>

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
                            title="Añadir pieza a la célula"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Añadir</span>
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
        <div className="pointer-events-none flex-1" />

        {/* ==================== 3. RIGHT DUAL COLUMN: TOP ATTRIBUTES + BOTTOM INSPECTOR ==================== */}
        <aside className="pointer-events-none flex w-[320px] sm:w-[360px] shrink-0 flex-col justify-between gap-3 overflow-hidden">
          {/* 3A. TOP-RIGHT PANEL: TOTAL SPECIES ATTRIBUTES */}
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
                  onKeyDown={(e) => e.stopPropagation()}
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

            {/* Quantitative Organic Capsule Attribute Grid */}
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
                Órganos vivos: {stats.placedOrgans.length}
              </span>
            </div>
          </section>

          {/* 3B. BOTTOM-RIGHT PANEL: SELECTED PART INSPECTOR */}
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

                  {/* Advanced 3D Per-Organ Morphology, Non-Uniform Scale & Individual Pigment Panel when an organ on the cell is selected */}
                  {selectedPlacedInstance && (
                    <div className="space-y-2.5 rounded-3xl border border-cyan-200/45 border-t-cyan-100/70 bg-gradient-to-b from-cyan-500/15 via-[#031521]/80 to-[#02101a]/90 p-3 shadow-[0_0_18px_rgba(34,211,238,0.2)]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-extrabold tracking-wider text-cyan-200 uppercase">
                          Morfología y Pigmento 3D
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onResetPlacedOrganMorphology(
                              selectedPlacedInstance.instanceId
                            )
                          }
                          className="rounded-full border border-cyan-300/35 bg-cyan-500/15 hover:bg-cyan-500/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-100 cursor-pointer active:scale-95 transition-all"
                          title="Restablecer escala, orientación y color de la pieza"
                        >
                          Restablecer
                        </button>
                      </div>

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
                            min={0.5}
                            max={2.2}
                            step={0.05}
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
                            <span>Anchura / Grosor</span>
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
                            min={0.5}
                            max={2.0}
                            step={0.05}
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

                        {/* Longitud / Proyección */}
                        <label className="block">
                          <div className="flex justify-between text-cyan-100/90">
                            <span>Longitud / Proyección</span>
                            <span className="font-mono font-bold text-amber-200">
                              {Math.round(
                                (selectedPlacedInstance.morphology
                                  ?.scaleHeight ?? 1.0) * 100
                              )}
                              %
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.5}
                            max={2.5}
                            step={0.05}
                            value={
                              selectedPlacedInstance.morphology?.scaleHeight ??
                              1.0
                            }
                            onChange={(e) =>
                              onUpdatePlacedOrganMorphology(
                                selectedPlacedInstance.instanceId,
                                { scaleHeight: Number(e.target.value) }
                              )
                            }
                            className="mt-0.5 w-full accent-amber-300 cursor-pointer"
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
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-300/55 bg-gradient-to-b from-rose-500/35 to-rose-900/60 px-4 py-2 text-xs font-extrabold text-rose-100 hover:from-rose-500/50 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>
                        Reabsorber pieza (+{inspectedSlot.costAdn} ADN)
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
                          stats.adn < inspectedSlot.costAdn
                        }
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-extrabold transition-all duration-150 ${
                          inspectedSlot.installedStacks <
                            inspectedSlot.maxStacks &&
                          stats.adn >= inspectedSlot.costAdn
                            ? 'border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.4),inset_0_1px_2px_rgba(255,255,255,0.75)] hover:scale-[1.02] active:scale-95 cursor-pointer'
                            : 'border border-cyan-500/20 bg-cyan-950/50 text-cyan-300/40 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        <span>
                          {inspectedSlot.installedStacks >=
                          inspectedSlot.maxStacks
                            ? 'Máximo alcanzado'
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
            onClick={() => onRotateEditorCamera(-0.45)}
            className="flex items-center gap-1.5 rounded-full border border-cyan-400/40 border-t-cyan-200/60 bg-cyan-500/20 hover:bg-cyan-500/35 px-3.5 py-1.5 text-xs font-bold text-cyan-100 shadow-[0_2px_10px_rgba(34,211,238,0.2)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
            title="Rotar cámara a la izquierda"
          >
            <RotateCcw className="h-3.5 w-3.5 text-cyan-200" />
            <span className="hidden sm:inline">Girar</span>
          </button>
          <button
            type="button"
            onClick={() => onRotateEditorCamera(0.45)}
            className="flex items-center gap-1.5 rounded-full border border-cyan-400/40 border-t-cyan-200/60 bg-cyan-500/20 hover:bg-cyan-500/35 px-3.5 py-1.5 text-xs font-bold text-cyan-100 shadow-[0_2px_10px_rgba(34,211,238,0.2)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
            title="Rotar cámara a la derecha"
          >
            <RotateCw className="h-3.5 w-3.5 text-cyan-200" />
            <span className="hidden sm:inline">Girar</span>
          </button>
        </div>

        {/* Center: Spore Workshop Direct Manipulation Instructions */}
        <div className="flex items-center gap-2 text-center text-[11px] text-cyan-100/90">
          <GripHorizontal className="hidden h-4 w-4 text-cyan-300 md:inline" />
          <span>
            <strong className="text-amber-300">Taller Spore 3D:</strong> Arrastra
            órganos a la membrana ·{' '}
            <strong className="text-cyan-200">Clic derecho + arrastrar</strong>{' '}
            para orbitar · Usa las{' '}
            <strong className="text-emerald-300">flechas 3D</strong> o la{' '}
            <strong className="text-emerald-300">rueda</strong> sobre las vértebras
          </span>
        </div>

        {/* Right: Terrestrial Evolution Jump (if ready) + Golden Bubble Confirm Button [E] */}
        <div className="flex items-center gap-2">
          {readyForLandTransition && !isCreatureStage && (
            <button
              type="button"
              onClick={onEvolveToCreatureStage}
              className="flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-gradient-to-b from-emerald-300 via-teal-400 to-emerald-500 px-4 py-2 font-display text-xs font-extrabold text-slate-950 shadow-[0_4px_16px_rgba(52,211,153,0.45),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
            >
              <Footprints className="h-4 w-4" />
              <span>Evolucionar a Criatura Terrestre</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-full border border-amber-100/85 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-5 py-2 font-display text-xs font-extrabold text-slate-950 shadow-[0_4px_16px_rgba(251,191,36,0.45),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isCreatureStage
                ? 'Eclosionar en la Costa [E]'
                : 'Eclosionar al Océano [E]'}
            </span>
          </button>
        </div>
      </footer>
    </motion.div>
  );
}
