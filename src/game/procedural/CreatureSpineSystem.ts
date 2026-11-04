import * as THREE from 'three';
import { SpineVertebraNode } from '../types';

export interface SpineVertebra {
  id: string;
  position: THREE.Vector3;   // Coordenada espacial 3D del nodo de control
  radius: number;             // Grosor o volumen de esta sección (0.35m a 2.5m)
  radiusX?: number;
  radiusY?: number;
  rotationRoll?: number;
  pitch?: number;
  yaw?: number;
}

export interface CreatureSpineData {
  vertebrae: SpineVertebra[]; // Mínimo 4, máximo 12 vértebras
}

export interface SpineRMFFrame {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
  radiusX: number;
  radiusY: number;
}

export interface OrganSpineAnchor {
  vertebraIndex: number;
  axialT: number;        // 0..1 fraction between vertebrae
  surfaceAngle: number;  // 0..2*PI around cross-section
}

/**
 * Spore-Style Decoupled Parametric Spine & Continuous Body Mesh Engine:
 * - C2 Centripetal Catmull-Rom 3D Spline governed by 4..12 interactive vertebrae.
 * - Rotation Minimizing Frames (RMF via Double Reflection / Parallel Transport).
 * - Watertight cross-section extrusion with smooth hemispherical cranial/caudal polar caps.
 * - Relative parametric organ anchoring attached to local spine cross sections.
 */
export class CreatureSpineSystem {
  public static readonly MIN_VERTEBRAE = 4;
  public static readonly MAX_VERTEBRAE = 12;
  public static readonly MIN_RADIUS = 0.35;
  public static readonly MAX_RADIUS = 2.5;
  public static readonly TRACTION_EXTEND_DIST = 0.8;
  public static readonly TRACTION_FUSE_DIST = 0.4;

  public readonly axialSegments: number;
  public readonly radialSegments: number;
  public readonly capRings: number = 4;
  public readonly totalRings: number;
  public readonly geometry: THREE.BufferGeometry;
  public curve: THREE.CatmullRomCurve3;

  public vertebrae: SpineVertebra[] = [];

  private readonly curveNodeVectors: THREE.Vector3[] = [];
  private readonly frames: SpineRMFFrame[] = [];
  private readonly positionsArray: Float32Array;
  private readonly uvsArray: Float32Array;
  private readonly indicesArray: Uint16Array;

  // Scratch vectors for zero GC in 60 FPS update loops
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _nL = new THREE.Vector3();
  private readonly _tL = new THREE.Vector3();
  private readonly _nRot = new THREE.Vector3();
  private readonly _bRot = new THREE.Vector3();

  constructor(axialSegments = 36, radialSegments = 24) {
    this.axialSegments = axialSegments;
    this.radialSegments = radialSegments;
    this.totalRings = this.capRings + (this.axialSegments + 1) + this.capRings;

    for (let i = 0; i < CreatureSpineSystem.MAX_VERTEBRAE; i++) {
      this.curveNodeVectors.push(new THREE.Vector3(0, 0, -1 + (i / 11) * 2));
    }

    for (let s = 0; s <= this.axialSegments; s++) {
      this.frames.push({
        position: new THREE.Vector3(),
        tangent: new THREE.Vector3(0, 0, 1),
        normal: new THREE.Vector3(1, 0, 0),
        binormal: new THREE.Vector3(0, 1, 0),
        radiusX: 1.0,
        radiusY: 1.0,
      });
    }

    this.curve = new THREE.CatmullRomCurve3(
      this.curveNodeVectors.slice(0, 6),
      false,
      'centripetal',
      0.5
    );

    const ringStride = this.radialSegments + 1;
    const totalVertices = 2 + this.totalRings * ringStride;
    this.positionsArray = new Float32Array(totalVertices * 3);
    this.uvsArray = new Float32Array(totalVertices * 2);

    const poleTriangles = this.radialSegments * 2;
    const stripTriangles = (this.totalRings - 1) * this.radialSegments * 2;
    this.indicesArray = new Uint16Array((poleTriangles + stripTriangles) * 3);

    this.geometry = new THREE.BufferGeometry();
    this.initTopologyAndUVs();
    this.initializeDefaultSpine(6, 1.0, 1.0);
  }

  private initTopologyAndUVs(): void {
    const M = this.radialSegments;
    const ringStride = M + 1;
    const R = this.totalRings;
    const caudalPoleIndex = 1 + R * ringStride;

    this.uvsArray[0] = 0.5;
    this.uvsArray[1] = 0.0;

    for (let r = 0; r < R; r++) {
      const vCoord = (r + 1) / (R + 1);
      for (let j = 0; j <= M; j++) {
        const uCoord = j / M;
        const vIdx = 1 + r * ringStride + j;
        this.uvsArray[vIdx * 2] = uCoord;
        this.uvsArray[vIdx * 2 + 1] = vCoord;
      }
    }

    this.uvsArray[caudalPoleIndex * 2] = 0.5;
    this.uvsArray[caudalPoleIndex * 2 + 1] = 1.0;

    let ptr = 0;
    // Cranial Pole Fan connecting vertex 0 to Ring 0
    for (let j = 0; j < M; j++) {
      const v0 = 0;
      const v1 = 1 + j;
      const v2 = 1 + j + 1;
      this.indicesArray[ptr++] = v0;
      this.indicesArray[ptr++] = v2;
      this.indicesArray[ptr++] = v1;
    }

    // Quad Strips between Ring r and Ring r + 1
    for (let r = 0; r < R - 1; r++) {
      const rowA = 1 + r * ringStride;
      const rowB = 1 + (r + 1) * ringStride;
      for (let j = 0; j < M; j++) {
        const a = rowA + j;
        const b = rowA + j + 1;
        const c = rowB + j;
        const d = rowB + j + 1;

        this.indicesArray[ptr++] = a;
        this.indicesArray[ptr++] = b;
        this.indicesArray[ptr++] = c;

        this.indicesArray[ptr++] = b;
        this.indicesArray[ptr++] = d;
        this.indicesArray[ptr++] = c;
      }
    }

    // Caudal Pole Fan connecting Ring (R - 1) to caudalPoleIndex
    const lastRow = 1 + (R - 1) * ringStride;
    for (let j = 0; j < M; j++) {
      const v1 = lastRow + j;
      const v2 = lastRow + j + 1;
      this.indicesArray[ptr++] = v1;
      this.indicesArray[ptr++] = v2;
      this.indicesArray[ptr++] = caudalPoleIndex;
    }

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positionsArray, 3)
    );
    this.geometry.setAttribute(
      'uv',
      new THREE.BufferAttribute(this.uvsArray, 2)
    );
    this.geometry.setIndex(new THREE.BufferAttribute(this.indicesArray, 1));
  }

  public initializeDefaultSpine(
    count = 6,
    spineLength = 1.0,
    baseRadius = 1.0
  ): void {
    const n = THREE.MathUtils.clamp(
      Math.round(count),
      CreatureSpineSystem.MIN_VERTEBRAE,
      CreatureSpineSystem.MAX_VERTEBRAE
    );
    const halfZ = 1.15 * spineLength;
    this.vertebrae = [];

    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const u = -1 + 2 * t; // -1 (front) to +1 (rear)
      const archY = Math.sin(t * Math.PI) * 0.16;
      const bioEnvelope =
        0.82 + 0.32 * Math.sin(t * Math.PI) + (1 - Math.abs(u)) * 0.12;
      const r = Number(
        THREE.MathUtils.clamp(
          baseRadius * bioEnvelope,
          CreatureSpineSystem.MIN_RADIUS,
          CreatureSpineSystem.MAX_RADIUS
        ).toFixed(2)
      );

      this.vertebrae.push({
        id: `vert_${i + 1}`,
        position: new THREE.Vector3(0, archY, u * halfZ),
        radius: r,
        radiusX: r,
        radiusY: r * 0.96,
        rotationRoll: 0,
        pitch: 0,
        yaw: 0,
      });
    }

    this.rebuildGeometry();
  }

  public setVertebrae(data: CreatureSpineData | SpineVertebra[]): void {
    const list = Array.isArray(data) ? data : data?.vertebrae;
    if (!list || list.length < CreatureSpineSystem.MIN_VERTEBRAE) {
      this.initializeDefaultSpine(6);
      return;
    }

    const n = Math.min(CreatureSpineSystem.MAX_VERTEBRAE, list.length);
    this.vertebrae = list.slice(0, n).map((v, i) => ({
      id: v.id || `vert_${i + 1}`,
      position:
        v.position instanceof THREE.Vector3
          ? v.position.clone()
          : v.position && typeof (v.position as { x?: number }).x === 'number'
          ? new THREE.Vector3(
              (v.position as { x: number; y: number; z: number }).x,
              (v.position as { x: number; y: number; z: number }).y,
              (v.position as { x: number; y: number; z: number }).z
            )
          : new THREE.Vector3(0, 0, 0),
      radius: THREE.MathUtils.clamp(
        v.radius ?? 1.0,
        CreatureSpineSystem.MIN_RADIUS,
        CreatureSpineSystem.MAX_RADIUS
      ),
      radiusX: v.radiusX !== undefined ? v.radiusX : v.radius ?? 1.0,
      radiusY: v.radiusY !== undefined ? v.radiusY : (v.radius ?? 1.0) * 0.96,
      rotationRoll: v.rotationRoll ?? 0,
      pitch: v.pitch ?? 0,
      yaw: v.yaw ?? 0,
    }));

    this.rebuildGeometry();
  }

  public fromSpineVertebraNodes(
    nodes: readonly SpineVertebraNode[],
    spineLength = 1.0
  ): void {
    if (!nodes || nodes.length < CreatureSpineSystem.MIN_VERTEBRAE) {
      this.initializeDefaultSpine(6, spineLength);
      return;
    }

    const n = Math.min(CreatureSpineSystem.MAX_VERTEBRAE, nodes.length);
    this.vertebrae = [];
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      const r = THREE.MathUtils.clamp(
        nd.radius ?? 1.0,
        CreatureSpineSystem.MIN_RADIUS,
        CreatureSpineSystem.MAX_RADIUS
      );
      this.vertebrae.push({
        id: `vert_${i + 1}`,
        position: new THREE.Vector3(nd.x, nd.y, nd.z),
        radius: r,
        radiusX: nd.radiusX !== undefined ? nd.radiusX : r,
        radiusY: nd.radiusY !== undefined ? nd.radiusY : r * 0.96,
        rotationRoll: nd.rotationRoll ?? 0,
        pitch: nd.pitch ?? 0,
        yaw: nd.yaw ?? 0,
      });
    }

    this.rebuildGeometry();
  }

  public toSpineVertebraNodes(): SpineVertebraNode[] {
    return this.vertebrae.map((v) => ({
      x: v.position.x,
      y: v.position.y,
      z: v.position.z,
      radius: v.radius,
      radiusX: v.radiusX ?? v.radius,
      radiusY: v.radiusY ?? v.radius * 0.96,
      rotationRoll: v.rotationRoll ?? 0,
      pitch: v.pitch ?? 0,
      yaw: v.yaw ?? 0,
    }));
  }

  /**
   * Seamless bridge for PlayerCell: builds spine, RMF frames and continuous body mesh
   * from SpineVertebraNode array while preserving legacy torsoRadii multipliers and shape factors.
   */
  public rebuildFromVertebraNodes(
    rawNodes: readonly SpineVertebraNode[],
    spineLength: number,
    torsoRadii: [number, number, number],
    sx: number,
    sy: number
  ): SpineVertebraNode[] {
    const nodes =
      rawNodes && rawNodes.length >= CreatureSpineSystem.MIN_VERTEBRAE
        ? rawNodes.map((n) => ({ ...n }))
        : null;

    if (!nodes) {
      this.initializeDefaultSpine(6, spineLength);
      return this.toSpineVertebraNodes();
    }

    const n = Math.min(CreatureSpineSystem.MAX_VERTEBRAE, nodes.length);
    this.vertebrae = [];
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      const t = n > 1 ? i / (n - 1) : 0.5;
      const u = -1 + 2 * t;
      const [rFront, rMid, rRear] = torsoRadii;
      const zoneMult =
        u < 0
          ? THREE.MathUtils.lerp(rMid, rFront, -u)
          : THREE.MathUtils.lerp(rMid, rRear, u);
      const bioEnvelope = 0.88 + 0.14 * Math.sin(t * Math.PI);
      const baseR = THREE.MathUtils.clamp(
        nd.radius ?? 1.0,
        CreatureSpineSystem.MIN_RADIUS,
        CreatureSpineSystem.MAX_RADIUS
      );
      const rx = THREE.MathUtils.clamp(
        (nd.radiusX ?? baseR) * zoneMult * bioEnvelope * sx * 0.95,
        CreatureSpineSystem.MIN_RADIUS,
        CreatureSpineSystem.MAX_RADIUS
      );
      const ry = THREE.MathUtils.clamp(
        (nd.radiusY ?? baseR * 0.96) * zoneMult * bioEnvelope * sy * 0.92,
        CreatureSpineSystem.MIN_RADIUS,
        CreatureSpineSystem.MAX_RADIUS
      );

      this.vertebrae.push({
        id: `vert_${i + 1}`,
        position: new THREE.Vector3(nd.x, nd.y, nd.z),
        radius: (rx + ry) * 0.5,
        radiusX: rx,
        radiusY: ry,
        rotationRoll: nd.rotationRoll ?? 0,
        pitch: nd.pitch ?? 0,
        yaw: nd.yaw ?? 0,
      });
    }

    this.rebuildGeometry();
    return this.toSpineVertebraNodes();
  }

  /**
   * Smoothly interpolates radius along normalized spline parameter t in [0, 1].
   */
  public getInterpolatedRadiusAtT(tNorm: number): {
    rX: number;
    rY: number;
    roll: number;
  } {
    const t = THREE.MathUtils.clamp(tNorm, 0, 1);
    const n = this.vertebrae.length;
    if (n === 0) return { rX: 1.0, rY: 0.96, roll: 0 };

    const scaled = t * (n - 1);
    const idx0 = Math.floor(scaled);
    const idx1 = Math.min(n - 1, idx0 + 1);
    const frac = scaled - idx0;
    // Hermite C1 smoothstep interpolation
    const smoothFrac = frac * frac * (3 - 2 * frac);

    const v0 = this.vertebrae[idx0];
    const v1 = this.vertebrae[idx1];

    const rx0 = v0.radiusX ?? v0.radius;
    const rx1 = v1.radiusX ?? v1.radius;
    const ry0 = v0.radiusY ?? v0.radius * 0.96;
    const ry1 = v1.radiusY ?? v1.radius * 0.96;
    const roll0 = v0.rotationRoll ?? 0;
    const roll1 = v1.rotationRoll ?? 0;

    return {
      rX: THREE.MathUtils.lerp(rx0, rx1, smoothFrac),
      rY: THREE.MathUtils.lerp(ry0, ry1, smoothFrac),
      roll: THREE.MathUtils.lerp(roll0, roll1, smoothFrac),
    };
  }

  /**
   * Rebuilds the central CatmullRom curve, Rotation Minimizing Frames (Double Reflection),
   * and continuous body skin vertices & normals in-place.
   */
  public rebuildGeometry(): void {
    if (this.vertebrae.length < CreatureSpineSystem.MIN_VERTEBRAE) {
      return;
    }

    // Monotonic spacing check to prevent inverted loops
    const minZStep = 0.08;
    for (let i = 1; i < this.vertebrae.length; i++) {
      if (this.vertebrae[i].position.z < this.vertebrae[i - 1].position.z + minZStep) {
        this.vertebrae[i].position.z = this.vertebrae[i - 1].position.z + minZStep;
      }
    }

    const n = Math.min(CreatureSpineSystem.MAX_VERTEBRAE, this.vertebrae.length);
    const activePoints: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const vec = this.curveNodeVectors[i];
      vec.copy(this.vertebrae[i].position);
      activePoints.push(vec);
    }

    this.curve.points = activePoints;
    this.curve.curveType = 'centripetal';
    this.curve.tension = 0.5;
    this.curve.updateArcLengths();

    const K = this.axialSegments;
    for (let i = 0; i <= K; i++) {
      const t = i / K;
      const frame = this.frames[i];
      this.curve.getPointAt(t, frame.position);
      this.curve.getTangentAt(t, frame.tangent).normalize();

      const { rX, rY } = this.getInterpolatedRadiusAtT(t);
      frame.radiusX = rX;
      frame.radiusY = rY;
    }

    // Step 2: Compute RMF (Double Reflection Parallel Transport)
    const f0 = this.frames[0];
    f0.normal.set(1, 0, 0);
    const dotN0 = f0.normal.dot(f0.tangent);
    f0.normal.addScaledVector(f0.tangent, -dotN0);
    if (f0.normal.lengthSq() < 1e-5) {
      f0.normal.set(0, 0, 1);
    }
    f0.normal.normalize();
    f0.binormal.crossVectors(f0.tangent, f0.normal).normalize();

    for (let i = 0; i < K; i++) {
      const curr = this.frames[i];
      const next = this.frames[i + 1];

      this._v1.subVectors(next.position, curr.position);
      const c1 = this._v1.lengthSq();
      if (c1 < 1e-8) {
        next.normal.copy(curr.normal);
        next.binormal.copy(curr.binormal);
        continue;
      }

      // First reflection
      const nDotV1 = (2 / c1) * this._v1.dot(curr.normal);
      this._nL.copy(curr.normal).addScaledVector(this._v1, -nDotV1);

      const tDotV1 = (2 / c1) * this._v1.dot(curr.tangent);
      this._tL.copy(curr.tangent).addScaledVector(this._v1, -tDotV1);

      // Second reflection
      this._v2.subVectors(next.tangent, this._tL);
      const c2 = this._v2.lengthSq();
      if (c2 < 1e-8) {
        next.normal.copy(this._nL).normalize();
      } else {
        const nLDotV2 = (2 / c2) * this._v2.dot(this._nL);
        next.normal.copy(this._nL).addScaledVector(this._v2, -nLDotV2).normalize();
      }

      next.binormal.crossVectors(next.tangent, next.normal).normalize();
    }

    // Apply per-vertebra axial roll rotation if specified
    for (let i = 0; i <= K; i++) {
      const t = i / K;
      const { roll } = this.getInterpolatedRadiusAtT(t);
      if (Math.abs(roll) > 1e-4) {
        const f = this.frames[i];
        const c = Math.cos(roll);
        const s = Math.sin(roll);
        this._nRot.copy(f.normal).multiplyScalar(c).addScaledVector(f.binormal, s);
        this._bRot.copy(f.binormal).multiplyScalar(c).addScaledVector(f.normal, -s);
        f.normal.copy(this._nRot).normalize();
        f.binormal.copy(this._bRot).normalize();
      }
    }

    // Step 3: Write Vertices for Cross-Section Extrusion & Polar Caps
    const M = this.radialSegments;
    const ringStride = M + 1;
    const R = this.totalRings;
    const caudalPoleIndex = 1 + R * ringStride;

    const headFrame = this.frames[0];
    const tailFrame = this.frames[K];
    const headCapDepth = Math.min(headFrame.radiusX, headFrame.radiusY) * 0.88;
    const tailCapDepth = Math.min(tailFrame.radiusX, tailFrame.radiusY) * 0.92;

    // Cranial Pole Vertex (index 0) projected forward along -T_0
    this.positionsArray[0] = headFrame.position.x - headFrame.tangent.x * headCapDepth;
    this.positionsArray[1] = headFrame.position.y - headFrame.tangent.y * headCapDepth;
    this.positionsArray[2] = headFrame.position.z - headFrame.tangent.z * headCapDepth;

    const writeRing = (
      ringIdx: number,
      cx: number,
      cy: number,
      cz: number,
      normal: THREE.Vector3,
      binormal: THREE.Vector3,
      rX: number,
      rY: number
    ) => {
      const baseVertex = 1 + ringIdx * ringStride;
      for (let j = 0; j <= M; j++) {
        const theta = (j / M) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const vx = cx + cosT * rX * normal.x + sinT * rY * binormal.x;
        const vy = cy + cosT * rX * normal.y + sinT * rY * binormal.y;
        const vz = cz + cosT * rX * normal.z + sinT * rY * binormal.z;

        const idx3 = (baseVertex + j) * 3;
        this.positionsArray[idx3] = vx;
        this.positionsArray[idx3 + 1] = vy;
        this.positionsArray[idx3 + 2] = vz;
      }
    };

    // Cranial Dome Cap Rings
    for (let c = 0; c < this.capRings; c++) {
      const phi = ((c + 1) / (this.capRings + 1)) * (Math.PI * 0.5);
      const axialOffset = Math.cos(phi) * headCapDepth;
      const radialScale = Math.sin(phi);
      writeRing(
        c,
        headFrame.position.x - headFrame.tangent.x * axialOffset,
        headFrame.position.y - headFrame.tangent.y * axialOffset,
        headFrame.position.z - headFrame.tangent.z * axialOffset,
        headFrame.normal,
        headFrame.binormal,
        headFrame.radiusX * radialScale,
        headFrame.radiusY * radialScale
      );
    }

    // Main Spine Rings
    for (let i = 0; i <= K; i++) {
      const f = this.frames[i];
      writeRing(
        this.capRings + i,
        f.position.x,
        f.position.y,
        f.position.z,
        f.normal,
        f.binormal,
        f.radiusX,
        f.radiusY
      );
    }

    // Caudal Dome Cap Rings
    for (let c = 0; c < this.capRings; c++) {
      const phi = ((c + 1) / (this.capRings + 1)) * (Math.PI * 0.5);
      const axialOffset = Math.sin(phi) * tailCapDepth;
      const radialScale = Math.cos(phi);
      writeRing(
        this.capRings + K + 1 + c,
        tailFrame.position.x + tailFrame.tangent.x * axialOffset,
        tailFrame.position.y + tailFrame.tangent.y * axialOffset,
        tailFrame.position.z + tailFrame.tangent.z * axialOffset,
        tailFrame.normal,
        tailFrame.binormal,
        tailFrame.radiusX * radialScale,
        tailFrame.radiusY * radialScale
      );
    }

    // Caudal Pole Vertex
    const pIdx3 = caudalPoleIndex * 3;
    this.positionsArray[pIdx3] = tailFrame.position.x + tailFrame.tangent.x * tailCapDepth;
    this.positionsArray[pIdx3 + 1] = tailFrame.position.y + tailFrame.tangent.y * tailCapDepth;
    this.positionsArray[pIdx3 + 2] = tailFrame.position.z + tailFrame.tangent.z * tailCapDepth;

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  /**
   * Applies organic Gaussian displacement to neighboring vertebrae when dragging vertebra index.
   * Direct neighbor receives 0.45 weight, next neighbor receives 0.15 weight.
   */
  public applyGaussianDisplacement(
    dragIndex: number,
    delta: THREE.Vector3,
    symmetry = false
  ): void {
    if (dragIndex < 0 || dragIndex >= this.vertebrae.length) return;

    for (let i = 0; i < this.vertebrae.length; i++) {
      const dist = Math.abs(i - dragIndex);
      let weight = 0;
      if (dist === 0) {
        weight = 1.0;
      } else if (dist === 1) {
        weight = 0.45;
      } else if (dist === 2) {
        weight = 0.15;
      } else {
        weight = Math.max(0, 0.15 * Math.pow(0.3, dist - 2));
      }

      const v = this.vertebrae[i];
      const dx = symmetry ? 0 : delta.x * weight;
      const dy = delta.y * weight;
      const dz = delta.z * weight;

      v.position.x = symmetry ? 0 : THREE.MathUtils.clamp(v.position.x + dx, -0.95, 0.95);
      v.position.y = THREE.MathUtils.clamp(v.position.y + dy, -0.65, 1.45);
      v.position.z += dz;
    }

    this.rebuildGeometry();
  }

  /**
   * Adjusts radius of an individual vertebra (scroll wheel).
   * Spatial position remains unaltered.
   */
  public adjustVertebraRadius(index: number, deltaRadius: number): number {
    if (index < 0 || index >= this.vertebrae.length) return 1.0;
    const v = this.vertebrae[index];
    const prev = v.radius;
    const next = THREE.MathUtils.clamp(
      prev + deltaRadius,
      CreatureSpineSystem.MIN_RADIUS,
      CreatureSpineSystem.MAX_RADIUS
    );
    const ratio = prev > 0.001 ? next / prev : 1.0;

    v.radius = next;
    v.radiusX = THREE.MathUtils.clamp(
      (v.radiusX ?? prev) * ratio,
      CreatureSpineSystem.MIN_RADIUS,
      CreatureSpineSystem.MAX_RADIUS
    );
    v.radiusY = THREE.MathUtils.clamp(
      (v.radiusY ?? prev * 0.96) * ratio,
      CreatureSpineSystem.MIN_RADIUS,
      CreatureSpineSystem.MAX_RADIUS
    );

    this.rebuildGeometry();
    return next;
  }

  /**
   * Handles traction handles at head/tail:
   * - Pulling outward beyond TRACTION_EXTEND_DIST (0.8m) adds a new vertebra (up to 12).
   * - Pushing inward below TRACTION_FUSE_DIST (0.4m) deletes terminal vertebra (down to 4).
   */
  public handleTractionDrag(
    end: 'head' | 'tail',
    targetWorldZ: number
  ): { changed: boolean; added: boolean; removed: boolean } {
    if (this.vertebrae.length < CreatureSpineSystem.MIN_VERTEBRAE) {
      return { changed: false, added: false, removed: false };
    }

    if (end === 'tail') {
      const lastIdx = this.vertebrae.length - 1;
      const lastV = this.vertebrae[lastIdx];
      const dist = targetWorldZ - lastV.position.z;

      if (
        dist > CreatureSpineSystem.TRACTION_EXTEND_DIST &&
        this.vertebrae.length < CreatureSpineSystem.MAX_VERTEBRAE
      ) {
        const prevV = this.vertebrae[lastIdx - 1];
        const dir = new THREE.Vector3().subVectors(lastV.position, prevV.position).normalize();
        if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);

        const newPos = lastV.position.clone().addScaledVector(dir, 0.45);
        this.vertebrae.push({
          id: `vert_${this.vertebrae.length + 1}`,
          position: newPos,
          radius: lastV.radius * 0.92,
          radiusX: (lastV.radiusX ?? lastV.radius) * 0.92,
          radiusY: (lastV.radiusY ?? lastV.radius * 0.96) * 0.92,
          rotationRoll: lastV.rotationRoll ?? 0,
          pitch: lastV.pitch ?? 0,
          yaw: lastV.yaw ?? 0,
        });
        this.rebuildGeometry();
        return { changed: true, added: true, removed: false };
      }

      if (
        dist < CreatureSpineSystem.TRACTION_FUSE_DIST &&
        this.vertebrae.length > CreatureSpineSystem.MIN_VERTEBRAE
      ) {
        this.vertebrae.pop();
        this.rebuildGeometry();
        return { changed: true, added: false, removed: true };
      }
    } else {
      // Cranial end (head)
      const firstV = this.vertebrae[0];
      const dist = firstV.position.z - targetWorldZ;

      if (
        dist > CreatureSpineSystem.TRACTION_EXTEND_DIST &&
        this.vertebrae.length < CreatureSpineSystem.MAX_VERTEBRAE
      ) {
        const nextV = this.vertebrae[1];
        const dir = new THREE.Vector3().subVectors(firstV.position, nextV.position).normalize();
        if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);

        const newPos = firstV.position.clone().addScaledVector(dir, 0.45);
        this.vertebrae.unshift({
          id: `vert_head_${Date.now()}`,
          position: newPos,
          radius: firstV.radius * 0.92,
          radiusX: (firstV.radiusX ?? firstV.radius) * 0.92,
          radiusY: (firstV.radiusY ?? firstV.radius * 0.96) * 0.92,
          rotationRoll: firstV.rotationRoll ?? 0,
          pitch: firstV.pitch ?? 0,
          yaw: firstV.yaw ?? 0,
        });
        this.rebuildGeometry();
        return { changed: true, added: true, removed: false };
      }

      if (
        dist < CreatureSpineSystem.TRACTION_FUSE_DIST &&
        this.vertebrae.length > CreatureSpineSystem.MIN_VERTEBRAE
      ) {
        this.vertebrae.shift();
        this.rebuildGeometry();
        return { changed: true, added: false, removed: true };
      }
    }

    return { changed: false, added: false, removed: false };
  }

  public getFrameAtT(tNorm: number, outFrame: SpineRMFFrame): void {
    const t = THREE.MathUtils.clamp(tNorm, 0, 1);
    const fIdx = t * this.axialSegments;
    const i0 = Math.min(this.axialSegments - 1, Math.floor(fIdx));
    const i1 = i0 + 1;
    const frac = fIdx - i0;

    const f0 = this.frames[i0];
    const f1 = this.frames[i1];

    outFrame.position.lerpVectors(f0.position, f1.position, frac);
    outFrame.tangent.lerpVectors(f0.tangent, f1.tangent, frac).normalize();
    outFrame.normal.lerpVectors(f0.normal, f1.normal, frac).normalize();
    outFrame.binormal.lerpVectors(f0.binormal, f1.binormal, frac).normalize();
    outFrame.radiusX = THREE.MathUtils.lerp(f0.radiusX, f1.radiusX, frac);
    outFrame.radiusY = THREE.MathUtils.lerp(f0.radiusY, f1.radiusY, frac);
  }

  /**
   * Relative attachment transformation for organs & limbs:
   * Computes the 3D surface point and outward normal from vertebraIndex, axialT, and surfaceAngle.
   */
  public getAttachmentTransform(
    vertebraIndex: number,
    axialT: number,
    surfaceAngle: number,
    outPos: THREE.Vector3,
    outNormal: THREE.Vector3,
    outTangent: THREE.Vector3,
    outBinormal: THREE.Vector3
  ): { spinePitch: number; normalAngle: number } {
    const n = Math.max(1, this.vertebrae.length - 1);
    const safeIdx = THREE.MathUtils.clamp(vertebraIndex, 0, n - 1);
    const safeAxialT = THREE.MathUtils.clamp(axialT, 0, 1);
    const tGlobal = (safeIdx + safeAxialT) / n;

    const tempFrame: SpineRMFFrame = {
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      binormal: new THREE.Vector3(),
      radiusX: 1.0,
      radiusY: 1.0,
    };
    this.getFrameAtT(tGlobal, tempFrame);

    const cosA = Math.cos(surfaceAngle);
    const sinA = Math.sin(surfaceAngle);

    outPos.copy(tempFrame.position)
      .addScaledVector(tempFrame.normal, cosA * tempFrame.radiusX)
      .addScaledVector(tempFrame.binormal, sinA * tempFrame.radiusY);

    outNormal.copy(tempFrame.normal).multiplyScalar(cosA)
      .addScaledVector(tempFrame.binormal, sinA)
      .normalize();

    outTangent.copy(tempFrame.tangent);
    outBinormal.crossVectors(outTangent, outNormal).normalize();

    const normalAngle = Math.atan2(outNormal.x, outNormal.z);
    const spinePitch = Math.asin(THREE.MathUtils.clamp(tempFrame.tangent.y, -0.78, 0.78)) * cosA * 0.48;

    return { spinePitch, normalAngle };
  }

  /**
   * Projects a local 3D point onto the spine to compute relative anchoring:
   * { vertebraIndex, axialT, surfaceAngle }.
   */
  public computeAnchorFromLocalPoint(localPoint: THREE.Vector3): OrganSpineAnchor {
    const n = this.vertebrae.length;
    if (n < 2) return { vertebraIndex: 0, axialT: 0.5, surfaceAngle: 0 };

    // Find closest vertebra by distance
    let bestDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < n; i++) {
      const d = localPoint.distanceTo(this.vertebrae[i].position);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const segIdx = Math.min(n - 2, Math.max(0, localPoint.z > this.vertebrae[bestIdx].position.z ? bestIdx : bestIdx - 1));
    const p0 = this.vertebrae[segIdx].position;
    const p1 = this.vertebrae[segIdx + 1].position;
    const segVec = new THREE.Vector3().subVectors(p1, p0);
    const segLenSq = segVec.lengthSq();

    let axialT = 0.5;
    if (segLenSq > 1e-5) {
      const ptVec = new THREE.Vector3().subVectors(localPoint, p0);
      axialT = THREE.MathUtils.clamp(ptVec.dot(segVec) / segLenSq, 0, 1);
    }

    const tGlobal = (segIdx + axialT) / (n - 1);
    const tempFrame: SpineRMFFrame = {
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      binormal: new THREE.Vector3(),
      radiusX: 1.0,
      radiusY: 1.0,
    };
    this.getFrameAtT(tGlobal, tempFrame);

    const relVec = new THREE.Vector3().subVectors(localPoint, tempFrame.position);
    const projNorm = relVec.dot(tempFrame.normal) / Math.max(0.1, tempFrame.radiusX);
    const projBinorm = relVec.dot(tempFrame.binormal) / Math.max(0.1, tempFrame.radiusY);
    const surfaceAngle = Math.atan2(projBinorm, projNorm);

    return {
      vertebraIndex: segIdx,
      axialT,
      surfaceAngle,
    };
  }

  public dispose(): void {
    this.geometry.dispose();
  }
}
