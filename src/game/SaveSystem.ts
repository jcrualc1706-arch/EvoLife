import {
  CellBodyShape,
  CellColorTheme,
  CellularGrowthStage,
  DietType,
  EvolutionaryStage,
  InnateTraitId,
  PlacedOrganInstance,
  PlanetSlotMetadata,
  PlanetTheme,
} from './types';

export interface PlanetCatalogDefinition {
  slotId: number;
  planetName: string;
  planetTheme: PlanetTheme;
  orbitRadius: number;
  planetRadius: number;
  axialTilt: number;
  hasRings: boolean;
  subtitle: string;
  atmosphereDesc: string;
}

export const PLANET_CATALOG: readonly PlanetCatalogDefinition[] = [
  {
    slotId: 1,
    planetName: 'Aethel Prime',
    planetTheme: 'oceanic',
    orbitRadius: 28,
    planetRadius: 2.35,
    axialTilt: 0.24,
    hasRings: false,
    subtitle: 'Mundo Thalásico Bioluminiscente',
    atmosphereDesc: 'Océanos profundos ricos en sílice y corrientes termales',
  },
  {
    slotId: 2,
    planetName: 'Pyros II',
    planetTheme: 'volcanic',
    orbitRadius: 42,
    planetRadius: 2.1,
    axialTilt: 0.18,
    hasRings: false,
    subtitle: 'Protoplaneta Volcánico Activo',
    atmosphereDesc: 'Mares de basalto líquido, fumarolas y azufre ionizado',
  },
  {
    slotId: 3,
    planetName: 'Gaea-9',
    planetTheme: 'terrene',
    orbitRadius: 58,
    planetRadius: 2.55,
    axialTilt: 0.32,
    hasRings: false,
    subtitle: 'Super-Tierra Clorofílica',
    atmosphereDesc: 'Archipiélagos esmeralda, mares templados y denso oxígeno',
  },
  {
    slotId: 4,
    planetName: 'Kalyx IV',
    planetTheme: 'crystalline',
    orbitRadius: 76,
    planetRadius: 2.75,
    axialTilt: 0.41,
    hasRings: true,
    subtitle: 'Gigante de Cuarzo y Anillos de Hielo',
    atmosphereDesc: 'Océanos subglaciales refractivos bajo anillos minerales',
  },
  {
    slotId: 5,
    planetName: 'Dune-V',
    planetTheme: 'desertic',
    orbitRadius: 96,
    planetRadius: 2.25,
    axialTilt: 0.28,
    hasRings: false,
    subtitle: 'Mundo Árido de Oasis Salinos',
    atmosphereDesc: 'Cuencas evaporíticas ámbar y mares interiores alcalinos',
  },
  {
    slotId: 6,
    planetName: 'Xylar VI',
    planetTheme: 'toxic',
    orbitRadius: 118,
    planetRadius: 2.9,
    axialTilt: 0.46,
    hasRings: true,
    subtitle: 'Exomundo Nebular Quimiosintético',
    atmosphereDesc: 'Mares de amoníaco bioluminiscente y esporas exóticas',
  },
];

export interface SlotSavePayload {
  stats: {
    speciesName: string;
    bodyShape: CellBodyShape;
    colorTheme: CellColorTheme;
    spineSegments: 1 | 2 | 3;
    spineLength: number;
    torsoRadii: [number, number, number];
    placedOrgans: PlacedOrganInstance[];
    evolutionaryStage: EvolutionaryStage;
    innateTrait: InnateTraitId;
    diet?: DietType;
    health: number;
    energy: number;
    adn: number;
    totalAdnEarned: number;
    growthStage: CellularGrowthStage;
    foodEaten: number;
    survivalTime: number;
  };
  unlockedSlotIds: string[];
  discoveredAdaptationIds: string[];
  installedAdaptations: Record<string, number>;
  completedQuestStep: number;
  savedAt?: number;
  savedPosition?: { x: number; z: number };
}

export class SaveSystem {
  public static readonly INDEX_STORAGE_KEY = 'evolife_slots_index_v1';
  public static readonly LEGACY_STORAGE_KEY = 'evolife_cellular_save_v1';
  private static readonly SLOT_KEY_PREFIX = 'evolife_save_slot_';

  public static getSlotStorageKey(slotId: number): string {
    const safeId = Math.max(1, Math.min(6, Math.floor(slotId)));
    return `${SaveSystem.SLOT_KEY_PREFIX}${safeId}`;
  }

  public static getDefaultSlotsMetadata(): PlanetSlotMetadata[] {
    return PLANET_CATALOG.map((def) => ({
      slotId: def.slotId,
      planetName: def.planetName,
      planetTheme: def.planetTheme,
      hasSave: false,
    }));
  }

  /**
   * Loads the 6 planetary save slots metadata and automatically migrates
   * any legacy single-slot save into Slot 1 if Slot 1 is empty.
   */
  public static loadAllPlanetSlots(): PlanetSlotMetadata[] {
    SaveSystem.migrateLegacySaveIfNeeded();

    const defaults = SaveSystem.getDefaultSlotsMetadata();
    try {
      const rawIndex = localStorage.getItem(SaveSystem.INDEX_STORAGE_KEY);
      const parsedIndex: Partial<PlanetSlotMetadata>[] = rawIndex
        ? JSON.parse(rawIndex)
        : [];

      const result: PlanetSlotMetadata[] = defaults.map((def) => {
        const storedMeta = Array.isArray(parsedIndex)
          ? parsedIndex.find((item) => item && Number(item.slotId) === def.slotId)
          : undefined;

        const rawSlot = localStorage.getItem(
          SaveSystem.getSlotStorageKey(def.slotId)
        );
        if (!rawSlot) {
          return {
            ...def,
            hasSave: false,
          };
        }

        const parsedSlot = JSON.parse(rawSlot) as SlotSavePayload | null;
        if (
          !parsedSlot ||
          typeof parsedSlot !== 'object' ||
          !parsedSlot.stats ||
          typeof parsedSlot.stats.health !== 'number' ||
          parsedSlot.stats.health <= 0
        ) {
          return {
            ...def,
            hasSave: false,
          };
        }

        const stats = parsedSlot.stats;
        const growthRaw = Number(stats.growthStage);
        const validGrowth: CellularGrowthStage =
          growthRaw >= 1 && growthRaw <= 5
            ? (growthRaw as CellularGrowthStage)
            : 1;

        return {
          slotId: def.slotId,
          planetName: def.planetName,
          planetTheme: def.planetTheme,
          hasSave: true,
          speciesName:
            typeof stats.speciesName === 'string' &&
            stats.speciesName.trim().length > 0
              ? stats.speciesName.trim()
              : storedMeta?.speciesName || 'Organismo Primigenio',
          growthStage: validGrowth,
          evolutionaryStage:
            stats.evolutionaryStage === 'creature_stage'
              ? 'creature_stage'
              : 'cell_stage',
          diet:
            stats.diet === 'carnivore' ||
            stats.diet === 'omnivore' ||
            stats.diet === 'herbivore'
              ? stats.diet
              : storedMeta?.diet || SaveSystem.inferDietFromPayload(parsedSlot),
          innateTrait:
            stats.innateTrait === 'thermophilic_cytoplasm' ||
            stats.innateTrait === 'voracious_chemotaxis' ||
            stats.innateTrait === 'abyssal_bioluminescence'
              ? stats.innateTrait
              : 'elastic_membrane',
          colorTheme:
            stats.colorTheme === 'emerald' ||
            stats.colorTheme === 'crimson' ||
            stats.colorTheme === 'violet'
              ? stats.colorTheme
              : 'cyan',
          bodyShape:
            stats.bodyShape === 'esferico' || stats.bodyShape === 'alargado'
              ? stats.bodyShape
              : 'fusiforme',
          adn: Math.max(0, Number(stats.adn) || 0),
          totalAdnEarned: Math.max(0, Number(stats.totalAdnEarned) || 0),
          survivalTime: Math.max(0, Number(stats.survivalTime) || 0),
          lastPlayedTimestamp:
            Number(parsedSlot.savedAt) ||
            Number(storedMeta?.lastPlayedTimestamp) ||
            Date.now(),
        };
      });

      SaveSystem.persistIndex(result);
      return result;
    } catch {
      return defaults;
    }
  }

  public static loadSlotPayload(slotId: number): SlotSavePayload | null {
    try {
      const raw = localStorage.getItem(SaveSystem.getSlotStorageKey(slotId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SlotSavePayload;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.stats ||
        typeof parsed.stats.health !== 'number' ||
        parsed.stats.health <= 0
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public static saveSlotPayload(
    slotId: number,
    payload: SlotSavePayload
  ): PlanetSlotMetadata[] {
    const safeId = Math.max(1, Math.min(6, Math.floor(slotId)));
    try {
      const stamped: SlotSavePayload = {
        ...payload,
        savedAt: Date.now(),
      };
      localStorage.setItem(
        SaveSystem.getSlotStorageKey(safeId),
        JSON.stringify(stamped)
      );
      // Also mirror to legacy key if slot 1 for seamless fallback
      if (safeId === 1) {
        localStorage.setItem(
          SaveSystem.LEGACY_STORAGE_KEY,
          JSON.stringify(stamped)
        );
      }
    } catch {
      // Ignore quota errors
    }
    return SaveSystem.loadAllPlanetSlots();
  }

  public static deleteSlotSave(slotId: number): PlanetSlotMetadata[] {
    const safeId = Math.max(1, Math.min(6, Math.floor(slotId)));
    try {
      localStorage.removeItem(SaveSystem.getSlotStorageKey(safeId));
      if (safeId === 1) {
        localStorage.removeItem(SaveSystem.LEGACY_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    return SaveSystem.loadAllPlanetSlots();
  }

  private static migrateLegacySaveIfNeeded(): void {
    try {
      const slot1Key = SaveSystem.getSlotStorageKey(1);
      const existingSlot1 = localStorage.getItem(slot1Key);
      if (existingSlot1) return;

      const legacyRaw = localStorage.getItem(SaveSystem.LEGACY_STORAGE_KEY);
      if (!legacyRaw) return;

      const parsed = JSON.parse(legacyRaw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.stats &&
        typeof parsed.stats.health === 'number' &&
        parsed.stats.health > 0
      ) {
        localStorage.setItem(slot1Key, legacyRaw);
      }
    } catch {
      // Ignore corrupt legacy data
    }
  }

  private static persistIndex(slots: PlanetSlotMetadata[]): void {
    try {
      localStorage.setItem(
        SaveSystem.INDEX_STORAGE_KEY,
        JSON.stringify(slots)
      );
    } catch {
      // Ignore storage errors
    }
  }

  private static inferDietFromPayload(payload: SlotSavePayload): DietType {
    const organs = Array.isArray(payload.stats?.placedOrgans)
      ? payload.stats.placedOrgans
      : [];
    let hasCarnivore = false;
    let hasHerbivore = false;
    let hasOmnivore = false;

    for (const org of organs) {
      const id = org?.adaptationId || '';
      if (id === 'mouth_proboscis' || id === 'mouth_suction_cup') {
        hasOmnivore = true;
      } else if (
        id === 'mouth_jaw' ||
        id === 'mouth_crusher_mandibles' ||
        id === 'mouth_needle_proboscis'
      ) {
        hasCarnivore = true;
      } else if (
        id === 'mouth_filter' ||
        id === 'mouth_radula' ||
        id === 'mouth_filter_baleen' ||
        id === 'chloroplast_1'
      ) {
        hasHerbivore = true;
      }
    }

    if (hasOmnivore || (hasCarnivore && hasHerbivore)) return 'omnivore';
    if (hasCarnivore) return 'carnivore';
    return 'herbivore';
  }
}
