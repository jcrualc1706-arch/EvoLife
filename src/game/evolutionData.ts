import { CellAdaptationDefinition } from './types';

/**
 * Diminishing returns formula for stackable adaptations:
 * Total Benefit = Base * (1 + 0.6 * (Copies - 1))
 */
export function computeStackedMultiplier(stacks: number): number {
  if (stacks <= 0) return 0;
  return 1 + 0.6 * (stacks - 1);
}

/**
 * Maps legacy adaptation IDs from previous save versions to the unified catalog IDs.
 */
export const LEGACY_ADAPTATION_ID_MAP: Readonly<Record<string, string>> = {
  rostral_spines: 'chitin_spike',
  flagellum_2: 'simple_flagellum',
  flagellum: 'simple_flagellum',
};

export function normalizeAdaptationId(id: string): string {
  return LEGACY_ADAPTATION_ID_MAP[id] ?? id;
}

/**
 * Adaptations installed by default on a newborn primordial cell (1 stack each).
 */
export const INITIAL_INSTALLED_ADAPTATIONS: Readonly<Record<string, number>> = {
  mouth_filter: 1,
  simple_flagellum: 1,
  eye_photoreceptor: 1,
};

/**
 * Complete Data-Driven Catalog of Cellular & Terrestrial Adaptations.
 */
export const ADAPTATION_CATALOG: readonly CellAdaptationDefinition[] = [
  // ============================================================================
  // 1. ALIMENTACIÓN (Bocas y Aparatos Digestivos)
  // ============================================================================
  {
    id: 'mouth_filter',
    name: 'Boca Filtradora Ciliar',
    veiledName: 'Señal genética: Aparato Filtrador',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 10,
    discoverySource: 'initial',
    discoveryHint: 'Patrón genético basal presente desde el origen celular.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Tamiz bucal bioluminiscente especializado en filtrar fitoplancton, esporas y materia vegetal con alta eficiencia energética.',
    statSummary: 'Dieta Herbívora · +20% Energía Vegetal',
    pros: [
      'Dieta Herbívora: Digiere flora y algas abisales',
      '+20% de Energía obtenida al consumir materia vegetal',
    ],
    tradeoffs: ['Incapaz de digerir fragmentos de carne o depredar células'],
    incompatibilities: [
      'Compatible o sustituible por Mandíbula Aserrada / Probóscide',
    ],
    modifiers: {
      grantsDiet: 'herbivore',
      creatureBite: 1,
      creatureSing: 1,
    },
  },
  {
    id: 'mouth_jaw',
    name: 'Mandíbula Aserrada',
    veiledName: 'Señal genética: Pinzas Quitinosas',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 15,
    discoverySource: 'initial',
    discoveryHint:
      'Disponible en el genoma basal para divergencia trófica carnívora.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Potentes pinzas quitinosas frontales que cambian tu dieta a Carnívora, permitiendo desgarrar carne y devorar células filtradoras.',
    statSummary: 'Dieta Carnívora · Mordisco Nv.1 · Cantar Nv.1',
    pros: [
      'Dieta Carnívora: Digiere carne y caza Células Filtradoras',
      '+15 Daño de mordida frontal (Mordisco Nv.1 y Cantar Nv.1 en tierra)',
    ],
    tradeoffs: [
      'Pierde capacidad de digerir algas (salvo con Boca Filtradora o Cloroplastos)',
    ],
    incompatibilities: ['Desactiva la digestión vegetal exclusiva'],
    modifiers: {
      grantsDiet: 'carnivore',
      contactDamageBonus: 15,
      creatureBite: 1,
      creatureSing: 1,
    },
  },
  {
    id: 'mouth_proboscis',
    name: 'Probóscide Perforadora',
    veiledName: 'Señal genética: Órgano Succionador',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 25,
    discoverySource: 'predator_kill',
    discoveryHint:
      'Aísla un Nódulo Genético tras derrotar o carroñear una Mandíbula Rápida.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Tubo succionador retráctil que otorga Dieta Omnívora total (vegetal y carne), +25% de energía por alimento y drena +5 ADN en combate.',
    statSummary: 'Dieta Omnívora · Mordisco Nv.1 · Cantar Nv.1',
    pros: [
      'Dieta Omnívora total: Asimila tanto algas como carne',
      '+25% Energía por nutriente y otorga Mordisco Nv.1 y Cantar Nv.1 en tierra',
    ],
    tradeoffs: ['Menor daño de desgarro frontal que la Mandíbula Aserrada'],
    modifiers: {
      grantsDiet: 'omnivore',
      creatureBite: 1,
      creatureSing: 1,
    },
  },
  {
    id: 'mouth_radula',
    name: 'Rádula Raspadora',
    veiledName: 'Señal genética: Placa Dentada Ventral',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 18,
    discoverySource: 'initial',
    discoveryHint: 'Disponible en el genoma basal y en células raspadoras de sustrato.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Placa quitinosa ventral rugosa en forma de pico curvo con hileras de diminutos dientes quitinosos para raspar algas incrustadas en rocas y suelo.',
    statSummary: 'Dieta Herbívora · +40% Ingesta Vegetal · +4 Energía/Planta',
    pros: [
      'Dieta Herbívora eficiente: +40% velocidad de ingestión vegetal',
      'Otorga +4 de Energía extra por cada planta o espora consumida',
    ],
    tradeoffs: ['Optimizada para flora; no desgarra blindajes carnívoros'],
    modifiers: {
      grantsDiet: 'herbivore',
      creatureBite: 1,
      creatureSing: 1,
    },
  },
  {
    id: 'mouth_suction_cup',
    name: 'Ventosa Osmótica',
    veiledName: 'Señal genética: Disco Succionador Anillado',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 22,
    discoverySource: 'scavenge_carcass',
    discoveryHint: 'Aísla secreciones y restos de organismos filtradores abisales.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Disco circular carnoso con bordes anillados retráctiles y orificio central pulsante. Se adhiere temporalmente a células cercanas drenando ADN y energía.',
    statSummary: 'Dieta Omnívora · Drena +3 ADN/s y +6 Energía/s · -10% Giro',
    pros: [
      'Dieta Omnívora de succión: Asimila materia vegetal y orgánica',
      'Drena pasivamente +3 ADN/s y +6 Energía/s al adherirse a células grandes',
    ],
    tradeoffs: ['-10% velocidad de giro por resistencia hidrodinámica del disco'],
    modifiers: {
      grantsDiet: 'omnivore',
      turnRateBonusPct: -0.1,
      creatureBite: 1,
      creatureSing: 1,
    },
  },
  {
    id: 'mouth_crusher_mandibles',
    name: 'Mandíbulas Trituradoras',
    veiledName: 'Señal genética: Tenazas Calcificadas Pesadas',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 25,
    discoverySource: 'predator_kill',
    discoveryHint: 'Extraído al abatir o repeler Megacélulas Acorazadas.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Dos tenazas pesadas, gruesas y calcificadas en color violeta oscuro que chocan frontalmente quebrando caparazones.',
    statSummary: 'Dieta Carnívora · +18 Daño · Ignora 50% Blindaje · -8% Vel.',
    pros: [
      'Dieta Carnívora pesada: Causa +18 de Daño de mordisco frontal',
      'Ignora el 50% del blindaje o defensa de presas y células acorazadas',
    ],
    tradeoffs: ['-8% velocidad de nado debido al elevado peso craneal'],
    modifiers: {
      grantsDiet: 'carnivore',
      contactDamageBonus: 18,
      speedBonusPct: -0.08,
      creatureBite: 1,
      creatureSing: 1,
    },
  },
  {
    id: 'mouth_filter_baleen',
    name: 'Filtro Barbas de Ballena Microbiano',
    veiledName: 'Señal genética: Cortina Filtradora Áurea',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 24,
    discoverySource: 'fossil_fragment',
    discoveryHint: 'Examina nódulos fósiles en la Pradera Bioluminiscente.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Cámara frontal ancha translúcida rodeada por una cortina densa de filamentos dorados vibrátiles que atraen nutrientes.',
    statSummary: 'Dieta Herbívora · Absorción Vegetal en Radio 4.5m',
    pros: [
      'Dieta Herbívora de gran radio',
      'Absorbe automáticamente materia vegetal flotante en un radio ampliado de 4.5m',
    ],
    tradeoffs: ['Especializado en filtración de flora en suspensión'],
    modifiers: {
      grantsDiet: 'herbivore',
      creatureBite: 1,
      creatureSing: 1,
    },
  },
  {
    id: 'mouth_needle_proboscis',
    name: 'Aguijón Inyector Vampírico',
    veiledName: 'Señal genética: Estilete Capilar Carmesí',
    category: 'alimentacion',
    stage: 'cell_stage',
    dnaCost: 25,
    discoverySource: 'predator_kill',
    discoveryHint: 'Derrota parásitos y cazadores veloces en el Arrecife Abisal.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Aguja hueca translúcida y afilada de tonalidad carmesí con capilares internos visibles que inyectan enzimas digestivas al embestir.',
    statSummary: 'Dieta Carnívora/Parásita · +15 Daño · +50% Robo Vida · +6 ADN',
    pros: [
      'Al embestir de frente clava el estilete causando +15 de Daño instantáneo',
      'Recupera el 50% del daño en Vida propia y drena +6 ADN de la víctima',
    ],
    tradeoffs: ['Requiere impacto frontal directo para inyectar la enzima'],
    modifiers: {
      grantsDiet: 'carnivore',
      contactDamageBonus: 15,
      creatureBite: 1,
      creatureSing: 1,
    },
  },

  // ============================================================================
  // 2. ATAQUE (Armas Biológicas Activas y Pasivas)
  // ============================================================================
  {
    id: 'chitin_spike',
    name: 'Espolón Quitinizado',
    veiledName: 'Señal genética: Púa Calcificada',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 15,
    discoverySource: 'predator_kill',
    discoveryHint:
      'Extrae el Nódulo Genético de un depredador abatido o de un Fósil en el Arrecife Abisal.',
    stackable: true,
    maxStacks: 4,
    socketType: 'any',
    description:
      'Púas calcificadas multi-anclaje. En fase celular repelen depredadores; en tierra otorgan Embestida Nv. 1 como alternativa económica.',
    statSummary: 'Embestida Nv.1 · Defensa Punzante · Apilable (x4)',
    pros: [
      'Embestida frontal (<3.6m) en mar y Embestida Nv.1 en Criatura Terrestre',
      '2 a 4 copias: Púas laterales/traseras que hieren y repelen al atacante (+8 ADN)',
    ],
    tradeoffs: [
      '-3% Velocidad máxima por copia debido a la densidad quitinosa',
    ],
    modifiers: {
      contactDamageBonus: 18,
      speedBonusPct: -0.03,
      unlocksAbilityId: 'ram_dash',
      creatureCharge: 1,
    },
  },
  {
    id: 'poison_gland',
    name: 'Glándula de Toxinas',
    veiledName: 'Señal genética: Vesícula Tóxica',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 20,
    discoverySource: 'scavenge_carcass',
    discoveryHint:
      'Aísla el Nódulo Genético cerca de restos celulares o en la Fosa Hidrotermal.',
    stackable: true,
    maxStacks: 3,
    socketType: 'rear',
    description:
      'Vesícula posterior bioluminiscente que libera nubes tóxicas en el océano y otorga Escupir Nv. 1 en el Estadio de Criatura.',
    statSummary: 'Escupir Nv.1 · Nube Tóxica (Q / Auto) · -45% Vel. Enemiga',
    pros: [
      'Libera nube citotóxica en agua y otorga Escupir Nv.1 en Criatura Terrestre',
      'Cada copia extra amplía un +35% el radio y duración de la nube',
    ],
    tradeoffs: ['+5% Gasto energético basal por síntesis continua de toxinas'],
    modifiers: {
      passiveDrainMultiplier: 1.05,
      unlocksAbilityId: 'poison_cloud',
      creatureSpit: 1,
    },
  },
  {
    id: 'electric_cell',
    name: 'Órgano Bioeléctrico',
    veiledName: 'Señal genética: Nodo Electrogénico',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 25,
    discoverySource: 'predator_kill',
    discoveryHint:
      'Aísla el genoma de una Megacélula Acorazada o analiza un Fósil del Arrecife Abisal.',
    stackable: false,
    maxStacks: 1,
    socketType: 'lateral',
    description:
      'Nodos bioeléctricos laterales que emiten un pulso de área de 9.5m al pulsar Q y otorgan Fascinar Nv. 1 por destello bioeléctrico en tierra.',
    statSummary: 'Fascinar Nv.1 · Pulso 9.5m (Tecla Q) · Aturde 3.2s',
    pros: [
      'Descarga radial de 9.5m (Tecla Q) que aturde depredadores 3.2s',
      'Otorga Fascinar Nv.1 en el Estadio de Criatura Terrestre',
    ],
    tradeoffs: ['Consume 12 de Energía por descarga (6.0s de enfriamiento)'],
    modifiers: {
      unlocksAbilityId: 'electric_pulse',
      creatureCharm: 1,
    },
  },
  {
    id: 'acid_spit',
    name: 'Glándula de Escupitajo Ácido',
    veiledName: 'Señal genética: Saco Maxilar Ácido',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 45,
    discoverySource: 'predator_kill',
    discoveryHint:
      'Extrae un Nódulo Genético tras abatir o repeler un cazador Mandíbula Rápida.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Sacos maxilares verde neón que disparan un proyectil ácido 3D auto-dirigido al pulsar Q (8 Energía, 2.5s recarga) hacia el enemigo frontal más cercano (<24m).',
    statSummary: 'Proyectil Ácido 24m (Tecla Q) · Envenena + Derriba',
    pros: [
      'Disparo a distancia (24m) con puntería asistida en cono frontal',
      'Derriba depredadores (+10 ADN) o abate presas (+18 ADN) sin contacto',
    ],
    tradeoffs: ['Consume 8 de Energía por disparo (2.5s de recarga)'],
    modifiers: {
      unlocksAbilityId: 'acid_spit',
    },
  },
  {
    id: 'weapon_harpoon_cell',
    name: 'Nematocisto / Arpón Celular',
    veiledName: 'Señal genética: Cápsula Cnidaria',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 28,
    discoverySource: 'scavenge_carcass',
    discoveryHint: 'Aísla restos de organismos cnidarios flotantes o carroña marina.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Cápsula ovoide presurizada con un filamento espinoso enrollado listo para dispararse hacia adelante al detectar presas o enemigos cercanos.',
    statSummary: 'Arpón Reactivo (<6m) · Atrapa y Atrae · +14 Daño',
    pros: [
      'Al detectar un enemigo a <6m dispara un micro-filamento que lo atrapa y atrae',
      'Inflige 14 de daño directo por impacto del arpón',
    ],
    tradeoffs: ['Requiere recarga osmótica tras cada disparo de filamento'],
    modifiers: {
      contactDamageBonus: 14,
    },
  },
  {
    id: 'weapon_rotary_drill',
    name: 'Taladro Calcificado de Membrana',
    veiledName: 'Señal genética: Cuerno Helicoidal',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 32,
    discoverySource: 'fossil_fragment',
    discoveryHint: 'Analiza restos de perforadores en la Fosa Hidrotermal.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Cuerno cónico en espiral helicoidal dorado que rota a gran velocidad sobre su propio eje triturando escudos enemigos.',
    statSummary: 'Perforación Continua: 12 Daño/s (Ignora Escudos) · -1.5 Energía/s',
    pros: [
      'Causa 12 de daño perforante por segundo al empujar contra un enemigo',
      'Ignora por completo escudos y caparazones defensivos',
    ],
    tradeoffs: ['Drena 1.5 Energía/s adicional debido a la fricción rotatoria'],
    modifiers: {
      contactDamageBonus: 16,
      passiveDrainMultiplier: 1.12,
    },
  },
  {
    id: 'weapon_caustic_acid_blister',
    name: 'Vesícula de Ácido Cáustico',
    veiledName: 'Señal genética: Ampolla Corrosiva',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 30,
    discoverySource: 'biome_exposure',
    discoveryHint: 'Sobrevive cerca de las fumarolas sulfurosas de la Fosa Hidrotermal.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Ampolla membranosa semitransparente verde amarillenta con núcleo corrosivo que estalla al recibir un golpe físico.',
    statSummary: 'Veneno +2 · Estallido Reactivo: 15 Daño y -30% Armadura',
    pros: [
      'Otorga Nivel de Veneno +2 a la especie',
      'Al sufrir un golpe estalla quemando 15 de vida al agresor y disolviendo 30% su armadura',
    ],
    tradeoffs: ['Membrana volátil sensible a colisiones bruscas'],
    modifiers: {
      contactDamageBonus: 15,
    },
  },
  {
    id: 'weapon_flash_photophore',
    name: 'Fotóforo Cegador / Pulso Lumínico',
    veiledName: 'Señal genética: Lente de Fósforo Abisal',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 24,
    discoverySource: 'biome_exposure',
    discoveryHint: 'Explora células bioluminiscentes en aguas profundas.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Perla cóncava reflectante con lente de cristal y núcleo de fósforo hiperbrillante que emite un destello cegador al pulsar Q.',
    statSummary: 'Fogonazo 8m (Tecla Q) · Desorienta 2.5s (DEAMBULAR)',
    pros: [
      'Al pulsar Q emite un fogonazo lumínico en un radio de 8m',
      'Desorienta a los depredadores forzándolos a DEAMBULAR sin rumbo durante 2.5s',
    ],
    tradeoffs: ['Consume 6 de Energía por destello lumínico'],
    modifiers: {
      unlocksAbilityId: 'flash_photophore',
    },
  },
  {
    id: 'weapon_tail_club',
    name: 'Maza Quitinizada Caudal',
    veiledName: 'Señal genética: Nódulo Óseo Caudal',
    category: 'ataque',
    stage: 'cell_stage',
    dnaCost: 22,
    discoverySource: 'scavenge_carcass',
    discoveryHint: 'Extrae carroña de organismos acorazados.',
    stackable: false,
    maxStacks: 1,
    socketType: 'rear',
    description:
      'Esfera pesada remachada con nódulos óseos en el extremo trasero de la columna que propina coletazos demoledores.',
    statSummary: 'Coletazo Trasero: 20 Daño + Empuje de 8m',
    pros: [
      'Al girar bruscamente o sufrir persecución trasera golpea con 20 de daño',
      'Empuja 8m hacia atrás al perseguidor despejando tu huida',
    ],
    tradeoffs: ['-4% agilidad de giro por la inercia de la maza caudal'],
    modifiers: {
      contactDamageBonus: 20,
      turnRateBonusPct: -0.04,
    },
  },

  // ============================================================================
  // 3. DEFENSA (Protección Estructural y Homeostasis)
  // ============================================================================
  {
    id: 'membrane_armor',
    name: 'Caparazón de Queratina',
    veiledName: 'Señal genética: Placa Dérmica',
    category: 'defensa',
    stage: 'cell_stage',
    dnaCost: 40,
    discoverySource: 'fossil_fragment',
    discoveryHint:
      'Examina un Fósil Abisal en el Arrecife Abisal o repele una Megacélula Acorazada.',
    stackable: true,
    maxStacks: 2,
    socketType: 'dorsal',
    description:
      'Recubre el dorso y flancos celulares con placas quitinizadas translúcidas que amortiguan las mordidas de los depredadores y amplían la vitalidad.',
    statSummary: '+40 Vida Máx. · -30% Daño Recibido · Apilable (x2)',
    pros: [
      '+40 Vida Máxima base (+64 Vida Máxima con 2 copias instaladas)',
      'Reduce el daño recibido por mordidas un 30% (48% con 2 copias)',
    ],
    tradeoffs: ['-5% Velocidad de desplazamiento por rigidez de la corteza'],
    modifiers: {
      maxHealthBonus: 40,
      damageReductionPct: 0.3,
      speedBonusPct: -0.05,
    },
  },
  {
    id: 'neutralizer_vesicle',
    name: 'Vesícula Neutralizadora',
    veiledName: 'Señal genética: Vacuola Termófila',
    category: 'defensa',
    stage: 'cell_stage',
    dnaCost: 30,
    discoverySource: 'biome_exposure',
    discoveryHint:
      'Sumérgete en las fumarolas de la Fosa Hidrotermal (sector oeste, >34m) para aislar este gen.',
    stackable: false,
    maxStacks: 1,
    socketType: 'dorsal',
    description:
      'Vacuolas homeostáticas dorsales que neutralizan agentes corrosivos, otorgan +25 Vida Máxima y duplican la regeneración en Fumarolas Hidrotermales.',
    statSummary: '+25 Vida Máx. · Regen. Termal x2 (+6 Energía/s)',
    pros: [
      '+25 Vida Máxima y resistencia térmica/química superior',
      'En Fumarolas Hidrotermales regenera +6 Energía/s y +3 Vida/s',
    ],
    tradeoffs: ['Luminiscencia dorsal visible en aguas oscuras'],
    modifiers: {
      maxHealthBonus: 25,
      damageReductionPct: 0.1,
    },
  },
  {
    id: 'defense_silica_spicules',
    name: 'Espículas de Sílice',
    veiledName: 'Señal genética: Agujas Vítreas de Esponja',
    category: 'defensa',
    stage: 'cell_stage',
    dnaCost: 16,
    discoverySource: 'fossil_fragment',
    discoveryHint: 'Aísla fósiles de esponjas primitivas en el lecho marino.',
    stackable: true,
    maxStacks: 3,
    socketType: 'any',
    description:
      'Grupo de 3 agujas cristalinas translúcidas de sílice que sobresalen de la membrana devolviendo parte del daño recibido.',
    statSummary: 'Defensa Reflectiva: Devuelve 35% del Daño Recibido',
    pros: [
      'Cualquier enemigo que te muerda sufre un 35% de retroceso de su propio daño',
      'Otorga +8% de Blindaje estructural adicional por copia',
    ],
    tradeoffs: ['No previene el impacto inicial, pero castiga al agresor'],
    modifiers: {
      damageReductionPct: 0.08,
      contactDamageBonus: 8,
    },
  },
  {
    id: 'defense_mucus_gland',
    name: 'Glándula de Mucílago Resbaladizo',
    veiledName: 'Señal genética: Poro Mucilaginoso',
    category: 'defensa',
    stage: 'cell_stage',
    dnaCost: 20,
    discoverySource: 'scavenge_carcass',
    discoveryHint: 'Analiza restos de organismos viscosos de fondo.',
    stackable: false,
    maxStacks: 1,
    socketType: 'lateral',
    description:
      'Nódulos porosos azul-turquesa que secretan un halo brillante gelatinoso sobre la membrana haciendo resbalar los mordiscos.',
    statSummary: '40% Prob. Esquiva por Resbale · +50% Resist. Empuje',
    pros: [
      '40% de probabilidad de que un mordisco enemigo resbale sin causar daño',
      '+50% resistencia al empuje y derribo en colisiones',
    ],
    tradeoffs: ['Ligero consumo metabólico para regenerar la película mucosa'],
    modifiers: {
      damageReductionPct: 0.15,
    },
  },
  {
    id: 'defense_hydrothermal_carapace',
    name: 'Caparazón Termo-Sulfuroso',
    veiledName: 'Señal genética: Corteza Basáltica Termal',
    category: 'defensa',
    stage: 'cell_stage',
    dnaCost: 32,
    discoverySource: 'biome_exposure',
    discoveryHint: 'Permanece 15s en la Fosa Hidrotermal para cristalizar este caparazón.',
    stackable: false,
    maxStacks: 1,
    socketType: 'dorsal',
    description:
      'Escudos basálticos negros de textura volcánica rugosa con vetas incandescentes naranjas que inmunizan contra toxinas y calor extremo.',
    statSummary: '+35 Vida Máx. · 100% Inmune a Veneno/Calor · -10% Giro',
    pros: [
      '+35 Vida Máxima y +25% Blindaje pesado',
      '100% de inmunidad a quemaduras térmicas y nubes de veneno ajenas',
    ],
    tradeoffs: ['-10% agilidad de giro por la densidad de las placas basálticas'],
    modifiers: {
      maxHealthBonus: 35,
      damageReductionPct: 0.25,
      turnRateBonusPct: -0.1,
    },
  },
  {
    id: 'defense_chitin_shield_plate',
    name: 'Placa Frontal de Escudo',
    veiledName: 'Señal genética: Escudo Rostral Quitinizado',
    category: 'defensa',
    stage: 'cell_stage',
    dnaCost: 25,
    discoverySource: 'predator_kill',
    discoveryHint: 'Abate o repele depredadores costeros acorazados.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Escudo dorsal plano y angular en forma de hoja quitinosa gruesa orientable mediante el manipulador 3D.',
    statSummary: 'Bloquea 60% del Daño Frontal Directo · +20% Blindaje',
    pros: [
      'Bloquea un 60% del daño frontal directo en embestidas cuerpo a cuerpo',
      'Orientable con el tirador 3D para cubrir el ángulo deseado',
    ],
    tradeoffs: ['No protege la retaguardia frente a emboscadas traseras'],
    modifiers: {
      damageReductionPct: 0.2,
      maxHealthBonus: 15,
    },
  },
  {
    id: 'defense_camouflage_chromatophores',
    name: 'Cromatóforos de Camuflaje',
    veiledName: 'Señal genética: Micro-Placas Iridiscentes',
    category: 'defensa',
    stage: 'cell_stage',
    dnaCost: 28,
    discoverySource: 'scavenge_carcass',
    discoveryHint: 'Aísla muestras de herbívoros evasivos del Arrecife Abisal.',
    stackable: false,
    maxStacks: 1,
    socketType: 'dorsal',
    description:
      'Capa de micro-placas hexagonales iridiscentes que cambian de tonalidad y vuelven translúcida la célula al permanecer inmóvil.',
    statSummary: 'Camuflaje 80% al Parar (1.5s) · Detección Enemiga 9m',
    pros: [
      'Al quedar inmóvil 1.5s tu célula se vuelve 80% translúcida',
      'Reduce el radio de detección de los depredadores de 25m a solo 9m',
    ],
    tradeoffs: ['El camuflaje se desactiva al atacar o usar el Impulso'],
    modifiers: {
      damageReductionPct: 0.12,
    },
  },

  // ============================================================================
  // 4. MOVIMIENTO (Locomoción e Hidrodinámica)
  // ============================================================================
  {
    id: 'simple_flagellum',
    name: 'Flagelo Propulsor',
    veiledName: 'Señal genética: Filamento Motor',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 15,
    discoverySource: 'initial',
    discoveryHint:
      'Órgano locomotor primordial presente en el código genético inicial.',
    stackable: true,
    maxStacks: 3,
    socketType: 'rear',
    description:
      'Filamento caudal propulsor. Puedes apilar hasta 3 flagelos (central, par bimodal lateral y propulsor dorsal) para alcanzar velocidades hidrodinámicas superiores.',
    statSummary: '+20% Velocidad Base · Apilable hasta 3 colas',
    pros: [
      '+20% Velocidad lineal base (+32% con 2 copias, +44% con 3 copias)',
      'Aumenta la aceleración de salida al nadar',
    ],
    tradeoffs: [
      'Si retiras todas las copias, tu velocidad basal se reduce un 20%',
    ],
    modifiers: {
      speedBonusPct: 0.2,
    },
  },
  {
    id: 'cilia_waves',
    name: 'Cilios Ondulantes',
    veiledName: 'Señal genética: Fibrillas Ciliares',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 20,
    discoverySource: 'scavenge_carcass',
    discoveryHint:
      'Recoge un Nódulo Genético de una Célula Filtradora o Fósil Marino.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Hileras de microtúbulos laterales sincronizados que otorgan giros instantáneos de alta precisión y reducen la deriva al maniobrar.',
    statSummary: '+35% Giro y Maniobra · -20% Coste de Movimiento · Apilable (x2)',
    pros: [
      '+35% Velocidad angular de giro (+56% con 2 copias)',
      '-20% Consumo de energía por desplazamiento continuo',
    ],
    tradeoffs: ['Aporta menor velocidad punta lineal que un Flagelo Propulsor'],
    modifiers: {
      turnRateBonusPct: 0.35,
      speedBonusPct: 0.08,
    },
  },
  {
    id: 'hydro_siphon',
    name: 'Sifón de Propulsión',
    veiledName: 'Señal genética: Tobera Hidrodinámica',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 35,
    discoverySource: 'fossil_fragment',
    discoveryHint:
      'Aísla un Fósil Abisal en la Fosa Hidrotermal o el Arrecife Abisal.',
    stackable: false,
    maxStacks: 1,
    socketType: 'rear',
    description:
      'Toberas musculares posteriores que comprimen y expulsan chorros de agua a presión al usar Impulso (Espacio), reduciendo su gasto energético.',
    statSummary: '+25% Vel. Impulso (Espacio) · -35% Gasto de Impulso',
    pros: [
      '+25% Velocidad adicional durante el Impulso con Espacio',
      '-35% Consumo de energía al mantener activado el Impulso',
    ],
    tradeoffs: ['Peso posterior ligeramente mayor en reposo'],
    modifiers: {
      boostEfficiencyPct: 0.35,
      speedBonusPct: 0.1,
    },
  },
  {
    id: 'movement_ribbon_fin',
    name: 'Aleta Ondulante Continua',
    veiledName: 'Señal genética: Membrana Cintiforme',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 20,
    discoverySource: 'initial',
    discoveryHint: 'Disponible en el genoma inicial de células cintiformes.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Aleta membranosa lateral alargada que se extiende a lo largo de varias vértebras con ondulación sinusoidal continua.',
    statSummary: '+60% Aceleración Inversa / Frenada · +12% Vel. Base',
    pros: [
      'Marcha atrás y frenada instantánea (+60% aceleración inversa)',
      '+12% velocidad de nado fluido y +20% maniobrabilidad lateral',
    ],
    tradeoffs: ['Mayor superficie expuesta en los flancos'],
    modifiers: {
      speedBonusPct: 0.12,
      turnRateBonusPct: 0.2,
    },
  },
  {
    id: 'movement_macro_cilia_skirt',
    name: 'Corona de Cilios Remos',
    veiledName: 'Señal genética: Anillo Rotífero Sincronizado',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 24,
    discoverySource: 'scavenge_carcass',
    discoveryHint: 'Aísla muestras de organismos rotíferos filtradores.',
    stackable: false,
    maxStacks: 1,
    socketType: 'lateral',
    description:
      'Anillo de múltiples cilios gruesos sincronizados que baten en rueda permitiendo pivotar al instante.',
    statSummary: '+50% Velocidad Angular de Giro · Pivote Instantáneo',
    pros: [
      '+50% velocidad angular de giro sobre el propio eje',
      'Permite encarar amenazas o esquivar embestidas al instante',
    ],
    tradeoffs: ['Enfocado en rotación más que en velocidad punta recta'],
    modifiers: {
      turnRateBonusPct: 0.5,
      speedBonusPct: 0.06,
    },
  },
  {
    id: 'movement_whip_flagella',
    name: 'Flagelo Látigo Doble',
    veiledName: 'Señal genética: Par Flagelar Trenzado',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 28,
    discoverySource: 'predator_kill',
    discoveryHint: 'Extrae el genoma de cazadores de alta velocidad.',
    stackable: true,
    maxStacks: 2,
    socketType: 'rear',
    description:
      'Dos látigos largos y delgados en espiral trenzada que se abren en la punta generando un empuje caudal superior.',
    statSummary: '+30% Velocidad Punta · +25% Duración de Impulso',
    pros: [
      '+30% velocidad punta en línea recta',
      '+25% duración y eficiencia del Impulso con la barra espaciadora',
    ],
    tradeoffs: ['-5% radio de giro en curvas cerradas a máxima velocidad'],
    modifiers: {
      speedBonusPct: 0.3,
      boostEfficiencyPct: 0.25,
      turnRateBonusPct: -0.05,
    },
  },
  {
    id: 'movement_pneumatic_vesicle',
    name: 'Vesícula Natatoria Regulable',
    veiledName: 'Señal genética: Cámara Hidrostática Interna',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 22,
    discoverySource: 'biome_exposure',
    discoveryHint: 'Explora los sectores de aguas abiertas para desarrollar esta vesícula.',
    stackable: false,
    maxStacks: 1,
    socketType: 'dorsal',
    description:
      'Vejiga elíptica interna brillante que se expande y contrae rítmicamente otorgando flotabilidad neutral perfecta.',
    statSummary: 'Flotabilidad Neutral: Anula Gasto Energético de Nado Pasivo',
    pros: [
      'Anula el gasto energético de flotación y movimiento pasivo sin Impulso',
      '+15 Energía Máxima de reserva hidrostática',
    ],
    tradeoffs: ['No incrementa la velocidad máxima de sprint'],
    modifiers: {
      passiveDrainMultiplier: 0.45,
      maxEnergyBonus: 15,
    },
  },
  {
    id: 'movement_reactive_nozzle',
    name: 'Tobera Expulsora de Chorro',
    veiledName: 'Señal genética: Propulsor Sónico Muscular',
    category: 'movimiento',
    stage: 'cell_stage',
    dnaCost: 34,
    discoverySource: 'predator_kill',
    discoveryHint: 'Abate o analiza Megacélulas del Arrecife Abisal.',
    stackable: false,
    maxStacks: 1,
    socketType: 'rear',
    description:
      'Embudo cónico muscular trasero con compuertas bioluminiscentes que se cierran con fuerza catapultando a la célula.',
    statSummary: 'Impulso Sónico (Espacio): Velocidad x2 · +35% Vel. Base',
    pros: [
      'Al pulsar Espacio desata un chorro sónico que duplica la aceleración de escape',
      '+35% velocidad base y +30% eficiencia de propulsión a chorro',
    ],
    tradeoffs: ['Mayor consumo instantáneo al iniciar la propulsión'],
    modifiers: {
      speedBonusPct: 0.35,
      boostEfficiencyPct: 0.3,
    },
  },

  // ============================================================================
  // 5. SENTIDOS (Percepción, Visión y Radar Químico)
  // ============================================================================
  {
    id: 'eye_photoreceptor',
    name: 'Mancha Ocular Fotorreceptora',
    veiledName: 'Señal genética: Pigmento Óptico',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 5,
    discoverySource: 'initial',
    discoveryHint:
      'Órgano sensorial básico presente desde el nacimiento celular.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Par de receptores ópticos frontales que permiten enfocar el entorno submarino y otorgan Vista Nv. 1 en tierra.',
    statSummary: 'Vista Nv.1 · Visión Celular Nítida · Evita Ceguera',
    pros: [
      'Mantiene el campo visual despejado y otorga Vista Nv.1 en Criatura Terrestre',
      'Reembolsable (+5 ADN) si prefieres evolucionar Ojos Pedunculados',
    ],
    tradeoffs: [
      'Retirar todos los órganos oculares reduce tu zoom y oscurece la periferia',
    ],
    modifiers: {
      visionRadiusMultiplier: 1.0,
      creatureSight: 1,
    },
  },
  {
    id: 'eye_stalks',
    name: 'Ojos Pedunculados Abisales',
    veiledName: 'Señal genética: Pedúnculo Óptico',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 15,
    discoverySource: 'fossil_fragment',
    discoveryHint:
      'Descubre un Fósil Abisal o derrota a un cazador Mandíbula Rápida.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Globos oculares bioluminiscentes elevados sobre pedúnculos móviles que amplían el zoom panorámico (+25%), disipan niebla y otorgan Vista Nv. 1.',
    statSummary: 'Vista Nv.1 · +25% Campo Visual · -30% Niebla Abisal',
    pros: [
      'Amplía la altura de cámara (+25% radio de visión panorámica) y Vista Nv.1',
      'Reduce un 30% la densidad de la niebla submarina para ver amenazas lejos',
    ],
    tradeoffs: ['Sustituye la necesidad de la Mancha Ocular básica'],
    modifiers: {
      visionRadiusMultiplier: 1.25,
      fogClearMultiplier: 0.7,
      creatureSight: 1,
    },
  },
  {
    id: 'chemoreceptor',
    name: 'Antenas Quimiorreceptoras',
    veiledName: 'Señal genética: Filamento Olfativo',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 20,
    discoverySource: 'scavenge_carcass',
    discoveryHint:
      'Recoge un Nódulo Genético de cualquier organismo o Fósil Marino.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Par de antenas sensoriales frontales que proyectan un vector holográfico 3D hacia el Nódulo Genético o nutriente más cercano y amplían el radar.',
    statSummary: 'Brújula 3D de Nódulos/Nutrientes · Radar 65m',
    pros: [
      'Muestra un puntero holográfico 3D en tiempo real hacia Nódulos Genéticos y comida',
      'Amplía el alcance del Radar de Amenazas e identifica portadores genéticos',
    ],
    tradeoffs: ['Ninguno'],
    modifiers: {
      visionRadiusMultiplier: 1.08,
    },
  },
  {
    id: 'sense_stalk_compound_eye',
    name: 'Ojo Compuesto Pedunculado',
    veiledName: 'Señal genética: Domo Óptico Facetado',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 12,
    discoverySource: 'initial',
    discoveryHint: 'Disponible desde el inicio en células del arrecife.',
    stackable: true,
    maxStacks: 2,
    socketType: 'front',
    description:
      'Ojo facetado sobre un tallo cilíndrico flexible que apunta en la dirección configurada por el tirador/gizmo 3D.',
    statSummary: 'Visión 120º por Ojo · Identifica Amenazas y Nutrientes Lejos',
    pros: [
      'Ángulo de visión de 120º orientable libremente con el gizmo 3D',
      '+15% alcance visual panorámico y lectura nítida de especies lejanas',
    ],
    tradeoffs: ['Pedúnculo expuesto en colisiones frontales'],
    modifiers: {
      visionRadiusMultiplier: 1.15,
    },
  },
  {
    id: 'sense_antenna_chemoreceptor',
    name: 'Antenas Quimiosensoriales',
    veiledName: 'Señal genética: Par Filiforme Olfativo',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 18,
    discoverySource: 'scavenge_carcass',
    discoveryHint: 'Aísla el genoma de células carroñeras abisales.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Dos antenas filiformes finas curvadas con nodos bioluminiscentes parpadeantes en las puntas que trazan estelas hacia carne y ADN.',
    statSummary: 'Rastro Olfativo (>30m) hacia Carne y Esporas Doradas de ADN',
    pros: [
      'Activa el rastro olfativo 3D hacia carne celular y nódulos de ADN a >30m',
      '+12% radio de percepción sensorial',
    ],
    tradeoffs: ['Ninguno'],
    modifiers: {
      visionRadiusMultiplier: 1.12,
    },
  },
  {
    id: 'sense_electro_sensor_pores',
    name: 'Ampollas Electrorreceptoras',
    veiledName: 'Señal genética: Poros de Lorenzini Abisales',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 24,
    discoverySource: 'predator_kill',
    discoveryHint: 'Obtén muestras de organismos eléctricos o depredadores de profundidad.',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Grupo de pequeños poros circulares con reborde dorado alrededor del hocico capaces de percibir campos bioeléctricos a través de la niebla.',
    statSummary: 'Detección Bioeléctrica en Niebla · Radar Total de Estado',
    pros: [
      'Detecta el estado y tipo de depredador a través de la niebla abisal más densa',
      '+18% radio de visión y -20% densidad de niebla',
    ],
    tradeoffs: ['Sensible a descargas bioeléctricas cercanas'],
    modifiers: {
      visionRadiusMultiplier: 1.18,
      fogClearMultiplier: 0.8,
    },
  },
  {
    id: 'sense_lateral_line_vibrissae',
    name: 'Línea Lateral Mecanorreceptora',
    veiledName: 'Señal genética: Vibrisas Hidrodinámicas',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 20,
    discoverySource: 'biome_exposure',
    discoveryHint: 'Explora cuevas y corrientes del Arrecife Abisal.',
    stackable: false,
    maxStacks: 1,
    socketType: 'lateral',
    description:
      'Hilera de pelos sensoriales microscópicos translúcidos a lo largo del costado del cuerpo que detectan ondas de presión traseras.',
    statSummary: 'Alerta de Embestida Trasera · +20% Reflejo de Esquiva',
    pros: [
      'Alerta direccional inmediata cuando un depredador carga por la espalda',
      'Otorga +15% agilidad de esquiva refleja ante emboscadas',
    ],
    tradeoffs: ['Ninguno'],
    modifiers: {
      turnRateBonusPct: 0.15,
      damageReductionPct: 0.1,
    },
  },
  {
    id: 'sense_abyssal_biolum_probe',
    name: 'Sonda Cefálica Iluminadora',
    veiledName: 'Señal genética: Illicium Bioluminiscente',
    category: 'sentidos',
    stage: 'cell_stage',
    dnaCost: 26,
    discoverySource: 'biome_exposure',
    discoveryHint: 'Adéntrate en la zona abisal más profunda (x > 50, z > 50).',
    stackable: false,
    maxStacks: 1,
    socketType: 'front',
    description:
      'Tallo largo articulado que nace en la frente y se arquea hacia adelante con un bulbo de luz blanca-azulada brillante que despeja la penumbra.',
    statSummary: 'Linterna Abisal (45m) · Despeja Niebla (-45%) y Revela Fósiles',
    pros: [
      'Despeja la niebla submarina hasta 45m de distancia revelando fósiles y colosos',
      '+28% alcance visual panorámico en zonas abisales',
    ],
    tradeoffs: ['El bulbo luminoso es visible desde lejos en la oscuridad'],
    modifiers: {
      visionRadiusMultiplier: 1.28,
      fogClearMultiplier: 0.55,
    },
  },

  // ============================================================================
  // 6. METABOLISMO (Simbiosis y Generación Energética)
  // ============================================================================
  {
    id: 'chloroplast_1',
    name: 'Cloroplastos Simbióticos',
    veiledName: 'Señal genética: Plastidio Fotosintético',
    category: 'metabolismo',
    stage: 'cell_stage',
    dnaCost: 30,
    discoverySource: 'biome_exposure',
    discoveryHint:
      'Consume 3 nutrientes vegetales en la Pradera Bioluminiscente o halla un Fósil.',
    stackable: true,
    maxStacks: 2,
    socketType: 'dorsal',
    description:
      'Integra orgánulos fotosintéticos internos capaces de sintetizar energía de la luz filtrada, reduciendo el gasto basal y permitiendo asimilar algas siempre.',
    statSummary: '-50% Consumo Pasivo · +30 Energía Máx. · Apilable (x2)',
    pros: [
      '-50% Consumo pasivo de energía y +30 Energía Máxima (+48 con 2 copias)',
      'Permite digerir algas incluso si tienes Mandíbula Carnívora (Omnívoro)',
    ],
    tradeoffs: ['Aumenta la visibilidad bioluminiscente esmeralda'],
    modifiers: {
      passiveDrainMultiplier: 0.5,
      maxEnergyBonus: 30,
    },
  },

  // ============================================================================
  // 7. ADAPTACIONES EXCLUSIVAS DEL ESTADIO DE CRIATURA TERRESTRE
  // ============================================================================
  {
    id: 'vocal_crest',
    name: 'Cresta Vocal Resonante',
    veiledName: 'Señal genética: Cámara Acústica Craneal',
    category: 'sentidos',
    stage: 'creature_stage',
    dnaCost: 35,
    discoverySource: 'initial',
    discoveryHint:
      'Se desbloquea automáticamente al evolucionar al Estadio de Criatura Terrestre.',
    stackable: false,
    maxStacks: 1,
    socketType: 'dorsal',
    description:
      'Cresta craneal luminosa que amplifica las ondas acústicas del Canto Social (Tecla C), ampliando el radio de alianza a 13.5m y recuperando energía.',
    statSummary: 'Radio Social 13.5m · +35 ADN y +15 Energía al Socializar',
    pros: [
      'Amplía el radio del Canto Social (Tecla C) de 8.5m a 13.5m',
      'Otorga +35 ADN y recupera +15 de Energía por cada criatura aliada',
    ],
    tradeoffs: ['Exclusivo del Estadio de Criatura Terrestre'],
    modifiers: {},
  },
  {
    id: 'grasping_arms',
    name: 'Brazos con Garras',
    veiledName: 'Señal genética: Extremidades Prensiles',
    category: 'ataque',
    stage: 'creature_stage',
    dnaCost: 45,
    discoverySource: 'initial',
    discoveryHint:
      'Se desbloquea automáticamente al evolucionar al Estadio de Criatura Terrestre.',
    stackable: false,
    maxStacks: 1,
    socketType: 'lateral',
    description:
      'Extremidades superiores prensiles con 3 garras frontales que permiten abatir depredadores medianos (Raptor Costero) en el Estadio Terrestre.',
    statSummary: 'Abate Depredadores Medianos · +40 ADN por Caza',
    pros: [
      'Permite abatir directamente al Raptor Costero en movimiento o impulso',
      'Otorga +40 ADN y +40 Energía por cada depredador abatido',
    ],
    tradeoffs: ['Exclusivo del Estadio de Criatura Terrestre'],
    modifiers: {
      contactDamageBonus: 35,
    },
  },
  {
    id: 'wings_1',
    name: 'Alas Membranales',
    veiledName: 'Señal genética: Patagio Dorsal',
    category: 'movimiento',
    stage: 'creature_stage',
    dnaCost: 55,
    discoverySource: 'initial',
    discoveryHint:
      'Se desbloquea automáticamente al evolucionar al Estadio de Criatura Terrestre.',
    stackable: false,
    maxStacks: 1,
    socketType: 'dorsal',
    description:
      'Par de alas dorsales articuladas que en el Estadio Terrestre permiten saltar y planear en el aire al mantener Espacio, esquivando mordidas terrestres.',
    statSummary: 'Salto y Planeo 3D (Espacio) · +35% Vel. Impulso',
    pros: [
      'Mantén Espacio en tierra para elevarte (+3.8m Y) y planear sobre peligros',
      'Inmunidad a mordidas terrestres mientras planeas en el aire',
    ],
    tradeoffs: ['Exclusivo del Estadio de Criatura Terrestre'],
    modifiers: {
      speedBonusPct: 0.15,
    },
  },

  // ============================================================================
  // 8. PIERNAS (5 Variantes de Locomoción Terrestre)
  // ============================================================================
  {
    id: 'leg_insectoid',
    name: 'Patas Quitinosas Segmentadas',
    veiledName: 'Señal genética: Artejos Quitinosos',
    category: 'piernas',
    stage: 'creature_stage',
    dnaCost: 25,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 3,
    socketType: 'lateral',
    description:
      'Extremidades insectoides segmentadas tipo mantis/grillo, finas, ligeras y de zancada silenciosa y veloz sobre terreno costero.',
    statSummary: 'Velocidad +2 · Sigilo +1',
    pros: [
      '+2 Velocidad Terrestre (zancada rápida multi-segmento)',
      '+1 Sigilo al desplazarse sin hacer ruido',
    ],
    tradeoffs: ['Estructura quitinosa ligera con menor masa de impacto'],
    modifiers: {
      speedBonusPct: 0.18,
      creatureSpeed: 2,
      creatureSneak: 1,
    },
  },
  {
    id: 'leg_digitigrade',
    name: 'Piernas Digitígradas Felinas',
    veiledName: 'Señal genética: Fémur Elástico Digitígrado',
    category: 'piernas',
    stage: 'creature_stage',
    dnaCost: 30,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Articulación canina/felina con tendón calcáneo elevado y musculatura estilizada para sprints explosivos y saltos ágiles.',
    statSummary: 'Velocidad +3 · Salto +2',
    pros: [
      '+3 Velocidad Terrestre para caza y persecución ágil',
      '+2 Salto gracias a la tracción elástica del tarso',
    ],
    tradeoffs: ['Consumo moderado de energía en sprints prolongados'],
    modifiers: {
      speedBonusPct: 0.26,
      creatureSpeed: 3,
      creatureJump: 2,
    },
  },
  {
    id: 'leg_plantigrade',
    name: 'Piernas Plantígradas Robustas',
    veiledName: 'Señal genética: Columna Plantígrada Úrsida',
    category: 'piernas',
    stage: 'creature_stage',
    dnaCost: 28,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Piernas musculosas y estables estilo primate/úrsido que apoyan toda la planta, sosteniendo torsos pesados y ampliando la vitalidad.',
    statSummary: 'Salto +1 · Vitalidad +15',
    pros: [
      '+15 Salud Máxima por soporte muscular robusto',
      '+1 Salto y estabilidad superior frente a embestidas',
    ],
    tradeoffs: ['Menor velocidad punta que las patas unguladas o digitígradas'],
    modifiers: {
      maxHealthBonus: 15,
      speedBonusPct: 0.12,
      creatureSpeed: 1,
      creatureJump: 1,
    },
  },
  {
    id: 'leg_ungulate',
    name: 'Patas Unguladas de Pezuña',
    veiledName: 'Señal genética: Metatarso Cursorio',
    category: 'piernas',
    stage: 'creature_stage',
    dnaCost: 35,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Extremidades delgadas, largas y elásticas estilo ciervo/caballo diseñadas para galopar a máxima velocidad y cargar con ímpetu.',
    statSummary: 'Velocidad +4 · Embestida +2',
    pros: [
      '+4 Velocidad Terrestre (máxima velocidad de galope)',
      '+2 Embestida en cargas frontales a la carrera',
    ],
    tradeoffs: ['Menor sigilo sobre superficies rocosas'],
    modifiers: {
      speedBonusPct: 0.35,
      contactDamageBonus: 12,
      creatureSpeed: 4,
      creatureCharge: 2,
    },
  },
  {
    id: 'leg_reptilian',
    name: 'Patas Reptilianas Acorazadas',
    veiledName: 'Señal genética: Fémur Escamoso Saurio',
    category: 'piernas',
    stage: 'creature_stage',
    dnaCost: 32,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Extremidades escamosas, anchas y pesadas recubiertas de osteodermos que otorgan blindaje estructural, golpe sísmico y ritmo tribal.',
    statSummary: 'Zarpazo +1 · Defensa +10% · Bailar +1',
    pros: [
      '+10% Defensa estructural gracias a las escamas dérmicas',
      '+1 Zarpazo/Golpe y +1 Bailar por pisotón rítmico terrestre',
    ],
    tradeoffs: ['Paso pesado y corpulento'],
    modifiers: {
      damageReductionPct: 0.1,
      contactDamageBonus: 10,
      creatureStrike: 1,
      creatureDance: 1,
    },
  },

  // ============================================================================
  // 9. BRAZOS (5 Variantes de Extremidades Superiores)
  // ============================================================================
  {
    id: 'arm_slender',
    name: 'Brazos Gráciles Ágiles',
    veiledName: 'Señal genética: Húmero Articulado Ligero',
    category: 'brazos',
    stage: 'creature_stage',
    dnaCost: 15,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Brazos flexibles y estilizados de bajo coste de ADN que permiten gesticular con elegancia y acoplar cualquier tipo de manos o garras.',
    statSummary: 'Posar +1 · Bajo Coste ADN',
    pros: [
      '+1 Posar para exhibición e interacción social',
      'Soporte anatómico ligero ideal para acoplar manos prensiles',
    ],
    tradeoffs: ['Fuerza bruta moderada sin garras acopladas'],
    modifiers: {
      creaturePose: 1,
    },
  },
  {
    id: 'arm_brawny',
    name: 'Brazos Musculosos de Gorila',
    veiledName: 'Señal genética: Bíceps Hipertrófico',
    category: 'brazos',
    stage: 'creature_stage',
    dnaCost: 30,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Extremidades superiores macizas de gran envergadura muscular que incrementan la potencia de desgarro cuerpo a cuerpo y la vitalidad.',
    statSummary: 'Zarpazo +2 · Salud +10',
    pros: [
      '+2 Zarpazo en combate cuerpo a cuerpo',
      '+10 Salud Máxima por masa muscular torácica',
    ],
    tradeoffs: ['Mayor envergadura en el tren superior'],
    modifiers: {
      maxHealthBonus: 10,
      contactDamageBonus: 16,
      creatureStrike: 2,
    },
  },
  {
    id: 'arm_praying',
    name: 'Brazos Raptores Tipo Mantis',
    veiledName: 'Señal genética: Tibia Raptora Aserrada',
    category: 'brazos',
    stage: 'creature_stage',
    dnaCost: 35,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Brazos plegables de emboscada armados con hileras de púas quitinosas en el antebrazo para atrapar y desgarrar presas al instante.',
    statSummary: 'Zarpazo +3 · Embestida +1',
    pros: [
      '+3 Zarpazo letal con antebrazos espinosos articulados',
      '+1 Embestida al abalanzarse sobre el objetivo',
    ],
    tradeoffs: ['Especializados en ataque agresivo'],
    modifiers: {
      contactDamageBonus: 24,
      creatureStrike: 3,
      creatureCharge: 1,
    },
  },
  {
    id: 'arm_patagium',
    name: 'Brazos Alares con Membrana de Murciélago',
    veiledName: 'Señal genética: Patagio Braquial Elástico',
    category: 'brazos',
    stage: 'creature_stage',
    dnaCost: 40,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Brazos extendidos unidos al torso por una membrana alar translúcida (patagio) que permite planear largas distancias tras saltar.',
    statSummary: 'Planeo +3 · Salto +1',
    pros: [
      '+3 Planeo para surcar corrientes de aire sobre la costa',
      '+1 Salto con impulso aerodinámico adicional',
    ],
    tradeoffs: ['Membrana amplia visible a distancia'],
    modifiers: {
      speedBonusPct: 0.14,
      creatureGlide: 3,
      creatureJump: 1,
    },
  },
  {
    id: 'arm_armored',
    name: 'Brazos Plaqueados Quitinosos',
    veiledName: 'Señal genética: Brazalete Exoesquelético',
    category: 'brazos',
    stage: 'creature_stage',
    dnaCost: 32,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Brazos recubiertos por placas quitinosas superpuestas que actúan como escudos laterales y golpean con contundencia.',
    statSummary: 'Defensa +12% · Zarpazo +1',
    pros: [
      '+12% Defensa estructural al cubrir los flancos del torso',
      '+1 Zarpazo contundente con placas calcificadas',
    ],
    tradeoffs: ['Ligeramente más pesados que los brazos gráciles'],
    modifiers: {
      damageReductionPct: 0.12,
      contactDamageBonus: 10,
      creatureStrike: 1,
    },
  },

  // ============================================================================
  // 10. MANOS / GRASPERS (3 Variantes Prensiles y de Combate)
  // ============================================================================
  {
    id: 'hand_primate',
    name: 'Manos Oponibles Prensiles',
    veiledName: 'Señal genética: Pulgar Oponible Tribal',
    category: 'manos',
    stage: 'creature_stage',
    dnaCost: 25,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Manos de cinco dedos con pulgar oponible que se encastran en los brazos: otorgan capacidad de agarre (hasGraspers) para recoger alimentos y empuñar herramientas tribales.',
    statSummary: 'Agarre Activo · Posar +3 · Fascinar +1',
    pros: [
      'Agarre (Graspers): Permite sostener comida, rocas y herramientas tribales',
      '+3 Posar y +1 Fascinar por expresividad gestual avanzada',
    ],
    tradeoffs: ['Orientadas a destreza, manipulación y comunicación social'],
    modifiers: {
      hasGraspers: true,
      creaturePose: 3,
      creatureCharm: 1,
    },
  },
  {
    id: 'hand_talons',
    name: 'Garras Afiladas de Raptor',
    veiledName: 'Señal genética: Falanges Unciformes',
    category: 'manos',
    stage: 'creature_stage',
    dnaCost: 30,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Zarpas curvas queratinizadas de depredador que se ensamblan en los extremos de los brazos: combinan agarre de presas con un zarpazo devastador.',
    statSummary: 'Agarre Activo · Zarpazo +3 · Mordisco +1',
    pros: [
      'Agarre (Graspers) +3 Zarpazo de desgarro crítico',
      '+1 Mordisco al sujetar firmemente a la presa',
    ],
    tradeoffs: ['Menor sutileza social que las manos oponibles'],
    modifiers: {
      hasGraspers: true,
      contactDamageBonus: 22,
      creatureStrike: 3,
      creatureBite: 1,
    },
  },
  {
    id: 'hand_insect_claw',
    name: 'Pinzas Quitinosas de Cangrejo',
    veiledName: 'Señal genética: Quela Calcificada',
    category: 'manos',
    stage: 'creature_stage',
    dnaCost: 28,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Tenazas articuladas de quitina densa acopladas a las muñecas: permiten sujetar objetos con fuerza hidráulica, golpear y desviar ataques.',
    statSummary: 'Agarre Activo · Zarpazo +2 · Defensa +5%',
    pros: [
      'Agarre (Graspers) con tenaza de presión hidráulica',
      '+2 Zarpazo y +5% Defensa adicional frente a ataques frontales',
    ],
    tradeoffs: ['Pinza rígida de dos dedos oponibles'],
    modifiers: {
      hasGraspers: true,
      contactDamageBonus: 15,
      damageReductionPct: 0.05,
      creatureStrike: 2,
    },
  },

  // ============================================================================
  // 11. PIES (3 Variantes de Tracción, Salto y Embestida)
  // ============================================================================
  {
    id: 'foot_paw',
    name: 'Zarpas con Almohadillas Suaves',
    veiledName: 'Señal genética: Cojinete Plantar Silencioso',
    category: 'pies',
    stage: 'creature_stage',
    dnaCost: 22,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Pies articulados con almohadillas elásticas que amortiguan cada pisada en los extremos de las piernas, maximizando el sigilo y la tracción.',
    statSummary: 'Sigilo +3 · Velocidad +2',
    pros: [
      '+3 Sigilo para acercarse a presas o depredadores sin ser detectado',
      '+2 Velocidad Terrestre por tracción plantar flexible',
    ],
    tradeoffs: ['Sin casco duro de embestida'],
    modifiers: {
      speedBonusPct: 0.16,
      creatureSneak: 3,
      creatureSpeed: 2,
    },
  },
  {
    id: 'foot_hoof',
    name: 'Pezuñas Clíperas de Embestida',
    veiledName: 'Señal genética: Casco Ungulado Córneo',
    category: 'pies',
    stage: 'creature_stage',
    dnaCost: 28,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Pezuñas hendidas ultraduras que se encastran en los tobillos: multiplican la velocidad de carrera e impulsan cargas demoledoras.',
    statSummary: 'Velocidad +3 · Embestida +3',
    pros: [
      '+3 Velocidad Terrestre sobre llanuras y costas',
      '+3 Embestida para derribar rivales al cargar',
    ],
    tradeoffs: ['Pisada sonora sobre roca'],
    modifiers: {
      speedBonusPct: 0.24,
      contactDamageBonus: 18,
      creatureSpeed: 3,
      creatureCharge: 3,
    },
  },
  {
    id: 'foot_webbed',
    name: 'Pies Palmeados de Anfibio',
    veiledName: 'Señal genética: Membrana Interdigital Costera',
    category: 'pies',
    stage: 'creature_stage',
    dnaCost: 24,
    discoverySource: 'initial',
    discoveryHint: 'Disponible al evolucionar al Estadio de Criatura Terrestre.',
    stackable: true,
    maxStacks: 2,
    socketType: 'lateral',
    description:
      'Pies anchos con membranas interdigitales bioluminiscentes que permiten danzar con agilidad, saltar con resorte y nadar velozmente en ríos y charcas.',
    statSummary: 'Bailar +3 · Salto +2 · Nado en Ríos',
    pros: [
      '+3 Bailar para alianzas sociales y rituales tribales',
      '+2 Salto elástico y propulsión anfibia en aguas costeras',
    ],
    tradeoffs: ['Especializados en agilidad anfibia y social'],
    modifiers: {
      speedBonusPct: 0.14,
      creatureDance: 3,
      creatureJump: 2,
    },
  },
];

/**
 * Strictly microbial adaptations that are retired/hidden when the organism transitions
 * to the Terrestrial Creature Stage (`creature_stage`).
 */
export const CELL_ONLY_ADAPTATION_IDS: ReadonlySet<string> = new Set([
  'simple_flagellum',
  'cilia_waves',
  'hydro_siphon',
  'movement_ribbon_fin',
  'movement_macro_cilia_skirt',
  'movement_whip_flagella',
  'movement_pneumatic_vesicle',
  'movement_reactive_nozzle',
  'chloroplast_1',
  'neutralizer_vesicle',
  'defense_mucus_gland',
]);

export function isCellOnlyAdaptation(rawId: string): boolean {
  return CELL_ONLY_ADAPTATION_IDS.has(normalizeAdaptationId(rawId));
}

export function isLegAdaptation(rawId: string): boolean {
  const id = normalizeAdaptationId(rawId);
  return id.startsWith('leg_');
}

export function isArmAdaptation(rawId: string): boolean {
  const id = normalizeAdaptationId(rawId);
  return id.startsWith('arm_') || id === 'grasping_arms';
}

export function isHandAdaptation(rawId: string): boolean {
  const id = normalizeAdaptationId(rawId);
  return id.startsWith('hand_');
}

export function isFootAdaptation(rawId: string): boolean {
  const id = normalizeAdaptationId(rawId);
  return id.startsWith('foot_');
}

export function isMouthAdaptation(rawId: string): boolean {
  const id = normalizeAdaptationId(rawId);
  return id.startsWith('mouth_');
}

export function computeCreatureStats(
  getStacks: (id: string) => number
): import('./types').CreatureStats {
  const hasAny = (ids: string[]) => ids.some((id) => getStacks(id) > 0);
  const has = (id: string) => getStacks(id) > 0;

  // Spore Non-Stacking Rule: each skill level is strictly the maximum level (Math.max)
  // granted by the single best installed piece for that attribute (capped at 5).
  // Installing multiple copies of the same mouth/limb/weapon NEVER sums their levels.

  // Locomoción (0 - 5; base speed 1 when crawling without legs)
  const rawSpeed = Math.max(
    1,
    has('leg_plantigrade') ? 1 : 0,
    has('leg_insectoid') ? 2 : 0,
    has('foot_paw') ? 2 : 0,
    has('foot_webbed') ? 2 : 0,
    has('leg_digitigrade') ? 3 : 0,
    has('foot_hoof') ? 3 : 0,
    has('leg_ungulate') ? 4 : 0
  );

  const rawJump = Math.max(
    0,
    has('leg_plantigrade') ? 1 : 0,
    has('leg_insectoid') ? 1 : 0,
    has('arm_patagium') ? 1 : 0,
    has('leg_digitigrade') ? 2 : 0,
    has('foot_webbed') ? 2 : 0,
    has('wings_1') ? 2 : 0
  );

  const rawGlide = Math.max(
    0,
    has('arm_patagium') ? 3 : 0,
    has('wings_1') ? 3 : 0
  );

  const rawSneak = Math.max(
    0,
    has('leg_insectoid') ? 1 : 0,
    has('defense_camouflage_chromatophores') ? 2 : 0,
    has('foot_paw') ? 3 : 0
  );

  // Combate (0 - 5)
  // Cellular mouths grant Bite Lv.1 and Sing Lv.1 in the Early Creature Creator
  const hasAnyCellularMouth = hasAny([
    'mouth_filter',
    'mouth_jaw',
    'mouth_proboscis',
    'mouth_radula',
    'mouth_suction_cup',
    'mouth_crusher_mandibles',
    'mouth_filter_baleen',
    'mouth_needle_proboscis',
  ]);

  const rawBite = Math.max(
    0,
    hasAnyCellularMouth ? 1 : 0,
    has('hand_talons') ? 1 : 0
  );

  const rawCharge = Math.max(
    0,
    has('chitin_spike') ? 1 : 0,
    has('arm_praying') ? 1 : 0,
    has('leg_ungulate') ? 2 : 0,
    has('weapon_rotary_drill') ? 2 : 0,
    has('foot_hoof') ? 3 : 0
  );

  const rawStrike = Math.max(
    0,
    has('leg_reptilian') ? 1 : 0,
    has('arm_armored') ? 1 : 0,
    has('arm_brawny') ? 2 : 0,
    has('grasping_arms') ? 2 : 0,
    has('hand_insect_claw') ? 2 : 0,
    has('weapon_tail_club') ? 2 : 0,
    has('arm_praying') ? 3 : 0,
    has('hand_talons') ? 3 : 0
  );

  const rawSpit = Math.max(
    0,
    has('poison_gland') ? 1 : 0,
    has('weapon_caustic_acid_blister') ? 1 : 0,
    has('acid_spit') ? 4 : 0
  );

  // Social / Tribal (0 - 5)
  const rawSing = Math.max(
    0,
    hasAnyCellularMouth ? 1 : 0,
    has('vocal_crest') ? 3 : 0
  );

  const rawDance = Math.max(
    0,
    has('leg_reptilian') ? 1 : 0,
    has('leg_digitigrade') ? 1 : 0,
    has('foot_webbed') ? 3 : 0
  );

  const rawPose = Math.max(
    0,
    has('arm_slender') ? 1 : 0,
    has('wings_1') ? 1 : 0,
    has('hand_primate') ? 3 : 0
  );

  const rawCharm = Math.max(
    0,
    has('electric_cell') ? 1 : 0,
    has('hand_primate') ? 1 : 0,
    has('sense_abyssal_biolum_probe') ? 1 : 0,
    has('defense_camouflage_chromatophores') ? 1 : 0,
    has('vocal_crest') ? 2 : 0,
    has('weapon_flash_photophore') ? 2 : 0
  );

  const rawHealth = Math.max(
    1,
    has('leg_reptilian') ? 2 : 0,
    has('arm_brawny') ? 2 : 0,
    has('defense_chitin_shield_plate') ? 2 : 0,
    has('leg_plantigrade') ? 3 : 0,
    has('arm_armored') ? 3 : 0,
    has('membrane_armor') ? 4 : 0,
    has('defense_hydrothermal_carapace') ? 4 : 0
  );

  const rawSight = Math.max(
    0,
    has('eye_photoreceptor') ? 1 : 0,
    has('eye_stalks') ? 1 : 0,
    has('chemoreceptor') ? 1 : 0,
    has('sense_antenna_chemoreceptor') ? 1 : 0,
    has('sense_electro_sensor_pores') ? 1 : 0,
    has('sense_stalk_compound_eye') ? 2 : 0,
    has('sense_abyssal_biolum_probe') ? 2 : 0
  );

  const hasGraspers = hasAny([
    'hand_primate',
    'hand_talons',
    'hand_insect_claw',
    'grasping_arms',
  ]);

  const clampStat = (val: number, min = 0, max = 5) =>
    Math.max(min, Math.min(max, val));

  return {
    speed: clampStat(rawSpeed, 1, 5),
    jump: clampStat(rawJump, 0, 5),
    glide: clampStat(rawGlide, 0, 5),
    sneak: clampStat(rawSneak, 0, 5),
    health: clampStat(rawHealth, 1, 5),
    sight: clampStat(rawSight, 0, 5),
    bite: clampStat(rawBite, 0, 5),
    charge: clampStat(rawCharge, 0, 5),
    strike: clampStat(rawStrike, 0, 5),
    spit: clampStat(rawSpit, 0, 5),
    sing: clampStat(rawSing, 0, 5),
    dance: clampStat(rawDance, 0, 5),
    pose: clampStat(rawPose, 0, 5),
    charm: clampStat(rawCharm, 0, 5),
    hasGraspers,
  };
}

export const MAX_CREATURE_COMPLEXITY = 100;

export function getOrganComplexityCost(
  rawId: string,
  mirrorSymmetry = true
): number {
  const id = normalizeAdaptationId(rawId);
  const symMult = mirrorSymmetry ? 1.65 : 1.0;
  if (isLegAdaptation(id) || isArmAdaptation(id)) {
    return Math.round(7 * symMult);
  }
  if (isHandAdaptation(id) || isFootAdaptation(id)) {
    return Math.round(4 * symMult);
  }
  if (id === 'wings_1') {
    return Math.round(8 * symMult);
  }
  if (isMouthAdaptation(id)) {
    return Math.round(5 * symMult);
  }
  return Math.round(3.5 * symMult);
}

export function computeCreatureComplexity(
  spineNodeCount: number,
  placedOrgans: readonly import('./types').PlacedOrganInstance[]
): number {
  const spineCost = Math.max(3, Math.min(9, spineNodeCount)) * 3;
  let organsCost = 0;
  for (const org of placedOrgans) {
    organsCost += getOrganComplexityCost(org.adaptationId, org.mirrorSymmetry);
  }
  return Math.min(MAX_CREATURE_COMPLEXITY, spineCost + organsCost);
}


