import * as THREE from 'three';
import { audioManager } from './AudioManager';
import { GAME_CONFIG } from './config';
import {
  isArmAdaptation,
  isFootAdaptation,
  isHandAdaptation,
  isLegAdaptation,
  normalizeAdaptationId,
} from './evolutionData';
import { createOrganVisual, OrganVisualInstance } from './OrganFactory3D';
import { EnvironmentObstacle } from './SceneEnvironment';
import {
  CreatureSpineSystem,
  SpineRMFFrame,
  SpineVertebra,
  OrganSpineAnchor,
} from './procedural/CreatureSpineSystem';
import {
  AcidSpitProjectile,
  BodySegmentConfig,
  BodySegmentId,
  BODY_SEGMENT_ORDER,
  CellBodyShape,
  CellColorTheme,
  CellularGrowthStage,
  createDefaultBodySegments,
  createDefaultSpineNodes,
  CreatureBodyArchetype,
  CreatureMorphologySliders,
  CreaturePaintConfig,
  DEFAULT_CREATURE_MORPHOLOGY,
  DEFAULT_CREATURE_PAINT,
  EditorPreviewAction,
  EditorSelectionTarget,
  InputState,
  MORPHOLOGY_SCALE_LIMITS,
  PlacedOrganInstance,
  PoisonCloudHazard,
  SpineVertebraNode,
  SteeringModeSetting,
} from './types';

const _forwardDir = new THREE.Vector3();
const _knockbackDecay = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _localPoint = new THREE.Vector3();
const _worldNozzlePos = new THREE.Vector3();
const _distalSocketPos = new THREE.Vector3();
const _rmfFrame: SpineRMFFrame = {
  position: new THREE.Vector3(),
  tangent: new THREE.Vector3(0, 0, 1),
  normal: new THREE.Vector3(1, 0, 0),
  binormal: new THREE.Vector3(0, 1, 0),
  radiusX: 0.95,
  radiusY: 0.95,
};

interface ColorPalette {
  membraneColor: number;
  membraneEmissive: number;
  boostColor: number;
  nucleusColor: number;
  nucleusEmissive: number;
  legColor: number;
}

const COLOR_THEMES: Record<CellColorTheme, ColorPalette> = {
  cyan: {
    membraneColor: 0x22d3ee,
    membraneEmissive: 0x0891b2,
    boostColor: 0x67e8f9,
    nucleusColor: 0xa7f3d0,
    nucleusEmissive: 0x10b981,
    legColor: 0x06b6d4,
  },
  emerald: {
    membraneColor: 0x34d399,
    membraneEmissive: 0x059669,
    boostColor: 0x6ee7b7,
    nucleusColor: 0xfef08a,
    nucleusEmissive: 0x84cc16,
    legColor: 0x10b981,
  },
  crimson: {
    membraneColor: 0xfb7185,
    membraneEmissive: 0xe11d48,
    boostColor: 0xfda4af,
    nucleusColor: 0xfde047,
    nucleusEmissive: 0xf97316,
    legColor: 0xf43f5e,
  },
  violet: {
    membraneColor: 0xc084fc,
    membraneEmissive: 0x7e22ce,
    boostColor: 0xd8b4fe,
    nucleusColor: 0x67e8f9,
    nucleusEmissive: 0x06b6d4,
    legColor: 0x9333ea,
  },
};

interface PooledPoisonCloud extends PoisonCloudHazard {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

export interface PooledAcidProjectile extends AcidSpitProjectile {
  mesh: THREE.Group;
  life: number;
}

interface ActivePlacedOrganEntry {
  instance: PlacedOrganInstance;
  primary: OrganVisualInstance;
  mirror: OrganVisualInstance | null;
}

export class PlayerCell {
  public readonly group: THREE.Group;
  public readonly position: THREE.Vector3;
  public headingAngle = 0; // Radians around Y axis (0 = facing -Z)
  public currentSpeed = 0;
  public angularVelocity = 0;
  public isBoosting = false;
  public heightOffset = 0;
  public currentScale = 1.0;
  public targetScale = 1.0;
  public cameraZoomMultiplier = 1.0;
  public activeArenaRadius = 110;

  private bodyShape: CellBodyShape = 'fusiforme';
  private colorTheme: CellColorTheme = 'cyan';
  private spineSegments: 1 | 2 | 3 = 1;
  private spineLength = 1.0;
  private torsoRadii: [number, number, number] = [1.0, 1.0, 1.0];
  private spineNodes: SpineVertebraNode[] = createDefaultSpineNodes(6, 1.0);
  private readonly creatureSpine = new CreatureSpineSystem(36, 24);
  private spineCurve: THREE.CatmullRomCurve3 = this.creatureSpine.curve;
  private spineBackboneLine!: THREE.Line;
  private paintConfig: CreaturePaintConfig = { ...DEFAULT_CREATURE_PAINT };
  private customPaintActive = false;
  private coatCanvas: HTMLCanvasElement | null = null;
  private coatCanvasTexture: THREE.CanvasTexture | null = null;
  private lastPaintSignature = '';
  private isLandCreature = false;
  private isEditingMode = false;
  private editorPreviewAction: EditorPreviewAction = 'idle';
  private editorActionTimer = 0;
  private isRespawnInvulnerable = false;

  private readonly knockbackVelocity = new THREE.Vector3();
  private membraneMesh!: THREE.Mesh;
  private nucleusMesh!: THREE.Mesh;
  private haloMesh!: THREE.Mesh;
  private membraneMat!: THREE.MeshPhysicalMaterial;
  private nucleusMat!: THREE.MeshStandardMaterial;
  private boostHaloMat!: THREE.MeshBasicMaterial;
  private legMat!: THREE.MeshStandardMaterial;
  private ciliaLeft: THREE.Mesh[] = [];
  private ciliaRight: THREE.Mesh[] = [];
  private readonly spineVertebraeMeshes: THREE.Mesh[] = [];
  private readonly spineVertebraeHitMeshes: THREE.Mesh[] = [];
  private readonly spineVertebraeMats: THREE.MeshStandardMaterial[] = [];
  private hoveredVertebraIndex: number | null = null;

  // Classic Cellular Membrane (cell_stage) & ARK-Style Pre-Built Creature Body Archetypes (creature_stage)
  private cellCapsuleMesh!: THREE.Mesh;
  private cellCapsuleBasePositions!: Float32Array;
  private creatureTorsoGroup!: THREE.Group;
  private creatureMorphology: CreatureMorphologySliders = {
    ...DEFAULT_CREATURE_MORPHOLOGY,
  };
  private bodySegments: BodySegmentConfig[] = createDefaultBodySegments();
  private bodySegmentsGroup!: THREE.Group;
  private segmentGroups: Record<BodySegmentId, THREE.Group> = {} as any;
  private segmentMeshes: Record<BodySegmentId, THREE.Mesh> = {} as any;
  private readonly bodySegmentMeshes: THREE.Mesh[] = [];
  private segmentHighlightMeshes: Record<BodySegmentId, THREE.Mesh> = {} as any;
  private segmentHighlightMats: Record<BodySegmentId, THREE.MeshBasicMaterial> = {} as any;
  private selectedSegmentId: BodySegmentId | null = null;
  private selectedSphereIndex: number | null = null;
  private hoveredSegmentId: BodySegmentId | null = null;
  private editorSelectionTarget: EditorSelectionTarget = 'body';
  public groundClearanceY = 0;
  public bodyGroundOffsetY = 0;

  // Dynamic Placed 3D Organs (Spore Workshop Drag & Drop)
  private placedOrgansGroup!: THREE.Group;
  private readonly activePlacedOrgans: ActivePlacedOrganEntry[] = [];
  private currentPlacedData: PlacedOrganInstance[] = [];
  private selectedInstanceId: string | null = null;

  // 3D Ghost Preview & Magnetic Snap Ring during Catalog / Organ Drag & Drop
  private dragPreviewGroup!: THREE.Group;
  private dragPreviewId: string | null = null;
  private dragPreviewPrimary: OrganVisualInstance | null = null;
  private dragPreviewMirror: OrganVisualInstance | null = null;
  private dragSnapRingPrimary!: THREE.Group;
  private dragSnapRingMirror!: THREE.Group;
  private dragSnapRingMat!: THREE.MeshBasicMaterial;
  private dragSnapHaloMat!: THREE.MeshBasicMaterial;
  private dragTargetAngle = 0;
  private dragSmoothedAngle = 0;
  private dragPreviewMirrorSymmetry = false;
  private dragPreviewIsValid = true;
  private dragPreviewInitialized = false;

  // 3D Spore Workshop Spine Stretch Arrows, Orientation Gizmo & Bioluminescent Lab Dish
  private editorLabDishGroup!: THREE.Group;
  private editorSpineOverlayGroup!: THREE.Group;
  private editorFrontArrowGroup!: THREE.Group;
  private editorRearArrowGroup!: THREE.Group;
  private editorArrowFrontMat!: THREE.MeshBasicMaterial;
  private editorArrowRearMat!: THREE.MeshBasicMaterial;

  // 3D Spore Part Orientation / Rotation Gizmo (floating sphere in front of selected organ)
  private editorOrientationGizmoGroup!: THREE.Group;
  private editorOrientationSphereMesh!: THREE.Mesh;
  private editorOrientationSphereMat!: THREE.MeshBasicMaterial;
  private editorOrientationRingMat!: THREE.MeshBasicMaterial;
  private editorOrientationStemMat!: THREE.MeshBasicMaterial;
  private isOrientationGizmoActive = false;

  // Amphibian Legs for Terrestrial Stage
  private evoAmphibianLegsGroup!: THREE.Group;
  private readonly amphibianLegs: THREE.Group[] = [];
  private hasCustomLegsInstalled = false;
  private hasWingsInstalled = false;
  private hasChemoreceptorInstalled = false;

  // 3D Spore Brain Evolution Sequence (Floating Thought Bubble & Pulsing Bioluminescent Brain)
  private brainCinematicGroup!: THREE.Group;
  private cerebrumGroup!: THREE.Group;
  private brainVesicleMesh!: THREE.Mesh;
  private brainVesicleMat!: THREE.MeshPhysicalMaterial;
  private readonly brainVesicleImplosionSpheres: THREE.Mesh[] = [];
  private brainVesicleImplosionMat!: THREE.MeshBasicMaterial;
  private brainOrganGroup!: THREE.Group;
  private brainLeftHemiMesh!: THREE.Mesh;
  private brainRightHemiMesh!: THREE.Mesh;
  private brainLeftBasePositions!: Float32Array;
  private brainRightBasePositions!: Float32Array;
  private brainLeftGyriDisplacements!: Float32Array;
  private brainRightGyriDisplacements!: Float32Array;
  private brainHemisphereMat!: THREE.MeshPhysicalMaterial;
  private brainCorpusMat!: THREE.MeshBasicMaterial;
  private brainDendriticLines!: THREE.LineSegments;
  private brainDendriticBasePositions!: Float32Array;
  private brainDendriticMat!: THREE.LineBasicMaterial;
  private brainSynapticPoints!: THREE.Points;
  private brainSynapticPositions!: Float32Array;
  private brainSynapticPhases!: Float32Array;
  private brainSynapticModes!: Uint8Array;
  private brainSynapticMat!: THREE.PointsMaterial;
  private brainFrontalFlashMesh!: THREE.Mesh;
  private brainFrontalFlashMat!: THREE.MeshBasicMaterial;
  private readonly brainShockwaveRings: THREE.Mesh[] = [];
  private readonly brainShockwaveMats: THREE.MeshBasicMaterial[] = [];
  private readonly brainEmissiveCyan = new THREE.Color(0x22d3ee);
  private readonly brainEmissiveViolet = new THREE.Color(0xc084fc);
  private readonly brainEmissiveWork = new THREE.Color();

  // Holographic Chemoreceptor Compass
  private chemoreceptorCompassGroup!: THREE.Group;
  private chemoreceptorArrowMat!: THREE.MeshBasicMaterial;
  private baseGrowthZoom = 1.0;
  private visionZoomFactor = 1.0;
  private poisonGlandStacks = 1;
  private isCamouflaged = false;

  // Pre-allocated World-Space Combat & Social Effect Pools
  private readonly poisonCloudPool: PooledPoisonCloud[] = [];
  private poisonPoolCursor = 0;
  private readonly acidProjectilePool: PooledAcidProjectile[] = [];
  private acidPoolCursor = 0;
  private electricWaveMesh!: THREE.Mesh;
  private electricDomeMesh!: THREE.Mesh;
  private electricWaveMat!: THREE.MeshBasicMaterial;
  private electricDomeMat!: THREE.MeshBasicMaterial;
  private electricPulseTimer = 0;
  private readonly electricPulseDuration = 0.55;
  private socialWaveMesh!: THREE.Mesh;
  private socialWaveMat!: THREE.MeshBasicMaterial;
  private socialWaveTimer = 0;
  private socialWaveMaxRadius = 9.5;

  // Pre-allocated Mating Call Acoustic Rings & Partner Cell (Spore Ritual)
  private readonly matingRingMeshes: THREE.Mesh[] = [];
  private readonly matingRingMats: THREE.MeshBasicMaterial[] = [];
  private mateCellGroup!: THREE.Group;
  private readonly mateTailSegments: THREE.Mesh[] = [];
  private readonly mateStartPos = new THREE.Vector3();
  private matingCallActive = false;
  private matingCallElapsed = 0;
  private readonly matingCallDuration = 0.9;

  private flagellumPhase = 0;
  private damageFlashTimer = 0;
  private obstacleBumpCooldown = 0;

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    this.position = this.group.position;

    this.buildProceduralCell();
    this.buildEditorWorkshopVisuals();
    this.buildBrainCinematicVisuals();
    this.initCombatEffectsPool(scene);
    scene.add(this.group);
  }

  private buildProceduralCell(): void {
    // Root container for both the Cellular Stage Capsule and the Creature Stage Archetype Body
    this.bodySegmentsGroup = new THREE.Group();
    (this.bodySegmentsGroup as any).renderOrder = 2;
    this.membraneMesh = this.bodySegmentsGroup as any;
    this.group.add(this.bodySegmentsGroup);

    this.membraneMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.25,
      roughness: 0.18,
      metalness: 0.05,
      transmission: 0.65,
      thickness: 1.2,
      ior: 1.38,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.88,
    });
    this.disposableMaterials.push(this.membraneMat);

    // 1A. Classic Original Cellular Stage Membrane (CapsuleGeometry - clean, single continuous mesh)
    const cellCapsuleGeo = new THREE.CapsuleGeometry(0.92, 0.9, 16, 28);
    cellCapsuleGeo.rotateX(Math.PI / 2);
    this.disposableGeometries.push(cellCapsuleGeo);
    const posAttr = cellCapsuleGeo.attributes.position as THREE.BufferAttribute;
    this.cellCapsuleBasePositions = new Float32Array(posAttr.array);

    this.cellCapsuleMesh = new THREE.Mesh(cellCapsuleGeo, this.membraneMat);
    this.cellCapsuleMesh.castShadow = true;
    this.cellCapsuleMesh.receiveShadow = true;
    this.cellCapsuleMesh.renderOrder = 2;
    this.cellCapsuleMesh.userData.bodySegmentId = 'pecho';
    this.cellCapsuleMesh.userData.sphereIndex = 2;
    this.bodySegmentsGroup.add(this.cellCapsuleMesh);

    // 1B. Creature Stage Pre-Built Archetype Body Group (ARK-style parametric scaling)
    this.creatureTorsoGroup = new THREE.Group();
    this.creatureTorsoGroup.visible = false;
    this.bodySegmentsGroup.add(this.creatureTorsoGroup);

    const segmentSphereGeo = new THREE.SphereGeometry(1.0, 24, 20);
    this.disposableGeometries.push(segmentSphereGeo);

    const pechoGroup = new THREE.Group();
    const cuelloGroup = new THREE.Group();
    const cabezaGroup = new THREE.Group();
    const abdomenGroup = new THREE.Group();
    const colaGroup = new THREE.Group();

    this.creatureTorsoGroup.add(
      pechoGroup,
      cuelloGroup,
      cabezaGroup,
      abdomenGroup,
      colaGroup
    );

    this.segmentGroups = {
      cabeza: cabezaGroup,
      cuello: cuelloGroup,
      pecho: pechoGroup,
      abdomen: abdomenGroup,
      cola: colaGroup,
    };

    const segIds: BodySegmentId[] = ['cabeza', 'cuello', 'pecho', 'abdomen', 'cola'];
    for (let idx = 0; idx < segIds.length; idx++) {
      const segId = segIds[idx];
      const mesh = new THREE.Mesh(segmentSphereGeo, this.membraneMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 2;
      mesh.userData.isBodySegment = true;
      mesh.userData.segmentId = segId;
      mesh.userData.bodySegmentId = segId;
      mesh.userData.sphereIndex = idx;
      this.segmentMeshes[segId] = mesh;
      this.bodySegmentMeshes[idx] = mesh;
      this.segmentGroups[segId].add(mesh);

      const hlMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        wireframe: true,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      this.disposableMaterials.push(hlMat);
      const hlMesh = new THREE.Mesh(segmentSphereGeo, hlMat);
      hlMesh.renderOrder = 10;
      hlMesh.visible = false;
      hlMesh.scale.setScalar(1.04);
      this.segmentHighlightMats[segId] = hlMat;
      this.segmentHighlightMeshes[segId] = hlMesh;
      this.segmentGroups[segId].add(hlMesh);
    }

    // 2. Glowing inner nucleus core (strictly parented inside cellCapsuleMesh so it never floats on the ground in Creature Stage)
    const nucleusGeo = new THREE.IcosahedronGeometry(0.48, 2);
    this.nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      emissive: 0x10b981,
      emissiveIntensity: 0.95,
      roughness: 0.45,
      metalness: 0.2,
    });
    this.nucleusMesh = new THREE.Mesh(nucleusGeo, this.nucleusMat);
    this.nucleusMesh.position.set(0, 0, 0.05);
    this.cellCapsuleMesh.add(this.nucleusMesh);

    // Keep legacy vertebra arrays allocated but permanently hidden so no floating spheres appear
    const vertebraGeo = new THREE.DodecahedronGeometry(0.18, 1);
    const vertebraHitGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const vertebraHitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.disposableGeometries.push(vertebraHitGeo);
    this.disposableMaterials.push(vertebraHitMat);

    for (let v = 0; v < 12; v++) {
      const vMat = new THREE.MeshStandardMaterial({
        color: 0xa7f3d0,
        emissive: 0x10b981,
        emissiveIntensity: 0.95,
        roughness: 0.38,
        metalness: 0.2,
      });
      this.disposableMaterials.push(vMat);
      this.spineVertebraeMats.push(vMat);

      const vMesh = new THREE.Mesh(vertebraGeo, vMat);
      vMesh.visible = false;
      const vHit = new THREE.Mesh(vertebraHitGeo, vertebraHitMat);
      vHit.visible = false;
      vMesh.add(vHit);
      this.spineVertebraeMeshes.push(vMesh);
      this.spineVertebraeHitMeshes.push(vHit);
    }

    const backboneGeo = new THREE.BufferGeometry().setFromPoints(
      new Array(32).fill(0).map(() => new THREE.Vector3())
    );
    const backboneMat = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
    });
    this.disposableGeometries.push(backboneGeo);
    this.disposableMaterials.push(backboneMat);
    this.spineBackboneLine = new THREE.Line(backboneGeo, backboneMat);
    this.spineBackboneLine.visible = false;

    // 3. Internal Organelles (Mitochondria / Vacuoles)
    const organelleGeo = new THREE.CapsuleGeometry(0.15, 0.26, 8, 12);
    const organelleMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.1,
    });

    const orgLeft = new THREE.Mesh(organelleGeo, organelleMat);
    orgLeft.position.set(-0.38, 0.1, -0.18);
    orgLeft.rotation.set(0.4, 0.5, 0.2);
    this.cellCapsuleMesh.add(orgLeft);

    const orgRight = new THREE.Mesh(organelleGeo, organelleMat);
    orgRight.position.set(0.38, -0.08, -0.12);
    orgRight.rotation.set(-0.3, -0.4, 0.3);
    this.cellCapsuleMesh.add(orgRight);

    // 4. Subtle Ambient Lateral Micro-Cilia
    const ciliaGeo = new THREE.ConeGeometry(0.1, 0.42, 8);
    ciliaGeo.rotateZ(Math.PI / 2);
    const ciliaMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.1,
    });

    for (let i = 0; i < 2; i++) {
      const zPos = -0.3 + i * 0.6;
      const leftFin = new THREE.Mesh(ciliaGeo, ciliaMat);
      leftFin.position.set(-0.98, 0, zPos);
      leftFin.rotation.y = 0.35;
      leftFin.visible = false;
      this.cellCapsuleMesh.add(leftFin);
      this.ciliaLeft.push(leftFin);

      const rightFin = new THREE.Mesh(ciliaGeo, ciliaMat);
      rightFin.position.set(0.98, 0, zPos);
      rightFin.rotation.z = Math.PI;
      rightFin.rotation.y = -0.35;
      rightFin.visible = false;
      this.cellCapsuleMesh.add(rightFin);
      this.ciliaRight.push(rightFin);
    }

    // 5. Underwater Contact Ring / Bioluminescent Halo beneath cell
    const haloGeo = new THREE.RingGeometry(0.95, 1.45, 32);
    haloGeo.rotateX(-Math.PI / 2);
    this.boostHaloMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.haloMesh = new THREE.Mesh(haloGeo, this.boostHaloMat);
    this.haloMesh.position.y = -0.95;
    this.group.add(this.haloMesh);

    // 6. Dynamic Placed 3D Organs Container & Drag Preview Container
    this.placedOrgansGroup = new THREE.Group();
    this.group.add(this.placedOrgansGroup);

    this.dragPreviewGroup = new THREE.Group();
    this.dragPreviewGroup.visible = false;

    // Magnetic Snapping Socket Rings (Primary + Mirror) for tactile membrane anchoring feedback
    const snapRingGeo = new THREE.RingGeometry(0.24, 0.34, 28);
    const snapHaloGeo = new THREE.CircleGeometry(0.24, 24);
    this.disposableGeometries.push(snapRingGeo, snapHaloGeo);

    this.dragSnapRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.dragSnapHaloMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.disposableMaterials.push(this.dragSnapRingMat, this.dragSnapHaloMat);

    this.dragSnapRingPrimary = new THREE.Group();
    const primaryRingMesh = new THREE.Mesh(snapRingGeo, this.dragSnapRingMat);
    primaryRingMesh.renderOrder = 18;
    const primaryHaloMesh = new THREE.Mesh(snapHaloGeo, this.dragSnapHaloMat);
    primaryHaloMesh.renderOrder = 17;
    this.dragSnapRingPrimary.add(primaryRingMesh, primaryHaloMesh);

    this.dragSnapRingMirror = new THREE.Group();
    const mirrorRingMesh = new THREE.Mesh(snapRingGeo, this.dragSnapRingMat);
    mirrorRingMesh.renderOrder = 18;
    const mirrorHaloMesh = new THREE.Mesh(snapHaloGeo, this.dragSnapHaloMat);
    mirrorHaloMesh.renderOrder = 17;
    this.dragSnapRingMirror.add(mirrorRingMesh, mirrorHaloMesh);

    this.dragPreviewGroup.add(this.dragSnapRingPrimary, this.dragSnapRingMirror);
    this.group.add(this.dragPreviewGroup);

    // 7. 4 Articulated Amphibian Legs with Webbed Feet (for Creature Stage)
    this.evoAmphibianLegsGroup = new THREE.Group();
    this.evoAmphibianLegsGroup.visible = false;

    const thighGeo = new THREE.CapsuleGeometry(0.16, 0.45, 8, 10);
    thighGeo.translate(0, -0.22, 0);
    const shinGeo = new THREE.CapsuleGeometry(0.13, 0.44, 8, 10);
    shinGeo.translate(0, -0.22, 0);
    const footPadGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.08, 10);
    footPadGeo.scale(1.1, 1.0, 1.45);
    const toeGeo = new THREE.ConeGeometry(0.06, 0.28, 6);
    toeGeo.rotateX(-Math.PI / 2);

    this.legMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.15,
    });

    const legSockets: [number, number, number, number][] = [
      [-0.82, -0.22, -0.58, -1],
      [0.82, -0.22, -0.58, 1],
      [-0.86, -0.22, 0.56, -1],
      [0.86, -0.22, 0.56, 1],
    ];

    for (const [lx, ly, lz, side] of legSockets) {
      const legHip = new THREE.Group();
      legHip.position.set(lx, ly, lz);

      const thighMesh = new THREE.Mesh(thighGeo, this.legMat);
      thighMesh.rotation.z = side * 0.45;
      thighMesh.castShadow = true;
      legHip.add(thighMesh);

      const shinMesh = new THREE.Mesh(shinGeo, this.legMat);
      shinMesh.position.set(side * 0.24, -0.38, 0.05);
      shinMesh.rotation.z = side * -0.15;
      shinMesh.castShadow = true;
      legHip.add(shinMesh);

      const footGroup = new THREE.Group();
      footGroup.position.set(side * 0.32, -0.78, -0.06);
      const padMesh = new THREE.Mesh(footPadGeo, this.legMat);
      footGroup.add(padMesh);

      for (let t = -1; t <= 1; t++) {
        const toeMesh = new THREE.Mesh(toeGeo, this.legMat);
        toeMesh.position.set(t * 0.12, -0.01, -0.28);
        toeMesh.rotation.y = -t * 0.22;
        footGroup.add(toeMesh);
      }

      legHip.add(footGroup);
      this.evoAmphibianLegsGroup.add(legHip);
      this.amphibianLegs.push(legHip);
    }
    this.group.add(this.evoAmphibianLegsGroup);

    this.disposableGeometries.push(
      vertebraGeo,
      nucleusGeo,
      organelleGeo,
      ciliaGeo,
      haloGeo,
      thighGeo,
      shinGeo,
      footPadGeo,
      toeGeo
    );
    this.disposableMaterials.push(
      this.membraneMat,
      this.nucleusMat,
      organelleMat,
      ciliaMat,
      this.boostHaloMat,
      this.legMat
    );
  }

  /**
   * Builds the Spore-style 3D Laboratory Dish Grid + Interactive Spine Vertebral Nodes + Stretch Arrows.
   */
  private buildEditorWorkshopVisuals(): void {
    // 1. Subtle Bioluminescent Laboratory Dish Grid underneath cell in Editor
    this.editorLabDishGroup = new THREE.Group();
    this.editorLabDishGroup.position.y = -0.92;
    this.editorLabDishGroup.visible = false;

    const dishRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposableMaterials.push(dishRingMat);

    for (const r of [1.8, 2.8, 3.9]) {
      const rGeo = new THREE.RingGeometry(r - 0.03, r, 48);
      rGeo.rotateX(-Math.PI / 2);
      this.disposableGeometries.push(rGeo);
      const rMesh = new THREE.Mesh(rGeo, dishRingMat);
      this.editorLabDishGroup.add(rMesh);
    }

    // Symmetry centerline guide along Z axis
    const axisGeo = new THREE.PlaneGeometry(0.04, 7.6);
    axisGeo.rotateX(-Math.PI / 2);
    const axisMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposableGeometries.push(axisGeo);
    this.disposableMaterials.push(axisMat);
    const axisMesh = new THREE.Mesh(axisGeo, axisMat);
    this.editorLabDishGroup.add(axisMesh);
    this.group.add(this.editorLabDishGroup);

    // 2. Interactive Spine Stretch Arrows (Front -Z and Rear +Z)
    this.editorSpineOverlayGroup = new THREE.Group();
    this.editorSpineOverlayGroup.visible = false;

    const arrowConeGeo = new THREE.ConeGeometry(0.24, 0.52, 14);
    const arrowStemGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.36, 12);
    const arrowHitGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const arrowHitMat = new THREE.MeshBasicMaterial({
      visible: false,
    });
    this.disposableGeometries.push(arrowConeGeo, arrowStemGeo, arrowHitGeo);
    this.disposableMaterials.push(arrowHitMat);

    this.editorArrowFrontMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
    });
    this.editorArrowRearMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
    });
    this.disposableMaterials.push(this.editorArrowFrontMat, this.editorArrowRearMat);

    // Front arrow pointing -Z
    this.editorFrontArrowGroup = new THREE.Group();
    this.editorFrontArrowGroup.userData.editorHandle = 'arrow_front';
    const frontCone = new THREE.Mesh(arrowConeGeo, this.editorArrowFrontMat);
    frontCone.rotation.x = -Math.PI / 2;
    frontCone.position.z = -0.32;
    frontCone.renderOrder = 12;
    frontCone.userData.editorHandle = 'arrow_front';
    const frontStem = new THREE.Mesh(arrowStemGeo, this.editorArrowFrontMat);
    frontStem.rotation.x = Math.PI / 2;
    frontStem.position.z = 0.05;
    frontStem.renderOrder = 12;
    frontStem.userData.editorHandle = 'arrow_front';
    const frontHit = new THREE.Mesh(arrowHitGeo, arrowHitMat);
    frontHit.userData.editorHandle = 'arrow_front';
    this.editorFrontArrowGroup.add(frontCone, frontStem, frontHit);
    this.editorSpineOverlayGroup.add(this.editorFrontArrowGroup);

    // Rear arrow pointing +Z
    this.editorRearArrowGroup = new THREE.Group();
    this.editorRearArrowGroup.userData.editorHandle = 'arrow_rear';
    const rearCone = new THREE.Mesh(arrowConeGeo, this.editorArrowRearMat);
    rearCone.rotation.x = Math.PI / 2;
    rearCone.position.z = 0.32;
    rearCone.renderOrder = 12;
    rearCone.userData.editorHandle = 'arrow_rear';
    const rearStem = new THREE.Mesh(arrowStemGeo, this.editorArrowRearMat);
    rearStem.rotation.x = Math.PI / 2;
    rearStem.position.z = -0.05;
    rearStem.renderOrder = 12;
    rearStem.userData.editorHandle = 'arrow_rear';
    const rearHit = new THREE.Mesh(arrowHitGeo, arrowHitMat);
    rearHit.userData.editorHandle = 'arrow_rear';
    this.editorRearArrowGroup.add(rearCone, rearStem, rearHit);
    this.editorSpineOverlayGroup.add(this.editorRearArrowGroup);

    this.group.add(this.editorSpineOverlayGroup);

    // 3. Spore-Style Part Orientation / Rotation Gizmo (floating sphere slightly in front of selected organ)
    this.editorOrientationGizmoGroup = new THREE.Group();
    this.editorOrientationGizmoGroup.visible = false;
    this.editorOrientationGizmoGroup.userData.editorHandle = 'organ_orientation_gizmo';

    const gizmoStemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.72, 10);
    gizmoStemGeo.rotateX(Math.PI / 2);
    const gizmoSphereGeo = new THREE.SphereGeometry(0.17, 20, 20);
    const gizmoRingGeo = new THREE.RingGeometry(0.21, 0.26, 24);
    gizmoRingGeo.rotateX(-Math.PI / 2);
    const gizmoHitGeo = new THREE.SphereGeometry(0.42, 10, 10);
    this.disposableGeometries.push(
      gizmoStemGeo,
      gizmoSphereGeo,
      gizmoRingGeo,
      gizmoHitGeo
    );

    this.editorOrientationStemMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
    });
    this.editorOrientationSphereMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
    });
    this.editorOrientationRingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.disposableMaterials.push(
      this.editorOrientationStemMat,
      this.editorOrientationSphereMat,
      this.editorOrientationRingMat
    );

    const gizmoStemMesh = new THREE.Mesh(gizmoStemGeo, this.editorOrientationStemMat);
    gizmoStemMesh.position.set(0, 0.1, 0.58);
    gizmoStemMesh.renderOrder = 15;
    gizmoStemMesh.userData.editorHandle = 'organ_orientation_gizmo';

    this.editorOrientationSphereMesh = new THREE.Mesh(
      gizmoSphereGeo,
      this.editorOrientationSphereMat
    );
    this.editorOrientationSphereMesh.position.set(0, 0.1, 0.96);
    this.editorOrientationSphereMesh.renderOrder = 16;
    this.editorOrientationSphereMesh.userData.editorHandle = 'organ_orientation_gizmo';

    const gizmoRingMesh = new THREE.Mesh(gizmoRingGeo, this.editorOrientationRingMat);
    gizmoRingMesh.renderOrder = 16;
    gizmoRingMesh.userData.editorHandle = 'organ_orientation_gizmo';
    this.editorOrientationSphereMesh.add(gizmoRingMesh);

    const gizmoHitMesh = new THREE.Mesh(gizmoHitGeo, arrowHitMat);
    gizmoHitMesh.position.set(0, 0.1, 0.96);
    gizmoHitMesh.userData.editorHandle = 'organ_orientation_gizmo';

    this.editorOrientationGizmoGroup.add(
      gizmoStemMesh,
      this.editorOrientationSphereMesh,
      gizmoHitMesh
    );
    this.group.add(this.editorOrientationGizmoGroup);
  }

  private getBodyShapeFactors(): { sx: number; sy: number; sz: number } {
    if (this.bodyShape === 'esferico') {
      return { sx: 1.24, sy: 1.1, sz: 0.84 };
    }
    if (this.bodyShape === 'alargado') {
      return { sx: 0.82, sy: 0.9, sz: 1.24 };
    }
    return { sx: 1.0, sy: 1.0, sz: 1.0 };
  }

  private getInterpolatedTorsoRadius(axialU: number): number {
    const u = THREE.MathUtils.clamp(axialU, -1, 1);
    const t = (u + 1) * 0.5;
    return this.getInterpolatedSpineRadiusAtT(t);
  }

  private getInterpolatedSpineRadiusAtT(tNorm: number): number {
    const t = THREE.MathUtils.clamp(tNorm, 0, 1);
    const nodes = this.spineNodes;
    if (!nodes || nodes.length === 0) {
      return 1.0;
    }
    if (nodes.length === 1) {
      return THREE.MathUtils.clamp(nodes[0].radius, 0.35, 2.8);
    }
    const scaled = t * (nodes.length - 1);
    const idx0 = Math.floor(scaled);
    const idx1 = Math.min(nodes.length - 1, idx0 + 1);
    const frac = scaled - idx0;
    const smoothFrac = frac * frac * (3 - 2 * frac);
    const r0 = nodes[idx0]?.radius ?? 1.0;
    const r1 = nodes[idx1]?.radius ?? 1.0;

    // Combine individual vertebra radius with legacy 3-zone torsoRadii multiplier
    const u = -1 + 2 * t;
    const [rFront, rMid, rRear] = this.torsoRadii;
    const zoneMult =
      u < 0
        ? THREE.MathUtils.lerp(rMid, rFront, -u)
        : THREE.MathUtils.lerp(rMid, rRear, u);

    return THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(r0, r1, smoothFrac) * zoneMult,
      0.35,
      2.8
    );
  }

  private rebuildSpineCurveFromNodes(): void {
    const { sx, sy } = this.getBodyShapeFactors();
    this.spineNodes = this.creatureSpine.rebuildFromVertebraNodes(
      this.spineNodes,
      this.spineLength,
      this.torsoRadii,
      sx,
      sy
    );
    this.spineCurve = this.creatureSpine.curve;

    if (this.spineBackboneLine) {
      const posAttr = this.spineBackboneLine.geometry.attributes
        .position as THREE.BufferAttribute;
      for (let i = 0; i < 32; i++) {
        const t = i / 31;
        this.creatureSpine.getFrameAtT(t, _rmfFrame);
        posAttr.setXYZ(
          i,
          _rmfFrame.position.x + _rmfFrame.binormal.x * 0.16,
          _rmfFrame.position.y + _rmfFrame.binormal.y * 0.16,
          _rmfFrame.position.z + _rmfFrame.binormal.z * 0.16
        );
      }
      posAttr.needsUpdate = true;
    }
  }

  public getBodySegments(): BodySegmentConfig[] {
    return this.bodySegments.map((s) => ({ ...s }));
  }

  public getBodySegment(id: BodySegmentId): BodySegmentConfig {
    return (
      this.bodySegments.find((s) => s.id === id) ?? {
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        radius: 1.0,
        lengthZ: 1.0,
        pitchAngle: 0,
        yawAngle: 0,
      }
    );
  }

  public setBodySegments(segments: BodySegmentConfig[]): void {
    if (segments && segments.length === 5) {
      this.bodySegments = segments.map((s) => ({
        ...s,
        radius: THREE.MathUtils.clamp(
          s.radius ?? 1.0,
          MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
          MORPHOLOGY_SCALE_LIMITS.bodySegment.max
        ),
      }));
      this.updateSegmentedBodyGeometry(false);
    }
  }

  public setBodySegment(
    id: BodySegmentId,
    partial: Partial<BodySegmentConfig>
  ): void {
    this.bodySegments = this.bodySegments.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          ...partial,
          radius:
            partial.radius !== undefined
              ? THREE.MathUtils.clamp(
                  partial.radius,
                  MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
                  MORPHOLOGY_SCALE_LIMITS.bodySegment.max
                )
              : s.radius,
          lengthZ:
            partial.lengthZ !== undefined
              ? THREE.MathUtils.clamp(partial.lengthZ, 0.5, 2.0)
              : s.lengthZ,
          pitchAngle:
            partial.pitchAngle !== undefined
              ? THREE.MathUtils.clamp(partial.pitchAngle, -Math.PI / 4, Math.PI / 4)
              : s.pitchAngle,
          yawAngle:
            partial.yawAngle !== undefined
              ? THREE.MathUtils.clamp(partial.yawAngle, -Math.PI / 6, Math.PI / 6)
              : s.yawAngle,
        };
      }
      return s;
    });
    this.updateSegmentedBodyGeometry(false);
  }

  public adjustBodySphereRadius(sphereIndex: number, delta: number): void {
    const safeIdx = THREE.MathUtils.clamp(Math.round(sphereIndex), 0, 4);
    const currentRadius = this.bodySegments[safeIdx]?.radius ?? 1.0;
    const newRadius = THREE.MathUtils.clamp(
      currentRadius + delta,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.max
    );

    if (this.bodySegments[safeIdx]) {
      this.bodySegments[safeIdx].radius = newRadius;

      // Escala únicamente la malla de esa esfera local
      const sphereMesh = this.bodySegmentMeshes[safeIdx];
      if (sphereMesh) {
        sphereMesh.scale.set(newRadius, newRadius, newRadius);
      }

      const segId = this.bodySegments[safeIdx].id;
      const hlMesh = this.segmentHighlightMeshes[segId];
      if (hlMesh) {
        hlMesh.scale.setScalar(newRadius * 1.04);
      }

      if (!this.isLandCreature) {
        const zoneIdx: 0 | 1 | 2 =
          safeIdx <= 1 ? 0 : safeIdx === 4 ? 2 : 1;
        this.torsoRadii[zoneIdx] = newRadius;
        this.updateSegmentedBodyGeometry(false);
        return;
      }

      // Actualiza la posición relativa de los órganos anclados a esta sección sin alterar la altura Y
      this.repositionOrgansOnSegment(safeIdx);
    }
  }

  public repositionOrgansOnSegment(_sphereIndex: number): void {
    // Reposiciona los órganos anclados sobre la sección sin recalcular ni modificar la altura Y de la criatura
    this.repositionAllPlacedOrgans(false);
  }

  public getBodySegmentObjects(): THREE.Object3D[] {
    if (!this.isLandCreature && this.cellCapsuleMesh) {
      return [this.cellCapsuleMesh];
    }
    return Object.values(this.segmentMeshes);
  }

  public setSelectedBodySegment(id: BodySegmentId | null): void {
    this.selectedSegmentId = id;
    this.selectedSphereIndex =
      id !== null ? BODY_SEGMENT_ORDER.indexOf(id) : null;
    if (this.selectedSphereIndex === -1) {
      this.selectedSphereIndex = null;
    }
    // Selección neutra: actualiza únicamente el indicador visual sin alterar position.y ni recalcular altura
    this.setHoveredBodySegment(this.hoveredSegmentId);
  }

  public setSelectedSphereIndex(sphereIndex: number | null): void {
    if (sphereIndex === null || sphereIndex < 0 || sphereIndex >= BODY_SEGMENT_ORDER.length) {
      this.selectedSphereIndex = null;
      this.selectedSegmentId = null;
    } else {
      const safeIdx = Math.round(sphereIndex);
      this.selectedSphereIndex = safeIdx;
      this.selectedSegmentId = BODY_SEGMENT_ORDER[safeIdx];
    }
    // Selección neutra: actualiza únicamente el indicador visual sin alterar position.y ni recalcular altura
    this.setHoveredBodySegment(this.hoveredSegmentId);
  }

  public getSelectedBodySegmentId(): BodySegmentId | null {
    return this.selectedSegmentId;
  }

  public getSelectedSphereIndex(): number | null {
    return this.selectedSphereIndex;
  }

  public setSelectedOrganInstanceId(instanceId: string | null): void {
    this.selectedInstanceId = instanceId;
    this.refreshOrganSelectionHighlights();
    this.updateOrientationGizmoTransform();
  }

  public setEditorSelectionTarget(target: EditorSelectionTarget): void {
    this.editorSelectionTarget = target;
    this.setHoveredBodySegment(this.hoveredSegmentId);
    this.refreshOrganSelectionHighlights();
  }

  public getEditorSelectionTarget(): EditorSelectionTarget {
    return this.editorSelectionTarget;
  }

  private refreshOrganSelectionHighlights(): void {
    for (const entry of this.activePlacedOrgans) {
      if (!this.isEditingMode || this.editorSelectionTarget === null) {
        entry.primary.setHighlight('none');
        entry.mirror?.setHighlight('none');
        continue;
      }
      const normId = normalizeAdaptationId(entry.instance.adaptationId);
      const isDirectlySelected =
        this.selectedInstanceId !== null &&
        entry.instance.instanceId === this.selectedInstanceId;
      const isTargetLegGroup =
        this.editorSelectionTarget === 'legs' &&
        (isLegAdaptation(normId) || isFootAdaptation(normId));
      const isTargetArmGroup =
        this.editorSelectionTarget === 'arms' &&
        (isArmAdaptation(normId) || isHandAdaptation(normId));

      const shouldHighlight =
        isDirectlySelected || isTargetLegGroup || isTargetArmGroup;
      entry.primary.setHighlight(shouldHighlight ? 'selected' : 'none');
      entry.mirror?.setHighlight(shouldHighlight ? 'selected' : 'none');
    }
  }

  public getEffectiveGroundY(): number {
    if (!this.isLandCreature) return 0;
    return THREE.MathUtils.clamp(
      this.groundClearanceY + this.bodyGroundOffsetY,
      0.2,
      3.5
    );
  }

  public setBodyGroundOffsetY(offsetY: number): void {
    this.bodyGroundOffsetY = THREE.MathUtils.clamp(offsetY, -1.5, 2.5);
    const effectiveY = this.getEffectiveGroundY();
    this.bodySegmentsGroup.position.y = effectiveY;
    this.placedOrgansGroup.position.y = effectiveY;
    this.bodySegmentsGroup.updateMatrixWorld(true);
    this.placedOrgansGroup.updateMatrixWorld(true);
    this.repositionAllPlacedOrgans(false);
  }

  public adjustCreatureGroundHeight(deltaY: number): number {
    if (!this.isLandCreature) return 0;
    const currentY = this.getEffectiveGroundY();
    const nextY = THREE.MathUtils.clamp(currentY + deltaY, 0.2, 3.5);
    this.bodyGroundOffsetY = nextY - this.groundClearanceY;
    this.bodySegmentsGroup.position.y = nextY;
    this.placedOrgansGroup.position.y = nextY;
    this.bodySegmentsGroup.updateMatrixWorld(true);
    this.placedOrgansGroup.updateMatrixWorld(true);
    this.repositionAllPlacedOrgans(false);
    return nextY;
  }

  public setHoveredBodySegment(id: BodySegmentId | null): void {
    this.hoveredSegmentId = id;
    const segIds: BodySegmentId[] = ['cabeza', 'cuello', 'pecho', 'abdomen', 'cola'];
    for (const segId of segIds) {
      const isSelected = this.selectedSegmentId === segId;
      const isHovered = this.hoveredSegmentId === segId;
      const isActive = (isSelected || isHovered) && this.isEditingMode;
      const hlMesh = this.segmentHighlightMeshes[segId];
      const hlMat = this.segmentHighlightMats[segId];
      if (hlMesh && hlMat) {
        hlMesh.visible = isActive;
        if (isActive) {
          hlMat.color.setHex(isSelected ? 0xfef08a : 0x67e8f9);
          hlMat.opacity = isSelected ? 0.62 : 0.35;
        }
      }
    }
  }

  public getCreatureMorphology(): CreatureMorphologySliders {
    return { ...this.creatureMorphology };
  }

  public setCreatureMorphology(
    partial: Partial<CreatureMorphologySliders>,
    recomputeBaseClearance = true
  ): void {
    this.creatureMorphology = {
      ...this.creatureMorphology,
      ...partial,
      heightScale:
        partial.heightScale !== undefined
          ? THREE.MathUtils.clamp(partial.heightScale, 0.7, 1.6)
          : this.creatureMorphology.heightScale,
      widthScale:
        partial.widthScale !== undefined
          ? THREE.MathUtils.clamp(partial.widthScale, 0.6, 1.8)
          : this.creatureMorphology.widthScale,
      musculatureScale:
        partial.musculatureScale !== undefined
          ? THREE.MathUtils.clamp(partial.musculatureScale, 0.7, 1.9)
          : this.creatureMorphology.musculatureScale,
    };
    this.updateSegmentedBodyGeometry(recomputeBaseClearance);
  }

  private getArchetypeLayout(archetype: CreatureBodyArchetype): {
    parts: Record<
      BodySegmentId,
      {
        pos: [number, number, number];
        scale: [number, number, number];
        pitch: number;
        yaw: number;
      }
    >;
    sockets: {
      head: [number, number, number];
      forelimbs: [number, number, number];
      hindlimbs: [number, number, number];
      tail: [number, number, number];
    };
  } {
    switch (archetype) {
      case 'cuadrupedo_robusto':
        return {
          parts: {
            pecho: {
              pos: [0, 0.14, -0.22],
              scale: [1.18, 1.05, 1.18],
              pitch: 0.04,
              yaw: 0,
            },
            cuello: {
              pos: [0, 0.42, -0.86],
              scale: [0.82, 0.84, 0.88],
              pitch: 0.26,
              yaw: 0,
            },
            cabeza: {
              pos: [0, 0.66, -1.36],
              scale: [0.88, 0.82, 0.98],
              pitch: 0.05,
              yaw: 0,
            },
            abdomen: {
              pos: [0, 0.12, 0.54],
              scale: [1.14, 1.02, 1.16],
              pitch: -0.04,
              yaw: 0,
            },
            cola: {
              pos: [0, 0.08, 1.38],
              scale: [0.68, 0.62, 1.12],
              pitch: -0.08,
              yaw: 0,
            },
          },
          sockets: {
            head: [0, 0.66, -1.36],
            forelimbs: [1.08, -0.04, -0.34],
            hindlimbs: [1.04, -0.04, 0.56],
            tail: [0, 0.04, 2.18],
          },
        };
      case 'reptiliano_rastreador':
        return {
          parts: {
            pecho: {
              pos: [0, -0.14, -0.18],
              scale: [1.26, 0.66, 1.18],
              pitch: 0,
              yaw: 0,
            },
            cuello: {
              pos: [0, -0.08, -0.84],
              scale: [0.88, 0.58, 0.86],
              pitch: 0.08,
              yaw: 0,
            },
            cabeza: {
              pos: [0, -0.02, -1.36],
              scale: [0.92, 0.56, 1.04],
              pitch: 0.02,
              yaw: 0,
            },
            abdomen: {
              pos: [0, -0.16, 0.56],
              scale: [1.18, 0.64, 1.16],
              pitch: 0,
              yaw: 0,
            },
            cola: {
              pos: [0, -0.18, 1.44],
              scale: [0.64, 0.45, 1.34],
              pitch: 0.04,
              yaw: 0,
            },
          },
          sockets: {
            head: [0, -0.02, -1.36],
            forelimbs: [1.18, -0.22, -0.32],
            hindlimbs: [1.12, -0.22, 0.58],
            tail: [0, -0.16, 2.38],
          },
        };
      case 'humanoide_erguido':
        return {
          parts: {
            pecho: {
              pos: [0, 0.48, -0.04],
              scale: [1.08, 1.04, 0.82],
              pitch: 0.1,
              yaw: 0,
            },
            cuello: {
              pos: [0, 0.98, -0.12],
              scale: [0.62, 0.6, 0.62],
              pitch: 0.05,
              yaw: 0,
            },
            cabeza: {
              pos: [0, 1.38, -0.2],
              scale: [0.82, 0.86, 0.86],
              pitch: 0,
              yaw: 0,
            },
            abdomen: {
              pos: [0, -0.02, 0.06],
              scale: [0.9, 0.88, 0.78],
              pitch: 0.04,
              yaw: 0,
            },
            cola: {
              pos: [0, -0.24, 0.58],
              scale: [0.46, 0.44, 0.72],
              pitch: -0.22,
              yaw: 0,
            },
          },
          sockets: {
            head: [0, 1.38, -0.2],
            forelimbs: [1.02, 0.58, -0.06],
            hindlimbs: [0.78, -0.2, 0.06],
            tail: [0, -0.32, 1.08],
          },
        };
      case 'serpentino':
        return {
          parts: {
            pecho: {
              pos: [0, -0.06, -0.26],
              scale: [0.74, 0.72, 1.26],
              pitch: 0.06,
              yaw: 0.12,
            },
            cuello: {
              pos: [-0.1, 0.08, -0.96],
              scale: [0.66, 0.66, 1.12],
              pitch: 0.12,
              yaw: -0.14,
            },
            cabeza: {
              pos: [0, 0.2, -1.58],
              scale: [0.76, 0.7, 1.02],
              pitch: 0.04,
              yaw: 0.06,
            },
            abdomen: {
              pos: [0.1, -0.12, 0.58],
              scale: [0.7, 0.68, 1.26],
              pitch: -0.04,
              yaw: -0.14,
            },
            cola: {
              pos: [0, -0.14, 1.48],
              scale: [0.52, 0.5, 1.38],
              pitch: 0.06,
              yaw: 0.14,
            },
          },
          sockets: {
            head: [0, 0.2, -1.58],
            forelimbs: [0.7, -0.1, -0.32],
            hindlimbs: [0.66, -0.16, 0.58],
            tail: [0, -0.12, 2.42],
          },
        };
      case 'bipedo_agil':
      default:
        return {
          parts: {
            pecho: {
              pos: [0, 0.2, -0.08],
              scale: [0.9, 0.96, 1.12],
              pitch: -0.16,
              yaw: 0,
            },
            cuello: {
              pos: [0, 0.58, -0.64],
              scale: [0.64, 0.76, 0.82],
              pitch: 0.38,
              yaw: 0,
            },
            cabeza: {
              pos: [0, 0.9, -1.06],
              scale: [0.76, 0.72, 0.94],
              pitch: 0.06,
              yaw: 0,
            },
            abdomen: {
              pos: [0, 0.08, 0.52],
              scale: [0.86, 0.9, 1.04],
              pitch: -0.1,
              yaw: 0,
            },
            cola: {
              pos: [0, 0.16, 1.3],
              scale: [0.54, 0.52, 1.28],
              pitch: 0.12,
              yaw: 0,
            },
          },
          sockets: {
            head: [0, 0.9, -1.06],
            forelimbs: [0.82, 0.24, -0.28],
            hindlimbs: [0.8, -0.06, 0.4],
            tail: [0, 0.22, 2.15],
          },
        };
    }
  }

  /**
   * Restores the clean CapsuleGeometry in Cellular Stage (`cell_stage`) and applies the
   * 5 Pre-Built ARK-Style Creature Archetypes + per-sphere local radii in Creature Stage (`creature_stage`).
   */
  public updateSegmentedBodyGeometry(recomputeBaseClearance = false): void {
    const isCreature = this.isLandCreature;
    if (this.cellCapsuleMesh) {
      this.cellCapsuleMesh.visible = !isCreature;
    }
    if (this.creatureTorsoGroup) {
      this.creatureTorsoGroup.visible = isCreature;
    }

    const { sx, sy, sz } = this.getBodyShapeFactors();
    const spineLen = this.spineLength;

    if (!isCreature) {
      // 1. Original Clean Cellular Stage Capsule Geometry Sculpting
      if (this.cellCapsuleMesh && this.cellCapsuleBasePositions) {
        const posAttr = this.cellCapsuleMesh.geometry.attributes
          .position as THREE.BufferAttribute;
        const base = this.cellCapsuleBasePositions;
        const [rFront, rMid, rRear] = this.torsoRadii;

        for (let i = 0; i < posAttr.count; i++) {
          const idx = i * 3;
          const bx = base[idx];
          const by = base[idx + 1];
          const bz = base[idx + 2];
          const u = THREE.MathUtils.clamp(bz / 1.37, -1, 1);
          const zoneRadius =
            u < 0
              ? THREE.MathUtils.lerp(rMid, rFront, -u)
              : THREE.MathUtils.lerp(rMid, rRear, u);

          posAttr.setXYZ(
            i,
            bx * sx * zoneRadius,
            by * sy * zoneRadius,
            bz * sz * spineLen
          );
        }
        posAttr.needsUpdate = true;
        this.cellCapsuleMesh.geometry.computeVertexNormals();
      }

      if (this.nucleusMesh) {
        this.nucleusMesh.visible = true;
        this.nucleusMesh.position.set(0, 0, 0.05);
      }

      const halfZ = 1.37 * sz * spineLen;
      if (this.editorFrontArrowGroup) {
        this.editorFrontArrowGroup.position.set(0, 0, -halfZ - 0.35);
      }
      if (this.editorRearArrowGroup) {
        this.editorRearArrowGroup.position.set(0, 0, halfZ + 0.35);
      }
    } else {
      // 2. Creature Stage: Pre-Built ARK-Style Body Archetype + Local Per-Sphere Radius Scaling
      const morph = this.creatureMorphology;
      const layout = this.getArchetypeLayout(morph.archetype);

      const segIds: BodySegmentId[] = [
        'cabeza',
        'cuello',
        'pecho',
        'abdomen',
        'cola',
      ];
      for (let idx = 0; idx < segIds.length; idx++) {
        const segId = segIds[idx];
        const part = layout.parts[segId];
        const segCfg = this.bodySegments[idx];
        const segRadius = THREE.MathUtils.clamp(
          segCfg?.radius ?? 1.0,
          MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
          MORPHOLOGY_SCALE_LIMITS.bodySegment.max
        );
        const sGroup = this.segmentGroups[segId];
        const sMesh = this.segmentMeshes[segId];
        const hlMesh = this.segmentHighlightMeshes[segId];
        if (sGroup && sMesh && part) {
          sGroup.position.set(part.pos[0], part.pos[1], part.pos[2]);
          sGroup.rotation.set(
            part.pitch + (segCfg?.pitchAngle ?? 0),
            part.yaw + (segCfg?.yawAngle ?? 0),
            0
          );
          sGroup.scale.set(part.scale[0], part.scale[1], part.scale[2]);
          sMesh.scale.set(segRadius, segRadius, segRadius);
          if (hlMesh) {
            hlMesh.scale.setScalar(segRadius * 1.04);
          }
        }
      }

      // ARK-style non-uniform torso group scaling
      const sxTorso =
        morph.widthScale * (0.85 + morph.musculatureScale * 0.15);
      const syTorso = morph.heightScale;
      const szTorso = 0.9 + morph.musculatureScale * 0.2;
      this.creatureTorsoGroup.scale.set(sxTorso, syTorso, szTorso);
      this.creatureTorsoGroup.updateMatrixWorld(true);

      if (this.nucleusMesh) {
        this.nucleusMesh.visible = false;
      }

      if (this.editorFrontArrowGroup) {
        this.editorFrontArrowGroup.position.set(
          0,
          layout.sockets.head[1] * syTorso,
          (layout.sockets.head[2] - 0.85) * szTorso
        );
      }
      if (this.editorRearArrowGroup) {
        this.editorRearArrowGroup.position.set(
          0,
          layout.sockets.tail[1] * syTorso,
          (layout.sockets.tail[2] + 0.35) * szTorso
        );
      }
    }

    // Reposition all placed 3D organs to stay flush on the membrane or archetype body
    this.repositionAllPlacedOrgans(recomputeBaseClearance);
  }

  private updateSculptedMembraneGeometry(): void {
    this.updateSegmentedBodyGeometry(false);
  }

  /**
   * Computes the exact 3D attachment position, outward normal angle, and pitch:
   * - In `cell_stage`: attaches directly to the classic continuous CapsuleGeometry contour.
   * - In `creature_stage`: attaches to the ARK-style Pre-Built Archetype sockets (`socket_head`, `socket_forelimbs`, `socket_hindlimbs`, `socket_tail`) and scaled spheres.
   */
  public getMembraneAttachmentTransform(
    angle: number,
    adaptationId?: string,
    _vertebraIndex?: number,
    _axialT?: number,
    _surfaceAngle?: number,
    targetSegmentId?: BodySegmentId
  ): { x: number; y: number; z: number; normalAngle: number; spinePitch: number } {
    const normId = adaptationId ? normalizeAdaptationId(adaptationId) : '';

    // 1. Original Cellular Stage (`cell_stage`): Direct placement on the continuous CapsuleGeometry contour
    if (!this.isLandCreature) {
      const { sx, sz } = this.getBodyShapeFactors();
      const u = Math.cos(angle);
      const [rFront, rMid, rRear] = this.torsoRadii;
      const zoneRadius =
        u < 0
          ? THREE.MathUtils.lerp(rMid, rFront, -u)
          : THREE.MathUtils.lerp(rMid, rRear, u);
      const rx = 0.92 * sx * zoneRadius;
      const rz = 1.37 * sz * this.spineLength;
      const x = Math.sin(angle) * rx;
      const z = Math.cos(angle) * rz;
      const normalAngle = Math.atan2(
        Math.sin(angle) / Math.max(0.2, rx),
        Math.cos(angle) / Math.max(0.2, rz)
      );
      return { x, y: 0, z, normalAngle, spinePitch: 0 };
    }

    // 2. Terrestrial Creature Stage (`creature_stage`): Attach to ARK-style Archetype Sockets & Local Sphere Radii
    const morph = this.creatureMorphology;
    const layout = this.getArchetypeLayout(morph.archetype);
    const sxTorso = morph.widthScale * (0.85 + morph.musculatureScale * 0.15);
    const syTorso = morph.heightScale;
    const szTorso = 0.9 + morph.musculatureScale * 0.2;

    const isLeg = isLegAdaptation(normId);
    const isArm = isArmAdaptation(normId) || normId.startsWith('wings_');
    const headPart = layout.parts.cabeza;
    const cuelloPart = layout.parts.cuello;
    const pechoPart = layout.parts.pecho;
    const abdomenPart = layout.parts.abdomen;
    const colaPart = layout.parts.cola;

    const headR = THREE.MathUtils.clamp(
      this.getBodySegment('cabeza').radius,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.max
    );
    const cuelloR = THREE.MathUtils.clamp(
      this.getBodySegment('cuello').radius,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.max
    );
    const pechoR = THREE.MathUtils.clamp(
      this.getBodySegment('pecho').radius,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.max
    );
    const abdomenR = THREE.MathUtils.clamp(
      this.getBodySegment('abdomen').radius,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.max
    );
    const colaR = THREE.MathUtils.clamp(
      this.getBodySegment('cola').radius,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
      MORPHOLOGY_SCALE_LIMITS.bodySegment.max
    );

    // Socket 1: Head (Mouths, Eyes, Senses, Crests)
    if (
      normId.startsWith('mouth_') ||
      normId.startsWith('eye_') ||
      normId.startsWith('sense_') ||
      normId === 'vocal_crest' ||
      targetSegmentId === 'cabeza'
    ) {
      const hx = headPart.pos[0];
      const hy = headPart.pos[1];
      const hz = headPart.pos[2];
      const hrx = headPart.scale[0] * headR;
      const hry = headPart.scale[1] * headR;
      const hrz = headPart.scale[2] * headR;

      if (normId.startsWith('mouth_')) {
        return {
          x: (hx + Math.sin(angle) * hrx * 0.25) * sxTorso,
          y: (hy - hry * 0.12) * syTorso,
          z: (hz - hrz * 0.95) * szTorso,
          normalAngle: Math.atan2(Math.sin(angle), -Math.abs(Math.cos(angle))),
          spinePitch: headPart.pitch,
        };
      }
      if (normId.startsWith('eye_') || normId.startsWith('sense_')) {
        const side = Math.sin(angle) >= 0 ? 1 : -1;
        return {
          x: (hx + side * hrx * 0.74) * sxTorso,
          y: (hy + hry * 0.42) * syTorso,
          z: (hz - hrz * 0.68) * szTorso,
          normalAngle: Math.atan2(side * 0.74, 0.68),
          spinePitch: headPart.pitch + 0.1,
        };
      }
      return {
        x: (hx + Math.sin(angle) * hrx * 0.85) * sxTorso,
        y: (hy + hry * 0.35) * syTorso,
        z: (hz + Math.cos(angle) * hrz * 0.85) * szTorso,
        normalAngle: Math.atan2(Math.sin(angle), Math.cos(angle)),
        spinePitch: headPart.pitch,
      };
    }

    // Socket 2: Forelimbs (Arms & Wings, or Anterior Quadruped Legs)
    if (isArm || (isLeg && Math.cos(angle) < -0.15)) {
      const side = Math.sin(angle) >= 0 ? 1 : -1;
      const sock = layout.sockets.forelimbs;
      const axialSpread = isLeg ? 0 : Math.cos(angle) * 0.18;
      const chestWidthFactor = THREE.MathUtils.lerp(1.0, pechoR, 0.55);
      return {
        x: side * sock[0] * chestWidthFactor * sxTorso,
        y: sock[1] * syTorso,
        z: (sock[2] + axialSpread) * szTorso,
        normalAngle: side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5,
        spinePitch: 0,
      };
    }

    // Socket 3: Hindlimbs (Posterior / Primary Legs)
    if (isLeg) {
      const side = Math.sin(angle) >= 0 ? 1 : -1;
      const sock = layout.sockets.hindlimbs;
      const abdomenWidthFactor = THREE.MathUtils.lerp(1.0, abdomenR, 0.55);
      return {
        x: side * sock[0] * abdomenWidthFactor * sxTorso,
        y: sock[1] * syTorso,
        z: sock[2] * szTorso,
        normalAngle: side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5,
        spinePitch: 0,
      };
    }

    // Socket 4: Tail Tip (Tail Club, Caudal Spikes)
    if (
      normId.startsWith('tail_') ||
      normId === 'weapon_tail_club' ||
      (normId === 'chitin_spike' && Math.cos(angle) > 0.45) ||
      targetSegmentId === 'cola'
    ) {
      const sock = layout.sockets.tail;
      const tailExtendZ =
        colaPart.pos[2] + (sock[2] - colaPart.pos[2]) * colaR;
      return {
        x: (sock[0] + Math.sin(angle) * 0.18 * colaR) * sxTorso,
        y: sock[1] * syTorso,
        z: tailExtendZ * szTorso,
        normalAngle: Math.atan2(Math.sin(angle), Math.max(0.2, Math.cos(angle))),
        spinePitch: colaPart.pitch,
      };
    }

    // General Torso / Dorsal Attachment (Armor, Chloroplasts, Poison, Electric)
    const u = Math.cos(angle);
    const isDorsal =
      normId === 'membrane_armor' || normId === 'chloroplast_1';
    const basePart =
      targetSegmentId === 'cuello'
        ? cuelloPart
        : u < 0
        ? pechoPart
        : abdomenPart;
    const baseR =
      targetSegmentId === 'cuello' ? cuelloR : u < 0 ? pechoR : abdomenR;
    const lx =
      basePart.pos[0] +
      Math.sin(angle) * basePart.scale[0] * baseR * (isDorsal ? 0.38 : 0.92);
    const ly =
      basePart.pos[1] + (isDorsal ? basePart.scale[1] * baseR * 0.85 : 0.08);
    const lz =
      basePart.pos[2] + Math.cos(angle) * basePart.scale[2] * baseR * 0.85;
    return {
      x: lx * sxTorso,
      y: ly * syTorso,
      z: lz * szTorso,
      normalAngle: Math.atan2(Math.sin(angle), Math.cos(angle)),
      spinePitch: basePart.pitch,
    };
  }

  private repositionAllPlacedOrgans(recomputeBaseClearance = false): void {
    const armEntries: ActivePlacedOrganEntry[] = [];
    const legEntries: ActivePlacedOrganEntry[] = [];
    let handIdx = 0;
    let footIdx = 0;

    const coatBase = this.customPaintActive
      ? this.paintConfig.baseColor
      : undefined;
    const coatDetail = this.customPaintActive
      ? this.paintConfig.detailColor
      : undefined;

    // Pass 1: Position all body/limb organs, apply 3-node limb joint pose + ground IK, and collect placed arms & legs
    for (const entry of this.activePlacedOrgans) {
      const normId = normalizeAdaptationId(entry.instance.adaptationId);
      if (isArmAdaptation(normId)) {
        armEntries.push(entry);
      } else if (isLegAdaptation(normId)) {
        legEntries.push(entry);
      }

      if (isHandAdaptation(normId) || isFootAdaptation(normId)) {
        continue;
      }

      const { instance, primary, mirror } = entry;
      if (primary.group.parent !== this.placedOrgansGroup) {
        this.placedOrgansGroup.add(primary.group);
      }
      if (mirror && mirror.group.parent !== this.placedOrgansGroup) {
        this.placedOrgansGroup.add(mirror.group);
      }

      const yaw = instance.orientationYaw ?? instance.localYaw ?? 0;
      const pitch = instance.orientationPitch ?? instance.localPitch ?? 0;
      const morph = instance.morphology;
      const scaleOverall = THREE.MathUtils.clamp(
        morph?.scaleOverall ?? 1.0,
        MORPHOLOGY_SCALE_LIMITS.organScale.min,
        MORPHOLOGY_SCALE_LIMITS.organScale.max
      );
      const scaleWidth = THREE.MathUtils.clamp(
        morph?.scaleWidth ?? 1.0,
        MORPHOLOGY_SCALE_LIMITS.organScale.min,
        MORPHOLOGY_SCALE_LIMITS.organScale.max
      );
      const scaleHeight = THREE.MathUtils.clamp(
        morph?.scaleHeight ?? 1.0,
        MORPHOLOGY_SCALE_LIMITS.organScale.min,
        MORPHOLOGY_SCALE_LIMITS.organScale.max
      );
      const upperJoint = morph?.upperJointAngle ?? 0;
      const middleJoint = morph?.middleJointAngle ?? 0;
      const boneLen = morph?.boneLength ?? 1.0;

      const sx = scaleOverall * scaleWidth;
      const sy = scaleOverall * scaleWidth;
      const sz = scaleOverall * scaleHeight;

      const tPrimary = this.getMembraneAttachmentTransform(
        instance.angle,
        instance.adaptationId,
        instance.vertebraIndex,
        instance.axialT,
        instance.surfaceAngle,
        instance.targetSegmentId
      );

      // 2-Segment Ground IK for legs so feet plant cleanly on the solid podium (Y = 0) without clipping
      const activeTorsoY = this.isLandCreature
        ? Math.max(0.2, this.groundClearanceY + this.bodyGroundOffsetY)
        : 0.88;
      const groundClearance = Math.max(0.18, activeTorsoY + tPrimary.y);
      const effectiveReach = Math.max(0.45, 0.78 * boneLen * scaleOverall);
      const reachRatio = THREE.MathUtils.clamp(
        groundClearance / effectiveReach,
        0.35,
        1.35
      );
      // When recomputeBaseClearance is true, measure with neutral IK so groundClearanceY is 100% deterministic
      const ikHipCompensation =
        isLegAdaptation(normId) && !recomputeBaseClearance
          ? THREE.MathUtils.clamp((1.0 - reachRatio) * 0.55, -0.52, 0.58)
          : 0;
      const ikKneeCompensation =
        isLegAdaptation(normId) && !recomputeBaseClearance
          ? THREE.MathUtils.clamp((reachRatio - 1.0) * 0.62, -0.58, 0.58)
          : 0;

      primary.setLimbPose(
        upperJoint + ikHipCompensation,
        middleJoint + ikKneeCompensation,
        boneLen
      );
      if (recomputeBaseClearance) {
        primary.animate(0, 0, false);
      }
      primary.group.position.set(tPrimary.x, tPrimary.y, tPrimary.z);
      primary.group.rotation.order = 'YXZ';
      primary.group.rotation.set(
        pitch + tPrimary.spinePitch,
        tPrimary.normalAngle + yaw,
        0
      );
      primary.group.scale.set(sx, sy, sz);
      primary.group.updateMatrix();
      primary.setCoatColors(coatBase, coatDetail);
      primary.setColorOverride(morph?.colorOverride);

      if (mirror) {
        const mirrorAngle = -instance.angle;
        const mirrorSurfaceAngle =
          instance.surfaceAngle !== undefined
            ? Math.PI - instance.surfaceAngle
            : undefined;
        const tMirror = this.getMembraneAttachmentTransform(
          mirrorAngle,
          instance.adaptationId,
          instance.vertebraIndex,
          instance.axialT,
          mirrorSurfaceAngle,
          instance.targetSegmentId
        );
        mirror.setLimbPose(
          upperJoint + ikHipCompensation,
          middleJoint + ikKneeCompensation,
          boneLen
        );
        if (recomputeBaseClearance) {
          mirror.animate(0, 0, false);
        }
        mirror.group.position.set(tMirror.x, tMirror.y, tMirror.z);
        mirror.group.rotation.order = 'YXZ';
        mirror.group.rotation.set(
          pitch + tMirror.spinePitch,
          tMirror.normalAngle - yaw,
          0
        );
        mirror.group.scale.set(sx, sy, sz);
        mirror.group.updateMatrix();
        mirror.setCoatColors(coatBase, coatDetail);
        mirror.setColorOverride(morph?.colorOverride);
      }
    }

    // Pass 2: Hierarchically parent Hands (hand_*) into the Wrist Group (distalSocketGroup) of Arms (arm_*)
    // and Feet (foot_*) into the Ankle Group (distalSocketGroup) of Legs (leg_*) so they inherit 100% of gait motion!
    for (const entry of this.activePlacedOrgans) {
      const normId = normalizeAdaptationId(entry.instance.adaptationId);
      const isHand = isHandAdaptation(normId);
      const isFoot = isFootAdaptation(normId);
      if (!isHand && !isFoot) continue;

      const { instance, primary, mirror } = entry;
      const yaw = instance.orientationYaw ?? instance.localYaw ?? 0;
      const pitch = instance.orientationPitch ?? instance.localPitch ?? 0;
      const morph = instance.morphology;
      const scaleOverall = THREE.MathUtils.clamp(
        morph?.scaleOverall ?? 1.0,
        MORPHOLOGY_SCALE_LIMITS.organScale.min,
        MORPHOLOGY_SCALE_LIMITS.organScale.max
      );
      const scaleWidth = THREE.MathUtils.clamp(
        morph?.scaleWidth ?? 1.0,
        MORPHOLOGY_SCALE_LIMITS.organScale.min,
        MORPHOLOGY_SCALE_LIMITS.organScale.max
      );
      const scaleHeight = THREE.MathUtils.clamp(
        morph?.scaleHeight ?? 1.0,
        MORPHOLOGY_SCALE_LIMITS.organScale.min,
        MORPHOLOGY_SCALE_LIMITS.organScale.max
      );
      const sx = scaleOverall * scaleWidth;
      const sy = scaleOverall * scaleWidth;
      const sz = scaleOverall * scaleHeight;

      const parentPool = isHand ? armEntries : legEntries;
      const pairIdx = isHand ? handIdx++ : footIdx++;
      let parentLimb: ActivePlacedOrganEntry | null = null;
      if (parentPool.length > 0) {
        let bestDist = Infinity;
        for (const candidate of parentPool) {
          const dist = Math.abs(
            Math.cos(candidate.instance.angle) - Math.cos(instance.angle)
          );
          if (dist < bestDist - 0.08) {
            bestDist = dist;
            parentLimb = candidate;
          }
        }
        if (!parentLimb) {
          parentLimb = parentPool[pairIdx % parentPool.length];
        }
      }

      if (parentLimb && parentLimb.primary.distalSocketGroup) {
        const ankleOrWristPrimary = parentLimb.primary.distalSocketGroup;
        if (primary.group.parent !== ankleOrWristPrimary) {
          ankleOrWristPrimary.add(primary.group);
        }
        if (recomputeBaseClearance) {
          primary.animate(0, 0, false);
        }
        const pScale = parentLimb.primary.group.scale;
        primary.group.position.set(0, 0, 0);
        primary.group.rotation.order = 'YXZ';
        primary.group.rotation.set(pitch, yaw, 0);
        primary.group.scale.set(
          sx / Math.max(0.25, pScale.x),
          sy / Math.max(0.25, pScale.y),
          sz / Math.max(0.25, pScale.z)
        );
        primary.setCoatColors(coatBase, coatDetail);
        primary.setColorOverride(morph?.colorOverride);

        if (mirror) {
          if (recomputeBaseClearance) {
            mirror.animate(0, 0, false);
          }
          if (parentLimb.mirror && parentLimb.mirror.distalSocketGroup) {
            const ankleOrWristMirror = parentLimb.mirror.distalSocketGroup;
            if (mirror.group.parent !== ankleOrWristMirror) {
              ankleOrWristMirror.add(mirror.group);
            }
            const mScale = parentLimb.mirror.group.scale;
            mirror.group.position.set(0, 0, 0);
            mirror.group.rotation.order = 'YXZ';
            mirror.group.rotation.set(pitch, -yaw, 0);
            mirror.group.scale.set(
              sx / Math.max(0.25, mScale.x),
              sy / Math.max(0.25, mScale.y),
              sz / Math.max(0.25, mScale.z)
            );
          } else {
            if (mirror.group.parent !== this.placedOrgansGroup) {
              this.placedOrgansGroup.add(mirror.group);
            }
            const mirrorAngle = -instance.angle;
            const mirrorSurfaceAngle =
              instance.surfaceAngle !== undefined
                ? Math.PI - instance.surfaceAngle
                : undefined;
            const tMirror = this.getMembraneAttachmentTransform(
              mirrorAngle,
              instance.adaptationId,
              instance.vertebraIndex,
              instance.axialT,
              mirrorSurfaceAngle,
              instance.targetSegmentId
            );
            mirror.group.position.set(tMirror.x, tMirror.y, tMirror.z);
            mirror.group.rotation.order = 'YXZ';
            mirror.group.rotation.set(
              pitch + tMirror.spinePitch,
              tMirror.normalAngle - yaw,
              0
            );
            mirror.group.scale.set(sx, sy, sz);
          }
          mirror.setCoatColors(coatBase, coatDetail);
          mirror.setColorOverride(morph?.colorOverride);
        }
      } else {
        // Fallback when no arm/leg is installed yet
        if (primary.group.parent !== this.placedOrgansGroup) {
          this.placedOrgansGroup.add(primary.group);
        }
        const tPrimary = this.getMembraneAttachmentTransform(
          instance.angle,
          instance.adaptationId,
          instance.vertebraIndex,
          instance.axialT,
          instance.surfaceAngle,
          instance.targetSegmentId
        );
        primary.group.position.set(tPrimary.x, tPrimary.y, tPrimary.z);
        primary.group.rotation.order = 'YXZ';
        primary.group.rotation.set(
          pitch + tPrimary.spinePitch,
          tPrimary.normalAngle + yaw,
          0
        );
        primary.group.scale.set(sx, sy, sz);
        primary.setCoatColors(coatBase, coatDetail);
        primary.setColorOverride(morph?.colorOverride);

        if (mirror) {
          if (mirror.group.parent !== this.placedOrgansGroup) {
            this.placedOrgansGroup.add(mirror.group);
          }
          const mirrorAngle = -instance.angle;
          const mirrorSurfaceAngle =
            instance.surfaceAngle !== undefined
              ? Math.PI - instance.surfaceAngle
              : undefined;
          const tMirror = this.getMembraneAttachmentTransform(
            mirrorAngle,
            instance.adaptationId,
            instance.vertebraIndex,
            instance.axialT,
            mirrorSurfaceAngle,
            instance.targetSegmentId
          );
          mirror.group.position.set(tMirror.x, tMirror.y, tMirror.z);
          mirror.group.rotation.order = 'YXZ';
          mirror.group.rotation.set(
            pitch + tMirror.spinePitch,
            tMirror.normalAngle - yaw,
            0
          );
          mirror.group.scale.set(sx, sy, sz);
          mirror.setCoatColors(coatBase, coatDetail);
          mirror.setColorOverride(morph?.colorOverride);
        }
      }
    }

    this.hasCustomLegsInstalled = legEntries.length > 0;
    if (this.evoAmphibianLegsGroup) {
      this.evoAmphibianLegsGroup.visible = false;
    }

    // Ground Clearance IK: Ensure creature torso elevates so lowest foot sole or ventral belly rests flush at Y=0
    if (this.isLandCreature) {
      if (recomputeBaseClearance) {
        this.bodySegmentsGroup.position.y = 0;
        this.placedOrgansGroup.position.y = 0;
        this.bodySegmentsGroup.updateMatrixWorld(true);
        this.placedOrgansGroup.updateMatrixWorld(true);

        let lowestReach = 0;
        let hasLimbs = false;

        for (const entry of this.activePlacedOrgans) {
          const normId = normalizeAdaptationId(entry.instance.adaptationId);
          if (isLegAdaptation(normId) || isFootAdaptation(normId)) {
            hasLimbs = true;
            if (entry.primary.getLowestFootWorldY) {
              const pLow = entry.primary.getLowestFootWorldY() - this.position.y;
              if (pLow < lowestReach) lowestReach = pLow;
            }
            if (entry.mirror?.getLowestFootWorldY) {
              const mLow = entry.mirror.getLowestFootWorldY() - this.position.y;
              if (mLow < lowestReach) lowestReach = mLow;
            }
          }
        }

        if (hasLimbs && lowestReach < -0.01) {
          // Legs extend downward: automatically elevate torso so feet rest flat and flush at ground level (Y = 0)
          this.groundClearanceY = Math.abs(lowestReach);
        } else if (!hasLimbs) {
          // Legless crawler / slug mode: rest ventral belly flush at Y = 0 with a minimal contact margin (~0.05m)
          this.creatureTorsoGroup.updateMatrixWorld(true);
          const torsoBox = new THREE.Box3().setFromObject(this.creatureTorsoGroup);
          const bellyBottom = torsoBox.min.y - this.position.y;
          if (bellyBottom < 0) {
            this.groundClearanceY = Math.abs(bellyBottom) + 0.05;
          } else {
            this.groundClearanceY = 0.05;
          }
        } else {
          this.groundClearanceY = 0;
        }
      }
    } else {
      this.groundClearanceY = 0;
      this.bodyGroundOffsetY = 0;
    }

    const effectiveY = this.getEffectiveGroundY();
    this.bodySegmentsGroup.position.y = effectiveY;
    this.placedOrgansGroup.position.y = effectiveY;
    this.bodySegmentsGroup.updateMatrixWorld(true);
    this.placedOrgansGroup.updateMatrixWorld(true);

    this.updateOrientationGizmoTransform();
  }

  private updateOrientationGizmoTransform(): void {
    if (!this.editorOrientationGizmoGroup) return;
    if (!this.isEditingMode || !this.selectedInstanceId) {
      this.editorOrientationGizmoGroup.visible = false;
      return;
    }

    const selectedEntry = this.activePlacedOrgans.find(
      (e) => e.instance.instanceId === this.selectedInstanceId
    );
    if (!selectedEntry) {
      this.editorOrientationGizmoGroup.visible = false;
      return;
    }

    const morph = selectedEntry.instance.morphology;
    const zReach = THREE.MathUtils.clamp(
      (morph?.scaleOverall ?? 1.0) * (morph?.scaleHeight ?? 1.0),
      0.65,
      2.6
    );

    const worldPos = new THREE.Vector3();
    selectedEntry.primary.group.getWorldPosition(worldPos);
    this.group.worldToLocal(worldPos);

    this.editorOrientationGizmoGroup.visible = true;
    this.editorOrientationGizmoGroup.position.copy(worldPos);
    this.editorOrientationGizmoGroup.rotation.copy(
      selectedEntry.primary.group.rotation
    );
    this.editorOrientationGizmoGroup.scale.set(1, 1, zReach);
  }

  private tagObjectTreeWithInstanceId(obj: THREE.Object3D, instanceId: string): void {
    obj.userData.placedInstanceId = instanceId;
    for (const child of obj.children) {
      this.tagObjectTreeWithInstanceId(child, instanceId);
    }
  }

  /**
   * Synchronizes the 3D organs mounted on the cell membrane from the player's placedOrgans array.
   */
  public syncPlacedOrgans(
    placedOrgans: readonly PlacedOrganInstance[],
    selectedInstanceId: string | null = null,
    recomputeBaseClearance = true
  ): void {
    this.selectedInstanceId = selectedInstanceId;

    const needsRebuild =
      placedOrgans.length !== this.activePlacedOrgans.length ||
      placedOrgans.some((item, idx) => {
        const cur = this.activePlacedOrgans[idx]?.instance;
        return (
          !cur ||
          cur.instanceId !== item.instanceId ||
          cur.adaptationId !== item.adaptationId ||
          cur.mirrorSymmetry !== item.mirrorSymmetry
        );
      });

    if (needsRebuild) {
      for (const entry of this.activePlacedOrgans) {
        entry.primary.group.removeFromParent();
        entry.primary.dispose();
        if (entry.mirror) {
          entry.mirror.group.removeFromParent();
          entry.mirror.dispose();
        }
      }
      this.activePlacedOrgans.length = 0;

      for (const inst of placedOrgans) {
        let vIdx = inst.vertebraIndex;
        let axT = inst.axialT;
        let sAngle = inst.surfaceAngle;
        if (vIdx === undefined || axT === undefined || sAngle === undefined) {
          const t = this.getMembraneAttachmentTransform(inst.angle, inst.adaptationId);
          const anchor = this.creatureSpine.computeAnchorFromLocalPoint(
            new THREE.Vector3(t.x, t.y, t.z)
          );
          vIdx = anchor.vertebraIndex;
          axT = anchor.axialT;
          sAngle = anchor.surfaceAngle;
          inst.vertebraIndex = vIdx;
          inst.axialT = axT;
          inst.surfaceAngle = sAngle;
        }

        const primary = createOrganVisual(inst.adaptationId);
        this.tagObjectTreeWithInstanceId(primary.group, inst.instanceId);
        this.placedOrgansGroup.add(primary.group);

        let mirror: OrganVisualInstance | null = null;
        if (inst.mirrorSymmetry && Math.abs(Math.sin(inst.angle)) > 0.16) {
          mirror = createOrganVisual(inst.adaptationId);
          this.tagObjectTreeWithInstanceId(mirror.group, inst.instanceId);
          this.placedOrgansGroup.add(mirror.group);
        }

        this.activePlacedOrgans.push({
          instance: {
            ...inst,
            vertebraIndex: vIdx,
            axialT: axT,
            surfaceAngle: sAngle,
            morphology: { ...(inst.morphology ?? { scaleOverall: 1, scaleWidth: 1, scaleHeight: 1 }) },
          },
          primary,
          mirror,
        });
      }
    } else {
      for (let i = 0; i < placedOrgans.length; i++) {
        let vIdx = placedOrgans[i].vertebraIndex;
        let axT = placedOrgans[i].axialT;
        let sAngle = placedOrgans[i].surfaceAngle;
        if (vIdx === undefined || axT === undefined || sAngle === undefined) {
          const t = this.getMembraneAttachmentTransform(placedOrgans[i].angle, placedOrgans[i].adaptationId);
          const anchor = this.creatureSpine.computeAnchorFromLocalPoint(
            new THREE.Vector3(t.x, t.y, t.z)
          );
          vIdx = anchor.vertebraIndex;
          axT = anchor.axialT;
          sAngle = anchor.surfaceAngle;
          placedOrgans[i].vertebraIndex = vIdx;
          placedOrgans[i].axialT = axT;
          placedOrgans[i].surfaceAngle = sAngle;
        }

        this.activePlacedOrgans[i].instance = {
          ...placedOrgans[i],
          vertebraIndex: vIdx,
          axialT: axT,
          surfaceAngle: sAngle,
          morphology: {
            ...(placedOrgans[i].morphology ?? {
              scaleOverall: 1,
              scaleWidth: 1,
              scaleHeight: 1,
            }),
          },
        };
      }
    }

    this.currentPlacedData = placedOrgans.map((p) => ({
      ...p,
      morphology: {
        ...(p.morphology ?? {
          scaleOverall: 1,
          scaleWidth: 1,
          scaleHeight: 1,
        }),
      },
    }));
    this.repositionAllPlacedOrgans(recomputeBaseClearance);
    this.refreshOrganSelectionHighlights();
  }

  /**
   * Updates the 3D Ghost Preview organ & magnetic snapping ring shown while dragging a piece over the cell in the Editor.
   */
  public setDragPreview(
    adaptationId: string | null,
    angle: number,
    mirrorSymmetry: boolean,
    isValid: boolean
  ): void {
    if (!adaptationId) {
      this.dragPreviewGroup.visible = false;
      this.dragPreviewInitialized = false;
      return;
    }

    const normId = normalizeAdaptationId(adaptationId);
    if (this.dragPreviewId !== normId) {
      if (this.dragPreviewPrimary) {
        this.dragPreviewGroup.remove(this.dragPreviewPrimary.group);
        this.dragPreviewPrimary.dispose();
        this.dragPreviewPrimary = null;
      }
      if (this.dragPreviewMirror) {
        this.dragPreviewGroup.remove(this.dragPreviewMirror.group);
        this.dragPreviewMirror.dispose();
        this.dragPreviewMirror = null;
      }
      this.dragPreviewId = normId;
      this.dragPreviewPrimary = createOrganVisual(normId);
      this.dragPreviewMirror = createOrganVisual(normId);
      this.dragPreviewGroup.add(this.dragPreviewPrimary.group);
      this.dragPreviewGroup.add(this.dragPreviewMirror.group);
      this.dragPreviewInitialized = false;
    }

    this.dragTargetAngle = angle;
    if (!this.dragPreviewInitialized || !this.dragPreviewGroup.visible) {
      this.dragSmoothedAngle = angle;
      this.dragPreviewInitialized = true;
    } else {
      // Shortest-angle interpolation for immediate responsive feedback without angular jumps
      let deltaAngle = this.dragTargetAngle - this.dragSmoothedAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.dragSmoothedAngle += deltaAngle * 0.48;
    }

    this.dragPreviewMirrorSymmetry = mirrorSymmetry;
    this.dragPreviewIsValid = isValid;
    this.dragPreviewGroup.visible = true;
    this.applyDragPreviewTransforms(this.dragSmoothedAngle);
  }

  private applyDragPreviewTransforms(angle: number): void {
    if (!this.dragPreviewId) return;
    const mode = this.dragPreviewIsValid ? 'preview_valid' : 'preview_invalid';
    this.dragSnapRingMat.color.setHex(
      this.dragPreviewIsValid ? 0x34d399 : 0xf43f5e
    );
    this.dragSnapHaloMat.color.setHex(
      this.dragPreviewIsValid ? 0x22d3ee : 0xf43f5e
    );

    if (this.dragPreviewPrimary) {
      const t = this.getMembraneAttachmentTransform(angle, this.dragPreviewId);
      this.dragPreviewPrimary.group.position.set(t.x, t.y, t.z);
      this.dragPreviewPrimary.group.rotation.y = t.normalAngle;
      this.dragPreviewPrimary.setHighlight(mode);

      this.dragSnapRingPrimary.visible = true;
      this.dragSnapRingPrimary.position.set(t.x, t.y + 0.02, t.z);
      this.dragSnapRingPrimary.rotation.set(0, t.normalAngle, 0);
    }

    if (this.dragPreviewMirror) {
      const showMirror =
        this.dragPreviewMirrorSymmetry && Math.abs(Math.sin(angle)) > 0.16;
      this.dragPreviewMirror.group.visible = showMirror;
      this.dragSnapRingMirror.visible = showMirror;
      if (showMirror) {
        const tm = this.getMembraneAttachmentTransform(
          -angle,
          this.dragPreviewId
        );
        this.dragPreviewMirror.group.position.set(tm.x, tm.y, tm.z);
        this.dragPreviewMirror.group.rotation.y = tm.normalAngle;
        this.dragPreviewMirror.setHighlight(mode);

        this.dragSnapRingMirror.position.set(tm.x, tm.y + 0.02, tm.z);
        this.dragSnapRingMirror.rotation.set(0, tm.normalAngle, 0);
      }
    }
  }

  /**
   * Projects a 3D world-space raycast point onto the cell's local horizontal contour.
   */
  public projectWorldPointToMembrane(worldPoint: THREE.Vector3): {
    angle: number;
    axialOffset: number;
    mirrorSymmetry: boolean;
    normalizedRadiusDistance: number;
    vertebraIndex: number;
    axialT: number;
    surfaceAngle: number;
    targetSegmentId: BodySegmentId;
  } {
    _localPoint.copy(worldPoint);
    this.group.worldToLocal(_localPoint);

    const { sx, sz } = this.getBodyShapeFactors();
    const halfLengthZ = Math.max(0.4, 1.38 * this.spineLength * sz);
    const angle = Math.atan2(_localPoint.x, _localPoint.z);
    const axialOffset = THREE.MathUtils.clamp(_localPoint.z / halfLengthZ, -1, 1);

    const rMult = this.getInterpolatedTorsoRadius(Math.cos(angle));
    const radiusX = Math.max(0.4, 0.94 * rMult * sx);

    const normX = _localPoint.x / radiusX;
    const normZ = _localPoint.z / halfLengthZ;
    const normalizedRadiusDistance = Math.hypot(normX, normZ);

    // Enable bilateral symmetry automatically unless placed near the central sagittal axis (|sin(angle)| <= 0.22)
    const mirrorSymmetry = Math.abs(Math.sin(angle)) > 0.22;

    const anchor = this.creatureSpine.computeAnchorFromLocalPoint(_localPoint);

    // Find nearest segment by distance to each segment group's center in local space
    let bestSegId: BodySegmentId = 'pecho';
    let bestDist = Infinity;
    const tempCenter = new THREE.Vector3();
    const allSegIds: BodySegmentId[] = ['cabeza', 'cuello', 'pecho', 'abdomen', 'cola'];
    for (const segId of allSegIds) {
      const sGroup = this.segmentGroups[segId];
      if (sGroup) {
        tempCenter.set(0, 0, 0);
        sGroup.localToWorld(tempCenter);
        this.group.worldToLocal(tempCenter);
        const d = _localPoint.distanceTo(tempCenter);
        if (d < bestDist) {
          bestDist = d;
          bestSegId = segId;
        }
      }
    }

    return {
      angle,
      axialOffset,
      mirrorSymmetry,
      normalizedRadiusDistance,
      vertebraIndex: anchor.vertebraIndex,
      axialT: anchor.axialT,
      surfaceAngle: anchor.surfaceAngle,
      targetSegmentId: bestSegId,
    };
  }

  /**
   * Handles pulling or pushing traction handles (cones) at the head or tail:
   * Pulling outward beyond 0.8m adds a new vertebra (up to 12).
   * Pushing inward below 0.4m fuses/deletes terminal vertebra (down to 4).
   */
  public handleSpineTractionDrag(
    end: 'head' | 'tail',
    localZ: number
  ): { changed: boolean; added: boolean; removed: boolean } {
    const res = this.creatureSpine.handleTractionDrag(end, localZ);
    if (res.changed) {
      this.spineNodes = this.creatureSpine.toSpineVertebraNodes();
      this.spineLength = THREE.MathUtils.clamp(
        (this.spineNodes[this.spineNodes.length - 1].z - this.spineNodes[0].z) * 0.58,
        0.75,
        1.75
      );
      this.updateSculptedMembraneGeometry();
    }
    return res;
  }

  public getCreatureSpine(): CreatureSpineSystem {
    return this.creatureSpine;
  }

  public getNearestSpineSegmentIndex(worldPoint: THREE.Vector3): 0 | 1 | 2 {
    _localPoint.copy(worldPoint);
    this.group.worldToLocal(_localPoint);
    const { sz } = this.getBodyShapeFactors();
    const halfLengthZ = Math.max(0.4, 1.38 * this.spineLength * sz);
    const u = _localPoint.z / halfLengthZ;
    if (u < -0.33) return 0; // Front
    if (u > 0.33) return 2; // Rear
    return 1; // Middle
  }

  public setHoveredSpineControl(
    handle: 'arrow_front' | 'arrow_rear' | null,
    vertebraIdx: number | null
  ): void {
    this.editorArrowFrontMat.color.setHex(
      handle === 'arrow_front' ? 0xfacc15 : 0x22d3ee
    );
    this.editorArrowRearMat.color.setHex(
      handle === 'arrow_rear' ? 0xfacc15 : 0x22d3ee
    );
    this.hoveredVertebraIndex = vertebraIdx;
    this.refreshVertebraMaterials();
  }

  private refreshVertebraMaterials(): void {
    const palette = COLOR_THEMES[this.colorTheme] ?? COLOR_THEMES.cyan;
    for (let v = 0; v < this.spineVertebraeMats.length; v++) {
      const vMat = this.spineVertebraeMats[v];
      const isHovered = this.isEditingMode && this.hoveredVertebraIndex === v;
      if (isHovered) {
        vMat.color.setHex(0xfef08a);
        vMat.emissive.setHex(0xfacc15);
        vMat.emissiveIntensity = 1.9;
      } else {
        vMat.color.setHex(palette.nucleusColor);
        vMat.emissive.setHex(palette.nucleusEmissive);
        vMat.emissiveIntensity = 0.95;
      }
    }
  }

  public setOrientationGizmoHovered(isActiveOrHovered: boolean): void {
    this.isOrientationGizmoActive = isActiveOrHovered;
    if (!this.editorOrientationSphereMat || !this.editorOrientationRingMat) return;
    if (isActiveOrHovered) {
      this.editorOrientationSphereMat.color.setHex(0xfef08a);
      this.editorOrientationSphereMat.opacity = 0.96;
      this.editorOrientationRingMat.color.setHex(0xfacc15);
      this.editorOrientationRingMat.opacity = 0.95;
      this.editorOrientationStemMat.color.setHex(0xfacc15);
      this.editorOrientationStemMat.opacity = 0.85;
    } else {
      this.editorOrientationSphereMat.color.setHex(0x67e8f9);
      this.editorOrientationSphereMat.opacity = 0.82;
      this.editorOrientationRingMat.color.setHex(0xfef08a);
      this.editorOrientationRingMat.opacity = 0.75;
      this.editorOrientationStemMat.color.setHex(0x67e8f9);
      this.editorOrientationStemMat.opacity = 0.55;
    }
  }

  /**
   * Computes the localYaw offset in radians when dragging the Spore Orientation Gizmo sphere in 3D space.
   */
  public computeOrganLocalYawFromWorldPoint(
    instance: PlacedOrganInstance,
    worldPoint: THREE.Vector3
  ): number {
    _localPoint.copy(worldPoint);
    this.group.worldToLocal(_localPoint);

    const tPrimary = this.getMembraneAttachmentTransform(
      instance.angle,
      instance.adaptationId
    );
    const dx = _localPoint.x - tPrimary.x;
    const dz = _localPoint.z - tPrimary.z;
    if (Math.hypot(dx, dz) < 0.05) {
      return instance.localYaw ?? 0;
    }

    const targetWorldAngle = Math.atan2(dx, dz);
    const rawDeltaYaw = targetWorldAngle - tPrimary.normalAngle;
    return Math.atan2(Math.sin(rawDeltaYaw), Math.cos(rawDeltaYaw));
  }

  public setEditorMode(isEditing: boolean): void {
    this.isEditingMode = isEditing;
    this.editorLabDishGroup.visible = isEditing;
    this.editorSpineOverlayGroup.visible = isEditing && !this.isLandCreature;
    if (this.spineBackboneLine) {
      this.spineBackboneLine.visible = false;
    }
    if (!isEditing) {
      this.hoveredVertebraIndex = null;
      this.dragPreviewGroup.visible = false;
      this.editorOrientationGizmoGroup.visible = false;
      this.refreshOrganSelectionHighlights();
      this.setHoveredBodySegment(null);
    } else {
      this.refreshOrganSelectionHighlights();
      this.setHoveredBodySegment(this.hoveredSegmentId);
      this.updateOrientationGizmoTransform();
    }
    this.refreshVertebraMaterials();
  }

  public getEditorArrowObjects(): THREE.Object3D[] {
    return [this.editorFrontArrowGroup, this.editorRearArrowGroup];
  }

  public getVertebraObjects(): THREE.Object3D[] {
    return this.spineVertebraeHitMeshes.slice(0, this.spineNodes.length);
  }

  public getSelectedLimbJointGizmoObjects(): THREE.Object3D[] {
    if (!this.isEditingMode || !this.selectedInstanceId) return [];
    const entry = this.activePlacedOrgans.find(
      (e) => e.instance.instanceId === this.selectedInstanceId
    );
    if (!entry) return [];
    return [
      ...entry.primary.getJointGizmoObjects(),
      ...(entry.mirror ? entry.mirror.getJointGizmoObjects() : []),
    ];
  }

  public getOrientationGizmoObject(): THREE.Object3D | null {
    return this.editorOrientationGizmoGroup &&
      this.editorOrientationGizmoGroup.visible
      ? this.editorOrientationGizmoGroup
      : null;
  }

  public getPlacedOrganRootObjects(): THREE.Object3D[] {
    return this.placedOrgansGroup.children;
  }

  public hasFrontSpikes(): boolean {
    for (const entry of this.activePlacedOrgans) {
      if (
        normalizeAdaptationId(entry.instance.adaptationId) === 'chitin_spike'
      ) {
        const effectiveAngle =
          entry.instance.angle + (entry.instance.localYaw ?? 0);
        if (
          Math.cos(entry.instance.angle) <= 0.15 ||
          Math.cos(effectiveAngle) <= 0.15
        ) {
          return true;
        }
      }
    }
    return false;
  }

  public hasRearOrFlankSpikes(): boolean {
    for (const entry of this.activePlacedOrgans) {
      if (
        normalizeAdaptationId(entry.instance.adaptationId) === 'chitin_spike' &&
        (Math.cos(entry.instance.angle) > -0.35 || entry.instance.mirrorSymmetry)
      ) {
        return true;
      }
    }
    return false;
  }

  private initCombatEffectsPool(scene: THREE.Scene): void {
    // 1. Pre-allocate 12 Poison Cloud spheres in world space
    const cloudGeo = new THREE.IcosahedronGeometry(1.0, 2);
    this.disposableGeometries.push(cloudGeo);

    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x84cc16,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      this.disposableMaterials.push(mat);

      const mesh = new THREE.Mesh(cloudGeo, mat);
      mesh.visible = false;
      scene.add(mesh);

      this.poisonCloudPool.push({
        position: mesh.position,
        radius: 2.3,
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 4.0,
      });
    }

    // 1B. Pre-allocate 6 Acid Spit Projectiles in world space
    const acidCoreGeo = new THREE.SphereGeometry(0.34, 12, 12);
    const acidHaloGeo = new THREE.SphereGeometry(0.56, 12, 12);
    const acidCoreMat = new THREE.MeshStandardMaterial({
      color: 0xd9f99d,
      emissive: 0x84cc16,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
    const acidHaloMat = new THREE.MeshBasicMaterial({
      color: 0xa3e635,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.disposableGeometries.push(acidCoreGeo, acidHaloGeo);
    this.disposableMaterials.push(acidCoreMat, acidHaloMat);

    for (let i = 0; i < 6; i++) {
      const projGroup = new THREE.Group();
      projGroup.visible = false;
      const coreMesh = new THREE.Mesh(acidCoreGeo, acidCoreMat);
      const haloMesh = new THREE.Mesh(acidHaloGeo, acidHaloMat);
      projGroup.add(coreMesh);
      projGroup.add(haloMesh);
      scene.add(projGroup);

      this.acidProjectilePool.push({
        position: projGroup.position,
        velocity: new THREE.Vector3(),
        radius: 0.85,
        active: false,
        mesh: projGroup,
        life: 0,
      });
    }

    // 2. Pre-allocate Bioelectric Shockwave Ring & Dome (9.5m max radius)
    const waveRingGeo = new THREE.RingGeometry(0.75, 1.0, 48);
    waveRingGeo.rotateX(-Math.PI / 2);
    this.electricWaveMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.electricWaveMesh = new THREE.Mesh(waveRingGeo, this.electricWaveMat);
    this.electricWaveMesh.visible = false;
    scene.add(this.electricWaveMesh);

    const domeGeo = new THREE.SphereGeometry(1.0, 24, 16);
    domeGeo.scale(1, 0.35, 1);
    this.electricDomeMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      wireframe: true,
      depthWrite: false,
    });
    this.electricDomeMesh = new THREE.Mesh(domeGeo, this.electricDomeMat);
    this.electricDomeMesh.visible = false;
    scene.add(this.electricDomeMesh);

    // 2B. Pre-allocate Socialize Harmonic Ring (KeyC in Creature Stage)
    this.socialWaveMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.socialWaveMesh = new THREE.Mesh(waveRingGeo, this.socialWaveMat);
    this.socialWaveMesh.visible = false;
    scene.add(this.socialWaveMesh);

    // 3. Pre-allocate Mating Call Acoustic Rings (Pink & Cyan harmonic waves)
    for (let r = 0; r < 2; r++) {
      const mat = new THREE.MeshBasicMaterial({
        color: r === 0 ? 0xf472b6 : 0x22d3ee,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(waveRingGeo, mat);
      ringMesh.visible = false;
      scene.add(ringMesh);
      this.matingRingMeshes.push(ringMesh);
      this.matingRingMats.push(mat);
      this.disposableMaterials.push(mat);
    }

    // 4. Pre-allocate 3D Partner Cell ("Pareja Celular") for courtship ritual
    this.mateCellGroup = new THREE.Group();
    this.mateCellGroup.visible = false;

    const mateBodyGeo = new THREE.CapsuleGeometry(0.88, 0.82, 14, 20);
    mateBodyGeo.rotateX(Math.PI / 2);
    const mateBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.4,
      roughness: 0.18,
      metalness: 0.05,
      transmission: 0.6,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    const mateBodyMesh = new THREE.Mesh(mateBodyGeo, mateBodyMat);
    this.mateCellGroup.add(mateBodyMesh);

    const mateCoreGeo = new THREE.IcosahedronGeometry(0.46, 1);
    const mateCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfbcfe8,
      emissive: 0xec4899,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    });
    const mateCoreMesh = new THREE.Mesh(mateCoreGeo, mateCoreMat);
    this.mateCellGroup.add(mateCoreMesh);

    const mateEyeGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const mateEyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      roughness: 0.1,
    });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(mateEyeGeo, mateEyeMat);
      eye.position.set(side * 0.4, 0.32, -1.0);
      this.mateCellGroup.add(eye);
    }

    const mateTailGeo = new THREE.SphereGeometry(0.2, 10, 10);
    mateTailGeo.scale(0.8, 0.8, 1.5);
    for (let t = 0; t < 3; t++) {
      const seg = new THREE.Mesh(mateTailGeo, mateCoreMat);
      seg.scale.setScalar(1 - t * 0.22);
      seg.position.set(0, 0, 1.35 + t * 0.42);
      this.mateCellGroup.add(seg);
      this.mateTailSegments.push(seg);
    }

    scene.add(this.mateCellGroup);

    // 5. Pre-allocate 3D Holographic Chemoreceptor Compass Vector in World Space
    this.chemoreceptorCompassGroup = new THREE.Group();
    this.chemoreceptorCompassGroup.visible = false;
    const compassArrowGeo = new THREE.ConeGeometry(0.28, 0.75, 8);
    compassArrowGeo.rotateX(-Math.PI / 2);
    this.chemoreceptorArrowMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const compassArrowMesh = new THREE.Mesh(
      compassArrowGeo,
      this.chemoreceptorArrowMat
    );
    compassArrowMesh.position.set(0, 0.15, -2.55);
    this.chemoreceptorCompassGroup.add(compassArrowMesh);
    scene.add(this.chemoreceptorCompassGroup);

    this.disposableGeometries.push(
      waveRingGeo,
      domeGeo,
      mateBodyGeo,
      mateCoreGeo,
      mateEyeGeo,
      mateTailGeo,
      compassArrowGeo
    );
    this.disposableMaterials.push(
      this.electricWaveMat,
      this.electricDomeMat,
      this.socialWaveMat,
      mateBodyMat,
      mateCoreMat,
      mateEyeMat,
      this.chemoreceptorArrowMat
    );
  }

  public setSpineNodes(nodes: SpineVertebraNode[]): void {
    if (nodes && nodes.length >= 3) {
      this.spineNodes = nodes.slice(0, 12).map((n) => ({ ...n }));
      this.updateSculptedMembraneGeometry();
      this.repositionAllPlacedOrgans();
    }
  }

  public getSpineNodes(): SpineVertebraNode[] {
    return this.spineNodes.map((n) => ({ ...n }));
  }

  public applyPaintConfig(paintConfig?: CreaturePaintConfig): void {
    if (!paintConfig) {
      this.customPaintActive = false;
      this.membraneMat.map = null;
      this.membraneMat.needsUpdate = true;
      return;
    }

    this.paintConfig = { ...paintConfig };
    this.customPaintActive = true;

    // 1. Configure PBR Surface Texture (Layer 1: Smooth vs Reptilian Scales vs Matte Chitin)
    if (paintConfig.skinTexture === 'reptilian_scales') {
      this.membraneMat.roughness = 0.34;
      this.membraneMat.metalness = 0.16;
      this.membraneMat.clearcoat = 0.85;
      this.membraneMat.clearcoatRoughness = 0.25;
      this.membraneMat.transmission = 0.12;
    } else if (paintConfig.skinTexture === 'matte_chitin') {
      this.membraneMat.roughness = 0.72;
      this.membraneMat.metalness = 0.28;
      this.membraneMat.clearcoat = 0.22;
      this.membraneMat.clearcoatRoughness = 0.65;
      this.membraneMat.transmission = 0.05;
    } else {
      // 'smooth' amphibian / organic skin
      this.membraneMat.roughness = 0.18;
      this.membraneMat.metalness = 0.05;
      this.membraneMat.clearcoat = 1.0;
      this.membraneMat.clearcoatRoughness = 0.12;
      this.membraneMat.transmission = this.isLandCreature ? 0.22 : 0.62;
    }

    // 2. Synthesize 512x512 Procedural Coat Texture (Layer 1 Base + Layer 2 Pattern)
    if (typeof document !== 'undefined') {
      if (!this.coatCanvas) {
        this.coatCanvas = document.createElement('canvas');
        this.coatCanvas.width = 512;
        this.coatCanvas.height = 512;
      }
      const ctx = this.coatCanvas.getContext('2d');
      if (ctx) {
        const w = 512;
        const h = 512;
        // Fill Layer 1 Base Color
        ctx.fillStyle = paintConfig.baseColor;
        ctx.fillRect(0, 0, w, h);

        // Optional procedural surface micro-relief pattern
        if (paintConfig.skinTexture === 'reptilian_scales') {
          ctx.strokeStyle = 'rgba(0,0,0,0.16)';
          ctx.lineWidth = 1.5;
          const step = 24;
          for (let y = 0; y < h + step; y += step) {
            const offset = (Math.floor(y / step) % 2) * (step * 0.5);
            for (let x = -step; x < w + step; x += step) {
              ctx.beginPath();
              ctx.arc(x + offset, y, step * 0.52, 0, Math.PI);
              ctx.stroke();
            }
          }
        } else if (paintConfig.skinTexture === 'matte_chitin') {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 2;
          for (let y = 0; y < h; y += 36) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 10, w, y);
            ctx.stroke();
          }
        }

        // Layer 2: Coat Pattern Overlay
        ctx.save();
        ctx.globalAlpha = THREE.MathUtils.clamp(paintConfig.patternOpacity ?? 0.78, 0.1, 1.0);

        if (paintConfig.patternType === 'tiger_stripes') {
          ctx.fillStyle = paintConfig.patternPrimaryColor;
          for (let i = 0; i < 14; i++) {
            const yBase = (i / 14) * h;
            ctx.beginPath();
            ctx.moveTo(0, yBase);
            ctx.quadraticCurveTo(w * 0.25, yBase + 22, w * 0.5, yBase + 6);
            ctx.quadraticCurveTo(w * 0.75, yBase - 14, w, yBase + 4);
            ctx.lineTo(w, yBase + 16);
            ctx.quadraticCurveTo(w * 0.75, yBase + 2, w * 0.5, yBase + 20);
            ctx.quadraticCurveTo(w * 0.25, yBase + 34, 0, yBase + 14);
            ctx.closePath();
            ctx.fill();
          }
          // Secondary thin accent stripes
          ctx.fillStyle = paintConfig.patternSecondaryColor;
          ctx.globalAlpha *= 0.65;
          for (let i = 0; i < 14; i += 2) {
            const yBase = (i / 14) * h + 18;
            ctx.fillRect(0, yBase, w, 4);
          }
        } else if (paintConfig.patternType === 'leopard_spots') {
          // Deterministic rosette spots
          for (let i = 0; i < 42; i++) {
            const sx = ((i * 137.5) % 100) * 0.01 * w;
            const sy = ((i * 73.1 + 19) % 100) * 0.01 * h;
            const rOuter = 14 + (i % 5) * 4;
            ctx.fillStyle = paintConfig.patternSecondaryColor;
            ctx.beginPath();
            ctx.arc(sx, sy, rOuter, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = paintConfig.patternPrimaryColor;
            ctx.beginPath();
            ctx.arc(sx + 2, sy - 1, rOuter * 0.62, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (paintConfig.patternType === 'dorsal_gradient') {
          const grad = ctx.createLinearGradient(0, 0, w, 0);
          grad.addColorStop(0.0, paintConfig.patternPrimaryColor);
          grad.addColorStop(0.28, paintConfig.patternSecondaryColor);
          grad.addColorStop(0.5, 'rgba(0,0,0,0)');
          grad.addColorStop(0.72, paintConfig.patternSecondaryColor);
          grad.addColorStop(1.0, paintConfig.patternPrimaryColor);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        } else if (paintConfig.patternType === 'pale_belly') {
          const grad = ctx.createRadialGradient(
            w * 0.5,
            h * 0.5,
            w * 0.06,
            w * 0.5,
            h * 0.5,
            w * 0.48
          );
          grad.addColorStop(0.0, paintConfig.patternPrimaryColor);
          grad.addColorStop(0.55, paintConfig.patternSecondaryColor);
          grad.addColorStop(1.0, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.restore();

        if (!this.coatCanvasTexture) {
          this.coatCanvasTexture = new THREE.CanvasTexture(this.coatCanvas);
          this.coatCanvasTexture.wrapS = THREE.RepeatWrapping;
          this.coatCanvasTexture.wrapT = THREE.ClampToEdgeWrapping;
        }
        this.coatCanvasTexture.needsUpdate = true;
        this.membraneMat.map = this.coatCanvasTexture;
        this.membraneMat.color.setHex(0xffffff);
        this.membraneMat.emissive.set(paintConfig.baseColor).multiplyScalar(0.32);
        this.membraneMat.needsUpdate = true;
      }
    }

    // 3. Apply Layer 3 (Details: Claws, Horns, Spikes, Joints) + Layer 1 Base to all placed 3D organs
    for (const entry of this.activePlacedOrgans) {
      entry.primary.setCoatColors(paintConfig.baseColor, paintConfig.detailColor);
      entry.mirror?.setCoatColors(paintConfig.baseColor, paintConfig.detailColor);
    }
    this.legMat.color.set(paintConfig.detailColor);
  }

  public applyMorphology(
    bodyShape: CellBodyShape,
    colorTheme: CellColorTheme,
    isLandCreature: boolean,
    spineSegments: 1 | 2 | 3 = this.spineSegments,
    spineLength: number = this.spineLength,
    torsoRadii: [number, number, number] = this.torsoRadii,
    spineNodes?: SpineVertebraNode[],
    paintConfig?: CreaturePaintConfig,
    bodySegments?: BodySegmentConfig[],
    creatureMorphology?: CreatureMorphologySliders
  ): void {
    this.bodyShape = bodyShape;
    this.colorTheme = colorTheme;
    this.isLandCreature = isLandCreature;
    this.spineSegments = spineSegments;
    this.spineLength = THREE.MathUtils.clamp(spineLength, 0.75, 1.75);
    this.torsoRadii = [
      THREE.MathUtils.clamp(torsoRadii[0], 0.6, 1.55),
      THREE.MathUtils.clamp(torsoRadii[1], 0.6, 1.55),
      THREE.MathUtils.clamp(torsoRadii[2], 0.6, 1.55),
    ];

    if (creatureMorphology) {
      this.creatureMorphology = {
        ...this.creatureMorphology,
        ...creatureMorphology,
      };
    }

    if (bodySegments && bodySegments.length === 5) {
      this.bodySegments = bodySegments.map((s) => ({ ...s }));
    }

    if (spineNodes && spineNodes.length >= 3) {
      this.spineNodes = spineNodes.slice(0, 12).map((n) => ({ ...n }));
    }

    this.updateSegmentedBodyGeometry();

    // Hide fallback amphibian legs so legless creatures crawl in slug/peristaltic mode
    this.evoAmphibianLegsGroup.visible = false;
    if (!isLandCreature) {
      this.heightOffset = 0;
    }

    // Apply Bioluminescent Color Theme Palette or 3-Layer Custom Paint
    const palette = COLOR_THEMES[colorTheme] ?? COLOR_THEMES.cyan;
    this.nucleusMat.color.setHex(palette.nucleusColor);
    this.nucleusMat.emissive.setHex(palette.nucleusEmissive);
    this.boostHaloMat.color.setHex(palette.membraneColor);
    this.legMat.color.setHex(palette.legColor);
    this.legMat.emissive.setHex(palette.membraneEmissive);

    if (paintConfig) {
      this.applyPaintConfig(paintConfig);
    } else if (!this.customPaintActive) {
      this.membraneMat.map = null;
      this.membraneMat.color.setHex(palette.membraneColor);
      this.membraneMat.emissive.setHex(palette.membraneEmissive);
      this.membraneMat.needsUpdate = true;
    } else {
      this.applyPaintConfig(this.paintConfig);
    }

    this.refreshVertebraMaterials();
  }

  public triggerSocialWave(maxRadius = 9.5): void {
    this.socialWaveTimer = 0.65;
    this.socialWaveMaxRadius = maxRadius;
    this.socialWaveMesh.position.copy(this.position);
    this.socialWaveMesh.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.2;
    this.socialWaveMesh.scale.setScalar(1.0);
    this.socialWaveMesh.visible = true;
  }

  public spawnAcidProjectile(targetPos?: THREE.Vector3 | null): void {
    const proj =
      this.acidProjectilePool[
        this.acidPoolCursor % this.acidProjectilePool.length
      ];
    this.acidPoolCursor++;

    _forwardDir.set(
      -Math.sin(this.headingAngle),
      0,
      -Math.cos(this.headingAngle)
    );

    const mouthDist = 1.85 * this.currentScale * this.spineLength;
    proj.position.set(
      this.position.x + _forwardDir.x * mouthDist,
      this.position.y + 0.1,
      this.position.z + _forwardDir.z * mouthDist
    );

    _aimDir.copy(_forwardDir);
    if (targetPos) {
      const toTargetX = targetPos.x - proj.position.x;
      const toTargetZ = targetPos.z - proj.position.z;
      const dist = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ);
      if (dist > 0.1 && dist <= 24.0) {
        const normX = toTargetX / dist;
        const normZ = toTargetZ / dist;
        const dot = normX * _forwardDir.x + normZ * _forwardDir.z;
        if (dot >= 0.35) {
          _aimDir.set(normX, 0, normZ).normalize();
        }
      }
    }

    proj.velocity.copy(_aimDir).multiplyScalar(32.0);
    proj.radius = 0.9 * this.currentScale;
    proj.life = 1.15;
    proj.active = true;
    proj.mesh.visible = true;
    proj.mesh.scale.setScalar(this.currentScale);
  }

  public getActiveAcidProjectiles(): readonly PooledAcidProjectile[] {
    return this.acidProjectilePool;
  }

  public setEditorPreviewAction(action: EditorPreviewAction): void {
    this.editorPreviewAction = action;
    this.editorActionTimer = 0;
    if (action === 'idle') {
      const effectiveY = this.getEffectiveGroundY();
      this.membraneMesh.scale.set(1, 1, 1);
      this.membraneMesh.position.set(0, effectiveY, 0);
      this.placedOrgansGroup.position.set(0, effectiveY, 0);
      this.placedOrgansGroup.rotation.set(0, 0, 0);
    }
  }

  public getEditorPreviewAction(): EditorPreviewAction {
    return this.editorPreviewAction;
  }

  public updateEditorIdle(delta: number, elapsedTime: number): void {
    this.currentScale = THREE.MathUtils.damp(
      this.currentScale,
      this.targetScale,
      4.0,
      delta
    );
    this.group.scale.setScalar(this.currentScale);
    this.editorActionTimer += delta;

    const preview = this.editorPreviewAction;
    const isCrawlingSlug =
      this.isLandCreature && !this.hasCustomLegsInstalled;

    // Determine effective animation speedRatio & boost state for Test Drive ("Probar") mode
    const previewSpeedRatio =
      preview === 'run'
        ? 1.35
        : preview === 'walk'
        ? 0.72
        : preview === 'attack'
        ? 0.95
        : preview === 'social'
        ? 0.55
        : 0.32;
    const previewBoosting = preview === 'run' || preview === 'attack';

    const phaseRate =
      preview === 'run'
        ? 14.0
        : preview === 'walk'
        ? 9.2
        : preview === 'attack'
        ? 11.5
        : 6.2;
    this.flagellumPhase += delta * phaseRate;

    // 1. Live Procedural Body Breathing, Center-of-Mass Sway, Peristaltic Crawl ("Babosa") & Test Drive Gestures
    const breathWave = Math.sin(elapsedTime * 2.8);
    let bodyPitch = 0;
    let bodyRoll = 0;
    let bodyYOffset = 0;
    let bodyZOffset = 0;

    if (isCrawlingSlug) {
      // Legless Terrestrial Creature ("Modo Babosa / Reptación"): peristaltic wave along belly
      const crawlFreq =
        preview === 'run' ? 8.5 : preview === 'walk' ? 5.6 : 2.6;
      const crawlAmp =
        preview === 'run' ? 0.11 : preview === 'walk' ? 0.08 : 0.035;
      const peristaltic = Math.sin(elapsedTime * crawlFreq);
      const peristalticCos = Math.cos(elapsedTime * crawlFreq);

      this.membraneMesh.scale.set(
        1.0 - peristaltic * crawlAmp * 0.7,
        1.0 + peristalticCos * crawlAmp * 0.5,
        1.0 + peristaltic * crawlAmp
      );
      bodyPitch = peristalticCos * crawlAmp * 0.65;
      bodyYOffset = Math.abs(peristaltic) * crawlAmp * 0.6;
      bodyZOffset =
        preview === 'walk' || preview === 'run'
          ? peristaltic * crawlAmp * 1.35
          : 0;
    } else if (this.isLandCreature && this.hasCustomLegsInstalled) {
      // Legged Creature: thoracic breathing + hip/shoulder sway + gait bounce in Test Drive
      this.membraneMesh.scale.set(
        1.0 + breathWave * 0.022,
        1.0 + breathWave * 0.026,
        1.0 - breathWave * 0.012
      );
      if (preview === 'walk' || preview === 'run') {
        const stride = this.flagellumPhase * 0.85;
        const bounceAmp = preview === 'run' ? 0.16 : 0.09;
        bodyYOffset = Math.abs(Math.sin(stride)) * bounceAmp;
        bodyRoll = Math.cos(stride) * (preview === 'run' ? 0.08 : 0.045);
        bodyPitch = Math.sin(stride * 2) * (preview === 'run' ? 0.06 : 0.03);
      } else {
        // Subtle idle weight transfer & breathing sway
        bodyYOffset = breathWave * 0.028;
        bodyRoll = Math.sin(elapsedTime * 1.4) * 0.022;
      }
    } else {
      // Cellular Stage idle float
      this.membraneMesh.scale.set(
        1.0 + breathWave * 0.018,
        1.0 + breathWave * 0.02,
        1.0 - breathWave * 0.014
      );
      bodyYOffset = breathWave * 0.025;
    }

    // Combat Attack Lunge & Strike in Test Drive ('attack')
    if (preview === 'attack') {
      const cycle = (this.editorActionTimer * 1.6) % 1.0;
      const lunge =
        cycle < 0.25
          ? -THREE.MathUtils.smoothstep(cycle, 0, 0.25) * 0.22
          : cycle < 0.5
          ? THREE.MathUtils.lerp(
              -0.22,
              0.48,
              THREE.MathUtils.smoothstep(cycle, 0.25, 0.45)
            )
          : THREE.MathUtils.lerp(
              0.48,
              0,
              THREE.MathUtils.smoothstep(cycle, 0.5, 1.0)
            );
      bodyZOffset -= lunge;
      bodyPitch += lunge * 0.38;
    }

    // Social Pose / Vocal Call in Test Drive ('social')
    if (preview === 'social') {
      const callWave = Math.sin(this.editorActionTimer * 4.2);
      bodyPitch -= 0.14 + callWave * 0.08;
      bodyYOffset += Math.max(0, callWave) * 0.08;
      bodyRoll += Math.cos(this.editorActionTimer * 2.1) * 0.06;
      if (this.socialWaveTimer <= 0 && Math.sin(this.editorActionTimer * 3.2) > 0.92) {
        this.triggerSocialWave(6.5);
      }
    }

    const effectiveY = this.getEffectiveGroundY();
    this.membraneMesh.position.set(
      0,
      effectiveY + bodyYOffset,
      bodyZOffset
    );
    this.placedOrgansGroup.position.set(
      0,
      effectiveY + bodyYOffset,
      bodyZOffset
    );
    this.group.rotation.set(bodyPitch, this.headingAngle, bodyRoll);

    // 2. Animate all placed 3D organs + Secondary Motion ("Jiggles") & Micro-Gestures
    const microMouthGesture =
      Math.sin(elapsedTime * 1.85) > 0.78 || preview === 'attack' || preview === 'social';
    for (const entry of this.activePlacedOrgans) {
      const effectiveSpeed = microMouthGesture
        ? Math.max(previewSpeedRatio, 0.85)
        : previewSpeedRatio;
      entry.primary.animate(elapsedTime, effectiveSpeed, previewBoosting);
      entry.mirror?.animate(elapsedTime, effectiveSpeed, previewBoosting);
    }

    // Update social wave ring if triggered during 'social' Test Drive preview
    if (this.socialWaveTimer > 0) {
      this.socialWaveTimer = Math.max(0, this.socialWaveTimer - delta);
      const tWave = 1.0 - this.socialWaveTimer / 0.65;
      this.socialWaveMesh.position.copy(this.position);
      this.socialWaveMesh.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.2;
      this.socialWaveMesh.scale.setScalar(1.0 + tWave * this.socialWaveMaxRadius);
      this.socialWaveMat.opacity = (1.0 - tWave) * 0.75;
      this.socialWaveMesh.visible = this.socialWaveTimer > 0;
    }

    if (this.dragPreviewGroup.visible) {
      let deltaAngle = this.dragTargetAngle - this.dragSmoothedAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.dragSmoothedAngle = THREE.MathUtils.damp(
        this.dragSmoothedAngle,
        this.dragSmoothedAngle + deltaAngle,
        24.0,
        delta
      );
      this.applyDragPreviewTransforms(this.dragSmoothedAngle);

      const snapScale = 1.0 + Math.sin(elapsedTime * 9.5) * 0.12;
      this.dragSnapRingPrimary.scale.setScalar(snapScale);
      this.dragSnapRingMirror.scale.setScalar(snapScale);

      this.dragPreviewPrimary?.animate(elapsedTime, 0.4, false);
      this.dragPreviewMirror?.animate(elapsedTime, 0.4, false);
    }

    for (let i = 0; i < this.ciliaLeft.length; i++) {
      const flutter = Math.sin(this.flagellumPhase * 1.1 + i) * 0.24;
      this.ciliaLeft[i].rotation.y = 0.35 + flutter;
      this.ciliaRight[i].rotation.y = -0.35 - flutter;
    }

    // Subtle pulse on hovered internal vertebra and active orientation gizmo sphere
    if (this.isEditingMode) {
      const activeCount = Math.min(
        this.spineNodes.length,
        this.spineVertebraeMeshes.length
      );
      for (let v = 0; v < activeCount; v++) {
        const isHov = this.hoveredVertebraIndex === v;
        const node = this.spineNodes[v];
        const rLocal = node ? node.radius : 1.0;
        const vPulse = isHov ? 1.24 + Math.sin(elapsedTime * 9) * 0.08 : 1.0;
        this.spineVertebraeMeshes[v].scale.set(
          (0.82 + 0.22 * rLocal) * vPulse,
          vPulse,
          vPulse
        );
      }
      if (this.editorOrientationGizmoGroup.visible) {
        const gPulse = this.isOrientationGizmoActive
          ? 1.18 + Math.sin(elapsedTime * 10) * 0.06
          : 1.0 + Math.sin(elapsedTime * 5) * 0.06;
        this.editorOrientationSphereMesh.scale.setScalar(gPulse);
      }
    }

    const pulse = 1.0 + Math.sin(elapsedTime * 4.2) * 0.07;
    this.nucleusMesh.scale.setScalar(pulse);

    const palette = COLOR_THEMES[this.colorTheme] ?? COLOR_THEMES.cyan;
    if (this.customPaintActive && this.membraneMat.map) {
      this.membraneMat.color.setHex(0xffffff);
      this.membraneMat.emissive.set(this.paintConfig.baseColor).multiplyScalar(0.32);
    } else {
      this.membraneMat.color.setHex(palette.membraneColor);
      this.membraneMat.emissive.setHex(palette.membraneEmissive);
    }
    this.membraneMat.emissiveIntensity = 0.35;
    this.boostHaloMat.color.setHex(palette.membraneColor);
    this.boostHaloMat.opacity = 0.38;
  }

  public setGrowthStage(stage: CellularGrowthStage): void {
    const scaleByStage: Record<CellularGrowthStage, number> = {
      1: 1.0,
      2: 1.28,
      3: 1.6,
      4: 1.95,
      5: 2.35,
    };
    const zoomByStage: Record<CellularGrowthStage, number> = {
      1: 1.0,
      2: 1.22,
      3: 1.45,
      4: 1.7,
      5: 2.0,
    };
    const arenaByStage: Record<CellularGrowthStage, number> = {
      1: 110,
      2: 165,
      3: 220,
      4: 275,
      5: 320,
    };

    this.targetScale = scaleByStage[stage] ?? 1.0;
    this.baseGrowthZoom = zoomByStage[stage] ?? 1.0;
    this.activeArenaRadius = arenaByStage[stage] ?? 110;
    this.cameraZoomMultiplier = this.baseGrowthZoom * this.visionZoomFactor;
  }

  public updateChemoreceptorCompass(
    targetPosition: THREE.Vector3 | null,
    isGeneticNodule: boolean,
    elapsedTime: number
  ): void {
    if (!this.hasChemoreceptorInstalled || !targetPosition) {
      this.chemoreceptorCompassGroup.visible = false;
      return;
    }

    const dx = targetPosition.x - this.position.x;
    const dz = targetPosition.z - this.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < 9.0) {
      this.chemoreceptorCompassGroup.visible = false;
      return;
    }

    this.chemoreceptorCompassGroup.visible = true;
    this.chemoreceptorCompassGroup.position.copy(this.position);
    this.chemoreceptorCompassGroup.scale.setScalar(this.currentScale);
    const angle = Math.atan2(-dx, -dz);
    this.chemoreceptorCompassGroup.rotation.set(0, angle, 0);

    this.chemoreceptorArrowMat.color.setHex(
      isGeneticNodule ? 0xfacc15 : 0x34d399
    );
    this.chemoreceptorArrowMat.opacity =
      0.55 + Math.sin(elapsedTime * 6.0) * 0.25;
  }

  public startMatingCall(): void {
    this.matingCallActive = true;
    this.matingCallElapsed = 0;

    const spawnAngle = this.headingAngle + 0.55;
    const dist = 10.5 * this.currentScale;
    this.mateStartPos.set(
      this.position.x - Math.sin(spawnAngle) * dist,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      this.position.z - Math.cos(spawnAngle) * dist
    );
    this.mateCellGroup.position.copy(this.mateStartPos);
    this.mateCellGroup.scale.setScalar(this.currentScale * 0.95);
    this.mateCellGroup.visible = true;

    for (const ring of this.matingRingMeshes) {
      ring.position.set(
        this.position.x,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.15,
        this.position.z
      );
      ring.scale.setScalar(1.0);
      ring.visible = true;
    }
  }

  public hideMateCell(): void {
    this.matingCallActive = false;
    this.matingCallElapsed = 0;
    this.mateCellGroup.visible = false;
    for (const ring of this.matingRingMeshes) {
      ring.visible = false;
    }
  }

  /**
   * Deterministic 3D multi-frequency Simplex/Perlin-style biological gyri/sulci folding noise
   * used to sculpt anatomical cerebral convolutions on each hemisphere.
   */
  private evaluateCerebralGyriNoise(x: number, y: number, z: number): number {
    // Primary convoluted cortical folds (low-mid frequency)
    const n1 =
      Math.sin(x * 7.8 + Math.cos(z * 6.4) * 1.35) *
      Math.cos(y * 7.2 + Math.sin(x * 5.9) * 1.25) *
      Math.sin(z * 6.8 + Math.cos(y * 6.1) * 1.15);
    // Secondary sulci ridges (higher frequency branching)
    const n2 =
      Math.sin(x * 14.6 - z * 11.2 + Math.sin(y * 9.8)) *
      Math.cos(y * 13.4 + x * 10.5);
    // Sharpness shaping: deep narrow sulci (valleys) and rounded gyri (crowns)
    const raw = n1 * 0.68 + n2 * 0.32;
    return Math.tanh(raw * 2.1);
  }

  /**
   * Builds the procedural 3D Spore Brain Evolution Sequence (`cerebrumGroup`)
   * anchored at the anterior/cranial pole of the cell:
   * - Dual PBR Cerebral Hemispheres (`IcosahedronGeometry` subdiv 3) with dynamic gyri/sulci vertex folding
   * - Biological translucent `MeshPhysicalMaterial` pulsing between cyan (`#22d3ee`) and synaptic violet (`#c084fc`)
   * - Dendritic Arborization / Axonal Filament Network (`LineSegments`) emerging from the cell nucleus
   * - Synaptic Particle Complex (`Points`, 104 electrical impulses) traveling between hemispheres and along axons
   * - Refractive Plasma Membrane Vesicle Bubble + bioluminescent micro-sphere implosion array
   * - Caustic Cranial Absorption Shockwave Rings
   */
  private buildBrainCinematicVisuals(): void {
    this.brainCinematicGroup = new THREE.Group();
    this.brainCinematicGroup.visible = false;
    this.group.add(this.brainCinematicGroup);

    // Cranial anchor group positioned toward the anterior pole of the cell
    this.cerebrumGroup = new THREE.Group();
    this.cerebrumGroup.position.set(0, 0, -0.46);
    this.brainCinematicGroup.add(this.cerebrumGroup);

    // 1. Refractive Plasma Membrane Vesicle Bubble (Outer Protective Bio-Envelope)
    const vesicleGeo = new THREE.IcosahedronGeometry(0.84, 3);
    vesicleGeo.scale(1.16, 0.96, 1.12);
    this.brainVesicleMat = new THREE.MeshPhysicalMaterial({
      color: 0xa5f3fc,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35,
      roughness: 0.05,
      metalness: 0.0,
      transmission: 0.95,
      thickness: 0.9,
      ior: 1.36,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.brainVesicleMesh = new THREE.Mesh(vesicleGeo, this.brainVesicleMat);
    this.brainVesicleMesh.position.set(0, 1.58, 0);
    this.brainVesicleMesh.renderOrder = 6;
    this.cerebrumGroup.add(this.brainVesicleMesh);

    // Bioluminescent micro-spheres for Phase 3 vesicle dissolution/implosion
    const implosionSphereGeo = new THREE.IcosahedronGeometry(0.048, 1);
    this.brainVesicleImplosionMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 24; i++) {
      const mSphere = new THREE.Mesh(
        implosionSphereGeo,
        this.brainVesicleImplosionMat
      );
      mSphere.visible = false;
      this.cerebrumGroup.add(mSphere);
      this.brainVesicleImplosionSpheres.push(mSphere);
    }

    // 2. Dual PBR Cerebral Hemispheres (`IcosahedronGeometry` subdivision 3)
    this.brainOrganGroup = new THREE.Group();
    this.brainOrganGroup.position.set(0, 1.58, 0);
    this.cerebrumGroup.add(this.brainOrganGroup);

    this.brainHemisphereMat = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.15,
      roughness: 0.28,
      metalness: 0.06,
      transmission: 0.62,
      thickness: 1.2,
      ior: 1.38,
      clearcoat: 1.0,
      clearcoatRoughness: 0.14,
      transparent: true,
      opacity: 0.96,
    });

    const buildHemisphereGeometry = (
      side: -1 | 1
    ): {
      geo: THREE.BufferGeometry;
      basePositions: Float32Array;
      gyriDisplacements: Float32Array;
    } => {
      const geo = new THREE.IcosahedronGeometry(0.38, 3);
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const basePositions = new Float32Array(posAttr.array.length);
      const gyriDisplacements = new Float32Array(posAttr.array.length);

      for (let i = 0; i < posAttr.count; i++) {
        let vx = posAttr.getX(i);
        let vy = posAttr.getY(i);
        let vz = posAttr.getZ(i);

        // Anatomical cerebral hemisphere shaping:
        // Flatten medial longitudinal fissure face, elongate frontal-occipital axis, arch parietal dome
        const isMedialFace = side < 0 ? vx > 0.02 : vx < -0.02;
        if (isMedialFace) {
          vx *= 0.36;
        } else {
          vx *= 0.92;
        }
        vy *= 0.95;
        vz *= 1.36;

        // Slight temporal lobe bulge on lower-outer side and frontal pole taper
        if (vy < 0 && !isMedialFace) {
          vx *= 1.12;
        }
        if (vz < 0) {
          // Frontal lobe fullness
          vy *= 1.05;
        }

        const len = Math.hypot(vx, vy, vz) || 1;
        const nx = vx / len;
        const ny = vy / len;
        const nz = vz / len;

        // Initial embryonic cortical fold + stored deep gyri/sulci displacement vector for Phase 2
        const foldVal = this.evaluateCerebralGyriNoise(
          nx * 1.4 + side * 0.7,
          ny * 1.4,
          nz * 1.8
        );
        const medialAttenuation = isMedialFace ? 0.25 : 1.0;
        const baseFoldOffset = foldVal * 0.018 * medialAttenuation;
        const maxGyriOffset = foldVal * 0.068 * medialAttenuation;

        const bx = vx + nx * baseFoldOffset;
        const by = vy + ny * baseFoldOffset;
        const bz = vz + nz * baseFoldOffset;

        const idx3 = i * 3;
        basePositions[idx3] = bx;
        basePositions[idx3 + 1] = by;
        basePositions[idx3 + 2] = bz;

        gyriDisplacements[idx3] = nx * maxGyriOffset;
        gyriDisplacements[idx3 + 1] = ny * maxGyriOffset;
        gyriDisplacements[idx3 + 2] = nz * maxGyriOffset;

        posAttr.setXYZ(i, bx, by, bz);
      }

      geo.computeVertexNormals();
      return { geo, basePositions, gyriDisplacements };
    };

    const leftData = buildHemisphereGeometry(-1);
    this.brainLeftBasePositions = leftData.basePositions;
    this.brainLeftGyriDisplacements = leftData.gyriDisplacements;
    this.brainLeftHemiMesh = new THREE.Mesh(
      leftData.geo,
      this.brainHemisphereMat
    );
    this.brainLeftHemiMesh.position.set(-0.18, 0, 0);
    this.brainLeftHemiMesh.rotation.z = 0.08;
    this.brainLeftHemiMesh.renderOrder = 4;
    this.brainOrganGroup.add(this.brainLeftHemiMesh);

    const rightData = buildHemisphereGeometry(1);
    this.brainRightBasePositions = rightData.basePositions;
    this.brainRightGyriDisplacements = rightData.gyriDisplacements;
    this.brainRightHemiMesh = new THREE.Mesh(
      rightData.geo,
      this.brainHemisphereMat
    );
    this.brainRightHemiMesh.position.set(0.18, 0, 0);
    this.brainRightHemiMesh.rotation.z = -0.08;
    this.brainRightHemiMesh.renderOrder = 4;
    this.brainOrganGroup.add(this.brainRightHemiMesh);

    // Corpus Callosum & Bioluminescent Thalamic Core bridging both hemispheres
    const corpusGeo = new THREE.CapsuleGeometry(0.1, 0.28, 10, 14);
    corpusGeo.rotateX(Math.PI / 2);
    this.brainCorpusMat = new THREE.MeshBasicMaterial({
      color: 0xa5f3fc,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const corpusMesh = new THREE.Mesh(corpusGeo, this.brainCorpusMat);
    corpusMesh.position.set(0, -0.03, 0.02);
    this.brainOrganGroup.add(corpusMesh);

    // Frontal Lobe Synaptic Flash Halo (emits micro-flashes during Phase 2 & 3)
    const frontalFlashGeo = new THREE.SphereGeometry(0.24, 16, 12);
    frontalFlashGeo.scale(1.3, 0.85, 0.85);
    this.brainFrontalFlashMat = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.brainFrontalFlashMesh = new THREE.Mesh(
      frontalFlashGeo,
      this.brainFrontalFlashMat
    );
    this.brainFrontalFlashMesh.position.set(0, 0.06, -0.34);
    this.brainOrganGroup.add(this.brainFrontalFlashMesh);

    // 3. Dendritic Arborization / Axonal Filament Network (`LineSegments`)
    // Connects the cell's inner nucleus (local 0, 0, 0.51 relative to cerebrumGroup) up to the brain stem & lobes
    const filamentCount = 18;
    const segmentsPerFilament = 10;
    const totalVertices = filamentCount * segmentsPerFilament * 2;
    this.brainDendriticBasePositions = new Float32Array(totalVertices * 3);
    const dendriticWorkPositions = new Float32Array(totalVertices * 3);

    let vCursor = 0;
    for (let f = 0; f < filamentCount; f++) {
      const angle = (f / filamentCount) * Math.PI * 2;
      const sideSign = Math.cos(angle) >= 0 ? 1 : -1;
      const startRadius = 0.08 + (f % 3) * 0.035;
      const endX =
        sideSign * (0.12 + (f % 4) * 0.065) + Math.cos(angle) * 0.08;
      const endZ = Math.sin(angle) * 0.28;

      for (let s = 0; s < segmentsPerFilament; s++) {
        const t0 = s / segmentsPerFilament;
        const t1 = (s + 1) / segmentsPerFilament;

        const writePoint = (t: number) => {
          const helixAngle = angle + t * 2.4;
          const midSpread = Math.sin(t * Math.PI) * 0.16;
          const px =
            THREE.MathUtils.lerp(
              Math.cos(angle) * startRadius,
              endX,
              t
            ) +
            Math.cos(helixAngle) * midSpread;
          const py = THREE.MathUtils.lerp(0.02, 1.52, t);
          const pz =
            THREE.MathUtils.lerp(
              0.46 + Math.sin(angle) * startRadius,
              endZ,
              t
            ) +
            Math.sin(helixAngle) * midSpread;

          const idx = vCursor * 3;
          this.brainDendriticBasePositions[idx] = px;
          this.brainDendriticBasePositions[idx + 1] = py;
          this.brainDendriticBasePositions[idx + 2] = pz;
          dendriticWorkPositions[idx] = px;
          dendriticWorkPositions[idx + 1] = py;
          dendriticWorkPositions[idx + 2] = pz;
          vCursor++;
        };

        writePoint(t0);
        writePoint(t1);
      }
    }

    const dendriticGeo = new THREE.BufferGeometry();
    dendriticGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(dendriticWorkPositions, 3)
    );
    this.brainDendriticMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    this.brainDendriticLines = new THREE.LineSegments(
      dendriticGeo,
      this.brainDendriticMat
    );
    this.brainDendriticLines.renderOrder = 3;
    this.cerebrumGroup.add(this.brainDendriticLines);

    // 4. Synaptic Particle Complex (`Points` - 104 electrical impulse particles)
    const particleCount = 104;
    this.brainSynapticPositions = new Float32Array(particleCount * 3);
    this.brainSynapticPhases = new Float32Array(particleCount);
    this.brainSynapticModes = new Uint8Array(particleCount);

    for (let p = 0; p < particleCount; p++) {
      this.brainSynapticPhases[p] = (p / particleCount) * Math.PI * 2;
      // Mode 0 (60%): Inter-hemispheric & cortical surface synapses
      // Mode 1 (40%): Ascending/descending axonal trunk impulses
      this.brainSynapticModes[p] = p % 5 < 3 ? 0 : 1;
    }

    const synapticGeo = new THREE.BufferGeometry();
    synapticGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.brainSynapticPositions, 3)
    );
    this.brainSynapticMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.095,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.brainSynapticPoints = new THREE.Points(
      synapticGeo,
      this.brainSynapticMat
    );
    this.brainSynapticPoints.renderOrder = 7;
    this.cerebrumGroup.add(this.brainSynapticPoints);

    // 5. Caustic Cranial Absorption Shockwave Rings (Phase 4)
    const ringGeo = new THREE.RingGeometry(0.28, 0.44, 40);
    ringGeo.rotateX(-Math.PI / 2);
    for (let r = 0; r < 3; r++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: r === 0 ? 0x22d3ee : r === 1 ? 0xc084fc : 0xfacc15,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const rMesh = new THREE.Mesh(ringGeo, rMat);
      rMesh.position.set(0, 0.24, 0.08);
      rMesh.visible = false;
      this.cerebrumGroup.add(rMesh);
      this.brainShockwaveRings.push(rMesh);
      this.brainShockwaveMats.push(rMat);
      this.disposableMaterials.push(rMat);
    }

    this.disposableGeometries.push(
      vesicleGeo,
      implosionSphereGeo,
      leftData.geo,
      rightData.geo,
      corpusGeo,
      frontalFlashGeo,
      dendriticGeo,
      synapticGeo,
      ringGeo
    );
    this.disposableMaterials.push(
      this.brainVesicleMat,
      this.brainVesicleImplosionMat,
      this.brainHemisphereMat,
      this.brainCorpusMat,
      this.brainFrontalFlashMat,
      this.brainDendriticMat,
      this.brainSynapticMat
    );
  }

  public setBrainCinematicActive(active: boolean): void {
    if (!this.brainCinematicGroup) return;
    this.brainCinematicGroup.visible = active;
    if (!active) {
      for (const ring of this.brainShockwaveRings) {
        ring.visible = false;
      }
      for (const mSphere of this.brainVesicleImplosionSpheres) {
        mSphere.visible = false;
      }
      this.membraneMesh.scale.set(1, 1, 1);
      this.membraneMesh.position.set(0, 0, 0);
      this.nucleusMesh.scale.setScalar(1);
      this.nucleusMat.emissiveIntensity = 0.95;
      for (const vMat of this.spineVertebraeMats) {
        vMat.emissiveIntensity = 0.95;
      }
    }
  }

  /**
   * 4-Phase Procedural Brain Evolution Choreography (5.5s total duration):
   * - Phase 1 [0.00 - 0.25]: Axonal Germination (Nucleus hyper-glow, cranial membrane bulge, helical axon sprout)
   * - Phase 2 [0.25 - 0.65]: Hemisphere Expansion & Gyrification (Elastic backOut separation, dynamic vertex sulci deepening, frontal micro-flashes)
   * - Phase 3 [0.65 - 0.85]: Synaptic Overload & Awakening of Consciousness (Doubled 8% heartbeat dilation, descending axon light waves illuminating internal vertebrae, refractive vesicle implosion into micro-spheres)
   * - Phase 4 [0.85 - 1.00]: Cranial Assimilation & Somatic Integration (Firm descent into cranium, membrane envelopment, radial flash & caustic shockwave rings)
   */
  public updateBrainCinematic(progress: number, elapsedTime: number): void {
    if (!this.brainCinematicGroup || !this.brainCinematicGroup.visible) return;

    const p = THREE.MathUtils.clamp(progress, 0, 1);

    this.currentScale = THREE.MathUtils.damp(
      this.currentScale,
      this.targetScale,
      4.0,
      0.016
    );
    this.group.scale.setScalar(this.currentScale);

    // Normalized sub-phase progress factors
    const pPhase1 = THREE.MathUtils.clamp(p / 0.25, 0, 1);
    const pPhase2 = THREE.MathUtils.clamp((p - 0.25) / 0.4, 0, 1);
    const pPhase3 = THREE.MathUtils.clamp((p - 0.65) / 0.2, 0, 1);
    const pPhase4 = THREE.MathUtils.clamp((p - 0.85) / 0.15, 0, 1);

    // Elastic backOut curve for Phase 2 hemisphere unfolding
    const backOut = (t: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    const hemiElastic = p < 0.25 ? pPhase1 * 0.38 : THREE.MathUtils.lerp(0.38, 1.0, backOut(pPhase2));

    // =========================================================================
    // PHASE 1 & 4: Cell Nucleus Glow & Cranial Membrane Elastic Bulge / Envelopment
    // =========================================================================
    const cranialBulge =
      Math.sin(pPhase1 * Math.PI * 0.5) * (1.0 - pPhase4 * 0.55);
    const envelopExpand = Math.sin(pPhase4 * Math.PI) * 0.16;
    this.membraneMesh.scale.set(
      1.0 + cranialBulge * 0.06 + envelopExpand * 0.12,
      1.0 + cranialBulge * 0.18 + envelopExpand * 0.22,
      1.0 + cranialBulge * 0.05 + envelopExpand * 0.08
    );
    this.membraneMesh.position.set(
      0,
      cranialBulge * 0.08 + envelopExpand * 0.06,
      0
    );

    const nucleusPulse =
      1.0 +
      Math.sin(elapsedTime * (8.0 + p * 10.0)) * 0.12 +
      pPhase1 * 0.28 +
      pPhase4 * 0.25;
    this.nucleusMesh.scale.setScalar(nucleusPulse);
    this.nucleusMat.emissiveIntensity =
      1.2 + pPhase1 * 1.6 + Math.sin(elapsedTime * 14.0) * 0.45;

    // =========================================================================
    // PHASE 1 -> 4: Dendritic Arborization Helical Sprouting & Somatic Wave
    // =========================================================================
    const dendriticPosAttr = this.brainDendriticLines.geometry.attributes
      .position as THREE.BufferAttribute;
    const dendriticArr = dendriticPosAttr.array as Float32Array;
    const sproutHeightFactor = THREE.MathUtils.smoothstep(p, 0.0, 0.25);
    const descendCompression = 1.0 - THREE.MathUtils.smoothstep(p, 0.85, 0.99) * 0.78;
    const helixSpin = elapsedTime * (1.8 + pPhase1 * 1.4);

    for (let i = 0; i < dendriticPosAttr.count; i++) {
      const idx = i * 3;
      const bx = this.brainDendriticBasePositions[idx];
      const by = this.brainDendriticBasePositions[idx + 1];
      const bz = this.brainDendriticBasePositions[idx + 2];

      const normY = THREE.MathUtils.clamp(by / 1.52, 0, 1);
      const activeGrow = THREE.MathUtils.clamp(
        sproutHeightFactor * 1.25 - normY * 0.25,
        0,
        1
      );
      const twistAngle = helixSpin * (1.0 - normY * 0.5) + normY * 1.2;
      const cosT = Math.cos(twistAngle * 0.22);
      const sinT = Math.sin(twistAngle * 0.22);

      const rx = bx * cosT - bz * sinT * 0.18;
      const rz = bz * cosT + bx * sinT * 0.18;

      dendriticArr[idx] = THREE.MathUtils.lerp(0, rx, activeGrow);
      dendriticArr[idx + 1] =
        by * activeGrow * descendCompression +
        (1.0 - descendCompression) * 0.18;
      dendriticArr[idx + 2] = THREE.MathUtils.lerp(0.46, rz, activeGrow);
    }
    dendriticPosAttr.needsUpdate = true;
    this.brainDendriticMat.opacity =
      (0.35 + sproutHeightFactor * 0.6) * (1.0 - pPhase4 * 0.65);

    // =========================================================================
    // PHASE 2 & 3: Dual PBR Hemispheres Separation, Dynamic Gyri/Sulci Vertex
    // Displacement & Doubled 8% Cerebral Heartbeat Pulsation
    // =========================================================================
    const descendT = THREE.MathUtils.smoothstep(p, 0.85, 0.99);
    const brainHoverY = THREE.MathUtils.lerp(
      0.55,
      1.58,
      THREE.MathUtils.smoothstep(p, 0.0, 0.26)
    );
    const brainCurrentY = THREE.MathUtils.lerp(brainHoverY, 0.22, descendT);
    const brainCurrentZ = THREE.MathUtils.lerp(0.0, 0.12, descendT);

    this.brainOrganGroup.position.set(
      0,
      brainCurrentY + Math.sin(elapsedTime * 4.2) * 0.035 * (1.0 - descendT),
      brainCurrentZ
    );

    // Lateral hemisphere separation with elastic damping in Phase 2
    const hemiSeparation = THREE.MathUtils.lerp(
      0.09,
      0.21,
      THREE.MathUtils.clamp(hemiElastic, 0, 1.15)
    );
    this.brainLeftHemiMesh.position.x = -hemiSeparation;
    this.brainRightHemiMesh.position.x = hemiSeparation;

    // Cerebral heartbeat frequency doubles in Phase 3 (visible 8% dilation/contraction)
    const beatFreq = p >= 0.65 ? 18.5 : 9.2;
    const beatAmp = p >= 0.65 ? 0.08 : 0.038;
    const cerebralBeat = 1.0 + Math.sin(elapsedTime * beatFreq) * beatAmp;

    const absorbScale = 1.0 - THREE.MathUtils.smoothstep(p, 0.88, 1.0) * 0.36;
    const totalBrainScale =
      Math.max(0.18, hemiElastic) * cerebralBeat * absorbScale;
    this.brainOrganGroup.scale.setScalar(totalBrainScale);
    this.brainOrganGroup.rotation.y =
      Math.sin(elapsedTime * 1.8) * 0.18 * (1.0 - descendT);

    // Dynamic vertex displacement of cerebral sulci & gyri as a function of p
    const gyriDepthFactor =
      THREE.MathUtils.smoothstep(p, 0.22, 0.65) +
      (p >= 0.65 ? Math.sin(elapsedTime * beatFreq) * 0.12 : 0);

    const updateHemisphereVertices = (
      mesh: THREE.Mesh,
      baseArr: Float32Array,
      dispArr: Float32Array
    ) => {
      const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = baseArr[i] + dispArr[i] * gyriDepthFactor;
        arr[i + 1] = baseArr[i + 1] + dispArr[i + 1] * gyriDepthFactor;
        arr[i + 2] = baseArr[i + 2] + dispArr[i + 2] * gyriDepthFactor;
      }
      attr.needsUpdate = true;
    };

    updateHemisphereVertices(
      this.brainLeftHemiMesh,
      this.brainLeftBasePositions,
      this.brainLeftGyriDisplacements
    );
    updateHemisphereVertices(
      this.brainRightHemiMesh,
      this.brainRightBasePositions,
      this.brainRightGyriDisplacements
    );

    // Reactive PBR Emissive pulsing between Cyan (#22d3ee) and Synaptic Violet (#c084fc)
    const colorMix =
      0.5 +
      0.5 *
        Math.sin(
          elapsedTime * (5.0 + p * 12.0) + pPhase2 * 1.5 + pPhase3 * 2.5
        );
    this.brainEmissiveWork
      .copy(this.brainEmissiveCyan)
      .lerp(this.brainEmissiveViolet, colorMix);
    this.brainHemisphereMat.emissive.copy(this.brainEmissiveWork);
    this.brainHemisphereMat.emissiveIntensity =
      0.95 +
      pPhase2 * 0.65 +
      pPhase3 * 0.85 +
      Math.abs(Math.sin(elapsedTime * beatFreq)) * 0.65;

    // Frontal lobe micro-flashes during Phase 2 & 3
    if (p >= 0.25 && p <= 0.88) {
      const flashWave = Math.max(0, Math.sin(elapsedTime * 24.0 + p * 30.0));
      this.brainFrontalFlashMat.opacity =
        Math.pow(flashWave, 3.0) * (0.55 + pPhase3 * 0.35);
      this.brainFrontalFlashMesh.scale.setScalar(0.9 + flashWave * 0.45);
    } else {
      this.brainFrontalFlashMat.opacity = 0;
    }

    // =========================================================================
    // PHASE 1 -> 4: Synaptic Particle Complex (104 Impulses) Accelerating with p
    // =========================================================================
    const synAttr = this.brainSynapticPoints.geometry.attributes
      .position as THREE.BufferAttribute;
    const synArr = synAttr.array as Float32Array;
    const synapticSpeed = 2.8 + p * 11.5 + pPhase3 * 6.0;

    for (let i = 0; i < this.brainSynapticPhases.length; i++) {
      const phase = this.brainSynapticPhases[i] + elapsedTime * synapticSpeed;
      const mode = this.brainSynapticModes[i];
      const idx = i * 3;

      if (mode === 0) {
        // Inter-hemispheric & cortical arc pulses bridging Left <-> Right lobes
        const bridgeX = Math.sin(phase) * (0.36 * totalBrainScale);
        const lobeY =
          brainCurrentY +
          Math.cos(phase * 1.7 + i) * (0.28 * totalBrainScale);
        const lobeZ =
          brainCurrentZ +
          Math.sin(phase * 0.8 + i * 0.5) * (0.44 * totalBrainScale);

        synArr[idx] = bridgeX;
        synArr[idx + 1] = lobeY;
        synArr[idx + 2] = lobeZ;
      } else {
        // Axonal travel pulses between cell nucleus and cerebral base (descends in Phase 3)
        const travelT =
          p >= 0.65
            ? 1.0 - ((phase * 0.22 + i * 0.07) % 1.0)
            : (phase * 0.22 + i * 0.07) % 1.0;
        const spiralA = phase * 0.9 + i;
        const radial = (0.08 + Math.sin(travelT * Math.PI) * 0.16) * (1.0 - descendT * 0.5);

        synArr[idx] = Math.cos(spiralA) * radial;
        synArr[idx + 1] = THREE.MathUtils.lerp(0.05, brainCurrentY, travelT);
        synArr[idx + 2] =
          THREE.MathUtils.lerp(0.42, brainCurrentZ, travelT) +
          Math.sin(spiralA) * radial;
      }
    }
    synAttr.needsUpdate = true;
    this.brainSynapticMat.size = 0.075 + pPhase2 * 0.03 + pPhase3 * 0.035;
    this.brainSynapticMat.color.copy(this.brainEmissiveWork);

    // =========================================================================
    // PHASE 3: Descending Light Waves Illuminating Internal Body Vertebrae &
    // Refractive Vesicle Vibration + Micro-Sphere Implosion Dissolution
    // =========================================================================
    if (p >= 0.65 && p <= 0.92) {
      const wavePhase = (p - 0.65) / 0.27;
      for (let v = 0; v < this.spineVertebraeMats.length; v++) {
        const vNorm = v / Math.max(1, this.spineVertebraeMats.length - 1);
        const waveFront = Math.max(
          0,
          1.0 - Math.abs(wavePhase * 1.4 - vNorm) * 3.2
        );
        this.spineVertebraeMats[v].emissiveIntensity =
          0.95 + waveFront * 2.4;
      }
    }

    // Outer Refractive Plasma Vesicle behavior across Phases 1-3
    const vesicleDissolve = THREE.MathUtils.smoothstep(p, 0.68, 0.85);
    this.brainVesicleMesh.visible = vesicleDissolve < 0.98;
    if (this.brainVesicleMesh.visible) {
      const vibAmp = p >= 0.65 ? (1.0 - vesicleDissolve) * 0.045 : 0.012;
      const vibX = Math.sin(elapsedTime * 38.0) * vibAmp;
      const vibY = Math.cos(elapsedTime * 34.0) * vibAmp;
      const vScale =
        THREE.MathUtils.smoothstep(p, 0.0, 0.24) *
        (1.0 + pPhase2 * 0.15) *
        (1.0 - vesicleDissolve * 0.45);
      this.brainVesicleMesh.position.set(vibX, brainCurrentY + vibY, 0);
      this.brainVesicleMesh.scale.set(
        1.16 * vScale,
        0.96 * vScale,
        1.12 * vScale
      );
      this.brainVesicleMat.opacity =
        0.75 *
        THREE.MathUtils.smoothstep(p, 0.0, 0.2) *
        (1.0 - vesicleDissolve);
    }

    // Micro-sphere implosion burst when the refractive vesicle dissolves in Phase 3
    const implosionActive = p >= 0.66 && p <= 0.89;
    const implosionT = THREE.MathUtils.clamp((p - 0.66) / 0.22, 0, 1);
    this.brainVesicleImplosionMat.opacity = implosionActive
      ? Math.sin(implosionT * Math.PI) * 0.95
      : 0;
    for (let i = 0; i < this.brainVesicleImplosionSpheres.length; i++) {
      const mSphere = this.brainVesicleImplosionSpheres[i];
      mSphere.visible = implosionActive;
      if (implosionActive) {
        const phi = Math.acos(
          1 - (2 * (i + 0.5)) / this.brainVesicleImplosionSpheres.length
        );
        const theta = Math.PI * (1 + Math.sqrt(5)) * i + elapsedTime * 2.5;
        // First expands slightly from vesicle rim, then implodes into the cerebral core
        const r =
          implosionT < 0.35
            ? THREE.MathUtils.lerp(0.82, 1.05, implosionT / 0.35)
            : THREE.MathUtils.lerp(1.05, 0.12, (implosionT - 0.35) / 0.65);
        mSphere.position.set(
          Math.sin(phi) * Math.cos(theta) * r,
          brainCurrentY + Math.cos(phi) * r,
          Math.sin(phi) * Math.sin(theta) * r
        );
        mSphere.scale.setScalar(1.2 - implosionT * 0.7);
      }
    }

    // =========================================================================
    // PHASE 4: Caustic Cranial Absorption Shockwave Rings ($p \in [0.85, 1.0]$)
    // =========================================================================
    for (let r = 0; r < this.brainShockwaveRings.length; r++) {
      const ringStart = 0.85 + r * 0.035;
      const ringMesh = this.brainShockwaveRings[r];
      const ringMat = this.brainShockwaveMats[r];
      if (p >= ringStart) {
        const rT = THREE.MathUtils.clamp(
          (p - ringStart) / (1.0 - ringStart),
          0,
          1
        );
        ringMesh.visible = true;
        ringMesh.scale.setScalar(0.65 + rT * 7.2);
        ringMat.opacity = (1.0 - rT) * 0.9;
      } else {
        ringMesh.visible = false;
      }
    }
  }

  /**
   * Emits poison clouds from the exact world-space nozzle coordinates of placed `poison_gland` organs!
   */
  public spawnPoisonCloud(): void {
    const stackBoost = 1 + 0.35 * Math.max(0, this.poisonGlandStacks - 1);

    // Collect world positions of all placed poison_gland nozzles
    const nozzleWorldPositions: THREE.Vector3[] = [];
    this.group.updateMatrixWorld(true);

    for (const entry of this.activePlacedOrgans) {
      if (
        normalizeAdaptationId(entry.instance.adaptationId) === 'poison_gland'
      ) {
        if (entry.primary.nozzleLocalPos) {
          _worldNozzlePos.copy(entry.primary.nozzleLocalPos);
          entry.primary.group.localToWorld(_worldNozzlePos);
          nozzleWorldPositions.push(_worldNozzlePos.clone());
        }
        if (entry.mirror && entry.mirror.nozzleLocalPos) {
          _worldNozzlePos.copy(entry.mirror.nozzleLocalPos);
          entry.mirror.group.localToWorld(_worldNozzlePos);
          nozzleWorldPositions.push(_worldNozzlePos.clone());
        }
      }
    }

    if (nozzleWorldPositions.length === 0) {
      const backDist = 2.1 * this.currentScale;
      nozzleWorldPositions.push(
        new THREE.Vector3(
          this.position.x + Math.sin(this.headingAngle) * backDist,
          GAME_CONFIG.WORLD.SWIM_PLANE_Y,
          this.position.z + Math.cos(this.headingAngle) * backDist
        )
      );
    }

    for (const spawnPos of nozzleWorldPositions) {
      const cloud =
        this.poisonCloudPool[
          this.poisonPoolCursor % this.poisonCloudPool.length
        ];
      this.poisonPoolCursor++;

      cloud.position.set(
        spawnPos.x + (Math.random() - 0.5) * 0.35,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        spawnPos.z + (Math.random() - 0.5) * 0.35
      );
      cloud.radius = 2.35 * this.currentScale * stackBoost;
      cloud.life = 4.0 * stackBoost;
      cloud.maxLife = 4.0 * stackBoost;
      cloud.active = true;
      cloud.mesh.visible = true;
      cloud.mesh.scale.setScalar(0.7 * this.currentScale * stackBoost);
      cloud.mat.opacity = 0.48;
    }
  }

  public triggerElectricPulse(): void {
    this.electricPulseTimer = this.electricPulseDuration;
    this.electricWaveMesh.position.copy(this.position);
    this.electricWaveMesh.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.2;
    this.electricWaveMesh.scale.setScalar(1.0);
    this.electricWaveMesh.visible = true;

    this.electricDomeMesh.position.copy(this.position);
    this.electricDomeMesh.scale.setScalar(1.0);
    this.electricDomeMesh.visible = true;
  }

  public getActivePoisonClouds(): readonly PoisonCloudHazard[] {
    return this.poisonCloudPool;
  }

  public syncEvolutionParts(
    installedInput: Readonly<Record<string, number>> | Set<string>
  ): void {
    const getCount = (id: string): number => {
      if (installedInput instanceof Set) {
        return installedInput.has(id) ? 1 : 0;
      }
      return installedInput[id] ?? 0;
    };

    const poisonCount =
      getCount('poison_gland') + getCount('weapon_caustic_acid_blister');
    const wingsCount = getCount('wings_1');
    const eyePhotoCount = getCount('eye_photoreceptor');
    const eyeStalksCount = getCount('eye_stalks');
    const compoundEyeCount = getCount('sense_stalk_compound_eye');
    const biolumProbeCount = getCount('sense_abyssal_biolum_probe');
    const electroPoresCount = getCount('sense_electro_sensor_pores');
    const chemoreceptorCount =
      getCount('chemoreceptor') + getCount('sense_antenna_chemoreceptor');

    this.poisonGlandStacks = Math.max(1, poisonCount);
    this.hasWingsInstalled = wingsCount > 0;
    this.hasChemoreceptorInstalled = chemoreceptorCount > 0;

    if (biolumProbeCount > 0 || eyeStalksCount > 0) {
      this.visionZoomFactor = 1.25;
    } else if (compoundEyeCount > 0 || electroPoresCount > 0) {
      this.visionZoomFactor = 1.15;
    } else if (eyePhotoCount > 0) {
      this.visionZoomFactor = 1.0;
    } else {
      this.visionZoomFactor = 0.78;
    }
    this.cameraZoomMultiplier = this.baseGrowthZoom * this.visionZoomFactor;

    if (!this.hasChemoreceptorInstalled) {
      this.chemoreceptorCompassGroup.visible = false;
    }

    const ciliaCount =
      getCount('cilia_waves') +
      getCount('movement_ribbon_fin') +
      getCount('movement_macro_cilia_skirt');
    const showCilia = ciliaCount > 0;
    for (const c of this.ciliaLeft) {
      c.visible = showCilia;
    }
    for (const c of this.ciliaRight) {
      c.visible = showCilia;
    }
  }

  public setCamouflageActive(active: boolean): void {
    this.isCamouflaged = active;
  }

  public setInvulnerableBlinking(active: boolean): void {
    this.isRespawnInvulnerable = active;
  }

  public applyDamageKnockback(fromPosition: THREE.Vector3, strength = 15): void {
    _knockbackDecay.subVectors(this.position, fromPosition);
    _knockbackDecay.y = 0;
    if (_knockbackDecay.lengthSq() < 0.001) {
      _knockbackDecay.set(0, 0, 1);
    } else {
      _knockbackDecay.normalize();
    }
    this.currentSpeed *= 0.25;
    this.knockbackVelocity.copy(_knockbackDecay).multiplyScalar(strength);
    this.damageFlashTimer = 0.42;
  }

  /**
   * Physical recoil when biting or colliding in melee combat: brakes forward momentum
   * and pushes the cell back ~2.5m-3.5m to prevent overlapping with the target.
   */
  public applyCombatBounce(targetPosition: THREE.Vector3, recoilStrength = 14): void {
    _knockbackDecay.subVectors(this.position, targetPosition);
    _knockbackDecay.y = 0;
    if (_knockbackDecay.lengthSq() < 0.001) {
      _knockbackDecay.set(Math.sin(this.headingAngle), 0, Math.cos(this.headingAngle));
    } else {
      _knockbackDecay.normalize();
    }
    this.currentSpeed *= 0.18;
    this.knockbackVelocity.copy(_knockbackDecay).multiplyScalar(recoilStrength);
  }

  public update(
    delta: number,
    elapsedTime: number,
    input: InputState,
    canBoost: boolean,
    speedMultiplier = 1.0,
    turnMultiplier = 1.0,
    nearbyObstacles: readonly EnvironmentObstacle[] = [],
    steeringMode: SteeringModeSetting = 'keyboard'
  ): { isMoving: boolean; isBoosting: boolean } {
    const safeDelta = Math.min(Math.max(delta, 0.001), 0.05);
    if (this.obstacleBumpCooldown > 0) {
      this.obstacleBumpCooldown = Math.max(
        0,
        this.obstacleBumpCooldown - safeDelta
      );
    }

    this.currentScale = THREE.MathUtils.damp(
      this.currentScale,
      this.targetScale,
      3.5,
      safeDelta
    );
    this.group.scale.setScalar(this.currentScale);
    this.placedOrgansGroup.scale.set(1, 1, 1);

    // 1. Strict Control Mode Exclusivity: 'keyboard' (WASD/Arrows only) vs 'mouse' (Left-Click Point-and-Click only)
    const isKeyboardMode = steeringMode === 'keyboard';
    const isMouseMode = steeringMode === 'mouse';

    const hasKeyboardInput =
      isKeyboardMode &&
      (input.forward || input.backward || input.left || input.right);
    const isMouseNavigating =
      isMouseMode &&
      Boolean(input.isLeftMouseDown) &&
      Boolean(input.hasTargetPosition) &&
      input.targetWorldPosition !== undefined;

    const MOUSE_STOP_RADIUS = 0.8;
    let mouseDistToTarget = 0;

    if (isMouseMode) {
      if (isMouseNavigating && input.targetWorldPosition) {
        const dx = input.targetWorldPosition.x - this.position.x;
        const dz = input.targetWorldPosition.z - this.position.z;
        mouseDistToTarget = Math.hypot(dx, dz);

        if (mouseDistToTarget > MOUSE_STOP_RADIUS) {
          const desiredHeading = Math.atan2(-dx, -dz);
          const angleDiff = Math.atan2(
            Math.sin(desiredHeading - this.headingAngle),
            Math.cos(desiredHeading - this.headingAngle)
          );
          const prevHeading = this.headingAngle;
          const turnDampLambda = Math.max(4.5, 6.8 * turnMultiplier);
          const nextUnwrappedHeading = THREE.MathUtils.damp(
            prevHeading,
            prevHeading + angleDiff,
            turnDampLambda,
            safeDelta
          );
          const stepAngle = nextUnwrappedHeading - prevHeading;
          this.headingAngle = Math.atan2(
            Math.sin(nextUnwrappedHeading),
            Math.cos(nextUnwrappedHeading)
          );
          const instAngVel = THREE.MathUtils.clamp(
            stepAngle / safeDelta,
            -8.5,
            8.5
          );
          this.angularVelocity = THREE.MathUtils.damp(
            this.angularVelocity,
            instAngVel,
            10.0,
            safeDelta
          );
        } else {
          // Inside deadzone (<= 0.8m): prevent erratic spinning on top of the cursor
          this.angularVelocity = THREE.MathUtils.damp(
            this.angularVelocity,
            0,
            GAME_CONFIG.PLAYER.TURN_DAMPING,
            safeDelta
          );
        }
      } else {
        // Mouse mode with left-click released: damp angular velocity to 0 (ignore A/D keys)
        this.angularVelocity = THREE.MathUtils.damp(
          this.angularVelocity,
          0,
          GAME_CONFIG.PLAYER.TURN_DAMPING,
          safeDelta
        );
      }
    } else {
      // Keyboard mode: Manual angular turning exclusively via A / D (or Left / Right arrows)
      let targetTurnRate = 0;
      const effectiveTurnSpeed = GAME_CONFIG.PLAYER.TURN_SPEED * turnMultiplier;
      if (input.left) targetTurnRate += effectiveTurnSpeed;
      if (input.right) targetTurnRate -= effectiveTurnSpeed;

      this.angularVelocity = THREE.MathUtils.damp(
        this.angularVelocity,
        targetTurnRate,
        GAME_CONFIG.PLAYER.TURN_DAMPING,
        safeDelta
      );
      this.headingAngle += this.angularVelocity * safeDelta;
    }

    // 2. Smooth forward/backward thrust (strictly gated by steeringMode) + Space Boost
    const wasBoosting = this.isBoosting;
    this.isBoosting = input.boost && canBoost;
    if (this.isBoosting && !wasBoosting) {
      audioManager.playBoostThrust();
    }
    const isWingGliding =
      this.isLandCreature && this.hasWingsInstalled && this.isBoosting;

    const maxForward = GAME_CONFIG.PLAYER.MAX_FORWARD_SPEED * speedMultiplier;
    const maxReverse = GAME_CONFIG.PLAYER.MAX_REVERSE_SPEED * speedMultiplier;

    let targetSpeed = 0;
    if (isKeyboardMode) {
      if (input.forward) {
        targetSpeed = maxForward;
      } else if (input.backward) {
        targetSpeed = -maxReverse;
      }
    } else if (isMouseNavigating && mouseDistToTarget > MOUSE_STOP_RADIUS) {
      // Smooth arrival taper near the clicked point (between 0.8m and 2.2m) to prevent overshooting
      const arrivalTaper =
        mouseDistToTarget < 2.2
          ? THREE.MathUtils.clamp(
              (mouseDistToTarget - MOUSE_STOP_RADIUS) / 1.4,
              0.25,
              1.0
            )
          : 1.0;
      targetSpeed = maxForward * arrivalTaper;
    }

    if (this.isBoosting) {
      const baseBoostSpeed =
        isKeyboardMode && input.backward ? -maxReverse : maxForward;
      const glideBonus = isWingGliding ? 1.35 : 1.0;
      targetSpeed =
        baseBoostSpeed * GAME_CONFIG.PLAYER.BOOST_MULTIPLIER * glideBonus;
    }

    const dampingLambda =
      Math.abs(targetSpeed) > 0.01
        ? GAME_CONFIG.PLAYER.ACCELERATION_DAMPING
        : GAME_CONFIG.PLAYER.WATER_DRAG_DAMPING;

    this.currentSpeed = THREE.MathUtils.damp(
      this.currentSpeed,
      targetSpeed,
      dampingLambda,
      safeDelta
    );

    // 3. Apply forward velocity + decaying knockback velocity
    _forwardDir.set(-Math.sin(this.headingAngle), 0, -Math.cos(this.headingAngle));
    this.position.addScaledVector(_forwardDir, this.currentSpeed * safeDelta);

    if (this.knockbackVelocity.lengthSq() > 0.01) {
      this.position.addScaledVector(this.knockbackVelocity, safeDelta);
      this.knockbackVelocity.x = THREE.MathUtils.damp(
        this.knockbackVelocity.x,
        0,
        5.2,
        safeDelta
      );
      this.knockbackVelocity.z = THREE.MathUtils.damp(
        this.knockbackVelocity.z,
        0,
        5.2,
        safeDelta
      );
    }

    // 3B. Solid Environment Obstacle Slide Collisions (Rocks, Chloroplast Tree Trunks, Hydrothermal Vents & Reefs)
    if (
      nearbyObstacles.length > 0 &&
      !(this.isLandCreature && this.heightOffset > 2.2)
    ) {
      const cellRadius =
        GAME_CONFIG.PLAYER.COLLISION_RADIUS *
        (0.76 + 0.24 * this.currentScale);
      const py = this.position.y;

      for (let i = 0; i < nearbyObstacles.length; i++) {
        const o = nearbyObstacles[i];

        // 3D Height Check (Y axis): cell only collides if within the obstacle's physical vertical span
        if (py < o.minY - 0.4 || py > o.maxY + 0.4) {
          continue;
        }

        const dx = this.position.x - o.x;
        const dz = this.position.z - o.z;
        const distSq = dx * dx + dz * dz;
        const minDist = cellRadius + o.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const nx = dist > 0.0001 ? dx / dist : 1;
          const nz = dist > 0.0001 ? dz / dist : 0;

          // Push cell position outward along the obstacle normal
          this.position.x = o.x + nx * minDist;
          this.position.z = o.z + nz * minDist;

          // Compute current velocity vector in XZ and project onto the obstacle tangent for smooth sliding
          const vx =
            -Math.sin(this.headingAngle) * this.currentSpeed +
            this.knockbackVelocity.x;
          const vz =
            -Math.cos(this.headingAngle) * this.currentSpeed +
            this.knockbackVelocity.z;
          const vNormal = vx * nx + vz * nz;

          if (vNormal < 0) {
            // High-speed impact feedback when boosting or ramming into a rock/trunk
            const impactSpeed = -vNormal;
            if (
              this.obstacleBumpCooldown <= 0 &&
              (impactSpeed > 8.5 || (this.isBoosting && impactSpeed > 5.2))
            ) {
              const atten = THREE.MathUtils.clamp(impactSpeed / 24.0, 0.25, 0.55);
              audioManager.playShieldDeflect(atten);
              this.obstacleBumpCooldown = 0.36;
            }

            // Tangential velocity vector along the obstacle contour
            const tx = vx - vNormal * nx;
            const tz = vz - vNormal * nz;
            const tangentSpeed = Math.hypot(tx, tz);

            // Project knockback onto tangent
            const kbNormal =
              this.knockbackVelocity.x * nx + this.knockbackVelocity.z * nz;
            if (kbNormal < 0) {
              this.knockbackVelocity.x -= kbNormal * nx;
              this.knockbackVelocity.z -= kbNormal * nz;
            }

            // Preserve tangential glide momentum without altering headingAngle
            const signSpeed = this.currentSpeed >= 0 ? 1 : -1;
            this.currentSpeed =
              signSpeed *
              Math.min(Math.abs(this.currentSpeed), tangentSpeed * 0.94);
          }
        }
      }
    }

    // 4. Soft arena boundary containment (expands progressively across the 5 cellular growth stages)
    const distSq =
      this.position.x * this.position.x + this.position.z * this.position.z;
    const stageMaxR = this.isLandCreature
      ? GAME_CONFIG.WORLD.ARENA_RADIUS
      : Math.min(GAME_CONFIG.WORLD.ARENA_RADIUS, this.activeArenaRadius);
    const maxRadius = stageMaxR - 2.0;
    if (distSq > maxRadius * maxRadius) {
      const dist = Math.sqrt(distSq);
      this.position.x = (this.position.x / dist) * maxRadius;
      this.position.z = (this.position.z / dist) * maxRadius;
      this.currentSpeed *= 0.75;
    }

    const speedRatio = Math.min(
      Math.abs(this.currentSpeed) / GAME_CONFIG.PLAYER.MAX_FORWARD_SPEED,
      1.5
    );
    const swimFreq = Math.min(
      17.5,
      5.0 + speedRatio * 7.2 + (this.isBoosting ? 4.0 : 0)
    );
    this.flagellumPhase = (this.flagellumPhase + safeDelta * swimFreq) % (Math.PI * 200);

    if (this.isLandCreature) {
      const targetHeight = isWingGliding ? 3.8 : 0.0;
      const heightLambda = isWingGliding ? 4.2 : 3.4;
      this.heightOffset = THREE.MathUtils.damp(
        this.heightOffset,
        targetHeight,
        heightLambda,
        safeDelta
      );

      if (!this.hasCustomLegsInstalled && this.heightOffset <= 0.45) {
        // Legless Terrestrial Creature ("Modo Babosa"): peristaltic wave locomotion on land
        const crawlWave = Math.sin(this.flagellumPhase * 0.85);
        const crawlAmp = 0.04 + Math.min(0.1, speedRatio * 0.08);
        this.membraneMesh.scale.set(
          1.0 - crawlWave * crawlAmp * 0.7,
          1.0 + Math.cos(this.flagellumPhase * 0.85) * crawlAmp * 0.5,
          1.0 + crawlWave * crawlAmp
        );
        const crawlBounce = Math.abs(crawlWave) * 0.09 * Math.min(1, speedRatio * 1.4);
        this.position.y = 0.0 + this.heightOffset + crawlBounce;
      } else {
        this.membraneMesh.scale.set(1, 1, 1);
        const strideBounce =
          this.heightOffset > 0.45
            ? Math.sin(elapsedTime * 5.5) * 0.14
            : Math.abs(Math.sin(this.flagellumPhase * 0.9)) *
              0.22 *
              Math.min(1, speedRatio * 1.4);

        this.position.y = 0.0 + this.heightOffset + strideBounce;
      }
      this.haloMesh.position.y =
        -0.95 - this.heightOffset / Math.max(0.5, this.currentScale);
    } else {
      this.membraneMesh.scale.set(1, 1, 1);
      this.heightOffset = 0;
      this.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y + Math.sin(elapsedTime * 2.4) * 0.16;
      this.haloMesh.position.y = -0.95;
    }
    const effectiveY = this.getEffectiveGroundY();
    this.membraneMesh.position.set(0, effectiveY, 0);
    this.placedOrgansGroup.position.set(0, effectiveY, 0);

    const bankAngle = THREE.MathUtils.clamp(
      -this.angularVelocity * 0.12,
      -0.28,
      0.28
    );
    const glidePitch =
      this.heightOffset > 0.25
        ? isWingGliding
          ? 0.12
          : -0.08
        : !this.hasCustomLegsInstalled && this.isLandCreature
        ? Math.cos(this.flagellumPhase * 0.85) * 0.045 * Math.min(1, speedRatio * 1.4)
        : 0;
    this.group.rotation.set(glidePitch, this.headingAngle, bankAngle);

    // 6. Animate all placed 3D organs
    for (const entry of this.activePlacedOrgans) {
      entry.primary.animate(elapsedTime, speedRatio, this.isBoosting);
      entry.mirror?.animate(elapsedTime, speedRatio, this.isBoosting);
    }

    // 6B. Quadruped Amphibian Gait Cycle
    if (this.evoAmphibianLegsGroup.visible && this.amphibianLegs.length === 4) {
      const strideAmp =
        this.heightOffset > 0.6
          ? 0.22
          : 0.12 + Math.min(0.55, speedRatio * 0.42);
      const strideWave = Math.sin(this.flagellumPhase * 0.9) * strideAmp;
      this.amphibianLegs[0].rotation.x = THREE.MathUtils.damp(
        this.amphibianLegs[0].rotation.x,
        strideWave,
        15.0,
        safeDelta
      );
      this.amphibianLegs[1].rotation.x = THREE.MathUtils.damp(
        this.amphibianLegs[1].rotation.x,
        -strideWave,
        15.0,
        safeDelta
      );
      this.amphibianLegs[2].rotation.x = THREE.MathUtils.damp(
        this.amphibianLegs[2].rotation.x,
        -strideWave,
        15.0,
        safeDelta
      );
      this.amphibianLegs[3].rotation.x = THREE.MathUtils.damp(
        this.amphibianLegs[3].rotation.x,
        strideWave,
        15.0,
        safeDelta
      );
    }

    for (let i = 0; i < this.ciliaLeft.length; i++) {
      const flutter = Math.sin(this.flagellumPhase * 1.1 + i) * 0.24;
      this.ciliaLeft[i].rotation.y = THREE.MathUtils.damp(
        this.ciliaLeft[i].rotation.y,
        0.35 + flutter,
        16.0,
        safeDelta
      );
      this.ciliaRight[i].rotation.y = THREE.MathUtils.damp(
        this.ciliaRight[i].rotation.y,
        -0.35 - flutter,
        16.0,
        safeDelta
      );
    }

    // 7. Update Pooled Poison Clouds
    for (let i = 0; i < this.poisonCloudPool.length; i++) {
      const cloud = this.poisonCloudPool[i];
      if (!cloud.active) continue;

      cloud.life -= delta;
      if (cloud.life <= 0) {
        cloud.active = false;
        cloud.mesh.visible = false;
        continue;
      }

      const progress = 1 - cloud.life / cloud.maxLife;
      const currentScale = (0.85 + progress * 1.65) * this.currentScale;
      cloud.radius = currentScale * 1.05;
      cloud.mesh.scale.set(currentScale, currentScale * 0.55, currentScale);
      cloud.mesh.rotation.y += delta * 0.8;
      cloud.mat.opacity = (1 - progress) * 0.45;
    }

    // 7B. Update Pooled 3D Acid Spit Projectiles
    for (let i = 0; i < this.acidProjectilePool.length; i++) {
      const proj = this.acidProjectilePool[i];
      if (!proj.active) continue;

      proj.life -= delta;
      if (proj.life <= 0) {
        proj.active = false;
        proj.mesh.visible = false;
        continue;
      }

      proj.position.addScaledVector(proj.velocity, delta);
      proj.mesh.rotation.y += delta * 12.0;
      proj.mesh.rotation.x += delta * 9.0;
    }

    // 8. Update Bioelectric Shockwave Pulse (expands to 9.5m)
    if (this.electricPulseTimer > 0) {
      this.electricPulseTimer = Math.max(0, this.electricPulseTimer - delta);
      const t = 1 - this.electricPulseTimer / this.electricPulseDuration;
      const currentRadius = 1.2 + t * 8.3;
      this.electricWaveMesh.position.x = this.position.x;
      this.electricWaveMesh.position.z = this.position.z;
      this.electricWaveMesh.scale.setScalar(currentRadius);
      this.electricWaveMat.opacity = (1 - t) * 0.85;

      this.electricDomeMesh.position.copy(this.position);
      this.electricDomeMesh.scale.setScalar(currentRadius);
      this.electricDomeMesh.rotation.y += delta * 8.0;
      this.electricDomeMat.opacity = (1 - t) * 0.55;

      if (this.electricPulseTimer <= 0) {
        this.electricWaveMesh.visible = false;
        this.electricDomeMesh.visible = false;
      }
    }

    // 8A-2. Update Socialize Harmonic Wave Ring
    if (this.socialWaveTimer > 0) {
      this.socialWaveTimer = Math.max(0, this.socialWaveTimer - delta);
      const t = 1 - this.socialWaveTimer / 0.65;
      const radius = 1.1 + t * (this.socialWaveMaxRadius - 1.1);
      this.socialWaveMesh.position.x = this.position.x;
      this.socialWaveMesh.position.z = this.position.z;
      this.socialWaveMesh.scale.setScalar(radius);
      this.socialWaveMat.opacity = (1 - t) * 0.85;
      if (this.socialWaveTimer <= 0) {
        this.socialWaveMesh.visible = false;
      }
    }

    // 8B. Update Mating Call Acoustic Waves & Partner Cell Approach
    if (this.matingCallActive) {
      this.matingCallElapsed = Math.min(
        this.matingCallDuration,
        this.matingCallElapsed + delta
      );
      const progress = this.matingCallElapsed / this.matingCallDuration;

      for (let r = 0; r < this.matingRingMeshes.length; r++) {
        const ringProgress = (progress + r * 0.45) % 1.0;
        const ringScale = (1.1 + ringProgress * 7.5) * this.currentScale;
        const ring = this.matingRingMeshes[r];
        ring.position.set(
          this.position.x,
          GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.12,
          this.position.z
        );
        ring.scale.setScalar(ringScale);
        this.matingRingMats[r].opacity = (1 - ringProgress) * 0.85;
      }

      const targetOffsetDist = 2.4 * this.currentScale;
      const targetX =
        this.position.x + Math.cos(this.headingAngle) * targetOffsetDist;
      const targetZ =
        this.position.z - Math.sin(this.headingAngle) * targetOffsetDist;

      const smoothT = 1 - Math.pow(1 - progress, 2.4);
      this.mateCellGroup.position.x = THREE.MathUtils.lerp(
        this.mateStartPos.x,
        targetX,
        smoothT
      );
      this.mateCellGroup.position.z = THREE.MathUtils.lerp(
        this.mateStartPos.z,
        targetZ,
        smoothT
      );
      this.mateCellGroup.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y + Math.sin(elapsedTime * 5.0) * 0.14;

      const dxToPlayer = this.position.x - this.mateCellGroup.position.x;
      const dzToPlayer = this.position.z - this.mateCellGroup.position.z;
      this.mateCellGroup.rotation.set(
        0,
        Math.atan2(-dxToPlayer, -dzToPlayer),
        0
      );
      this.mateCellGroup.scale.setScalar(this.currentScale * 0.94);

      for (let t = 0; t < this.mateTailSegments.length; t++) {
        this.mateTailSegments[t].position.x =
          Math.sin(elapsedTime * 18.0 - t * 0.9) * 0.18;
      }
    }

    const pulse = 1.0 + Math.sin(elapsedTime * 4.2) * 0.07;
    this.nucleusMesh.scale.setScalar(pulse);

    const palette = COLOR_THEMES[this.colorTheme] ?? COLOR_THEMES.cyan;

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - delta);
      this.membraneMat.color.setHex(0xf43f5e);
      this.membraneMat.emissive.setHex(0xe11d48);
      this.membraneMat.emissiveIntensity = 0.9;
    } else if (this.isRespawnInvulnerable) {
      const blinkOn = Math.sin(elapsedTime * 28.0) > 0;
      this.membraneMat.color.setHex(blinkOn ? 0xffffff : palette.membraneColor);
      this.membraneMat.emissive.setHex(blinkOn ? 0x38bdf8 : palette.membraneEmissive);
      this.membraneMat.emissiveIntensity = blinkOn ? 1.1 : 0.2;
      this.boostHaloMat.opacity = blinkOn ? 0.85 : 0.15;
      this.boostHaloMat.color.setHex(0x38bdf8);
    } else if (this.matingCallActive) {
      this.membraneMat.color.setHex(0xf472b6);
      this.membraneMat.emissive.setHex(0xec4899);
      this.membraneMat.emissiveIntensity = 0.7;
      this.boostHaloMat.opacity = 0.75;
      this.boostHaloMat.color.setHex(0xf472b6);
    } else if (this.isBoosting) {
      this.membraneMat.color.setHex(palette.boostColor);
      this.membraneMat.emissive.setHex(palette.membraneColor);
      this.membraneMat.emissiveIntensity = 0.65;
      this.boostHaloMat.opacity = 0.65;
      this.boostHaloMat.color.setHex(palette.boostColor);
    } else {
      if (this.customPaintActive && this.membraneMat.map) {
        this.membraneMat.color.setHex(0xffffff);
        this.membraneMat.emissive.set(this.paintConfig.baseColor).multiplyScalar(0.32);
      } else {
        this.membraneMat.color.setHex(palette.membraneColor);
        this.membraneMat.emissive.setHex(palette.membraneEmissive);
      }
      this.membraneMat.emissiveIntensity = this.isCamouflaged ? 0.08 : 0.25;
      this.boostHaloMat.opacity = this.isCamouflaged ? 0.06 : 0.26;
      this.boostHaloMat.color.setHex(palette.membraneColor);
    }
    this.membraneMat.opacity = this.isRespawnInvulnerable
      ? Math.sin(elapsedTime * 28.0) > 0
        ? 0.95
        : 0.32
      : this.isCamouflaged
      ? 0.22
      : 0.88;

    const isMoving =
      hasKeyboardInput ||
      isMouseNavigating ||
      Math.abs(this.currentSpeed) > 0.6;

    return {
      isMoving,
      isBoosting: this.isBoosting,
    };
  }

  public reset(): void {
    this.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    this.headingAngle = 0;
    this.currentSpeed = 0;
    this.angularVelocity = 0;
    this.isBoosting = false;
    this.heightOffset = 0;
    this.currentScale = 1.0;
    this.targetScale = 1.0;
    this.cameraZoomMultiplier = 1.0;
    this.activeArenaRadius = 110;
    this.group.scale.setScalar(1.0);
    this.knockbackVelocity.set(0, 0, 0);
    this.damageFlashTimer = 0;
    this.isRespawnInvulnerable = false;
    this.group.rotation.set(0, 0, 0);
    this.haloMesh.position.y = -0.95;
    this.setEditorMode(false);
    this.spineSegments = 1;
    this.spineLength = 1.0;
    this.torsoRadii = [1.0, 1.0, 1.0];
    this.spineNodes = createDefaultSpineNodes(5, 1.0);
    this.customPaintActive = false;
    this.groundClearanceY = 0;
    this.bodyGroundOffsetY = 0;
    this.editorSelectionTarget = 'body';
    this.paintConfig = { ...DEFAULT_CREATURE_PAINT };
    this.creatureMorphology = { ...DEFAULT_CREATURE_MORPHOLOGY };
    this.bodySegments = createDefaultBodySegments();
    this.applyMorphology(
      'fusiforme',
      'cyan',
      false,
      1,
      1.0,
      [1.0, 1.0, 1.0],
      this.spineNodes,
      this.paintConfig,
      this.bodySegments,
      this.creatureMorphology
    );

    for (const cloud of this.poisonCloudPool) {
      cloud.active = false;
      cloud.life = 0;
      cloud.mesh.visible = false;
    }
    for (const proj of this.acidProjectilePool) {
      proj.active = false;
      proj.life = 0;
      proj.mesh.visible = false;
    }
    this.electricPulseTimer = 0;
    this.electricWaveMesh.visible = false;
    this.electricDomeMesh.visible = false;
    this.socialWaveTimer = 0;
    this.socialWaveMesh.visible = false;
    for (const c of this.ciliaLeft) {
      c.visible = false;
    }
    for (const c of this.ciliaRight) {
      c.visible = false;
    }
    this.hideMateCell();
  }

  public dispose(): void {
    for (const entry of this.activePlacedOrgans) {
      entry.primary.dispose();
      entry.mirror?.dispose();
    }
    this.dragPreviewPrimary?.dispose();
    this.dragPreviewMirror?.dispose();
    for (const geo of this.disposableGeometries) {
      geo.dispose();
    }
    for (const mat of this.disposableMaterials) {
      mat.dispose();
    }
  }
}
