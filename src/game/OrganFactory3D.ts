import * as THREE from 'three';
import { normalizeAdaptationId } from './evolutionData';

export interface OrganVisualInstance {
  group: THREE.Group;
  nozzleLocalPos?: THREE.Vector3;
  animate: (elapsedTime: number, speedRatio: number, isBoosting: boolean) => void;
  setHighlight: (mode: 'none' | 'selected' | 'preview_valid' | 'preview_invalid') => void;
  setColorOverride: (colorHex?: string) => void;
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
  }> = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
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
        tintableMaterials.push({
          mat: m,
          origColorHex: cHex,
          origEmissiveHex: m.emissive.getHex(),
        });
      }
    }
    return m;
  };

  let animateFn: (elapsedTime: number, speedRatio: number, isBoosting: boolean) => void = () => {};
  let nozzleLocalPos: THREE.Vector3 | undefined;

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
  } else if (id === 'simple_flagellum' || id === 'flagellum_2') {
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
  group.add(highlightRing);

  const setHighlight = (
    mode: 'none' | 'selected' | 'preview_valid' | 'preview_invalid'
  ) => {
    if (mode === 'none') {
      highlightRing.visible = false;
      return;
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
  const setColorOverride = (colorHex?: string) => {
    const normalized = colorHex?.trim() || undefined;
    if (currentColorOverride === normalized) return;
    currentColorOverride = normalized;

    if (!normalized) {
      for (const entry of tintableMaterials) {
        entry.mat.color.setHex(entry.origColorHex);
        entry.mat.emissive.setHex(entry.origEmissiveHex);
      }
      return;
    }

    const targetColor = new THREE.Color(normalized);
    const targetEmissive = targetColor.clone().multiplyScalar(0.55);
    for (const entry of tintableMaterials) {
      const origColor = new THREE.Color(entry.origColorHex);
      // Blend 75% custom pigment with 25% original shading so multi-part organs keep depth contrast
      entry.mat.color.copy(origColor).lerp(targetColor, 0.78);
      if (entry.origEmissiveHex !== 0x000000) {
        const origEm = new THREE.Color(entry.origEmissiveHex);
        entry.mat.emissive.copy(origEm).lerp(targetEmissive, 0.75);
      } else {
        entry.mat.emissive.copy(targetEmissive).multiplyScalar(0.35);
      }
    }
  };

  return {
    group,
    nozzleLocalPos,
    animate: animateFn,
    setHighlight,
    setColorOverride,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
