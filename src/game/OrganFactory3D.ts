import * as THREE from 'three';
import { normalizeAdaptationId } from './evolutionData';
import type { PlayerCell } from './PlayerCell';
import {
  CellBodyShape,
  CellColorTheme,
  PlacedOrganInstance,
} from './types';

export type LimbBoneRole =
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'foot'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hand';

export interface OrganVisualInstance {
  group: THREE.Group;
  position: THREE.Vector3;
  nozzleLocalPos?: THREE.Vector3;
  distalSocketLocalPos?: THREE.Vector3;
  distalSocketGroup?: THREE.Group;
  getBoneNode: (role: LimbBoneRole) => THREE.Object3D | null;
  animate: (elapsedTime: number, speedRatio: number, isBoosting: boolean) => void;
  setHighlight: (mode: 'none' | 'selected' | 'preview_valid' | 'preview_invalid') => void;
  setColorOverride: (colorHex?: string) => void;
  setCoatColors: (baseColorHex?: string, detailColorHex?: string) => void;
  setLimbPose: (
    upperJointAngle: number,
    middleJointAngle: number,
    boneLength: number
  ) => void;
  getLowestFootWorldY?: () => number;
  getLowestFootLocalY?: () => number;
  getJointGizmoObjects: () => THREE.Object3D[];
  dispose: () => void;
}

/**
 * Procedural 3D Organ Factory for EvoLife's Spore-style 3D Workshop & Gameplay.
 * Convention:
 * - Origin (0,0,0) is the attachment anchor on the cell membrane.
 * - Local +Z points OUTWARD along the membrane surface normal.
 * - Local +Y is dorsal (up), Local +X is lateral.
 */
export function createOrganVisual(rawAdaptationId: string): OrganVisualInstance {
  const id = normalizeAdaptationId(rawAdaptationId);
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const tintableMaterials: Array<{
    mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
    origColorHex: number;
    origEmissiveHex: number;
    isDetailAccent: boolean;
  }> = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(
    m: T,
    forceDetailAccent?: boolean
  ): T => {
    materials.push(m);
    if (
      m instanceof THREE.MeshStandardMaterial ||
      m instanceof THREE.MeshPhysicalMaterial
    ) {
      const cHex = m.color.getHex();
      // Preserve eye sclera (pure white/ivory) and pupils (near-black) so eyes remain expressive
      const isEyeScleraOrPupil =
        cHex === 0xf8fafc ||
        cHex === 0xffffff ||
        cHex === 0x020617 ||
        cHex === 0x090d16;
      if (!isEyeScleraOrPupil) {
        const isDetail =
          forceDetailAccent !== undefined
            ? forceDetailAccent
            : tintableMaterials.length > 0;
        tintableMaterials.push({
          mat: m,
          origColorHex: cHex,
          origEmissiveHex: m.emissive.getHex(),
          isDetailAccent: isDetail,
        });
      }
    }
    return m;
  };

  let animateFn: (elapsedTime: number, speedRatio: number, isBoosting: boolean) => void = () => {};
  let nozzleLocalPos: THREE.Vector3 | undefined;
  let distalSocketLocalPos: THREE.Vector3 | undefined;
  let limbProximalPivot: THREE.Group | undefined;
  let limbMiddlePivot: THREE.Group | undefined;
  let limbDistalSocketGroup: THREE.Group | undefined;
  let baseDistalSocketPos: THREE.Vector3 | undefined;
  let savedUpperJointAngle = 0;
  let savedMiddleJointAngle = 0;
  let savedBoneLength = 1.0;
  const jointGizmoGroups: THREE.Group[] = [];
  const jointGizmoHitMeshes: THREE.Object3D[] = [];

  const attachLimbJointRig = (
    rootGroup: THREE.Group,
    middleJointPos: THREE.Vector3,
    distalSocketPos: THREE.Vector3
  ) => {
    const proxPivot = new THREE.Group();
    const midPivot = new THREE.Group();
    midPivot.position.copy(middleJointPos);

    // Move children located beyond the middle joint into midPivot so bending the knee/elbow articulates the lower segment
    const childrenToInspect = [...rootGroup.children];
    for (const child of childrenToInspect) {
      const distToDistal = child.position.distanceTo(distalSocketPos);
      const distToOrigin = child.position.length();
      if (distToDistal < distToOrigin && distToOrigin > 0.25) {
        rootGroup.remove(child);
        child.position.sub(middleJointPos);
        midPivot.add(child);
      } else {
        rootGroup.remove(child);
        proxPivot.add(child);
      }
    }

    // Distal Socket Group (Ankle for legs / Wrist for arms) where Feet and Hands attach hierarchically
    const socketGroup = new THREE.Group();
    socketGroup.name = id.startsWith('leg_') ? 'ankleGroup' : 'wristGroup';
    socketGroup.position.copy(distalSocketPos).sub(middleJointPos);
    midPivot.add(socketGroup);

    proxPivot.add(midPivot);
    rootGroup.add(proxPivot);

    limbProximalPivot = proxPivot;
    limbMiddlePivot = midPivot;
    limbDistalSocketGroup = socketGroup;
    baseDistalSocketPos = distalSocketPos.clone();
  };

  if (id === 'chitin_spike') {
    // 1. Espolón Quitinizado: Basal anchor ring + curved sharp chitin cone pointing outward (+Z)
    const ringGeo = trackGeo(new THREE.TorusGeometry(0.19, 0.045, 10, 20));
    const ringMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        emissive: 0x92400e,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.6,
      })
    );
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 0, 0.02);
    group.add(ringMesh);

    const spikeGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.92, 12));
    spikeGeo.rotateX(Math.PI / 2);
    spikeGeo.translate(0, 0, 0.46);
    const spikeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        roughness: 0.16,
        metalness: 0.72,
      })
    );
    const mainSpike = new THREE.Mesh(spikeGeo, spikeMat);
    group.add(mainSpike);

    // Lateral micro-barbs
    const barbGeo = trackGeo(new THREE.ConeGeometry(0.06, 0.34, 8));
    barbGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      const barb = new THREE.Mesh(barbGeo, spikeMat);
      barb.position.set(side * 0.11, 0, 0.28);
      barb.rotation.y = side * 0.38;
      group.add(barb);
    }

    animateFn = (elapsedTime, _speedRatio, isBoosting) => {
      const pulse = isBoosting ? 1.08 + Math.sin(elapsedTime * 18) * 0.05 : 1.0;
      mainSpike.scale.set(1, 1, pulse);
    };
  } else if (id === 'poison_gland') {
    // 2. Glándula de Veneno: Translucent acid-green spherical bulb + top/outward tubular nozzle (pitorro) + rising green bubbles
    const bulbGeo = trackGeo(new THREE.SphereGeometry(0.28, 16, 16));
    bulbGeo.scale(1.08, 0.92, 1.12);
    const bulbMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xa3e635,
        emissive: 0x4d7c0f,
        emissiveIntensity: 0.95,
        roughness: 0.15,
        transmission: 0.62,
        transparent: true,
        opacity: 0.88,
        clearcoat: 1.0,
      })
    );
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
    bulbMesh.position.set(0, 0.04, 0.16);
    group.add(bulbMesh);

    // Inner glowing toxin core inside the translucent bulb
    const coreGeo = trackGeo(new THREE.SphereGeometry(0.15, 12, 12));
    const coreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd9f99d,
        emissive: 0x84cc16,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      })
    );
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 0.04, 0.16);
    group.add(coreMesh);

    // Tubular nozzle (pitorro) angled upward & outward
    const nozzlePivot = new THREE.Group();
    nozzlePivot.position.set(0, 0.18, 0.32);
    nozzlePivot.rotation.x = -0.45; // Angled upward and outward
    const nozzleGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.105, 0.34, 12));
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x84cc16,
        emissive: 0x3f6212,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.2,
      })
    );
    const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzleMesh.position.set(0, 0, 0.14);
    nozzlePivot.add(nozzleMesh);

    const lipGeo = trackGeo(new THREE.TorusGeometry(0.06, 0.02, 8, 16));
    const lipMesh = new THREE.Mesh(lipGeo, coreMat);
    lipMesh.position.set(0, 0, 0.31);
    nozzlePivot.add(lipMesh);
    group.add(nozzlePivot);

    // Rising miniature green poison bubbles from nozzle tip
    const bubbleGeo = trackGeo(new THREE.SphereGeometry(0.045, 8, 8));
    const bubbleMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xbef264,
        transparent: true,
        opacity: 0.8,
      })
    );
    const bubbles: THREE.Mesh[] = [];
    for (let b = 0; b < 4; b++) {
      const bMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      group.add(bMesh);
      bubbles.push(bMesh);
    }

    nozzleLocalPos = new THREE.Vector3(0, 0.28, 0.62);

    animateFn = (elapsedTime) => {
      const throb = 1.0 + Math.sin(elapsedTime * 5.2) * 0.08;
      bulbMesh.scale.set(1.08 * throb, 0.92 * throb, 1.12 * throb);
      for (let b = 0; b < bubbles.length; b++) {
        const phase = (elapsedTime * 1.4 + b * 0.25) % 1.0;
        const bub = bubbles[b];
        bub.position.set(
          Math.sin(elapsedTime * 4 + b * 1.7) * 0.05,
          0.26 + phase * 0.42,
          0.46 + phase * 0.28
        );
        bub.scale.setScalar((1.0 - phase * 0.5) * 0.95);
      }
    };
  } else if (id === 'mouth_jaw') {
    // 3. Mandíbula Aserrada: Pair of curved chitinous pincers with internal serrated teeth
    const baseGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 12));
    baseGeo.rotateX(Math.PI / 2);
    const baseMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x9f1239,
        emissive: 0x881337,
        emissiveIntensity: 0.4,
        roughness: 0.35,
      })
    );
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    group.add(baseMesh);

    const jawGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.78, 10));
    jawGeo.rotateX(Math.PI / 2);
    jawGeo.scale(1.1, 0.62, 1.0);
    jawGeo.translate(0, 0, 0.36);

    const toothGeo = trackGeo(new THREE.ConeGeometry(0.045, 0.14, 6));
    const jawMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfda4af,
        emissive: 0xe11d48,
        emissiveIntensity: 0.48,
        roughness: 0.22,
        metalness: 0.58,
      })
    );

    const leftPivot = new THREE.Group();
    leftPivot.position.set(-0.22, 0, 0.05);
    const leftBlade = new THREE.Mesh(jawGeo, jawMat);
    leftPivot.add(leftBlade);

    const rightPivot = new THREE.Group();
    rightPivot.position.set(0.22, 0, 0.05);
    const rightBlade = new THREE.Mesh(jawGeo, jawMat);
    rightPivot.add(rightBlade);

    for (let t = 0; t < 3; t++) {
      const zOff = 0.2 + t * 0.16;
      const lTooth = new THREE.Mesh(toothGeo, jawMat);
      lTooth.position.set(0.08, 0, zOff);
      lTooth.rotation.z = -Math.PI / 2;
      leftPivot.add(lTooth);

      const rTooth = new THREE.Mesh(toothGeo, jawMat);
      rTooth.position.set(-0.08, 0, zOff);
      rTooth.rotation.z = Math.PI / 2;
      rightPivot.add(rTooth);
    }

    group.add(leftPivot);
    group.add(rightPivot);

    animateFn = (elapsedTime, speedRatio) => {
      const snap = Math.sin(elapsedTime * (5.5 + speedRatio * 4.0)) * 0.24;
      leftPivot.rotation.y = 0.22 - snap;
      rightPivot.rotation.y = -0.22 + snap;
    };
  } else if (id === 'mouth_filter') {
    // 4. Boca Filtradora Ciliar: Oral cavity arch with vibrating turquoise cilia filaments
    const archGeo = trackGeo(new THREE.TorusGeometry(0.28, 0.05, 10, 20, Math.PI));
    archGeo.rotateX(Math.PI / 2);
    const filterMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x5eead4,
        emissive: 0x0d9488,
        emissiveIntensity: 0.8,
        roughness: 0.25,
      })
    );
    const archMesh = new THREE.Mesh(archGeo, filterMat);
    archMesh.position.set(0, 0, 0.05);
    group.add(archMesh);

    const ciliumGeo = trackGeo(new THREE.ConeGeometry(0.035, 0.45, 8));
    ciliumGeo.rotateX(Math.PI / 2);
    ciliumGeo.translate(0, 0, 0.22);
    const bristles: THREE.Mesh[] = [];
    for (let i = -3; i <= 3; i++) {
      const b = new THREE.Mesh(ciliumGeo, filterMat);
      const angle = (i / 3) * 0.75;
      b.position.set(Math.sin(angle) * 0.24, -0.02, Math.cos(angle) * 0.14);
      b.rotation.y = angle * 0.5;
      group.add(b);
      bristles.push(b);
    }

    animateFn = (elapsedTime) => {
      for (let i = 0; i < bristles.length; i++) {
        bristles[i].rotation.x = Math.sin(elapsedTime * 12.0 + i * 0.8) * 0.18;
      }
    };
  } else if (id === 'mouth_proboscis') {
    // 5. Probóscide Succionadora: Ringed elongated trunk ending in a suction ring & piercing stinger
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.065, 0.16, 0.95, 12));
    trunkGeo.rotateX(Math.PI / 2);
    trunkGeo.translate(0, 0, 0.46);
    const probMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0x10b981,
        emissiveIntensity: 0.7,
        roughness: 0.22,
        metalness: 0.35,
      })
    );
    const trunkMesh = new THREE.Mesh(trunkGeo, probMat);
    group.add(trunkMesh);

    const ringGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.026, 8, 16));
    const rings: THREE.Mesh[] = [];
    for (let r = 0; r < 3; r++) {
      const rMesh = new THREE.Mesh(ringGeo, probMat);
      const s = 1.0 - r * 0.18;
      rMesh.scale.setScalar(s);
      rMesh.position.set(0, 0, 0.24 + r * 0.25);
      group.add(rMesh);
      rings.push(rMesh);
    }

    const suctionGeo = trackGeo(new THREE.TorusGeometry(0.095, 0.032, 10, 18));
    const suctionMesh = new THREE.Mesh(suctionGeo, probMat);
    suctionMesh.position.set(0, 0, 0.94);
    group.add(suctionMesh);

    const stingerGeo = trackGeo(new THREE.ConeGeometry(0.04, 0.28, 8));
    stingerGeo.rotateX(Math.PI / 2);
    const stingerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x059669,
        emissiveIntensity: 1.1,
      })
    );
    const stingerMesh = new THREE.Mesh(stingerGeo, stingerMat);
    stingerMesh.position.set(0, 0, 1.04);
    group.add(stingerMesh);

    animateFn = (elapsedTime) => {
      const pump = 1.0 + Math.sin(elapsedTime * 7.0) * 0.08;
      trunkMesh.scale.set(1, 1, pump);
      suctionMesh.position.z = 0.94 * pump;
      stingerMesh.position.z = 1.04 * pump;
    };
  } else if (id === 'simple_flagellum' || id === 'flagellum_2' || id === 'flagellum') {
    // 6. Flagelo Simple: Segmented whip tail undulating with a continuous sine wave
    const rotorGeo = trackGeo(new THREE.TorusGeometry(0.16, 0.04, 8, 16));
    const tailMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x5eead4,
        emissive: 0x14b8a6,
        emissiveIntensity: 0.7,
        roughness: 0.32,
        metalness: 0.15,
      })
    );
    const rotorMesh = new THREE.Mesh(rotorGeo, tailMat);
    group.add(rotorMesh);

    const segments: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const radius = 0.17 * (1 - i * 0.15);
      const segGeo = trackGeo(new THREE.SphereGeometry(radius, 10, 10));
      segGeo.scale(0.82, 0.82, 1.75);
      const seg = new THREE.Mesh(segGeo, tailMat);
      seg.position.set(0, 0, 0.22 + i * 0.34);
      group.add(seg);
      segments.push(seg);
    }

    let flagellumLocalPhase = 0;
    let flagellumLastTime = -1;
    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const dt =
        flagellumLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - flagellumLastTime), 0.05);
      flagellumLastTime = elapsedTime;
      const clampedSpeed = THREE.MathUtils.clamp(speedRatio, 0, 1.5);
      const targetFreq = Math.min(18.0, 6.5 + clampedSpeed * 6.5 + (isBoosting ? 4.0 : 0));
      flagellumLocalPhase = (flagellumLocalPhase + dt * targetFreq) % (Math.PI * 200);
      for (let i = 0; i < segments.length; i++) {
        const wave = Math.sin(flagellumLocalPhase - i * 0.78);
        const amp = (0.055 + clampedSpeed * 0.055) * (1 + i * 0.32);
        const targetX = wave * amp;
        const targetRotY = wave * 0.24;
        segments[i].position.x = THREE.MathUtils.damp(
          segments[i].position.x,
          targetX,
          16.0,
          dt
        );
        segments[i].rotation.y = THREE.MathUtils.damp(
          segments[i].rotation.y,
          targetRotY,
          16.0,
          dt
        );
      }
    };
  } else if (id === 'hydro_siphon') {
    // 7. Sifón Hidrodinámico: Muscular biological funnel nozzle that contracts and expels water jets
    const baseRingGeo = trackGeo(new THREE.TorusGeometry(0.2, 0.045, 10, 18));
    const siphonMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
        roughness: 0.22,
        metalness: 0.45,
        side: THREE.DoubleSide,
      })
    );
    const baseRing = new THREE.Mesh(baseRingGeo, siphonMat);
    group.add(baseRing);

    const coneGeo = trackGeo(
      new THREE.CylinderGeometry(0.14, 0.23, 0.56, 14, 1, true)
    );
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, 0.28);
    const funnelMesh = new THREE.Mesh(coneGeo, siphonMat);
    group.add(funnelMesh);

    const jetGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.48, 10));
    jetGeo.rotateX(Math.PI / 2);
    jetGeo.translate(0, 0, 0.72);
    const jetMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.55,
      })
    );
    const jetMesh = new THREE.Mesh(jetGeo, jetMat);
    group.add(jetMesh);

    let siphonLocalPhase = 0;
    let siphonLastTime = -1;
    animateFn = (elapsedTime, _speedRatio, isBoosting) => {
      const dt =
        siphonLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - siphonLastTime), 0.05);
      siphonLastTime = elapsedTime;
      const rate = isBoosting ? 12.0 : 6.5;
      siphonLocalPhase = (siphonLocalPhase + dt * rate) % (Math.PI * 200);
      const contract = 1.0 + Math.sin(siphonLocalPhase) * 0.12;
      funnelMesh.scale.set(contract, contract, 1.0 / contract);
      const targetJetZ = isBoosting
        ? 1.38
        : 0.75 + Math.sin(siphonLocalPhase) * 0.2;
      jetMesh.scale.set(
        1,
        1,
        THREE.MathUtils.damp(jetMesh.scale.z, targetJetZ, 14.0, dt)
      );
      jetMat.opacity = isBoosting ? 0.82 : 0.38;
    };
  } else if (id === 'cilia_waves') {
    // 8. Cilios Ondulantes: Translucent lateral fin-hairs vibrating at high frequency
    const padGeo = trackGeo(new THREE.CapsuleGeometry(0.07, 0.46, 6, 10));
    padGeo.rotateY(Math.PI / 2);
    const ciliaMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        transmission: 0.5,
        transparent: true,
        opacity: 0.88,
      })
    );
    const padMesh = new THREE.Mesh(padGeo, ciliaMat);
    group.add(padMesh);

    const hairGeo = trackGeo(new THREE.ConeGeometry(0.04, 0.52, 8));
    hairGeo.rotateX(Math.PI / 2);
    hairGeo.translate(0, 0, 0.26);
    const hairs: THREE.Mesh[] = [];
    for (let i = -2; i <= 2; i++) {
      const h = new THREE.Mesh(hairGeo, ciliaMat);
      h.position.set(i * 0.11, 0, 0.04);
      group.add(h);
      hairs.push(h);
    }

    let ciliaLocalPhase = 0;
    let ciliaLastTime = -1;
    animateFn = (elapsedTime, speedRatio) => {
      const dt =
        ciliaLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - ciliaLastTime), 0.05);
      ciliaLastTime = elapsedTime;
      const clampedSpeed = THREE.MathUtils.clamp(speedRatio, 0, 1.5);
      const freq = 10.0 + clampedSpeed * 6.5;
      ciliaLocalPhase = (ciliaLocalPhase + dt * freq) % (Math.PI * 200);
      for (let i = 0; i < hairs.length; i++) {
        const targetRotY = Math.sin(ciliaLocalPhase + i * 0.9) * 0.28;
        hairs[i].rotation.y = THREE.MathUtils.damp(
          hairs[i].rotation.y,
          targetRotY,
          16.0,
          dt
        );
      }
    };
  } else if (id === 'electric_cell') {
    // 9. Célula Eléctrica: Bioluminescent coil sphere crowned by an electrode with yellow/cyan electric arcs
    const coilGeo = trackGeo(new THREE.SphereGeometry(0.22, 14, 14));
    const coilMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.0,
        roughness: 0.2,
        metalness: 0.65,
      })
    );
    const coilMesh = new THREE.Mesh(coilGeo, coilMat);
    coilMesh.position.set(0, 0, 0.14);
    group.add(coilMesh);

    const rodGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.09, 0.36, 8));
    rodGeo.rotateX(Math.PI / 2);
    const rodMesh = new THREE.Mesh(rodGeo, coilMat);
    rodMesh.position.set(0, 0, 0.34);
    group.add(rodMesh);

    const orbGeo = trackGeo(new THREE.OctahedronGeometry(0.14, 1));
    const sparkMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 1.9,
        roughness: 0.1,
      })
    );
    const orbMesh = new THREE.Mesh(orbGeo, sparkMat);
    orbMesh.position.set(0, 0, 0.56);
    group.add(orbMesh);

    const arcGeo = trackGeo(new THREE.TorusGeometry(0.18, 0.018, 6, 12, Math.PI * 1.2));
    const arcMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.9,
      })
    );
    const arcs: THREE.Mesh[] = [];
    for (let a = 0; a < 2; a++) {
      const arc = new THREE.Mesh(arcGeo, a === 0 ? arcMat : sparkMat);
      arc.position.set(0, 0, 0.56);
      group.add(arc);
      arcs.push(arc);
    }

    animateFn = (elapsedTime) => {
      const pulse = 1.0 + Math.sin(elapsedTime * 22.0) * 0.22;
      orbMesh.scale.setScalar(pulse);
      orbMesh.rotation.z += 0.12;
      arcs[0].rotation.set(elapsedTime * 11, elapsedTime * 15, 0);
      arcs[1].rotation.set(-elapsedTime * 14, elapsedTime * 9, 1.2);
    };
  } else if (id === 'eye_photoreceptor') {
    // 10A. Ojo Fotorreceptor: Spherical eyeball with sclera, colored iris & dark pupil
    const scleraGeo = trackGeo(new THREE.SphereGeometry(0.24, 16, 16));
    const scleraMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.14,
        metalness: 0.05,
      })
    );
    const scleraMesh = new THREE.Mesh(scleraGeo, scleraMat);
    scleraMesh.position.set(0, 0.05, 0.14);
    group.add(scleraMesh);

    const irisGeo = trackGeo(new THREE.SphereGeometry(0.15, 14, 14));
    irisGeo.scale(1.0, 1.0, 0.55);
    const irisMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.65,
        roughness: 0.15,
      })
    );
    const irisMesh = new THREE.Mesh(irisGeo, irisMat);
    irisMesh.position.set(0, 0.06, 0.31);
    group.add(irisMesh);

    const pupilGeo = trackGeo(new THREE.SphereGeometry(0.095, 12, 12));
    pupilGeo.scale(1.0, 1.0, 0.5);
    const pupilMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x020617,
        roughness: 0.05,
        metalness: 0.8,
      })
    );
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.position.set(0, 0.06, 0.36);
    group.add(pupilMesh);

    animateFn = (elapsedTime) => {
      const lookX = Math.sin(elapsedTime * 1.9) * 0.03;
      irisMesh.position.x = lookX;
      pupilMesh.position.x = lookX * 1.15;
    };
  } else if (id === 'eye_stalks') {
    // 10B. Ojo Pedunculado Abisal: Eyeball elevated on a flexible curved stalk
    const stalkPivot = new THREE.Group();
    const stalkGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.095, 0.62, 10));
    stalkGeo.rotateX(Math.PI / 2);
    stalkGeo.translate(0, 0, 0.3);
    const stalkMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0e7490,
        emissiveIntensity: 0.5,
        roughness: 0.3,
      })
    );
    const stalkMesh = new THREE.Mesh(stalkGeo, stalkMat);
    stalkMesh.rotation.x = -0.35;
    stalkPivot.add(stalkMesh);

    const globeGeo = trackGeo(new THREE.SphereGeometry(0.25, 16, 16));
    const globeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.12,
      })
    );
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeMesh.position.set(0, 0.22, 0.58);
    stalkPivot.add(globeMesh);

    const irisGeo = trackGeo(new THREE.SphereGeometry(0.16, 12, 12));
    irisGeo.scale(1, 1, 0.5);
    const irisMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x10b981,
        emissiveIntensity: 0.9,
      })
    );
    const irisMesh = new THREE.Mesh(irisGeo, irisMat);
    irisMesh.position.set(0, 0.23, 0.77);
    stalkPivot.add(irisMesh);

    const pupilGeo = trackGeo(new THREE.SphereGeometry(0.095, 10, 10));
    pupilGeo.scale(1, 1, 0.5);
    const pupilMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x020617,
        roughness: 0.05,
      })
    );
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.position.set(0, 0.23, 0.82);
    stalkPivot.add(pupilMesh);

    group.add(stalkPivot);

    animateFn = (elapsedTime) => {
      stalkPivot.rotation.y = Math.sin(elapsedTime * 2.4) * 0.16;
      stalkPivot.rotation.x = Math.cos(elapsedTime * 1.8) * 0.08;
    };
  } else if (id === 'membrane_armor') {
    // 11. Caparazón de Queratina: Overlapping hexagonal chitinous armor plates
    const hexGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.32, 0.11, 6));
    hexGeo.rotateX(Math.PI / 2);
    const armorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x3730a3,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.65,
      })
    );
    const centerPlate = new THREE.Mesh(hexGeo, armorMat);
    centerPlate.position.set(0, 0.08, 0.08);
    group.add(centerPlate);

    for (const side of [-1, 1]) {
      const sidePlate = new THREE.Mesh(hexGeo, armorMat);
      sidePlate.scale.setScalar(0.76);
      sidePlate.position.set(side * 0.26, 0.04, 0.04);
      sidePlate.rotation.y = side * 0.32;
      group.add(sidePlate);
    }
  } else if (id === 'neutralizer_vesicle') {
    // 12. Vesícula Neutralizadora: Translucent homeostatic vacuole with glowing inner buffer granules
    const vacGeo = trackGeo(new THREE.SphereGeometry(0.25, 16, 16));
    const vacMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x2dd4bf,
        emissive: 0x0d9488,
        emissiveIntensity: 1.0,
        transmission: 0.68,
        transparent: true,
        opacity: 0.88,
        roughness: 0.15,
      })
    );
    const vacMesh = new THREE.Mesh(vacGeo, vacMat);
    vacMesh.position.set(0, 0.1, 0.12);
    group.add(vacMesh);

    animateFn = (elapsedTime) => {
      vacMesh.scale.setScalar(1.0 + Math.sin(elapsedTime * 4.5) * 0.09);
    };
  } else if (id === 'chemoreceptor') {
    // 13. Antenas Quimiorreceptoras: Paired bifurcated olfactory filaments with glowing tips
    const stemGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.05, 0.78, 8));
    stemGeo.rotateX(Math.PI / 2);
    stemGeo.translate(0, 0, 0.39);
    const antMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0x10b981,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      })
    );
    const tipGeo = trackGeo(new THREE.SphereGeometry(0.06, 8, 8));
    const stems: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const branch = new THREE.Group();
      branch.rotation.y = side * 0.28;
      const stem = new THREE.Mesh(stemGeo, antMat);
      const tip = new THREE.Mesh(tipGeo, antMat);
      tip.position.set(0, 0, 0.78);
      branch.add(stem);
      branch.add(tip);
      group.add(branch);
      stems.push(branch);
    }

    animateFn = (elapsedTime) => {
      stems[0].rotation.y = -0.28 + Math.sin(elapsedTime * 7.5) * 0.14;
      stems[1].rotation.y = 0.28 - Math.sin(elapsedTime * 7.5) * 0.14;
    };
  } else if (id === 'chloroplast_1') {
    // 14. Cloroplastos Simbióticos: Cluster of luminous emerald photosynthetic plastids
    const plastidGeo = trackGeo(new THREE.CapsuleGeometry(0.12, 0.2, 8, 12));
    const plastidMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x16a34a,
        emissiveIntensity: 1.35,
        roughness: 0.22,
      })
    );
    for (let i = 0; i < 3; i++) {
      const pMesh = new THREE.Mesh(plastidGeo, plastidMat);
      pMesh.position.set((i - 1) * 0.16, 0.12, 0.02);
      pMesh.rotation.set(0.4, i * 0.8, 0.5);
      group.add(pMesh);
    }
  } else if (id === 'vocal_crest') {
    // 15. Cresta Vocal Resonante
    const crestGeo = trackGeo(new THREE.ConeGeometry(0.28, 0.95, 10));
    crestGeo.scale(0.35, 1.0, 1.25);
    const crestMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf472b6,
        emissive: 0xec4899,
        emissiveIntensity: 0.95,
        roughness: 0.15,
        transmission: 0.55,
        transparent: true,
        opacity: 0.92,
      })
    );
    const crestMesh = new THREE.Mesh(crestGeo, crestMat);
    crestMesh.position.set(0, 0.35, 0.15);
    crestMesh.rotation.x = 0.45;
    group.add(crestMesh);
  } else if (id === 'grasping_arms') {
    // 16. Brazos con Garras
    const armGeo = trackGeo(new THREE.CapsuleGeometry(0.11, 0.42, 8, 10));
    const clawGeo = trackGeo(new THREE.ConeGeometry(0.05, 0.28, 6));
    clawGeo.rotateX(Math.PI / 2);
    const armMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xea580c,
        emissiveIntensity: 0.5,
        roughness: 0.3,
      })
    );
    const clawMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.6,
        metalness: 0.7,
      })
    );
    const armMesh = new THREE.Mesh(armGeo, armMat);
    armMesh.rotation.x = Math.PI / 2;
    armMesh.position.set(0, 0, 0.26);
    group.add(armMesh);
    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.Mesh(clawGeo, clawMat);
      claw.position.set(c * 0.08, 0, 0.58);
      claw.rotation.y = c * 0.2;
      group.add(claw);
    }
  } else if (id === 'wings_1') {
    // 17. Alas Membranales
    const foilGeo = trackGeo(new THREE.ConeGeometry(0.55, 1.35, 6));
    foilGeo.scale(1.0, 0.12, 1.0);
    foilGeo.rotateX(Math.PI / 2);
    foilGeo.translate(0, 0.18, 0.55);
    const wingMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        transmission: 0.5,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
      })
    );
    const wingMesh = new THREE.Mesh(foilGeo, wingMat);
    group.add(wingMesh);
    animateFn = (elapsedTime) => {
      wingMesh.rotation.z = Math.sin(elapsedTime * 6.0) * 0.28;
    };
  } else if (id === 'acid_spit') {
    // 18. Glándula de Escupitajo Ácido
    const sacGeo = trackGeo(new THREE.SphereGeometry(0.24, 12, 12));
    sacGeo.scale(0.85, 0.9, 1.35);
    const ductGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.09, 0.36, 8));
    ductGeo.rotateX(Math.PI / 2);
    const acidMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa3e635,
        emissive: 0x4d7c0f,
        emissiveIntensity: 1.3,
        roughness: 0.18,
      })
    );
    const sacMesh = new THREE.Mesh(sacGeo, acidMat);
    sacMesh.position.set(0, 0, 0.16);
    const ductMesh = new THREE.Mesh(ductGeo, acidMat);
    ductMesh.position.set(0, 0, 0.42);
    group.add(sacMesh);
    group.add(ductMesh);
  } else if (id === 'mouth_radula') {
    // 19. Rádula Raspadora: Curved chitinous ventral beak plate with rows of micro-teeth
    const plateGeo = trackGeo(new THREE.ConeGeometry(0.24, 0.56, 8));
    plateGeo.rotateX(Math.PI / 2);
    plateGeo.scale(1.15, 0.52, 1.0);
    const plateMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        emissive: 0x78350f,
        emissiveIntensity: 0.45,
        roughness: 0.42,
        metalness: 0.35,
      })
    );
    const beakPlate = new THREE.Mesh(plateGeo, plateMat);
    beakPlate.position.set(0, -0.04, 0.26);
    beakPlate.rotation.x = 0.22;
    group.add(beakPlate);

    const toothGeo = trackGeo(new THREE.ConeGeometry(0.032, 0.11, 5));
    toothGeo.rotateX(Math.PI);
    const toothMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xb45309,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      })
    );
    const radulaBand = new THREE.Group();
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(col * 0.075, -0.08, 0.14 + row * 0.11);
        radulaBand.add(tooth);
      }
    }
    group.add(radulaBand);

    let radulaPhase = 0;
    let radulaLastTime = -1;
    animateFn = (elapsedTime, speedRatio) => {
      const dt =
        radulaLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - radulaLastTime), 0.05);
      radulaLastTime = elapsedTime;
      radulaPhase =
        (radulaPhase + dt * (6.5 + THREE.MathUtils.clamp(speedRatio, 0, 1.5) * 4.0)) %
        (Math.PI * 200);
      radulaBand.position.z = Math.sin(radulaPhase) * 0.045;
    };
  } else if (id === 'mouth_suction_cup') {
    // 20. Ventosa Osmótica: Fleshy circular disc with retractile ringed rim and pulsing central orifice
    const rimGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.075, 14, 24));
    const innerRingGeo = trackGeo(new THREE.TorusGeometry(0.14, 0.045, 12, 20));
    const cupMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf472b6,
        emissive: 0xbe185d,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        transmission: 0.35,
        transparent: true,
        opacity: 0.92,
      })
    );
    const orificeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x4c0519,
        emissive: 0x9f1239,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      })
    );
    const discGroup = new THREE.Group();
    discGroup.position.set(0, 0, 0.22);
    const outerRim = new THREE.Mesh(rimGeo, cupMat);
    const innerRim = new THREE.Mesh(innerRingGeo, cupMat);
    innerRim.position.z = 0.06;
    const coreGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.06, 0.18, 14));
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, orificeMat);
    discGroup.add(outerRim, innerRim, coreMesh);
    group.add(discGroup);

    animateFn = (elapsedTime) => {
      const p = 1.0 + Math.sin(elapsedTime * 6.5) * 0.12;
      outerRim.scale.set(p, p, 1.0);
      innerRim.scale.set(2.0 - p, 2.0 - p, 1.0);
    };
  } else if (id === 'mouth_crusher_mandibles') {
    // 21. Mandíbulas Trituradoras: Two heavy calcified dark-violet pincers that clash together
    const jawGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.16, 0.52));
    const tipGeo = trackGeo(new THREE.ConeGeometry(0.12, 0.28, 6));
    tipGeo.rotateX(Math.PI / 2);
    const crusherMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x581c87,
        emissive: 0x3b0764,
        emissiveIntensity: 0.65,
        roughness: 0.28,
        metalness: 0.72,
      })
    );
    const toothMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe9d5ff,
        emissive: 0x9333ea,
        emissiveIntensity: 0.75,
        metalness: 0.8,
      })
    );
    const pivots: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.2, 0, 0.05);
      const body = new THREE.Mesh(jawGeo, crusherMat);
      body.position.set(0, 0, 0.24);
      const tip = new THREE.Mesh(tipGeo, toothMat);
      tip.position.set(-side * 0.08, 0, 0.52);
      tip.rotation.y = -side * 0.55;
      pivot.add(body, tip);
      group.add(pivot);
      pivots.push(pivot);
    }

    let crusherPhase = 0;
    let crusherLastTime = -1;
    animateFn = (elapsedTime, speedRatio) => {
      const dt =
        crusherLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - crusherLastTime), 0.05);
      crusherLastTime = elapsedTime;
      crusherPhase =
        (crusherPhase + dt * (4.2 + THREE.MathUtils.clamp(speedRatio, 0, 1.5) * 3.2)) %
        (Math.PI * 200);
      const snap = Math.abs(Math.sin(crusherPhase)) * 0.32;
      pivots[0].rotation.y = 0.22 - snap;
      pivots[1].rotation.y = -0.22 + snap;
    };
  } else if (id === 'mouth_filter_baleen') {
    // 22. Filtro Barbas de Ballena Microbiano: Wide translucent chamber with golden vibrating baleen filaments
    const archGeo = trackGeo(
      new THREE.TorusGeometry(0.32, 0.045, 10, 24, Math.PI)
    );
    const chamberMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        transmission: 0.65,
        transparent: true,
        opacity: 0.85,
      })
    );
    const baleenMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xd97706,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
    );
    const arch = new THREE.Mesh(archGeo, chamberMat);
    arch.position.set(0, 0.02, 0.18);
    arch.rotation.x = Math.PI / 2;
    group.add(arch);

    const filamentGeo = trackGeo(
      new THREE.CylinderGeometry(0.012, 0.006, 0.36, 6)
    );
    filamentGeo.rotateX(Math.PI / 2);
    const filaments: THREE.Mesh[] = [];
    for (let i = -4; i <= 4; i++) {
      const ang = (i / 4) * 1.1;
      const fil = new THREE.Mesh(filamentGeo, baleenMat);
      fil.position.set(
        Math.sin(ang) * 0.28,
        -0.02,
        0.16 + Math.cos(ang) * 0.18
      );
      fil.rotation.y = ang * 0.5;
      group.add(fil);
      filaments.push(fil);
    }

    animateFn = (elapsedTime) => {
      for (let i = 0; i < filaments.length; i++) {
        filaments[i].rotation.x = Math.sin(elapsedTime * 10 + i * 0.7) * 0.16;
      }
    };
  } else if (id === 'mouth_needle_proboscis') {
    // 23. Aguijón Inyector Vampírico: Hollow translucent crimson needle with glowing internal capillaries
    const sheathGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.35, 12));
    sheathGeo.rotateX(Math.PI / 2);
    const needleGeo = trackGeo(
      new THREE.CylinderGeometry(0.012, 0.065, 0.92, 12)
    );
    needleGeo.rotateX(Math.PI / 2);
    needleGeo.translate(0, 0, 0.46);
    const needleMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf43f5e,
        emissive: 0xbe123c,
        emissiveIntensity: 0.75,
        transmission: 0.6,
        transparent: true,
        opacity: 0.9,
        roughness: 0.12,
      })
    );
    const capillaryGeo = trackGeo(
      new THREE.CylinderGeometry(0.016, 0.022, 0.76, 8)
    );
    capillaryGeo.rotateX(Math.PI / 2);
    const capMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfecdd3,
        emissive: 0xe11d48,
        emissiveIntensity: 1.5,
      })
    );
    const sheath = new THREE.Mesh(sheathGeo, needleMat);
    sheath.position.z = 0.14;
    const needle = new THREE.Mesh(needleGeo, needleMat);
    const capillary = new THREE.Mesh(capillaryGeo, capMat);
    capillary.position.z = 0.42;
    group.add(sheath, needle, capillary);

    animateFn = (elapsedTime, _speedRatio, isBoosting) => {
      const thrust = isBoosting ? 0.14 : Math.sin(elapsedTime * 6) * 0.05;
      needle.position.z = thrust;
      capillary.position.z = 0.42 + thrust;
    };
  } else if (id === 'weapon_harpoon_cell') {
    // 24. Nematocisto / Arpón Celular: Ovoid capsule with coiled barbed filament ready to fire
    const podGeo = trackGeo(new THREE.SphereGeometry(0.22, 14, 14));
    podGeo.scale(0.85, 0.85, 1.35);
    const podMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.6,
        transmission: 0.65,
        transparent: true,
        opacity: 0.86,
      })
    );
    const coilGeo = trackGeo(new THREE.TorusKnotGeometry(0.09, 0.02, 32, 6, 2, 3));
    const harpoonTipGeo = trackGeo(new THREE.ConeGeometry(0.075, 0.34, 8));
    harpoonTipGeo.rotateX(Math.PI / 2);
    const barbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xd97706,
        emissiveIntensity: 1.1,
        metalness: 0.6,
      })
    );
    const podMesh = new THREE.Mesh(podGeo, podMat);
    podMesh.position.z = 0.18;
    const coilMesh = new THREE.Mesh(coilGeo, barbMat);
    coilMesh.position.z = 0.2;
    const tipMesh = new THREE.Mesh(harpoonTipGeo, barbMat);
    tipMesh.position.z = 0.52;
    group.add(podMesh, coilMesh, tipMesh);

    animateFn = (elapsedTime) => {
      coilMesh.rotation.z = elapsedTime * 3.5;
      tipMesh.position.z = 0.52 + Math.sin(elapsedTime * 7) * 0.05;
    };
  } else if (id === 'weapon_rotary_drill') {
    // 25. Taladro Calcificado de Membrana: Golden helical spiral cone horn rotating on its axis
    const drillGroup = new THREE.Group();
    const coneGeo = trackGeo(new THREE.ConeGeometry(0.22, 0.88, 7));
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, 0.44);
    const drillMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xb45309,
        emissiveIntensity: 0.75,
        roughness: 0.22,
        metalness: 0.82,
      })
    );
    const threadGeo = trackGeo(new THREE.TorusGeometry(0.15, 0.032, 8, 18));
    const mainCone = new THREE.Mesh(coneGeo, drillMat);
    drillGroup.add(mainCone);

    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(threadGeo, drillMat);
      const s = 1 - r * 0.26;
      ring.scale.setScalar(s);
      ring.position.z = 0.18 + r * 0.22;
      ring.rotation.x = 0.35;
      drillGroup.add(ring);
    }
    group.add(drillGroup);

    let drillPhase = 0;
    let drillLastTime = -1;
    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const dt =
        drillLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - drillLastTime), 0.05);
      drillLastTime = elapsedTime;
      const rotSpeed =
        9.0 + THREE.MathUtils.clamp(speedRatio, 0, 1.5) * 8.0 + (isBoosting ? 7.0 : 0);
      drillPhase = (drillPhase + dt * rotSpeed) % (Math.PI * 200);
      drillGroup.rotation.z = drillPhase;
    };
  } else if (id === 'weapon_caustic_acid_blister') {
    // 26. Vesícula de Ácido Cáustico: Yellow-green semi-transparent blister with corrosive glowing core
    const blisterGeo = trackGeo(new THREE.SphereGeometry(0.26, 16, 16));
    blisterGeo.scale(1.1, 0.9, 1.05);
    const blisterMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xbef264,
        emissive: 0x65a30d,
        emissiveIntensity: 0.85,
        transmission: 0.65,
        transparent: true,
        opacity: 0.86,
        roughness: 0.15,
      })
    );
    const coreGeo = trackGeo(new THREE.DodecahedronGeometry(0.13, 0));
    const coreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0x84cc16,
        emissiveIntensity: 1.6,
      })
    );
    const blisterMesh = new THREE.Mesh(blisterGeo, blisterMat);
    blisterMesh.position.z = 0.18;
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.z = 0.2;
    group.add(blisterMesh, coreMesh);

    animateFn = (elapsedTime) => {
      const swell = 1.0 + Math.sin(elapsedTime * 5.5) * 0.11;
      blisterMesh.scale.set(1.1 * swell, 0.9 * swell, 1.05 * swell);
      coreMesh.rotation.y = elapsedTime * 2.5;
    };
  } else if (id === 'weapon_flash_photophore') {
    // 27. Fotóforo Cegador / Pulso Lumínico: Reflective concave pearl with crystal lens & hyper-bright core
    const dishGeo = trackGeo(
      new THREE.CylinderGeometry(0.24, 0.14, 0.16, 18)
    );
    dishGeo.rotateX(Math.PI / 2);
    const dishMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        roughness: 0.12,
        metalness: 0.9,
      })
    );
    const lensGeo = trackGeo(new THREE.SphereGeometry(0.18, 16, 16));
    const lensMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.0,
        roughness: 0.08,
      })
    );
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.position.z = 0.12;
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.z = 0.22;
    group.add(dishMesh, lensMesh);

    animateFn = (elapsedTime) => {
      lensMat.emissiveIntensity = 1.6 + Math.sin(elapsedTime * 8) * 0.6;
    };
  } else if (id === 'weapon_tail_club') {
    // 28. Maza Quitinizada Caudal: Heavy riveted sphere with bone nodules at end of caudal stalk
    const stalkGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 0.45, 10));
    stalkGeo.rotateX(Math.PI / 2);
    const clubGeo = trackGeo(new THREE.DodecahedronGeometry(0.28, 1));
    const clubMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xb45309,
        emissive: 0x78350f,
        emissiveIntensity: 0.5,
        roughness: 0.35,
        metalness: 0.65,
      })
    );
    const noduleGeo = trackGeo(new THREE.SphereGeometry(0.085, 8, 8));
    const noduleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xd97706,
        emissiveIntensity: 0.65,
        roughness: 0.25,
      })
    );
    const clubGroup = new THREE.Group();
    const stalk = new THREE.Mesh(stalkGeo, clubMat);
    stalk.position.z = 0.22;
    const ball = new THREE.Mesh(clubGeo, clubMat);
    ball.position.z = 0.56;
    clubGroup.add(stalk, ball);

    for (let n = 0; n < 4; n++) {
      const ang = (n / 4) * Math.PI * 2;
      const nod = new THREE.Mesh(noduleGeo, noduleMat);
      nod.position.set(
        Math.cos(ang) * 0.24,
        Math.sin(ang) * 0.24,
        0.58
      );
      clubGroup.add(nod);
    }
    group.add(clubGroup);

    let clubPhase = 0;
    let clubLastTime = -1;
    animateFn = (elapsedTime, speedRatio) => {
      const dt =
        clubLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - clubLastTime), 0.05);
      clubLastTime = elapsedTime;
      clubPhase =
        (clubPhase + dt * (4.2 + THREE.MathUtils.clamp(speedRatio, 0, 1.5) * 3.8)) %
        (Math.PI * 200);
      const targetRotY = Math.sin(clubPhase) * 0.24;
      clubGroup.rotation.y = THREE.MathUtils.damp(
        clubGroup.rotation.y,
        targetRotY,
        15.0,
        dt
      );
    };
  } else if (id === 'defense_silica_spicules') {
    // 29. Espículas de Sílice: Cluster of 3 crystalline translucent silica needles
    const needleGeo = trackGeo(new THREE.ConeGeometry(0.065, 0.68, 6));
    needleGeo.rotateX(Math.PI / 2);
    needleGeo.translate(0, 0, 0.34);
    const silicaMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.85,
        transmission: 0.72,
        transparent: true,
        opacity: 0.9,
        roughness: 0.08,
        ior: 1.48,
      })
    );
    for (let i = -1; i <= 1; i++) {
      const spicule = new THREE.Mesh(needleGeo, silicaMat);
      spicule.rotation.y = i * 0.36;
      spicule.rotation.x = -Math.abs(i) * 0.14;
      group.add(spicule);
    }
  } else if (id === 'defense_mucus_gland') {
    // 30. Glándula de Mucílago Resbaladizo: Porous turquoise nodules secreting a gelatinous halo
    const noduleGeo = trackGeo(new THREE.SphereGeometry(0.18, 14, 14));
    const haloGeo = trackGeo(new THREE.SphereGeometry(0.32, 16, 16));
    haloGeo.scale(1.15, 0.8, 1.15);
    const glandMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      })
    );
    const mucusMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x67e8f9,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.55,
        transmission: 0.78,
        transparent: true,
        opacity: 0.55,
        roughness: 0.05,
      })
    );
    const glandMesh = new THREE.Mesh(noduleGeo, glandMat);
    glandMesh.position.z = 0.14;
    const mucusHalo = new THREE.Mesh(haloGeo, mucusMat);
    mucusHalo.position.z = 0.16;
    group.add(glandMesh, mucusHalo);

    animateFn = (elapsedTime) => {
      const w = 1.0 + Math.sin(elapsedTime * 4.5) * 0.1;
      mucusHalo.scale.set(1.15 * w, 0.8 / w, 1.15 * w);
    };
  } else if (id === 'defense_hydrothermal_carapace') {
    // 31. Caparazón Termo-Sulfuroso: Rough black basalt shields with incandescent orange veins
    const rockGeo = trackGeo(new THREE.DodecahedronGeometry(0.32, 1));
    rockGeo.scale(1.25, 0.42, 1.15);
    const basaltMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0xea580c,
        emissiveIntensity: 0.55,
        roughness: 0.78,
        metalness: 0.45,
      })
    );
    const veinGeo = trackGeo(new THREE.TorusGeometry(0.22, 0.025, 6, 12));
    veinGeo.rotateX(Math.PI / 2);
    const veinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xf97316,
        emissiveIntensity: 1.6,
      })
    );
    const mainShield = new THREE.Mesh(rockGeo, basaltMat);
    mainShield.position.set(0, 0.08, 0.12);
    const veinMesh = new THREE.Mesh(veinGeo, veinMat);
    veinMesh.position.set(0, 0.14, 0.12);
    group.add(mainShield, veinMesh);
  } else if (id === 'defense_chitin_shield_plate') {
    // 32. Placa Frontal de Escudo: Angular flat chitinous blade shield
    const shieldGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.34, 0.1));
    const edgeGeo = trackGeo(new THREE.ConeGeometry(0.36, 0.18, 4));
    edgeGeo.rotateX(Math.PI / 2);
    const shieldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.65,
        roughness: 0.22,
        metalness: 0.75,
      })
    );
    const plate = new THREE.Mesh(shieldGeo, shieldMat);
    plate.position.set(0, 0.04, 0.24);
    const edge = new THREE.Mesh(edgeGeo, shieldMat);
    edge.position.set(0, 0.04, 0.32);
    edge.rotation.z = Math.PI / 4;
    group.add(plate, edge);
  } else if (id === 'defense_camouflage_chromatophores') {
    // 33. Cromatóforos de Camuflaje: Iridescent hexagonal micro-plates shifting color dynamically
    const hexGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 6));
    hexGeo.rotateX(Math.PI / 2);
    const chromaMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x2dd4bf,
        emissive: 0x6366f1,
        emissiveIntensity: 0.85,
        iridescence: 1.0,
        roughness: 0.15,
        transparent: true,
        opacity: 0.82,
      })
    );
    const tiles: THREE.Mesh[] = [];
    const offsets = [
      [0, 0.08, 0.08],
      [-0.22, 0.05, 0.04],
      [0.22, 0.05, 0.04],
      [0, 0.06, -0.14],
    ];
    for (const [ox, oy, oz] of offsets) {
      const tile = new THREE.Mesh(hexGeo, chromaMat);
      tile.position.set(ox, oy, oz);
      group.add(tile);
      tiles.push(tile);
    }

    animateFn = (elapsedTime) => {
      const hue = (elapsedTime * 0.15) % 1.0;
      chromaMat.color.setHSL(hue, 0.8, 0.6);
      for (let i = 0; i < tiles.length; i++) {
        tiles[i].scale.setScalar(0.9 + Math.sin(elapsedTime * 4 + i) * 0.12);
      }
    };
  } else if (id === 'movement_ribbon_fin') {
    // 34. Aleta Ondulante Continua: Elongated lateral ribbon membrane with sinusoidal wave
    const segGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.22, 0.18));
    const finMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.75,
        transmission: 0.6,
        transparent: true,
        opacity: 0.86,
      })
    );
    const finSegs: THREE.Mesh[] = [];
    for (let s = 0; s < 6; s++) {
      const seg = new THREE.Mesh(segGeo, finMat);
      seg.position.set((s - 2.5) * 0.14, 0, 0.24);
      group.add(seg);
      finSegs.push(seg);
    }

    let ribbonPhase = 0;
    let ribbonLastTime = -1;
    animateFn = (elapsedTime, speedRatio) => {
      const dt =
        ribbonLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - ribbonLastTime), 0.05);
      ribbonLastTime = elapsedTime;
      const freq = 6.5 + THREE.MathUtils.clamp(speedRatio, 0, 1.5) * 5.5;
      ribbonPhase = (ribbonPhase + dt * freq) % (Math.PI * 200);
      for (let s = 0; s < finSegs.length; s++) {
        const targetY = Math.sin(ribbonPhase + s * 0.9) * 0.08;
        const targetRotZ = Math.cos(ribbonPhase + s * 0.9) * 0.22;
        finSegs[s].position.y = THREE.MathUtils.damp(
          finSegs[s].position.y,
          targetY,
          16.0,
          dt
        );
        finSegs[s].rotation.z = THREE.MathUtils.damp(
          finSegs[s].rotation.z,
          targetRotZ,
          16.0,
          dt
        );
      }
    };
  } else if (id === 'movement_macro_cilia_skirt') {
    // 35. Corona de Cilios Remos: Ring of synchronized thick oar-cilia beating in a wheel
    const oarGeo = trackGeo(new THREE.CapsuleGeometry(0.032, 0.34, 6, 8));
    oarGeo.rotateX(Math.PI / 2);
    oarGeo.translate(0, 0, 0.2);
    const oarMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
      })
    );
    const wheelGroup = new THREE.Group();
    const oars: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const oar = new THREE.Mesh(oarGeo, oarMat);
      oar.position.set((i - 2.5) * 0.11, 0, 0.06);
      wheelGroup.add(oar);
      oars.push(oar);
    }
    group.add(wheelGroup);

    let oarPhase = 0;
    let oarLastTime = -1;
    animateFn = (elapsedTime, speedRatio) => {
      const dt =
        oarLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - oarLastTime), 0.05);
      oarLastTime = elapsedTime;
      const freq = 7.5 + THREE.MathUtils.clamp(speedRatio, 0, 1.5) * 6.0;
      oarPhase = (oarPhase + dt * freq) % (Math.PI * 200);
      for (let i = 0; i < oars.length; i++) {
        const targetRotY = Math.sin(oarPhase + i * 0.8) * 0.36;
        oars[i].rotation.y = THREE.MathUtils.damp(
          oars[i].rotation.y,
          targetRotY,
          16.0,
          dt
        );
      }
    };
  } else if (id === 'movement_whip_flagella') {
    // 36. Flagelo Látigo Doble: Two long braided spiral whips splitting at the tip
    const segGeo = trackGeo(new THREE.SphereGeometry(0.075, 8, 8));
    segGeo.scale(0.8, 0.8, 2.2);
    const whipMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x059669,
        emissiveIntensity: 1.0,
        roughness: 0.2,
      })
    );
    const leftSegments: THREE.Mesh[] = [];
    const rightSegments: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const scale = 1 - i * 0.11;
      const lSeg = new THREE.Mesh(segGeo, whipMat);
      lSeg.scale.setScalar(scale);
      lSeg.position.set(-0.08 - i * 0.03, 0, 0.18 + i * 0.22);
      const rSeg = new THREE.Mesh(segGeo, whipMat);
      rSeg.scale.setScalar(scale);
      rSeg.position.set(0.08 + i * 0.03, 0, 0.18 + i * 0.22);
      group.add(lSeg, rSeg);
      leftSegments.push(lSeg);
      rightSegments.push(rSeg);
    }

    let whipPhase = 0;
    let whipLastTime = -1;
    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const dt =
        whipLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - whipLastTime), 0.05);
      whipLastTime = elapsedTime;
      const clampedSpeed = THREE.MathUtils.clamp(speedRatio, 0, 1.5);
      const freq = Math.min(18.0, 7.5 + clampedSpeed * 6.5 + (isBoosting ? 4.0 : 0));
      whipPhase = (whipPhase + dt * freq) % (Math.PI * 200);
      for (let i = 0; i < leftSegments.length; i++) {
        const wave = Math.sin(whipPhase - i * 0.78) * (0.048 + i * 0.025);
        const targetLeftX = -0.08 - i * 0.03 + wave;
        const targetRightX = 0.08 + i * 0.03 - wave;
        leftSegments[i].position.x = THREE.MathUtils.damp(
          leftSegments[i].position.x,
          targetLeftX,
          16.0,
          dt
        );
        rightSegments[i].position.x = THREE.MathUtils.damp(
          rightSegments[i].position.x,
          targetRightX,
          16.0,
          dt
        );
      }
    };
  } else if (id === 'movement_pneumatic_vesicle') {
    // 37. Vesícula Natatoria Regulable: Luminous internal elliptical bladder expanding and contracting
    const bladderGeo = trackGeo(new THREE.SphereGeometry(0.24, 16, 16));
    bladderGeo.scale(0.9, 0.75, 1.35);
    const bladderMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xa5f3fc,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.95,
        transmission: 0.75,
        transparent: true,
        opacity: 0.85,
        roughness: 0.1,
      })
    );
    const bladderMesh = new THREE.Mesh(bladderGeo, bladderMat);
    bladderMesh.position.set(0, 0.12, 0.06);
    group.add(bladderMesh);

    animateFn = (elapsedTime) => {
      const breath = 1.0 + Math.sin(elapsedTime * 3.8) * 0.14;
      bladderMesh.scale.set(0.9 * breath, 0.75 * breath, 1.35);
    };
  } else if (id === 'movement_reactive_nozzle') {
    // 38. Tobera Expulsora de Chorro: Muscular rear conical funnel with bioluminescent flaps
    const funnelGeo = trackGeo(
      new THREE.CylinderGeometry(0.26, 0.14, 0.52, 16, 1, true)
    );
    funnelGeo.rotateX(Math.PI / 2);
    const nozzleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.65,
        roughness: 0.28,
        side: THREE.DoubleSide,
      })
    );
    const glowRingGeo = trackGeo(new THREE.TorusGeometry(0.25, 0.035, 10, 20));
    const glowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.5,
      })
    );
    const funnelMesh = new THREE.Mesh(funnelGeo, nozzleMat);
    funnelMesh.position.z = 0.26;
    const glowRing = new THREE.Mesh(glowRingGeo, glowMat);
    glowRing.position.z = 0.5;
    group.add(funnelMesh, glowRing);

    let nozzlePhase = 0;
    let nozzleLastTime = -1;
    animateFn = (elapsedTime, _speedRatio, isBoosting) => {
      const dt =
        nozzleLastTime < 0
          ? 0.016
          : Math.min(Math.max(0.001, elapsedTime - nozzleLastTime), 0.05);
      nozzleLastTime = elapsedTime;
      const rate = isBoosting ? 13.0 : 5.0;
      nozzlePhase = (nozzlePhase + dt * rate) % (Math.PI * 200);
      const targetContract = isBoosting
        ? 0.84 + Math.sin(nozzlePhase) * 0.1
        : 1.0 + Math.sin(nozzlePhase) * 0.06;
      const dampedScale = THREE.MathUtils.damp(
        glowRing.scale.x,
        targetContract,
        14.0,
        dt
      );
      glowRing.scale.setScalar(dampedScale);
    };
  } else if (id === 'sense_stalk_compound_eye') {
    // 39. Ojo Compuesto Pedunculado: Faceted eye on a flexible cylindrical stalk
    const stalkGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.085, 0.46, 10));
    stalkGeo.rotateX(Math.PI / 2);
    const domeGeo = trackGeo(new THREE.IcosahedronGeometry(0.18, 1));
    const stalkMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0891b2,
        emissive: 0x155e75,
        emissiveIntensity: 0.5,
      })
    );
    const eyeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xeab308,
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.4,
        flatShading: true,
      })
    );
    const stalk = new THREE.Mesh(stalkGeo, stalkMat);
    stalk.position.z = 0.22;
    const dome = new THREE.Mesh(domeGeo, eyeMat);
    dome.position.z = 0.48;
    group.add(stalk, dome);
  } else if (id === 'sense_antenna_chemoreceptor') {
    // 40. Antenas Quimiosensoriales: Two fine curved filiform antennae with blinking nodes
    const curveGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.04, 0.86, 8));
    curveGeo.rotateX(Math.PI / 2);
    curveGeo.translate(0, 0, 0.43);
    const nodeGeo = trackGeo(new THREE.SphereGeometry(0.065, 10, 10));
    const antMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x059669,
        emissiveIntensity: 0.7,
      })
    );
    const nodeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0x10b981,
        emissiveIntensity: 1.8,
      })
    );
    const branches: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const b = new THREE.Group();
      b.rotation.y = side * 0.34;
      const stem = new THREE.Mesh(curveGeo, antMat);
      const tip = new THREE.Mesh(nodeGeo, nodeMat);
      tip.position.z = 0.86;
      b.add(stem, tip);
      group.add(b);
      branches.push(b);
    }

    animateFn = (elapsedTime) => {
      nodeMat.emissiveIntensity = 1.2 + Math.sin(elapsedTime * 9) * 0.7;
      branches[0].rotation.y = -0.34 + Math.sin(elapsedTime * 6) * 0.12;
      branches[1].rotation.y = 0.34 - Math.sin(elapsedTime * 6) * 0.12;
    };
  } else if (id === 'sense_electro_sensor_pores') {
    // 41. Ampollas Electrorreceptoras: Cluster of small circular pores with golden rims
    const poreRingGeo = trackGeo(new THREE.TorusGeometry(0.065, 0.018, 8, 16));
    const rimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xd97706,
        emissiveIntensity: 1.3,
        metalness: 0.7,
      })
    );
    for (let i = -2; i <= 2; i++) {
      const pore = new THREE.Mesh(poreRingGeo, rimMat);
      pore.position.set(i * 0.11, (i % 2) * 0.05, 0.14 - Math.abs(i) * 0.02);
      group.add(pore);
    }
  } else if (id === 'sense_lateral_line_vibrissae') {
    // 42. Línea Lateral Mecanorreceptora: Row of microscopic translucent sensory hairs
    const hairGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.024, 0.44, 6));
    hairGeo.rotateX(Math.PI / 2);
    hairGeo.translate(0, 0, 0.22);
    const hairMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xa5f3fc,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.85,
      })
    );
    const hairs: THREE.Mesh[] = [];
    for (let i = -2; i <= 2; i++) {
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set(i * 0.13, 0, 0.04);
      group.add(hair);
      hairs.push(hair);
    }

    animateFn = (elapsedTime) => {
      for (let i = 0; i < hairs.length; i++) {
        hairs[i].rotation.y = Math.sin(elapsedTime * 8 + i * 0.7) * 0.2;
      }
    };
  } else if (id === 'sense_abyssal_biolum_probe') {
    // 43. Sonda Cefálica Iluminadora: Long articulated stalk arching forward with glowing white-blue lure bulb
    const stalk1Geo = trackGeo(new THREE.CylinderGeometry(0.032, 0.05, 0.52, 8));
    const stalk2Geo = trackGeo(new THREE.CylinderGeometry(0.02, 0.032, 0.46, 8));
    const bulbGeo = trackGeo(new THREE.SphereGeometry(0.14, 16, 16));
    const stalkMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.5,
      })
    );
    const lureMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.2,
        roughness: 0.1,
      })
    );
    const probeArm = new THREE.Group();
    const s1 = new THREE.Mesh(stalk1Geo, stalkMat);
    s1.position.set(0, 0.24, 0.16);
    s1.rotation.x = 0.55;
    const s2 = new THREE.Mesh(stalk2Geo, stalkMat);
    s2.position.set(0, 0.36, 0.52);
    s2.rotation.x = 1.25;
    const bulb = new THREE.Mesh(bulbGeo, lureMat);
    bulb.position.set(0, 0.28, 0.78);
    probeArm.add(s1, s2, bulb);
    group.add(probeArm);

    animateFn = (elapsedTime) => {
      probeArm.rotation.x = Math.sin(elapsedTime * 3.5) * 0.1;
      bulb.scale.setScalar(1.0 + Math.sin(elapsedTime * 7.0) * 0.12);
    };
  } else if (id === 'leg_insectoid') {
    // 44. Patas Quitinosas Segmentadas: 3-segment mantis/cricket chitinous leg with high knee joint
    const chitinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x065f46,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.55,
      })
    );
    const jointMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa7f3d0,
        emissive: 0x10b981,
        emissiveIntensity: 0.7,
        roughness: 0.35,
      })
    );

    const legRoot = new THREE.Group();
    const coxaMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.16, 12, 12)),
      jointMat
    );
    const femurGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.1, 0.78, 10));
    const femurMesh = new THREE.Mesh(femurGeo, chitinMat);
    femurMesh.position.set(0, 0.26, 0.32);
    femurMesh.rotation.x = 0.88;

    const kneeJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.095, 10, 10)),
      jointMat
    );
    kneeJoint.position.set(0, 0.48, 0.62);

    const tibiaGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.065, 1.05, 10));
    const tibiaMesh = new THREE.Mesh(tibiaGeo, chitinMat);
    tibiaMesh.position.set(0, -0.02, 0.78);
    tibiaMesh.rotation.x = -0.32;

    const ankleJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.075, 10, 10)),
      jointMat
    );
    ankleJoint.position.set(0, -0.52, 0.92);

    legRoot.add(coxaMesh, femurMesh, kneeJoint, tibiaMesh, ankleJoint);
    group.add(legRoot);
    distalSocketLocalPos = new THREE.Vector3(0, -0.56, 0.94);

    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const freq = isBoosting ? 14.0 : 8.5;
      const amp = Math.min(1.2, Math.max(0.18, speedRatio)) * 0.38;
      legRoot.rotation.x = Math.sin(elapsedTime * freq) * amp;
    };
  } else if (id === 'leg_digitigrade') {
    // 45. Piernas Digitígradas Felinas: Feline/canine muscular thigh, elevated hock/ankle, and agile shin
    const muscleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0369a1,
        emissiveIntensity: 0.42,
        roughness: 0.42,
        metalness: 0.18,
      })
    );
    const tendonMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x0284c7,
        emissiveIntensity: 0.65,
        roughness: 0.25,
      })
    );

    const legRoot = new THREE.Group();
    const hipMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.22, 14, 14)),
      muscleMat
    );
    hipMesh.scale.set(0.95, 1.15, 1.2);

    const thighGeo = trackGeo(new THREE.CapsuleGeometry(0.15, 0.48, 8, 12));
    const thighMesh = new THREE.Mesh(thighGeo, muscleMat);
    thighMesh.position.set(0, -0.18, 0.28);
    thighMesh.rotation.x = 0.65;

    const kneeMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.13, 12, 12)),
      tendonMat
    );
    kneeMesh.position.set(0, -0.36, 0.52);

    const shinGeo = trackGeo(new THREE.CapsuleGeometry(0.095, 0.46, 8, 12));
    const shinMesh = new THREE.Mesh(shinGeo, muscleMat);
    shinMesh.position.set(0, -0.58, 0.36);
    shinMesh.rotation.x = -0.55;

    const hockMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.1, 10, 10)),
      tendonMat
    );
    hockMesh.position.set(0, -0.78, 0.2);

    const metatarsalGeo = trackGeo(
      new THREE.CylinderGeometry(0.065, 0.08, 0.38, 10)
    );
    const metatarsalMesh = new THREE.Mesh(metatarsalGeo, tendonMat);
    metatarsalMesh.position.set(0, -0.92, 0.38);
    metatarsalMesh.rotation.x = 0.68;

    legRoot.add(
      hipMesh,
      thighMesh,
      kneeMesh,
      shinMesh,
      hockMesh,
      metatarsalMesh
    );
    group.add(legRoot);
    distalSocketLocalPos = new THREE.Vector3(0, -1.04, 0.52);

    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const freq = isBoosting ? 12.5 : 7.5;
      const amp = Math.min(1.2, Math.max(0.15, speedRatio)) * 0.42;
      legRoot.rotation.x = Math.sin(elapsedTime * freq) * amp;
    };
  } else if (id === 'leg_plantigrade') {
    // 46. Piernas Plantígradas Robustas: Heavy ursine/primate muscular leg column
    const heavyMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x0f766e,
        emissiveIntensity: 0.38,
        roughness: 0.55,
        metalness: 0.15,
      })
    );
    const kneeCapMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x99f6e4,
        emissive: 0x0d9488,
        emissiveIntensity: 0.55,
        roughness: 0.3,
      })
    );

    const legRoot = new THREE.Group();
    const thighGeo = trackGeo(new THREE.CapsuleGeometry(0.2, 0.48, 8, 14));
    const thighMesh = new THREE.Mesh(thighGeo, heavyMat);
    thighMesh.position.set(0, -0.24, 0.26);
    thighMesh.rotation.x = 0.42;

    const kneeCap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.17, 12, 12)),
      kneeCapMat
    );
    kneeCap.position.set(0, -0.48, 0.44);

    const calfGeo = trackGeo(new THREE.CapsuleGeometry(0.16, 0.46, 8, 14));
    const calfMesh = new THREE.Mesh(calfGeo, heavyMat);
    calfMesh.position.set(0, -0.78, 0.42);
    calfMesh.rotation.x = -0.12;

    legRoot.add(thighMesh, kneeCap, calfMesh);
    group.add(legRoot);
    distalSocketLocalPos = new THREE.Vector3(0, -1.06, 0.44);

    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const freq = isBoosting ? 10.5 : 6.5;
      const amp = Math.min(1.2, Math.max(0.15, speedRatio)) * 0.34;
      legRoot.rotation.x = Math.sin(elapsedTime * freq) * amp;
    };
  } else if (id === 'leg_ungulate') {
    // 47. Patas Unguladas de Pezuña: High-speed slender elastic cursorial deer/equine leg
    const cursorialMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xb45309,
        emissiveIntensity: 0.45,
        roughness: 0.35,
        metalness: 0.3,
      })
    );
    const boneJointMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        emissive: 0xd97706,
        emissiveIntensity: 0.65,
        roughness: 0.22,
      })
    );

    const legRoot = new THREE.Group();
    const haunchGeo = trackGeo(new THREE.SphereGeometry(0.21, 14, 14));
    haunchGeo.scale(0.85, 1.25, 1.3);
    const haunchMesh = new THREE.Mesh(haunchGeo, cursorialMat);
    haunchMesh.position.set(0, -0.05, 0.16);

    const upperLegGeo = trackGeo(
      new THREE.CylinderGeometry(0.085, 0.14, 0.56, 10)
    );
    const upperLeg = new THREE.Mesh(upperLegGeo, cursorialMat);
    upperLeg.position.set(0, -0.32, 0.34);
    upperLeg.rotation.x = 0.52;

    const hockJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.1, 10, 10)),
      boneJointMat
    );
    hockJoint.position.set(0, -0.58, 0.48);

    const cannonBoneGeo = trackGeo(
      new THREE.CylinderGeometry(0.048, 0.072, 0.64, 10)
    );
    const cannonBone = new THREE.Mesh(cannonBoneGeo, boneJointMat);
    cannonBone.position.set(0, -0.88, 0.42);
    cannonBone.rotation.x = -0.18;

    legRoot.add(haunchMesh, upperLeg, hockJoint, cannonBone);
    group.add(legRoot);
    distalSocketLocalPos = new THREE.Vector3(0, -1.16, 0.38);

    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const freq = isBoosting ? 14.5 : 8.8;
      const amp = Math.min(1.25, Math.max(0.18, speedRatio)) * 0.46;
      legRoot.rotation.x = Math.sin(elapsedTime * freq) * amp;
    };
  } else if (id === 'leg_reptilian') {
    // 48. Patas Reptilianas Acorazadas: Wide splayed scaly saurian leg with osteoderm armor plates
    const scaleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x059669,
        emissive: 0x064e3b,
        emissiveIntensity: 0.42,
        roughness: 0.48,
        metalness: 0.25,
      })
    );
    const osteodermMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa7f3d0,
        emissive: 0x10b981,
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.55,
      })
    );

    const legRoot = new THREE.Group();
    const thighGeo = trackGeo(new THREE.CapsuleGeometry(0.19, 0.44, 8, 12));
    const thighMesh = new THREE.Mesh(thighGeo, scaleMat);
    thighMesh.position.set(0, -0.16, 0.32);
    thighMesh.rotation.x = 0.72;

    const shinGeo = trackGeo(new THREE.CapsuleGeometry(0.15, 0.44, 8, 12));
    const shinMesh = new THREE.Mesh(shinGeo, scaleMat);
    shinMesh.position.set(0, -0.62, 0.56);
    shinMesh.rotation.x = 0.14;

    // Dorsal osteoderm scutes along thigh & shin
    const scuteGeo = trackGeo(new THREE.ConeGeometry(0.085, 0.22, 6));
    for (let s = 0; s < 3; s++) {
      const scute = new THREE.Mesh(scuteGeo, osteodermMat);
      scute.position.set(0, -0.12 - s * 0.24, 0.44 + s * 0.12);
      scute.rotation.x = 0.85;
      legRoot.add(scute);
    }

    legRoot.add(thighMesh, shinMesh);
    group.add(legRoot);
    distalSocketLocalPos = new THREE.Vector3(0, -0.96, 0.62);

    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const freq = isBoosting ? 10.0 : 6.2;
      const amp = Math.min(1.2, Math.max(0.15, speedRatio)) * 0.35;
      legRoot.rotation.x = Math.sin(elapsedTime * freq) * amp;
    };
  } else if (id === 'arm_slender') {
    // 49. Brazos Gráciles Ágiles: Flexible slender articulated arm with wrist socket
    const armMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      })
    );
    const jointMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.7,
        roughness: 0.25,
      })
    );

    const armRoot = new THREE.Group();
    const shoulder = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.14, 12, 12)),
      jointMat
    );
    const humerusGeo = trackGeo(new THREE.CapsuleGeometry(0.075, 0.42, 8, 10));
    humerusGeo.rotateX(Math.PI / 2);
    const humerus = new THREE.Mesh(humerusGeo, armMat);
    humerus.position.set(0, 0.02, 0.26);

    const elbow = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.095, 10, 10)),
      jointMat
    );
    elbow.position.set(0, 0.02, 0.5);

    const forearmGeo = trackGeo(new THREE.CapsuleGeometry(0.065, 0.42, 8, 10));
    forearmGeo.rotateX(Math.PI / 2);
    const forearm = new THREE.Mesh(forearmGeo, armMat);
    forearm.position.set(0.08, 0.04, 0.74);
    forearm.rotation.y = 0.25;

    armRoot.add(shoulder, humerus, elbow, forearm);
    group.add(armRoot);
    distalSocketLocalPos = new THREE.Vector3(0.14, 0.05, 0.98);

    animateFn = (elapsedTime) => {
      armRoot.rotation.y = Math.sin(elapsedTime * 3.2) * 0.1;
      armRoot.rotation.x = Math.cos(elapsedTime * 2.5) * 0.06;
    };
  } else if (id === 'arm_brawny') {
    // 50. Brazos Musculosos de Gorila: Massive deltoid, hypertrophic bicep and heavy forearm
    const brawnMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0x881337,
        emissiveIntensity: 0.42,
        roughness: 0.45,
        metalness: 0.15,
      })
    );
    const veinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfda4af,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.75,
        roughness: 0.28,
      })
    );

    const armRoot = new THREE.Group();
    const deltoid = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.24, 14, 14)),
      brawnMat
    );
    deltoid.scale.set(1.1, 1.15, 1.25);
    deltoid.position.set(0, 0.06, 0.12);

    const bicepGeo = trackGeo(new THREE.CapsuleGeometry(0.15, 0.38, 8, 12));
    bicepGeo.rotateX(Math.PI / 2);
    const bicep = new THREE.Mesh(bicepGeo, brawnMat);
    bicep.position.set(0, 0.04, 0.38);

    const elbow = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.14, 12, 12)),
      veinMat
    );
    elbow.position.set(0, 0.02, 0.62);

    const forearmGeo = trackGeo(new THREE.CapsuleGeometry(0.16, 0.44, 8, 12));
    forearmGeo.rotateX(Math.PI / 2);
    const forearm = new THREE.Mesh(forearmGeo, brawnMat);
    forearm.position.set(0.06, -0.02, 0.88);
    forearm.rotation.y = 0.22;

    armRoot.add(deltoid, bicep, elbow, forearm);
    group.add(armRoot);
    distalSocketLocalPos = new THREE.Vector3(0.12, -0.04, 1.16);

    animateFn = (elapsedTime, _speedRatio, isBoosting) => {
      const flex = isBoosting ? 0.24 : 0.08;
      armRoot.rotation.y = Math.sin(elapsedTime * 4.5) * flex;
    };
  } else if (id === 'arm_praying') {
    // 51. Brazos Raptores Tipo Mantis: Folding raptorial arm with serrated forearm spines
    const mantisMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x84cc16,
        emissive: 0x3f6212,
        emissiveIntensity: 0.5,
        roughness: 0.24,
        metalness: 0.45,
      })
    );
    const spineMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xca8a04,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.65,
      })
    );

    const armRoot = new THREE.Group();
    const coxa = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.07, 0.095, 0.46, 10)),
      mantisMat
    );
    coxa.rotation.x = Math.PI / 2;
    coxa.position.set(0, 0.08, 0.24);

    const femur = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.095, 0.48, 8, 10)),
      mantisMat
    );
    femur.rotation.x = Math.PI / 2 - 0.35;
    femur.position.set(0, 0.18, 0.64);

    // Forearm serrated spines
    const barbGeo = trackGeo(new THREE.ConeGeometry(0.04, 0.22, 6));
    for (let b = 0; b < 4; b++) {
      const barb = new THREE.Mesh(barbGeo, spineMat);
      barb.position.set(0, 0.04, 0.46 + b * 0.11);
      barb.rotation.x = Math.PI * 0.85;
      armRoot.add(barb);
    }

    const sickleTip = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.065, 0.38, 8)),
      spineMat
    );
    sickleTip.position.set(0, 0.08, 1.02);
    sickleTip.rotation.x = Math.PI * 0.72;

    armRoot.add(coxa, femur, sickleTip);
    group.add(armRoot);
    distalSocketLocalPos = new THREE.Vector3(0, 0.14, 0.96);

    animateFn = (elapsedTime, _speedRatio, isBoosting) => {
      const strike = Math.sin(elapsedTime * (isBoosting ? 12.0 : 5.0)) * 0.18;
      armRoot.rotation.x = strike;
    };
  } else if (id === 'arm_patagium') {
    // 52. Brazos Alares con Membrana de Murciélago: Extended wing-arm with translucent patagium membrane
    const boneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x6b21a8,
        emissiveIntensity: 0.5,
        roughness: 0.3,
      })
    );
    const wingMembraneMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xd8b4fe,
        emissive: 0x9333ea,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        transmission: 0.55,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
      })
    );

    const wingRoot = new THREE.Group();
    const spar1Geo = trackGeo(new THREE.CylinderGeometry(0.045, 0.075, 0.62, 10));
    spar1Geo.rotateX(Math.PI / 2);
    const spar1 = new THREE.Mesh(spar1Geo, boneMat);
    spar1.position.set(0, 0.08, 0.31);

    const spar2Geo = trackGeo(new THREE.CylinderGeometry(0.03, 0.05, 0.68, 10));
    spar2Geo.rotateX(Math.PI / 2);
    const spar2 = new THREE.Mesh(spar2Geo, boneMat);
    spar2.position.set(0, 0.12, 0.92);
    spar2.rotation.x = -0.12;

    // Patagium Wing Membrane Triangle/Fan
    const patagiumShape = new THREE.Shape();
    patagiumShape.moveTo(0, 0);
    patagiumShape.lineTo(1.22, 0.12);
    patagiumShape.quadraticCurveTo(0.85, -0.45, 0.52, -0.58);
    patagiumShape.quadraticCurveTo(0.25, -0.42, 0, -0.35);
    patagiumShape.closePath();

    const patagiumGeo = trackGeo(new THREE.ShapeGeometry(patagiumShape));
    patagiumGeo.rotateY(-Math.PI / 2);
    const patagiumMesh = new THREE.Mesh(patagiumGeo, wingMembraneMat);
    patagiumMesh.position.set(0, 0.08, 0.05);

    wingRoot.add(spar1, spar2, patagiumMesh);
    group.add(wingRoot);
    distalSocketLocalPos = new THREE.Vector3(0, 0.14, 1.24);

    animateFn = (elapsedTime, speedRatio, isBoosting) => {
      const flapFreq = isBoosting ? 11.0 : 4.8 + speedRatio * 3.0;
      wingRoot.rotation.z = Math.sin(elapsedTime * flapFreq) * 0.28;
    };
  } else if (id === 'arm_armored') {
    // 53. Brazos Plaqueados Quitinosos: Chitin-plated gauntlet arm with overlapping defensive shields
    const armorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0x92400e,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.68,
      })
    );
    const trimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        roughness: 0.18,
        metalness: 0.75,
      })
    );

    const armRoot = new THREE.Group();
    const pauldronGeo = trackGeo(
      new THREE.SphereGeometry(0.24, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6)
    );
    const pauldron = new THREE.Mesh(pauldronGeo, armorMat);
    pauldron.position.set(0, 0.08, 0.18);
    pauldron.rotation.x = Math.PI * 0.35;

    const vambraceGeo = trackGeo(
      new THREE.CylinderGeometry(0.14, 0.18, 0.56, 8)
    );
    vambraceGeo.rotateX(Math.PI / 2);
    const vambrace = new THREE.Mesh(vambraceGeo, armorMat);
    vambrace.position.set(0, 0, 0.62);

    // Overlapping dorsal shield plates on forearm
    const plateGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.06, 0.22));
    for (let p = 0; p < 3; p++) {
      const plate = new THREE.Mesh(plateGeo, trimMat);
      plate.position.set(0, 0.14, 0.44 + p * 0.18);
      plate.rotation.x = -0.18;
      armRoot.add(plate);
    }

    armRoot.add(pauldron, vambrace);
    group.add(armRoot);
    distalSocketLocalPos = new THREE.Vector3(0, 0, 0.94);

    animateFn = (elapsedTime) => {
      armRoot.rotation.y = Math.sin(elapsedTime * 3.0) * 0.08;
    };
  } else if (id === 'hand_primate') {
    // 54. Manos Oponibles Prensiles: Palm + 4 articulated fingers + opposable thumb
    const handMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      })
    );
    const tipMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      })
    );

    const handRoot = new THREE.Group();
    const palmGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.09, 0.24));
    const palmMesh = new THREE.Mesh(palmGeo, handMat);
    palmMesh.position.set(0, 0, 0.12);
    handRoot.add(palmMesh);

    const fingerGeo = trackGeo(new THREE.CapsuleGeometry(0.026, 0.16, 6, 8));
    fingerGeo.rotateX(Math.PI / 2);
    const fingers: THREE.Mesh[] = [];
    for (let f = -1.5; f <= 1.5; f += 1.0) {
      const finger = new THREE.Mesh(fingerGeo, tipMat);
      finger.position.set(f * 0.065, 0, 0.31);
      finger.rotation.y = f * 0.08;
      handRoot.add(finger);
      fingers.push(finger);
    }

    // Opposable thumb
    const thumb = new THREE.Mesh(fingerGeo, tipMat);
    thumb.position.set(-0.16, -0.02, 0.18);
    thumb.rotation.y = -0.68;
    handRoot.add(thumb);
    group.add(handRoot);

    animateFn = (elapsedTime) => {
      const curl = Math.sin(elapsedTime * 4.2) * 0.16;
      for (const fg of fingers) {
        fg.rotation.x = 0.2 + curl;
      }
      thumb.rotation.z = curl * 0.8;
    };
  } else if (id === 'hand_talons') {
    // 55. Garras Afiladas de Raptor: Muscular raptor wrist with 3 wickedly curved keratin talons
    const wristMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0x881337,
        emissiveIntensity: 0.45,
        roughness: 0.38,
      })
    );
    const talonMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        roughness: 0.15,
        metalness: 0.72,
      })
    );

    const talonRoot = new THREE.Group();
    const carpus = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.15, 12, 12)),
      wristMat
    );
    carpus.scale.set(1.2, 0.75, 1.1);
    carpus.position.set(0, 0, 0.1);
    talonRoot.add(carpus);

    const clawGeo = trackGeo(new THREE.ConeGeometry(0.048, 0.42, 8));
    clawGeo.rotateX(Math.PI * 0.62);
    for (const side of [-1, 0, 1]) {
      const claw = new THREE.Mesh(clawGeo, talonMat);
      claw.position.set(side * 0.1, -0.04, 0.34);
      claw.rotation.y = side * 0.22;
      talonRoot.add(claw);
    }
    group.add(talonRoot);

    animateFn = (elapsedTime, _speedRatio, isBoosting) => {
      const slash = Math.sin(elapsedTime * (isBoosting ? 14.0 : 5.5)) * 0.24;
      talonRoot.rotation.x = slash;
    };
  } else if (id === 'hand_insect_claw') {
    // 56. Pinzas Quitinosas de Cangrejo: Heavy articulated crustacean chela pincer
    const shellMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0x9a3412,
        emissiveIntensity: 0.48,
        roughness: 0.24,
        metalness: 0.58,
      })
    );
    const toothMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xd97706,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      })
    );

    const chelaGroup = new THREE.Group();
    const basePalm = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.18, 14, 14)),
      shellMat
    );
    basePalm.scale.set(1.15, 0.82, 1.35);
    basePalm.position.set(0, 0, 0.16);
    chelaGroup.add(basePalm);

    const jawGeo = trackGeo(new THREE.ConeGeometry(0.085, 0.44, 10));
    jawGeo.rotateX(Math.PI / 2);
    jawGeo.translate(0, 0, 0.22);

    const leftPincer = new THREE.Mesh(jawGeo, toothMat);
    leftPincer.position.set(-0.08, 0, 0.26);
    const rightPincer = new THREE.Mesh(jawGeo, shellMat);
    rightPincer.position.set(0.08, 0, 0.26);

    chelaGroup.add(leftPincer, rightPincer);
    group.add(chelaGroup);

    animateFn = (elapsedTime) => {
      const pinch = Math.abs(Math.sin(elapsedTime * 5.2)) * 0.28;
      leftPincer.rotation.y = -0.12 + pinch;
      rightPincer.rotation.y = 0.12 - pinch;
    };
  } else if (id === 'foot_paw') {
    // 57. Zarpas con Almohadillas Suaves: Cushioned feline/lupine paw with soft stealth pads & 4 toes
    const pawMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0369a1,
        emissiveIntensity: 0.42,
        roughness: 0.45,
      })
    );
    const padMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.75,
        roughness: 0.3,
      })
    );

    const pawGroup = new THREE.Group();
    const mainPad = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.18, 14, 12)),
      pawMat
    );
    mainPad.scale.set(1.15, 0.52, 1.35);
    mainPad.position.set(0, 0, 0.14);
    pawGroup.add(mainPad);

    const toeGeo = trackGeo(new THREE.SphereGeometry(0.068, 10, 10));
    toeGeo.scale(0.9, 0.65, 1.35);
    for (let t = -1.5; t <= 1.5; t += 1.0) {
      const toe = new THREE.Mesh(toeGeo, padMat);
      toe.position.set(t * 0.085, -0.01, 0.34 - Math.abs(t) * 0.03);
      pawGroup.add(toe);
    }
    group.add(pawGroup);
  } else if (id === 'foot_hoof') {
    // 58. Pezuñas Clíperas de Embestida: Hardened cloven charging hoof with glowing keratin cleft
    const hoofMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0x92400e,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.65,
      })
    );
    const glowCleftMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xd97706,
        emissiveIntensity: 0.95,
        roughness: 0.18,
      })
    );

    const hoofGroup = new THREE.Group();
    const fetlock = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.1, 0.14, 0.18, 12)),
      hoofMat
    );
    fetlock.position.set(0, 0.06, 0.08);

    const lobeGeo = trackGeo(new THREE.CylinderGeometry(0.065, 0.1, 0.22, 10));
    for (const side of [-1, 1]) {
      const lobe = new THREE.Mesh(lobeGeo, hoofMat);
      lobe.position.set(side * 0.068, -0.06, 0.18);
      lobe.rotation.x = 0.28;
      hoofGroup.add(lobe);
    }

    const cleft = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.025, 0.16, 0.24)),
      glowCleftMat
    );
    cleft.position.set(0, -0.05, 0.2);
    hoofGroup.add(fetlock, cleft);
    group.add(hoofGroup);
  } else if (id === 'foot_webbed') {
    // 59. Pies Palmeados de Anfibio: Wide amphibian webbed foot with 3 long toes & bioluminescent webbing
    const toeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x047857,
        emissiveIntensity: 0.5,
        roughness: 0.32,
      })
    );
    const webMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x6ee7b7,
        emissive: 0x10b981,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        transmission: 0.5,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
      })
    );

    const webGroup = new THREE.Group();
    const digitGeo = trackGeo(new THREE.CapsuleGeometry(0.035, 0.34, 6, 8));
    digitGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 0, 1]) {
      const digit = new THREE.Mesh(digitGeo, toeMat);
      digit.position.set(side * 0.11, 0, 0.22);
      digit.rotation.y = side * 0.38;
      webGroup.add(digit);
    }

    const fanGeo = trackGeo(
      new THREE.CircleGeometry(0.36, 16, Math.PI * 0.22, Math.PI * 0.56)
    );
    fanGeo.rotateX(-Math.PI / 2);
    const fanMesh = new THREE.Mesh(fanGeo, webMat);
    fanMesh.position.set(0, -0.01, 0.04);
    webGroup.add(fanMesh);
    group.add(webGroup);
  }

  // Attach 3-node articulated joint rig to all legs & arms
  if (distalSocketLocalPos && group.children.length > 0) {
    const limbRoot = group.children[0] as THREE.Group;
    if (limbRoot && limbRoot.isGroup) {
      const midPos = distalSocketLocalPos.clone().multiplyScalar(0.52);
      if (id.startsWith('leg_')) {
        midPos.y += 0.14;
      }
      attachLimbJointRig(limbRoot, midPos, distalSocketLocalPos);
    }
  }

  // Selection / Preview ring at base of organ
  const highlightRingGeo = trackGeo(new THREE.RingGeometry(0.24, 0.33, 24));
  const highlightRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const highlightRing = new THREE.Mesh(highlightRingGeo, highlightRingMat);
  highlightRing.position.set(0, 0, 0.03);
  highlightRing.visible = false;

  const setHighlight = (
    mode: 'none' | 'selected' | 'preview_valid' | 'preview_invalid'
  ) => {
    const showJointGizmos = mode === 'selected';
    for (const jg of jointGizmoGroups) {
      jg.visible = showJointGizmos;
    }
    if (mode === 'none') {
      highlightRing.visible = false;
      if (highlightRing.parent === group) {
        group.remove(highlightRing);
      }
      return;
    }
    if (highlightRing.parent !== group) {
      group.add(highlightRing);
    }
    highlightRing.visible = true;
    if (mode === 'selected') {
      highlightRingMat.color.setHex(0xfacc15);
      highlightRingMat.opacity = 0.92;
    } else if (mode === 'preview_valid') {
      highlightRingMat.color.setHex(0x34d399);
      highlightRingMat.opacity = 0.85;
    } else {
      highlightRingMat.color.setHex(0xf43f5e);
      highlightRingMat.opacity = 0.85;
    }
  };

  let currentColorOverride: string | undefined = undefined;
  let currentCoatBaseHex: string | undefined = undefined;
  let currentCoatDetailHex: string | undefined = undefined;

  const applyEffectiveColors = () => {
    if (currentColorOverride) {
      const targetColor = new THREE.Color(currentColorOverride);
      const targetEmissive = targetColor.clone().multiplyScalar(0.55);
      for (const entry of tintableMaterials) {
        const origColor = new THREE.Color(entry.origColorHex);
        entry.mat.color.copy(origColor).lerp(targetColor, 0.78);
        if (entry.origEmissiveHex !== 0x000000) {
          const origEm = new THREE.Color(entry.origEmissiveHex);
          entry.mat.emissive.copy(origEm).lerp(targetEmissive, 0.75);
        } else {
          entry.mat.emissive.copy(targetEmissive).multiplyScalar(0.35);
        }
      }
      return;
    }

    if (!currentCoatBaseHex && !currentCoatDetailHex) {
      for (const entry of tintableMaterials) {
        entry.mat.color.setHex(entry.origColorHex);
        entry.mat.emissive.setHex(entry.origEmissiveHex);
      }
      return;
    }

    const baseColor = currentCoatBaseHex
      ? new THREE.Color(currentCoatBaseHex)
      : null;
    const detailColor = currentCoatDetailHex
      ? new THREE.Color(currentCoatDetailHex)
      : null;

    for (const entry of tintableMaterials) {
      const origColor = new THREE.Color(entry.origColorHex);
      const target = entry.isDetailAccent
        ? detailColor ?? baseColor
        : baseColor ?? detailColor;
      if (target) {
        const blendFactor = entry.isDetailAccent ? 0.82 : 0.72;
        entry.mat.color.copy(origColor).lerp(target, blendFactor);
        const targetEm = target.clone().multiplyScalar(0.48);
        if (entry.origEmissiveHex !== 0x000000) {
          const origEm = new THREE.Color(entry.origEmissiveHex);
          entry.mat.emissive.copy(origEm).lerp(targetEm, 0.7);
        } else {
          entry.mat.emissive.copy(targetEm).multiplyScalar(0.3);
        }
      } else {
        entry.mat.color.setHex(entry.origColorHex);
        entry.mat.emissive.setHex(entry.origEmissiveHex);
      }
    }
  };

  const setColorOverride = (colorHex?: string) => {
    const normalized = colorHex?.trim() || undefined;
    if (currentColorOverride === normalized) return;
    currentColorOverride = normalized;
    applyEffectiveColors();
  };

  const setCoatColors = (baseColorHex?: string, detailColorHex?: string) => {
    const normBase = baseColorHex?.trim() || undefined;
    const normDetail = detailColorHex?.trim() || undefined;
    if (
      currentCoatBaseHex === normBase &&
      currentCoatDetailHex === normDetail
    ) {
      return;
    }
    currentCoatBaseHex = normBase;
    currentCoatDetailHex = normDetail;
    applyEffectiveColors();
  };

  const setLimbPose = (
    upperJointAngle: number,
    middleJointAngle: number,
    boneLength: number
  ) => {
    if (
      !limbProximalPivot ||
      !limbMiddlePivot ||
      !limbDistalSocketGroup ||
      !baseDistalSocketPos ||
      !distalSocketLocalPos
    ) {
      return;
    }
    savedUpperJointAngle = THREE.MathUtils.clamp(upperJointAngle, -1.0, 1.0);
    savedMiddleJointAngle = THREE.MathUtils.clamp(middleJointAngle, -1.2, 1.2);
    savedBoneLength = THREE.MathUtils.clamp(boneLength, 0.6, 1.75);

    limbProximalPivot.rotation.x = savedUpperJointAngle;
    limbProximalPivot.scale.set(1, savedBoneLength, savedBoneLength);
    limbMiddlePivot.rotation.x = savedMiddleJointAngle;
    // Counter-scale distalSocketGroup so attached Feet/Hands are not distorted by boneLength
    limbDistalSocketGroup.scale.set(1, 1 / savedBoneLength, 1 / savedBoneLength);
    if (id.startsWith('leg_')) {
      // Counter-rotate ankle so foot sole aligns horizontally parallel to ground floor
      limbDistalSocketGroup.rotation.x = -(
        savedUpperJointAngle + savedMiddleJointAngle
      );
    }

    limbProximalPivot.updateMatrix();
    limbMiddlePivot.updateMatrix();
    limbDistalSocketGroup.updateMatrix();

    // Compute exact local socket position inside `group` after bone bending & stretching
    const socketPos = new THREE.Vector3();
    socketPos.copy(limbDistalSocketGroup.position);
    socketPos.applyMatrix4(limbMiddlePivot.matrix);
    socketPos.applyMatrix4(limbProximalPivot.matrix);
    distalSocketLocalPos.copy(socketPos);
  };

  const getBoneNode = (role: LimbBoneRole): THREE.Object3D | null => {
    switch (role) {
      case 'hip':
      case 'shoulder':
        return limbProximalPivot ?? group.children[0] ?? null;
      case 'knee':
      case 'elbow':
        return limbMiddlePivot ?? null;
      case 'ankle':
      case 'wrist':
        return limbDistalSocketGroup ?? null;
      case 'foot':
      case 'hand':
        return limbDistalSocketGroup && limbDistalSocketGroup.children.length > 0
          ? limbDistalSocketGroup.children[0]
          : null;
      default:
        return null;
    }
  };

  const wrappedAnimate = (
    elapsedTime: number,
    speedRatio: number,
    isBoosting: boolean
  ) => {
    // Legs and arms are driven by the biphasic procedural gait engine (updateLimbAnimations in PlayerCell)
    if (id.startsWith('leg_') || id.startsWith('arm_')) {
      return;
    }
    animateFn(elapsedTime, speedRatio, isBoosting);
  };

  return {
    group,
    position: group.position,
    nozzleLocalPos,
    distalSocketLocalPos,
    distalSocketGroup: limbDistalSocketGroup,
    getBoneNode,
    animate: wrappedAnimate,
    setHighlight,
    setColorOverride,
    setCoatColors,
    setLimbPose,
    getLowestFootWorldY: () => {
      group.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(group).min.y;
    },
    getLowestFootLocalY: () => {
      group.updateMatrix();
      if (distalSocketLocalPos) {
        const footSolePos = distalSocketLocalPos.clone();
        footSolePos.y -= 0.05;
        footSolePos.applyMatrix4(group.matrix);
        return footSolePos.y;
      }
      return group.position.y - 0.75 * group.scale.y;
    },
    getJointGizmoObjects: () => jointGizmoHitMeshes,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

const CLONE_COLOR_THEMES: Record<
  CellColorTheme,
  {
    membraneColor: number;
    membraneEmissive: number;
    nucleusColor: number;
    nucleusEmissive: number;
  }
> = {
  cyan: {
    membraneColor: 0x22d3ee,
    membraneEmissive: 0x0891b2,
    nucleusColor: 0xa7f3d0,
    nucleusEmissive: 0x10b981,
  },
  emerald: {
    membraneColor: 0x34d399,
    membraneEmissive: 0x059669,
    nucleusColor: 0xfef08a,
    nucleusEmissive: 0x84cc16,
  },
  crimson: {
    membraneColor: 0xfb7185,
    membraneEmissive: 0xe11d48,
    nucleusColor: 0xfde047,
    nucleusEmissive: 0xf97316,
  },
  violet: {
    membraneColor: 0xc084fc,
    membraneEmissive: 0x7e22ce,
    nucleusColor: 0x67e8f9,
    nucleusEmissive: 0x06b6d4,
  },
};

/**
 * Construye un clon 3D exacto de la morfología celular del jugador (membrana, núcleo y órganos acoplados)
 * para poblar la sopa primigenia con congéneres idénticos de la misma especie.
 */
export function buildCellMeshClone(
  bodyShape: CellBodyShape,
  colorTheme: CellColorTheme,
  placedOrgans: readonly PlacedOrganInstance[],
  growthStage: number
): THREE.Group {
  const rootGroup = new THREE.Group();
  const palette = CLONE_COLOR_THEMES[colorTheme] ?? CLONE_COLOR_THEMES.cyan;

  const shapeFactors =
    bodyShape === 'esferico'
      ? { sx: 1.18, sy: 1.0, sz: 0.84 }
      : bodyShape === 'alargado'
      ? { sx: 0.8, sy: 0.92, sz: 1.24 }
      : { sx: 1.0, sy: 1.0, sz: 1.0 };

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const organVisuals: OrganVisualInstance[] = [];

  // 1. Membrana celular translúcida
  const membraneGeo = new THREE.SphereGeometry(0.95, 22, 18);
  membraneGeo.scale(
    shapeFactors.sx,
    0.68 * shapeFactors.sy,
    1.42 * shapeFactors.sz
  );
  geometries.push(membraneGeo);

  const membraneMat = new THREE.MeshPhysicalMaterial({
    color: palette.membraneColor,
    emissive: palette.membraneEmissive,
    emissiveIntensity: 0.38,
    roughness: 0.18,
    metalness: 0.05,
    transmission: 0.62,
    transparent: true,
    opacity: 0.88,
  });
  materials.push(membraneMat);

  const membraneMesh = new THREE.Mesh(membraneGeo, membraneMat);
  rootGroup.add(membraneMesh);

  // 2. Núcleo celular bioluminiscente interno
  const nucleusGeo = new THREE.SphereGeometry(0.42, 16, 14);
  nucleusGeo.scale(1.0, 0.78, 1.15);
  geometries.push(nucleusGeo);

  const nucleusMat = new THREE.MeshStandardMaterial({
    color: palette.nucleusColor,
    emissive: palette.nucleusEmissive,
    emissiveIntensity: 0.95,
    roughness: 0.3,
  });
  materials.push(nucleusMat);

  const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
  nucleusMesh.position.set(0, 0.04, 0.08);
  rootGroup.add(nucleusMesh);

  // 3. Órganos instalados clonados con simetría bilateral y escala morfológica
  const rx = 0.92 * shapeFactors.sx;
  const rz = 1.35 * shapeFactors.sz;

  const attachOrganAtAngle = (inst: PlacedOrganInstance, angle: number, isMirror: boolean) => {
    const visual = createOrganVisual(inst.adaptationId);
    const x = Math.sin(angle) * rx;
    const z = Math.cos(angle) * rz;
    const normalAngle = Math.atan2(x / (rx * rx), z / (rz * rz));

    const yaw = (inst.orientationYaw ?? 0) * (isMirror ? -1 : 1);
    const pitch = inst.orientationPitch ?? 0;

    visual.group.position.set(x, 0.02, z);
    visual.group.rotation.set(pitch, normalAngle + yaw, 0);

    const morph = inst.morphology;
    if (morph) {
      const sOverall = morph.scaleOverall ?? 1.0;
      const sW = morph.scaleWidth ?? 1.0;
      const sH = morph.scaleHeight ?? 1.0;
      visual.group.scale.set(
        sOverall * sW * (isMirror ? -1 : 1),
        sOverall,
        sOverall * sH
      );
    } else if (isMirror) {
      visual.group.scale.set(-1, 1, 1);
    }


    rootGroup.add(visual.group);
    organVisuals.push(visual);
  };


  for (const inst of placedOrgans) {
    attachOrganAtAngle(inst, inst.angle, false);
    if (inst.mirrorSymmetry && Math.abs(Math.sin(inst.angle)) > 0.16) {
      attachOrganAtAngle(inst, -inst.angle, true);
    }
  }

  // 4. Escala según etapa de crecimiento (1..5)
  const stageScale = 0.85 + Math.max(1, Math.min(5, growthStage)) * 0.1;
  rootGroup.scale.setScalar(stageScale);

  rootGroup.userData.organVisuals = organVisuals;
  rootGroup.userData.disposeClone = () => {
    for (const v of organVisuals) v.dispose();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  };

  return rootGroup;
}

/**
 * Clona al 100% la estructura morfológica 3D real de la célula del jugador
 * (membrana esculpida, material físico con tema de color, núcleo, orgánulos
 * internos y todos los órganos colocados con sus posiciones, giros, escalas y simetría).
 */
export function buildIdenticalCellClone(playerCell: PlayerCell): THREE.Group {
  const cloneGroup = new THREE.Group();
  const clonedGeometries: THREE.BufferGeometry[] = [];

  // 1. Clonar la membrana celular exacta (con su geometría deformada por columna y su material actual)
  const originalMembrane = playerCell.cellMembraneMesh;
  if (originalMembrane) {
    const clonedGeo = originalMembrane.geometry.clone();
    clonedGeometries.push(clonedGeo);

    const clonedMembrane = new THREE.Mesh(clonedGeo, originalMembrane.material);
    clonedMembrane.scale.copy(originalMembrane.scale);
    clonedMembrane.position.copy(originalMembrane.position);
    clonedMembrane.rotation.copy(originalMembrane.rotation);
    clonedMembrane.castShadow = originalMembrane.castShadow;
    clonedMembrane.receiveShadow = originalMembrane.receiveShadow;

    // Clonar orgánulos internos (núcleo bioluminiscente, mitocondrias/vacuolas y cilios visibles)
    for (const child of originalMembrane.children) {
      if (!child.visible) continue;
      const clonedChild = child.clone(true);
      clonedMembrane.add(clonedChild);
    }

    cloneGroup.add(clonedMembrane);
  }

  // 2. Clonar todos los órganos colocados (bocas, ojos, flagelos, púas, glándulas) en su posición y escala exacta
  for (const organEntry of playerCell.activeOrganEntries) {
    if (organEntry.primary && organEntry.primary.group.visible) {
      const clonedPrimary = organEntry.primary.group.clone(true);
      clonedPrimary.position.copy(organEntry.primary.group.position);
      clonedPrimary.rotation.copy(organEntry.primary.group.rotation);
      clonedPrimary.scale.copy(organEntry.primary.group.scale);
      cloneGroup.add(clonedPrimary);
    }

    if (organEntry.mirror && organEntry.mirror.group.visible) {
      const clonedMirror = organEntry.mirror.group.clone(true);
      clonedMirror.position.copy(organEntry.mirror.group.position);
      clonedMirror.rotation.copy(organEntry.mirror.group.rotation);
      clonedMirror.scale.copy(organEntry.mirror.group.scale);
      cloneGroup.add(clonedMirror);
    }
  }

  // 3. Igualar la escala de crecimiento general del jugador
  cloneGroup.scale.copy(playerCell.mesh.scale);

  cloneGroup.userData.disposeClone = () => {
    for (const g of clonedGeometries) {
      g.dispose();
    }
  };

  return cloneGroup;
}

export const organFactory = {
  createOrganVisual,
  buildCellMeshClone,
  buildIdenticalCellClone,
};


