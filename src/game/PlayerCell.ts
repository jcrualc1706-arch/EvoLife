import * as THREE from 'three';
import { audioManager } from './AudioManager';
import { GAME_CONFIG } from './config';
import { normalizeAdaptationId } from './evolutionData';
import { createOrganVisual, OrganVisualInstance } from './OrganFactory3D';
import {
  AcidSpitProjectile,
  CellBodyShape,
  CellColorTheme,
  CellularGrowthStage,
  InputState,
  PlacedOrganInstance,
  PoisonCloudHazard,
} from './types';

const _forwardDir = new THREE.Vector3();
const _knockbackDecay = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _localPoint = new THREE.Vector3();
const _worldNozzlePos = new THREE.Vector3();

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
  public activeArenaRadius = 90;

  private bodyShape: CellBodyShape = 'fusiforme';
  private colorTheme: CellColorTheme = 'cyan';
  private spineSegments: 1 | 2 | 3 = 1;
  private spineLength = 1.0;
  private torsoRadii: [number, number, number] = [1.0, 1.0, 1.0];
  private isLandCreature = false;
  private isEditingMode = false;
  private isRespawnInvulnerable = false;

  private readonly knockbackVelocity = new THREE.Vector3();
  private membraneMesh!: THREE.Mesh;
  private baseMembranePositions!: Float32Array;
  private nucleusMesh!: THREE.Mesh;
  private haloMesh!: THREE.Mesh;
  private membraneMat!: THREE.MeshPhysicalMaterial;
  private nucleusMat!: THREE.MeshStandardMaterial;
  private boostHaloMat!: THREE.MeshBasicMaterial;
  private legMat!: THREE.MeshStandardMaterial;
  private ciliaLeft: THREE.Mesh[] = [];
  private ciliaRight: THREE.Mesh[] = [];
  private readonly spineVertebraeMeshes: THREE.Mesh[] = [];
  private readonly spineVertebraeMats: THREE.MeshStandardMaterial[] = [];
  private hoveredVertebraIndex: number | null = null;

  // Dynamic Placed 3D Organs (Spore Workshop Drag & Drop)
  private placedOrgansGroup!: THREE.Group;
  private readonly activePlacedOrgans: ActivePlacedOrganEntry[] = [];
  private currentPlacedData: PlacedOrganInstance[] = [];
  private selectedInstanceId: string | null = null;

  // 3D Ghost Preview during Catalog / Organ Drag & Drop
  private dragPreviewGroup!: THREE.Group;
  private dragPreviewId: string | null = null;
  private dragPreviewPrimary: OrganVisualInstance | null = null;
  private dragPreviewMirror: OrganVisualInstance | null = null;

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
  private hasWingsInstalled = false;
  private hasChemoreceptorInstalled = false;

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

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    this.position = this.group.position;

    this.buildProceduralCell();
    this.buildEditorWorkshopVisuals();
    this.initCombatEffectsPool(scene);
    scene.add(this.group);
  }

  private buildProceduralCell(): void {
    // 1. Primary Silhouette: Sculptable translucent cytoplasmic membrane
    const membraneGeo = new THREE.CapsuleGeometry(0.95, 0.9, 24, 32);
    membraneGeo.rotateX(Math.PI / 2);
    const posAttr = membraneGeo.attributes.position as THREE.BufferAttribute;
    this.baseMembranePositions = new Float32Array(posAttr.array.length);
    this.baseMembranePositions.set(posAttr.array);

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
    this.membraneMesh = new THREE.Mesh(membraneGeo, this.membraneMat);
    this.membraneMesh.castShadow = true;
    this.membraneMesh.receiveShadow = true;
    this.membraneMesh.renderOrder = 2;
    this.group.add(this.membraneMesh);

    // 2. Glowing inner nucleus core
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
    this.group.add(this.nucleusMesh);

    // Internal Spine Vertebrae segments (directly interactive in 3D Editor via Raycaster + Wheel)
    const vertebraGeo = new THREE.DodecahedronGeometry(0.21, 1);
    vertebraGeo.scale(1.15, 0.62, 1.18);
    const vertebraHitGeo = new THREE.SphereGeometry(0.36, 8, 8);
    const vertebraHitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.disposableGeometries.push(vertebraHitGeo);
    this.disposableMaterials.push(vertebraHitMat);

    for (let v = 0; v < 5; v++) {
      const vMat = new THREE.MeshStandardMaterial({
        color: 0xa7f3d0,
        emissive: 0x10b981,
        emissiveIntensity: 0.95,
        roughness: 0.38,
        metalness: 0.2,
      });
      this.disposableMaterials.push(vMat);
      this.spineVertebraeMats.push(vMat);

      const segIdx: 0 | 1 | 2 = v <= 1 ? 0 : v === 2 ? 1 : 2;
      const vMesh = new THREE.Mesh(vertebraGeo, vMat);
      vMesh.position.set(0, 0.24, -0.68 + v * 0.34);
      vMesh.userData.vertebraIndex = v;
      vMesh.userData.spineSegmentIndex = segIdx;
      vMesh.visible = true;

      const vHit = new THREE.Mesh(vertebraHitGeo, vertebraHitMat);
      vHit.userData.vertebraIndex = v;
      vHit.userData.spineSegmentIndex = segIdx;
      vMesh.add(vHit);

      this.group.add(vMesh);
      this.spineVertebraeMeshes.push(vMesh);
    }

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
    this.group.add(orgLeft);

    const orgRight = new THREE.Mesh(organelleGeo, organelleMat);
    orgRight.position.set(0.38, -0.08, -0.12);
    orgRight.rotation.set(-0.3, -0.4, 0.3);
    this.group.add(orgRight);

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
      this.group.add(leftFin);
      this.ciliaLeft.push(leftFin);

      const rightFin = new THREE.Mesh(ciliaGeo, ciliaMat);
      rightFin.position.set(0.98, 0, zPos);
      rightFin.rotation.z = Math.PI;
      rightFin.rotation.y = -0.35;
      this.group.add(rightFin);
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
      membraneGeo,
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
    const [rFront, rMid, rRear] = this.torsoRadii;
    if (u < 0) {
      const t = -u;
      return THREE.MathUtils.lerp(rMid, rFront, t * (2 - t));
    }
    const t = u;
    return THREE.MathUtils.lerp(rMid, rRear, t * (2 - t));
  }

  /**
   * Deforms the cell membrane vertex buffer smoothly based on spineLength, torsoRadii, and bodyShape,
   * and repositions all attached 3D organs and spine handles.
   */
  private updateSculptedMembraneGeometry(): void {
    const geo = this.membraneMesh.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const base = this.baseMembranePositions;
    const { sx, sy, sz } = this.getBodyShapeFactors();
    const totalZScale = this.spineLength * sz;

    for (let i = 0; i < arr.length; i += 3) {
      const x0 = base[i];
      const y0 = base[i + 1];
      const z0 = base[i + 2];

      const u = THREE.MathUtils.clamp(z0 / 1.4, -1, 1);
      const rMult = this.getInterpolatedTorsoRadius(u);

      arr[i] = x0 * rMult * sx;
      arr[i + 1] = y0 * (0.72 + 0.28 * rMult) * sy;
      arr[i + 2] = z0 * totalZScale;
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    // Update internal spine vertebrae & front/rear stretch arrows
    const halfLengthZ = 1.4 * totalZScale;
    const vertebraPositionsU = [-0.62, -0.31, 0.0, 0.31, 0.62];
    for (let v = 0; v < this.spineVertebraeMeshes.length; v++) {
      const vMesh = this.spineVertebraeMeshes[v];
      if (!vMesh) continue;
      const u = vertebraPositionsU[v] ?? 0;
      const rLocal = this.getInterpolatedTorsoRadius(u);
      vMesh.position.set(0, 0.24 * sy, u * halfLengthZ);
      const isHov = this.isEditingMode && this.hoveredVertebraIndex === v;
      const hovScale = isHov ? 1.24 : 1.0;
      vMesh.scale.set(
        (0.82 + 0.22 * rLocal) * hovScale,
        hovScale,
        hovScale
      );
    }

    if (this.editorFrontArrowGroup && this.editorRearArrowGroup) {
      this.editorFrontArrowGroup.position.set(0, 0.05, -halfLengthZ - 0.58);
      this.editorRearArrowGroup.position.set(0, 0.05, halfLengthZ + 0.58);
    }

    // Reposition lateral micro-cilia and amphibian legs proportionally
    for (let i = 0; i < this.ciliaLeft.length; i++) {
      const u = i === 0 ? -0.25 : 0.25;
      const rMid = this.getInterpolatedTorsoRadius(u) * sx;
      const zPos = u * halfLengthZ;
      this.ciliaLeft[i].position.set(-0.98 * rMid, 0, zPos);
      this.ciliaRight[i].position.set(0.98 * rMid, 0, zPos);
    }

    if (this.amphibianLegs.length === 4) {
      const rFront = this.getInterpolatedTorsoRadius(-0.45) * sx;
      const rRear = this.getInterpolatedTorsoRadius(0.45) * sx;
      this.amphibianLegs[0].position.set(-0.82 * rFront, -0.22, -0.45 * halfLengthZ);
      this.amphibianLegs[1].position.set(0.82 * rFront, -0.22, -0.45 * halfLengthZ);
      this.amphibianLegs[2].position.set(-0.86 * rRear, -0.22, 0.45 * halfLengthZ);
      this.amphibianLegs[3].position.set(0.86 * rRear, -0.22, 0.45 * halfLengthZ);
    }

    // Reposition all placed 3D organs to stay flush on the sculpted membrane contour
    this.repositionAllPlacedOrgans();
  }

  /**
   * Computes the exact 3D membrane attachment position and outward normal angle for a given contour angle.
   */
  public getMembraneAttachmentTransform(
    angle: number,
    adaptationId?: string
  ): { x: number; y: number; z: number; normalAngle: number } {
    const { sx, sy, sz } = this.getBodyShapeFactors();
    const halfLengthZ = 1.38 * this.spineLength * sz;
    const u = Math.cos(angle);
    const rMult = this.getInterpolatedTorsoRadius(u);
    const radiusX = 0.94 * rMult * sx;

    const normId = adaptationId ? normalizeAdaptationId(adaptationId) : '';
    const isDorsalOrgan =
      normId === 'membrane_armor' ||
      normId === 'chloroplast_1' ||
      normId === 'neutralizer_vesicle' ||
      normId === 'defense_hydrothermal_carapace' ||
      normId === 'defense_camouflage_chromatophores' ||
      normId === 'movement_pneumatic_vesicle' ||
      normId === 'vocal_crest' ||
      normId === 'wings_1';

    const surfaceFactor = isDorsalOrgan ? 0.55 : 0.96;
    const x = Math.sin(angle) * radiusX * surfaceFactor;
    const z = Math.cos(angle) * halfLengthZ * (isDorsalOrgan ? 0.65 : 0.97);
    const y = isDorsalOrgan
      ? 0.58 * (0.72 + 0.28 * rMult) * sy
      : normId === 'eye_photoreceptor' ||
        normId === 'eye_stalks' ||
        normId === 'sense_stalk_compound_eye' ||
        normId === 'sense_abyssal_biolum_probe'
      ? 0.24 * sy
      : 0.02;

    const normalAngle = Math.atan2(
      Math.sin(angle) / Math.max(0.25, radiusX),
      Math.cos(angle) / Math.max(0.25, halfLengthZ)
    );

    return { x, y, z, normalAngle };
  }

  private repositionAllPlacedOrgans(): void {
    for (const entry of this.activePlacedOrgans) {
      const { instance, primary, mirror } = entry;
      const yaw = instance.orientationYaw ?? instance.localYaw ?? 0;
      const pitch = instance.orientationPitch ?? instance.localPitch ?? 0;
      const morph = instance.morphology;
      const scaleOverall = THREE.MathUtils.clamp(
        morph?.scaleOverall ?? 1.0,
        0.5,
        2.2
      );
      const scaleWidth = THREE.MathUtils.clamp(
        morph?.scaleWidth ?? 1.0,
        0.5,
        2.0
      );
      const scaleHeight = THREE.MathUtils.clamp(
        morph?.scaleHeight ?? 1.0,
        0.5,
        2.5
      );
      const sx = scaleOverall * scaleWidth;
      const sy = scaleOverall * scaleWidth;
      const sz = scaleOverall * scaleHeight;

      const tPrimary = this.getMembraneAttachmentTransform(
        instance.angle,
        instance.adaptationId
      );
      primary.group.position.set(tPrimary.x, tPrimary.y, tPrimary.z);
      primary.group.rotation.order = 'YXZ';
      primary.group.rotation.set(pitch, tPrimary.normalAngle + yaw, 0);
      primary.group.scale.set(sx, sy, sz);
      primary.setColorOverride(morph?.colorOverride);

      if (mirror) {
        const mirrorAngle = -instance.angle;
        const tMirror = this.getMembraneAttachmentTransform(
          mirrorAngle,
          instance.adaptationId
        );
        mirror.group.position.set(tMirror.x, tMirror.y, tMirror.z);
        mirror.group.rotation.order = 'YXZ';
        // Mirror symmetry: negate yaw so the opposite twin rotates symmetrically!
        mirror.group.rotation.set(pitch, tMirror.normalAngle - yaw, 0);
        mirror.group.scale.set(sx, sy, sz);
        mirror.setColorOverride(morph?.colorOverride);
      }
    }
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

    this.editorOrientationGizmoGroup.visible = true;
    this.editorOrientationGizmoGroup.position.copy(
      selectedEntry.primary.group.position
    );
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
    selectedInstanceId: string | null = null
  ): void {
    this.selectedInstanceId = selectedInstanceId;

    // Check if the list of instances or angles changed
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
        this.placedOrgansGroup.remove(entry.primary.group);
        entry.primary.dispose();
        if (entry.mirror) {
          this.placedOrgansGroup.remove(entry.mirror.group);
          entry.mirror.dispose();
        }
      }
      this.activePlacedOrgans.length = 0;

      for (const inst of placedOrgans) {
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
            morphology: { ...(inst.morphology ?? { scaleOverall: 1, scaleWidth: 1, scaleHeight: 1 }) },
          },
          primary,
          mirror,
        });
      }
    } else {
      for (let i = 0; i < placedOrgans.length; i++) {
        this.activePlacedOrgans[i].instance = {
          ...placedOrgans[i],
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
    this.repositionAllPlacedOrgans();

    for (const entry of this.activePlacedOrgans) {
      const isSel =
        this.isEditingMode &&
        this.selectedInstanceId !== null &&
        entry.instance.instanceId === this.selectedInstanceId;
      entry.primary.setHighlight(isSel ? 'selected' : 'none');
      entry.mirror?.setHighlight(isSel ? 'selected' : 'none');
    }
  }

  /**
   * Updates the 3D Ghost Preview organ shown while dragging a piece over the cell in the Editor.
   */
  public setDragPreview(
    adaptationId: string | null,
    angle: number,
    mirrorSymmetry: boolean,
    isValid: boolean
  ): void {
    if (!adaptationId) {
      this.dragPreviewGroup.visible = false;
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
    }

    this.dragPreviewGroup.visible = true;
    const mode = isValid ? 'preview_valid' : 'preview_invalid';

    if (this.dragPreviewPrimary) {
      const t = this.getMembraneAttachmentTransform(angle, normId);
      this.dragPreviewPrimary.group.position.set(t.x, t.y, t.z);
      this.dragPreviewPrimary.group.rotation.y = t.normalAngle;
      this.dragPreviewPrimary.setHighlight(mode);
    }

    if (this.dragPreviewMirror) {
      const showMirror = mirrorSymmetry && Math.abs(Math.sin(angle)) > 0.16;
      this.dragPreviewMirror.group.visible = showMirror;
      if (showMirror) {
        const tm = this.getMembraneAttachmentTransform(-angle, normId);
        this.dragPreviewMirror.group.position.set(tm.x, tm.y, tm.z);
        this.dragPreviewMirror.group.rotation.y = tm.normalAngle;
        this.dragPreviewMirror.setHighlight(mode);
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

    return {
      angle,
      axialOffset,
      mirrorSymmetry,
      normalizedRadiusDistance,
    };
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
    this.editorSpineOverlayGroup.visible = isEditing;
    if (!isEditing) {
      this.hoveredVertebraIndex = null;
      this.dragPreviewGroup.visible = false;
      this.editorOrientationGizmoGroup.visible = false;
      for (const entry of this.activePlacedOrgans) {
        entry.primary.setHighlight('none');
        entry.mirror?.setHighlight('none');
      }
    } else {
      for (const entry of this.activePlacedOrgans) {
        const isSel =
          this.selectedInstanceId !== null &&
          entry.instance.instanceId === this.selectedInstanceId;
        entry.primary.setHighlight(isSel ? 'selected' : 'none');
        entry.mirror?.setHighlight(isSel ? 'selected' : 'none');
      }
      this.updateOrientationGizmoTransform();
    }
    this.refreshVertebraMaterials();
  }

  public getEditorArrowObjects(): THREE.Object3D[] {
    return [this.editorFrontArrowGroup, this.editorRearArrowGroup];
  }

  public getVertebraObjects(): THREE.Object3D[] {
    return this.spineVertebraeMeshes;
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

  public applyMorphology(
    bodyShape: CellBodyShape,
    colorTheme: CellColorTheme,
    isLandCreature: boolean,
    spineSegments: 1 | 2 | 3 = this.spineSegments,
    spineLength: number = this.spineLength,
    torsoRadii: [number, number, number] = this.torsoRadii
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

    this.updateSculptedMembraneGeometry();

    // Keep internal vertebrae visible inside the cell so the dorsal spine column is always discernible and interactive
    for (let v = 0; v < this.spineVertebraeMeshes.length; v++) {
      this.spineVertebraeMeshes[v].visible = true;
    }

    // Toggle 4 Amphibious Legs for Creature Stage
    this.evoAmphibianLegsGroup.visible = isLandCreature;
    if (!isLandCreature) {
      this.heightOffset = 0;
    }

    // Apply Bioluminescent Color Theme Palette
    const palette = COLOR_THEMES[colorTheme] ?? COLOR_THEMES.cyan;
    this.membraneMat.color.setHex(palette.membraneColor);
    this.membraneMat.emissive.setHex(palette.membraneEmissive);
    this.nucleusMat.color.setHex(palette.nucleusColor);
    this.nucleusMat.emissive.setHex(palette.nucleusEmissive);
    this.boostHaloMat.color.setHex(palette.membraneColor);
    this.legMat.color.setHex(palette.legColor);
    this.legMat.emissive.setHex(palette.membraneEmissive);
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

  public updateEditorIdle(delta: number, elapsedTime: number): void {
    this.currentScale = THREE.MathUtils.damp(
      this.currentScale,
      this.targetScale,
      4.0,
      delta
    );
    this.group.scale.setScalar(this.currentScale);
    this.group.rotation.set(0, this.headingAngle, 0);

    // Animate all placed 3D organs while inspecting in the 3D Workshop
    this.flagellumPhase += delta * 6.2;
    for (const entry of this.activePlacedOrgans) {
      entry.primary.animate(elapsedTime, 0.35, false);
      entry.mirror?.animate(elapsedTime, 0.35, false);
    }

    if (this.dragPreviewGroup.visible) {
      this.dragPreviewPrimary?.animate(elapsedTime, 0.4, false);
      this.dragPreviewMirror?.animate(elapsedTime, 0.4, false);
    }

    if (this.evoAmphibianLegsGroup.visible && this.amphibianLegs.length === 4) {
      const legWave = Math.sin(this.flagellumPhase * 0.65) * 0.24;
      this.amphibianLegs[0].rotation.x = legWave;
      this.amphibianLegs[1].rotation.x = -legWave;
      this.amphibianLegs[2].rotation.x = -legWave;
      this.amphibianLegs[3].rotation.x = legWave;
    }

    for (let i = 0; i < this.ciliaLeft.length; i++) {
      const flutter = Math.sin(this.flagellumPhase * 1.1 + i) * 0.24;
      this.ciliaLeft[i].rotation.y = 0.35 + flutter;
      this.ciliaRight[i].rotation.y = -0.35 - flutter;
    }

    // Subtle pulse on hovered internal vertebra and active orientation gizmo sphere
    if (this.isEditingMode) {
      const vertebraPositionsU = [-0.62, -0.31, 0.0, 0.31, 0.62];
      for (let v = 0; v < this.spineVertebraeMeshes.length; v++) {
        const isHov = this.hoveredVertebraIndex === v;
        const u = vertebraPositionsU[v] ?? 0;
        const rLocal = this.getInterpolatedTorsoRadius(u);
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
    this.membraneMat.color.setHex(palette.membraneColor);
    this.membraneMat.emissive.setHex(palette.membraneEmissive);
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
      1: 90,
      2: 135,
      3: 180,
      4: 220,
      5: 250,
    };

    this.targetScale = scaleByStage[stage] ?? 1.0;
    this.baseGrowthZoom = zoomByStage[stage] ?? 1.0;
    this.activeArenaRadius = arenaByStage[stage] ?? 90;
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
    turnMultiplier = 1.0
  ): { isMoving: boolean; isBoosting: boolean } {
    const safeDelta = Math.min(Math.max(delta, 0.001), 0.05);

    this.currentScale = THREE.MathUtils.damp(
      this.currentScale,
      this.targetScale,
      3.5,
      safeDelta
    );
    this.group.scale.setScalar(this.currentScale);
    this.placedOrgansGroup.scale.set(1, 1, 1);

    // 1. Smooth angular turning (A / D)
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

    // 2. Smooth forward/backward thrust (W / S) + Space Boost (or Wing Jump/Glide in Creature Stage)
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
    if (input.forward) {
      targetSpeed = maxForward;
    } else if (input.backward) {
      targetSpeed = -maxReverse;
    }

    if (this.isBoosting) {
      const baseBoostSpeed = input.backward ? -maxReverse : maxForward;
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

    // 4. Soft arena boundary containment (expands progressively across the 5 cellular growth stages)
    const distSq =
      this.position.x * this.position.x + this.position.z * this.position.z;
    const stageMaxR = this.isLandCreature
      ? GAME_CONFIG.WORLD.ARENA_RADIUS
      : Math.min(GAME_CONFIG.WORLD.ARENA_RADIUS, this.activeArenaRadius);
    const maxRadius = stageMaxR - 1.5;
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

      const strideBounce =
        this.heightOffset > 0.45
          ? Math.sin(elapsedTime * 5.5) * 0.14
          : Math.abs(Math.sin(this.flagellumPhase * 0.9)) *
            0.22 *
            Math.min(1, speedRatio * 1.4);

      this.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y + this.heightOffset + strideBounce;
      this.haloMesh.position.y =
        -0.95 - this.heightOffset / Math.max(0.5, this.currentScale);
    } else {
      this.heightOffset = 0;
      this.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y + Math.sin(elapsedTime * 2.4) * 0.16;
      this.haloMesh.position.y = -0.95;
    }

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
      this.membraneMat.color.setHex(palette.membraneColor);
      this.membraneMat.emissive.setHex(palette.membraneEmissive);
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
      input.forward ||
      input.backward ||
      input.left ||
      input.right ||
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
    this.activeArenaRadius = 90;
    this.group.scale.setScalar(1.0);
    this.knockbackVelocity.set(0, 0, 0);
    this.damageFlashTimer = 0;
    this.isRespawnInvulnerable = false;
    this.group.rotation.set(0, 0, 0);
    this.haloMesh.position.y = -0.95;
    this.setEditorMode(false);
    this.applyMorphology('fusiforme', 'cyan', false, 1, 1.0, [1.0, 1.0, 1.0]);

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
