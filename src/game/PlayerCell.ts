import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { InputState } from './types';

const _forwardDir = new THREE.Vector3();
const _knockbackDecay = new THREE.Vector3();

export class PlayerCell {
  public readonly group: THREE.Group;
  public readonly position: THREE.Vector3;
  public headingAngle = 0; // Radians around Y axis (0 = facing -Z)
  public currentSpeed = 0;
  public angularVelocity = 0;
  public isBoosting = false;

  private readonly knockbackVelocity = new THREE.Vector3();
  private membraneMesh!: THREE.Mesh;
  private nucleusMesh!: THREE.Mesh;
  private membraneMat!: THREE.MeshPhysicalMaterial;
  private nucleusMat!: THREE.MeshStandardMaterial;
  private boostHaloMat!: THREE.MeshBasicMaterial;
  private tailSegments: THREE.Mesh[] = [];
  private ciliaLeft: THREE.Mesh[] = [];
  private ciliaRight: THREE.Mesh[] = [];

  // Evolutionary 3D Part Groups (pre-allocated once, toggled via .visible)
  private evoFlagellumGroup!: THREE.Group;
  private evoLateralTailLeft: THREE.Mesh[] = [];
  private evoLateralTailRight: THREE.Mesh[] = [];
  private evoChloroplastGroup!: THREE.Group;
  private evoArmorGroup!: THREE.Group;
  private evoSpinesGroup!: THREE.Group;

  private flagellumPhase = 0;
  private damageFlashTimer = 0;

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    this.position = this.group.position;

    this.buildProceduralCell();
    scene.add(this.group);
  }

  private buildProceduralCell(): void {
    // 1. Primary Silhouette: Outer translucent cytoplasmic membrane
    const membraneGeo = new THREE.CapsuleGeometry(0.95, 0.9, 16, 24);
    membraneGeo.rotateX(Math.PI / 2);
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

    // 2. Secondary Read: Glowing inner nucleus core
    const nucleusGeo = new THREE.IcosahedronGeometry(0.52, 2);
    this.nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      emissive: 0x10b981,
      emissiveIntensity: 0.95,
      roughness: 0.45,
      metalness: 0.2,
    });
    this.nucleusMesh = new THREE.Mesh(nucleusGeo, this.nucleusMat);
    this.nucleusMesh.position.set(0, 0, 0.1);
    this.group.add(this.nucleusMesh);

    // 3. Internal Organelles (Mitochondria / Vacuoles)
    const organelleGeo = new THREE.CapsuleGeometry(0.16, 0.28, 8, 12);
    const organelleMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.1,
    });

    const orgLeft = new THREE.Mesh(organelleGeo, organelleMat);
    orgLeft.position.set(-0.42, 0.12, -0.2);
    orgLeft.rotation.set(0.4, 0.5, 0.2);
    this.group.add(orgLeft);

    const orgRight = new THREE.Mesh(organelleGeo, organelleMat);
    orgRight.position.set(0.42, -0.1, -0.15);
    orgRight.rotation.set(-0.3, -0.4, 0.3);
    this.group.add(orgRight);

    // 4. Sensory Eyespots (Left & Right Sclera + Pupils facing -Z forward)
    const eyeGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.05,
    });
    const pupilGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.25,
      roughness: 0.1,
      metalness: 0.8,
    });

    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.44, 0.36, -1.12);

      const sclera = new THREE.Mesh(eyeGeo, eyeMat);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(side * 0.03, 0.04, -0.16);

      eyeGroup.add(sclera);
      eyeGroup.add(pupil);
      this.group.add(eyeGroup);
    }

    // 5. Lateral Cilia Fins (2 per side)
    const ciliaGeo = new THREE.ConeGeometry(0.14, 0.65, 8);
    ciliaGeo.rotateZ(Math.PI / 2);
    const ciliaMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.4,
      roughness: 0.5,
      metalness: 0.1,
    });

    for (let i = 0; i < 2; i++) {
      const zPos = -0.35 + i * 0.65;

      const leftFin = new THREE.Mesh(ciliaGeo, ciliaMat);
      leftFin.position.set(-1.05, 0, zPos);
      leftFin.rotation.y = 0.35;
      this.group.add(leftFin);
      this.ciliaLeft.push(leftFin);

      const rightFin = new THREE.Mesh(ciliaGeo, ciliaMat);
      rightFin.position.set(1.05, 0, zPos);
      rightFin.rotation.z = Math.PI;
      rightFin.rotation.y = -0.35;
      this.group.add(rightFin);
      this.ciliaRight.push(rightFin);
    }

    // 6. Articulated Flagellum Tail (4 segments trailing +Z)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.15,
    });

    for (let i = 0; i < 4; i++) {
      const radius = 0.24 * (1 - i * 0.18);
      const segGeo = new THREE.SphereGeometry(radius, 12, 12);
      segGeo.scale(0.85, 0.85, 1.65);
      const segMesh = new THREE.Mesh(segGeo, tailMat);
      segMesh.position.set(0, 0, 1.45 + i * 0.48);
      this.group.add(segMesh);
      this.tailSegments.push(segMesh);
      this.disposableGeometries.push(segGeo);
    }

    // 7. Underwater Contact Ring / Bioluminescent Halo beneath cell
    const haloGeo = new THREE.RingGeometry(0.95, 1.45, 32);
    haloGeo.rotateX(-Math.PI / 2);
    this.boostHaloMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, this.boostHaloMat);
    haloMesh.position.y = -0.95;
    this.group.add(haloMesh);

    // --- 8. EVOLUTIONARY PARTS (Hidden initially, unlocked via ADN) ---

    // 8A. flagellum_2 ("Flagelo Bimotor"): Two lateral articulated flagella
    this.evoFlagellumGroup = new THREE.Group();
    this.evoFlagellumGroup.visible = false;
    const biFlagellumMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.2,
    });
    for (let i = 0; i < 3; i++) {
      const latRadius = 0.19 * (1 - i * 0.2);
      const latGeo = new THREE.SphereGeometry(latRadius, 10, 10);
      latGeo.scale(0.8, 0.8, 1.6);
      this.disposableGeometries.push(latGeo);

      const leftSeg = new THREE.Mesh(latGeo, biFlagellumMat);
      leftSeg.position.set(-0.55 - i * 0.08, 0, 1.3 + i * 0.42);
      this.evoFlagellumGroup.add(leftSeg);
      this.evoLateralTailLeft.push(leftSeg);

      const rightSeg = new THREE.Mesh(latGeo, biFlagellumMat);
      rightSeg.position.set(0.55 + i * 0.08, 0, 1.3 + i * 0.42);
      this.evoFlagellumGroup.add(rightSeg);
      this.evoLateralTailRight.push(rightSeg);
    }
    this.group.add(this.evoFlagellumGroup);

    // 8B. chloroplast_1 ("Cloroplastos Simbióticos"): Glowing emerald organelles inside cell
    this.evoChloroplastGroup = new THREE.Group();
    this.evoChloroplastGroup.visible = false;
    const chloroGeo = new THREE.CapsuleGeometry(0.18, 0.24, 8, 12);
    const chloroMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 1.15,
      roughness: 0.25,
      metalness: 0.1,
    });
    const chloroPositions: [number, number, number, number, number][] = [
      [-0.48, 0.22, -0.55, 0.5, 0.3],
      [0.48, 0.22, -0.55, -0.5, -0.3],
      [-0.52, -0.18, 0.35, -0.4, 0.6],
      [0.52, -0.18, 0.35, 0.4, -0.6],
    ];
    for (const [cx, cy, cz, rx, rz] of chloroPositions) {
      const cMesh = new THREE.Mesh(chloroGeo, chloroMat);
      cMesh.position.set(cx, cy, cz);
      cMesh.rotation.set(rx, 0.2, rz);
      this.evoChloroplastGroup.add(cMesh);
    }
    this.group.add(this.evoChloroplastGroup);

    // 8C. membrane_armor ("Corteza Quitinizada"): Dorsal protective chitin plates
    this.evoArmorGroup = new THREE.Group();
    this.evoArmorGroup.visible = false;
    const armorPlateGeo = new THREE.DodecahedronGeometry(0.42, 0);
    armorPlateGeo.scale(1.35, 0.42, 1.1);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x3730a3,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.55,
    });
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(armorPlateGeo, armorMat);
      const scaleStep = 1 - Math.abs(i - 1) * 0.16;
      plate.scale.setScalar(scaleStep);
      plate.position.set(0, 0.86 - Math.abs(i - 1) * 0.06, -0.55 + i * 0.55);
      this.evoArmorGroup.add(plate);
    }
    this.group.add(this.evoArmorGroup);

    // 8D. rostral_spines ("Espolones Rostrales"): Forward-pointing (-Z) sharp horns
    this.evoSpinesGroup = new THREE.Group();
    this.evoSpinesGroup.visible = false;
    const spineGeo = new THREE.ConeGeometry(0.18, 0.95, 10);
    spineGeo.rotateX(-Math.PI / 2); // Point toward -Z
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.65,
    });
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(spineGeo, spineMat);
      horn.position.set(side * 0.62, 0.06, -1.42);
      horn.rotation.y = side * -0.16;
      this.evoSpinesGroup.add(horn);
    }
    this.group.add(this.evoSpinesGroup);

    this.disposableGeometries.push(
      membraneGeo,
      nucleusGeo,
      organelleGeo,
      eyeGeo,
      pupilGeo,
      ciliaGeo,
      haloGeo,
      chloroGeo,
      armorPlateGeo,
      spineGeo
    );
    this.disposableMaterials.push(
      this.membraneMat,
      this.nucleusMat,
      organelleMat,
      eyeMat,
      pupilMat,
      ciliaMat,
      tailMat,
      this.boostHaloMat,
      biFlagellumMat,
      chloroMat,
      armorMat,
      spineMat
    );
  }

  public syncEvolutionParts(unlockedIds: Set<string>): void {
    this.evoFlagellumGroup.visible = unlockedIds.has('flagellum_2');
    this.evoChloroplastGroup.visible = unlockedIds.has('chloroplast_1');
    this.evoArmorGroup.visible = unlockedIds.has('membrane_armor');
    this.evoSpinesGroup.visible = unlockedIds.has('rostral_spines');
  }

  public applyDamageKnockback(fromPosition: THREE.Vector3, strength = 15): void {
    _knockbackDecay.subVectors(this.position, fromPosition);
    _knockbackDecay.y = 0;
    if (_knockbackDecay.lengthSq() < 0.001) {
      _knockbackDecay.set(0, 0, 1);
    } else {
      _knockbackDecay.normalize();
    }
    this.knockbackVelocity.copy(_knockbackDecay).multiplyScalar(strength);
    this.damageFlashTimer = 0.42;
  }

  public update(
    delta: number,
    elapsedTime: number,
    input: InputState,
    canBoost: boolean,
    speedMultiplier = 1.0,
    turnMultiplier = 1.0
  ): { isMoving: boolean; isBoosting: boolean } {
    // 1. Smooth angular turning (A / D)
    let targetTurnRate = 0;
    const effectiveTurnSpeed = GAME_CONFIG.PLAYER.TURN_SPEED * turnMultiplier;
    if (input.left) targetTurnRate += effectiveTurnSpeed;
    if (input.right) targetTurnRate -= effectiveTurnSpeed;

    this.angularVelocity = THREE.MathUtils.damp(
      this.angularVelocity,
      targetTurnRate,
      GAME_CONFIG.PLAYER.TURN_DAMPING,
      delta
    );
    this.headingAngle += this.angularVelocity * delta;

    // 2. Smooth forward/backward thrust (W / S) + Space Boost
    this.isBoosting = input.boost && canBoost;

    const maxForward = GAME_CONFIG.PLAYER.MAX_FORWARD_SPEED * speedMultiplier;
    const maxReverse = GAME_CONFIG.PLAYER.MAX_REVERSE_SPEED * speedMultiplier;

    let targetSpeed = 0;
    if (input.forward) {
      targetSpeed = maxForward;
    } else if (input.backward) {
      targetSpeed = -maxReverse;
    }

    if (this.isBoosting) {
      // Boost propels the organism forward even if W is just tapped or held
      const baseBoostSpeed = input.backward ? -maxReverse : maxForward;
      targetSpeed = baseBoostSpeed * GAME_CONFIG.PLAYER.BOOST_MULTIPLIER;
    }

    const dampingLambda =
      Math.abs(targetSpeed) > 0.01
        ? GAME_CONFIG.PLAYER.ACCELERATION_DAMPING
        : GAME_CONFIG.PLAYER.WATER_DRAG_DAMPING;

    this.currentSpeed = THREE.MathUtils.damp(
      this.currentSpeed,
      targetSpeed,
      dampingLambda,
      delta
    );

    // 3. Apply forward velocity + decaying knockback velocity
    _forwardDir.set(-Math.sin(this.headingAngle), 0, -Math.cos(this.headingAngle));
    this.position.addScaledVector(_forwardDir, this.currentSpeed * delta);

    if (this.knockbackVelocity.lengthSq() > 0.01) {
      this.position.addScaledVector(this.knockbackVelocity, delta);
      this.knockbackVelocity.x = THREE.MathUtils.damp(
        this.knockbackVelocity.x,
        0,
        6.5,
        delta
      );
      this.knockbackVelocity.z = THREE.MathUtils.damp(
        this.knockbackVelocity.z,
        0,
        6.5,
        delta
      );
    }

    // 4. Soft arena boundary containment
    const distSq =
      this.position.x * this.position.x + this.position.z * this.position.z;
    const maxRadius = GAME_CONFIG.WORLD.ARENA_RADIUS - 1.5;
    if (distSq > maxRadius * maxRadius) {
      const dist = Math.sqrt(distSq);
      this.position.x = (this.position.x / dist) * maxRadius;
      this.position.z = (this.position.z / dist) * maxRadius;
      this.currentSpeed *= 0.75;
    }

    // Gentle vertical buoyancy oscillation in the water column
    this.position.y =
      GAME_CONFIG.WORLD.SWIM_PLANE_Y + Math.sin(elapsedTime * 2.4) * 0.16;

    // 5. Apply rotation + subtle banking tilt when turning
    const bankAngle = THREE.MathUtils.clamp(
      -this.angularVelocity * 0.12,
      -0.28,
      0.28
    );
    this.group.rotation.set(0, this.headingAngle, bankAngle);

    // 6. Animate procedural flagellum, lateral flagella, cilia, and nucleus pulse
    const speedRatio = Math.min(
      Math.abs(this.currentSpeed) / GAME_CONFIG.PLAYER.MAX_FORWARD_SPEED,
      2.5
    );
    const swimFreq = 5.5 + speedRatio * 10.5 + (this.isBoosting ? 8.0 : 0);
    this.flagellumPhase += delta * swimFreq;

    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];
      const wave = Math.sin(this.flagellumPhase - i * 0.85);
      const amplitude = (0.1 + speedRatio * 0.14) * (1 + i * 0.45);
      seg.position.x = wave * amplitude;
      seg.rotation.y = wave * 0.35;
    }

    if (this.evoFlagellumGroup.visible) {
      for (let i = 0; i < this.evoLateralTailLeft.length; i++) {
        const wave = Math.cos(this.flagellumPhase - i * 0.9);
        const amp = (0.08 + speedRatio * 0.12) * (1 + i * 0.35);
        this.evoLateralTailLeft[i].position.x = -0.55 - i * 0.08 + wave * amp;
        this.evoLateralTailRight[i].position.x = 0.55 + i * 0.08 - wave * amp;
      }
    }

    for (let i = 0; i < this.ciliaLeft.length; i++) {
      const flutter = Math.sin(this.flagellumPhase * 1.2 + i) * 0.28;
      this.ciliaLeft[i].rotation.y = 0.35 + flutter;
      this.ciliaRight[i].rotation.y = -0.35 - flutter;
    }

    // Nucleus breathing pulse & damage flash feedback
    const pulse = 1.0 + Math.sin(elapsedTime * 4.2) * 0.07;
    this.nucleusMesh.scale.setScalar(pulse);

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - delta);
      this.membraneMat.color.setHex(0xf43f5e);
      this.membraneMat.emissive.setHex(0xe11d48);
      this.membraneMat.emissiveIntensity = 0.9;
    } else if (this.isBoosting) {
      this.membraneMat.color.setHex(0x67e8f9);
      this.membraneMat.emissive.setHex(0x06b6d4);
      this.membraneMat.emissiveIntensity = 0.65;
      this.boostHaloMat.opacity = 0.65;
      this.boostHaloMat.color.setHex(0x38bdf8);
    } else {
      this.membraneMat.color.setHex(0x22d3ee);
      this.membraneMat.emissive.setHex(0x0891b2);
      this.membraneMat.emissiveIntensity = 0.25;
      this.boostHaloMat.opacity = 0.26;
      this.boostHaloMat.color.setHex(0x22d3ee);
    }

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
    this.knockbackVelocity.set(0, 0, 0);
    this.damageFlashTimer = 0;
    this.group.rotation.set(0, 0, 0);
    this.evoFlagellumGroup.visible = false;
    this.evoChloroplastGroup.visible = false;
    this.evoArmorGroup.visible = false;
    this.evoSpinesGroup.visible = false;
  }

  public dispose(): void {
    for (const geo of this.disposableGeometries) {
      geo.dispose();
    }
    for (const mat of this.disposableMaterials) {
      mat.dispose();
    }
  }
}
