import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { DietType, FoodKind } from './types';

interface FoodItemState {
  position: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
  kind: FoodKind;
  defaultKind: FoodKind;
  phase: number;
  spawnScale: number;
}

export interface FoodConsumptionResult {
  energyGained: number;
  adnGained: number;
  itemsEaten: number;
  blockedFoodKind: FoodKind | null;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class FoodManager {
  private readonly items: FoodItemState[] = [];
  private coreInstanced!: THREE.InstancedMesh;
  private shellInstanced!: THREE.InstancedMesh;
  private dropCursor = 0;

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.initMeshes(scene);
    this.resetAll();
  }

  private initMeshes(scene: THREE.Scene): void {
    const count = GAME_CONFIG.FOOD.TOTAL_COUNT;

    // 1. Inner nutrient core (Icosahedron)
    const coreGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x10b981,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.15,
    });

    // 2. Outer translucent membrane (Dodecahedron)
    const shellGeo = new THREE.DodecahedronGeometry(0.68, 1);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0x059669,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.05,
      transmission: 0.6,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });

    this.coreInstanced = new THREE.InstancedMesh(coreGeo, coreMat, count);
    this.shellInstanced = new THREE.InstancedMesh(shellGeo, shellMat, count);
    this.coreInstanced.frustumCulled = false;
    this.shellInstanced.frustumCulled = false;
    this.coreInstanced.castShadow = true;

    for (let i = 0; i < count; i++) {
      const defaultKind: FoodKind =
        i % 6 === 0 ? 'dna_spore' : i % 3 === 1 ? 'meat' : 'plant';

      this.items.push({
        position: new THREE.Vector3(),
        active: true,
        respawnTimer: 0,
        kind: defaultKind,
        defaultKind,
        phase: i * 0.77,
        spawnScale: 1,
      });
    }

    scene.add(this.coreInstanced);
    scene.add(this.shellInstanced);

    this.disposableGeometries.push(coreGeo, shellGeo);
    this.disposableMaterials.push(coreMat, shellMat);
  }

  private applyItemColor(index: number, kind: FoodKind): void {
    if (kind === 'dna_spore') {
      _color.setHex(0xfde047); // Golden DNA meteorite spore
      this.coreInstanced.setColorAt(index, _color);
      _color.setHex(0x38bdf8);
      this.shellInstanced.setColorAt(index, _color);
    } else if (kind === 'meat') {
      _color.setHex(0xfb7185); // Coral-crimson protein meat fragment
      this.coreInstanced.setColorAt(index, _color);
      _color.setHex(0xe11d48);
      this.shellInstanced.setColorAt(index, _color);
    } else {
      _color.setHex(0x34d399); // Emerald phytoplankton plant matter
      this.coreInstanced.setColorAt(index, _color);
      _color.setHex(0x6ee7b7);
      this.shellInstanced.setColorAt(index, _color);
    }
  }

  private assignRandomPosition(item: FoodItemState, avoidCenter = false): void {
    const minRadius = avoidCenter ? 7.5 : 4.0;
    const maxRadius = GAME_CONFIG.WORLD.ARENA_RADIUS - 5.0;
    const r =
      minRadius + Math.sqrt(Math.random()) * (maxRadius - minRadius);
    const theta = Math.random() * Math.PI * 2;

    item.position.set(
      Math.cos(theta) * r,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      Math.sin(theta) * r
    );
  }

  /**
   * Spawns a protein meat chunk + a DNA spore at the exact position where a cell dies in the ecosystem.
   */
  public spawnMeatDrop(position: THREE.Vector3): void {
    const drops: FoodKind[] = ['meat', 'dna_spore'];

    for (let d = 0; d < drops.length; d++) {
      // Find an inactive slot first, or recycle via round-robin cursor
      let targetIdx = -1;
      for (let i = 0; i < this.items.length; i++) {
        if (!this.items[i].active) {
          targetIdx = i;
          break;
        }
      }
      if (targetIdx === -1) {
        targetIdx = this.dropCursor % this.items.length;
        this.dropCursor++;
      }

      const item = this.items[targetIdx];
      item.active = true;
      item.respawnTimer = 0;
      item.kind = drops[d];
      item.spawnScale = 0.2;

      const offsetAngle = d * Math.PI + Math.random() * 0.8;
      const offsetDist = 0.85 + d * 0.55;
      item.position.set(
        position.x + Math.cos(offsetAngle) * offsetDist,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        position.z + Math.sin(offsetAngle) * offsetDist
      );

      this.applyItemColor(targetIdx, item.kind);
    }

    if (this.coreInstanced.instanceColor) {
      this.coreInstanced.instanceColor.needsUpdate = true;
    }
    if (this.shellInstanced.instanceColor) {
      this.shellInstanced.instanceColor.needsUpdate = true;
    }
  }

  public resetAll(): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      item.active = true;
      item.respawnTimer = 0;
      item.spawnScale = 1;
      item.kind = item.defaultKind;
      this.assignRandomPosition(item, i < 6);
      this.applyItemColor(i, item.kind);
    }

    if (this.coreInstanced.instanceColor) {
      this.coreInstanced.instanceColor.needsUpdate = true;
    }
    if (this.shellInstanced.instanceColor) {
      this.shellInstanced.instanceColor.needsUpdate = true;
    }
  }

  private canDigest(playerDiet: DietType, kind: FoodKind): boolean {
    if (kind === 'dna_spore') return true;
    if (playerDiet === 'omnivore') return true;
    if (playerDiet === 'herbivore' && kind === 'plant') return true;
    if (playerDiet === 'carnivore' && kind === 'meat') return true;
    return false;
  }

  public update(
    delta: number,
    elapsedTime: number,
    playerPosition: THREE.Vector3,
    playerDiet: DietType = 'herbivore'
  ): FoodConsumptionResult {
    let energyGained = 0;
    let adnGained = 0;
    let itemsEaten = 0;
    let blockedFoodKind: FoodKind | null = null;
    let colorDirty = false;

    const pickupDist =
      GAME_CONFIG.PLAYER.COLLISION_RADIUS + GAME_CONFIG.FOOD.COLLISION_RADIUS;
    const pickupDistSq = pickupDist * pickupDist;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];

      if (!item.active) {
        item.respawnTimer -= delta;
        if (item.respawnTimer <= 0) {
          item.active = true;
          item.spawnScale = 0.05;
          item.kind = item.defaultKind;
          this.assignRandomPosition(item, true);
          this.applyItemColor(i, item.kind);
          colorDirty = true;
        } else {
          // Keep hidden at scale 0
          _dummy.position.copy(item.position);
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          this.coreInstanced.setMatrixAt(i, _dummy.matrix);
          this.shellInstanced.setMatrixAt(i, _dummy.matrix);
          continue;
        }
      }

      // Check 2D XZ collision with player cell
      const dx = item.position.x - playerPosition.x;
      const dz = item.position.z - playerPosition.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= pickupDistSq) {
        if (!this.canDigest(playerDiet, item.kind)) {
          // Gently push undigestible food away and notify HUD
          const dist = Math.sqrt(distSq) || 0.1;
          item.position.x += (dx / dist) * 1.8;
          item.position.z += (dz / dist) * 1.8;
          blockedFoodKind = item.kind;
        } else {
          item.active = false;
          item.respawnTimer = GAME_CONFIG.FOOD.RESPAWN_DELAY_SEC;
          itemsEaten++;

          if (item.kind === 'dna_spore') {
            energyGained += GAME_CONFIG.FOOD.ENERGY_RESTORE_LARGE;
            adnGained += GAME_CONFIG.FOOD.ADN_REWARD_LARGE;
          } else if (item.kind === 'meat') {
            energyGained += 22;
            adnGained += 8;
          } else {
            energyGained += GAME_CONFIG.FOOD.ENERGY_RESTORE_SMALL;
            adnGained += GAME_CONFIG.FOOD.ADN_REWARD_SMALL;
          }

          _dummy.position.copy(item.position);
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          this.coreInstanced.setMatrixAt(i, _dummy.matrix);
          this.shellInstanced.setMatrixAt(i, _dummy.matrix);
          continue;
        }
      }

      // Smooth spawn scale-in + organic floating & rotation
      item.spawnScale = THREE.MathUtils.damp(item.spawnScale, 1.0, 5.0, delta);
      const baseScale =
        item.kind === 'dna_spore' ? 1.25 : item.kind === 'meat' ? 1.08 : 0.95;
      const pulse = 1.0 + Math.sin(elapsedTime * 3.2 + item.phase) * 0.12;
      const finalScale = item.spawnScale * baseScale * pulse;

      const bobY =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y +
        Math.sin(elapsedTime * 2.1 + item.phase) * 0.25;

      _dummy.position.set(item.position.x, bobY, item.position.z);
      _dummy.rotation.set(
        elapsedTime * 0.9 + item.phase,
        elapsedTime * 1.3 + item.phase,
        0
      );
      _dummy.scale.setScalar(finalScale);
      _dummy.updateMatrix();
      this.coreInstanced.setMatrixAt(i, _dummy.matrix);

      _dummy.rotation.set(
        -elapsedTime * 0.7 - item.phase,
        -elapsedTime * 1.0,
        elapsedTime * 0.5
      );
      _dummy.scale.setScalar(finalScale * 1.08);
      _dummy.updateMatrix();
      this.shellInstanced.setMatrixAt(i, _dummy.matrix);
    }

    if (colorDirty) {
      if (this.coreInstanced.instanceColor) {
        this.coreInstanced.instanceColor.needsUpdate = true;
      }
      if (this.shellInstanced.instanceColor) {
        this.shellInstanced.instanceColor.needsUpdate = true;
      }
    }

    this.coreInstanced.instanceMatrix.needsUpdate = true;
    this.shellInstanced.instanceMatrix.needsUpdate = true;

    return { energyGained, adnGained, itemsEaten, blockedFoodKind };
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].active) count++;
    }
    return count;
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
