import * as THREE from 'three';
import { SpineVertebraNode, createDefaultSpineNodes } from './types';

export interface SpineRMFFrame {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
  radiusX: number;
  radiusY: number;
}

/**
 * Maxis Spore (2008) Procedural Creature Spine & Cross-Section Skinning Engine:
 * - C2 Centripetal Catmull-Rom 3D Spline governed by 4..12 interactive vertebra nodes.
 * - Rotation Minimizing Frames (RMF via Double Reflection / Parallel Transport) eliminating Frenet torsion flips.
 * - Elliptical Cross-Section Skinning with hemispherical cranial/caudal polar caps and analytical PBR normals at 60 FPS.
 */
export class CreatureSpine {
  public readonly axialSegments: number;
  public readonly radialSegments: number;
  public readonly capRings: number = 4;
  public readonly totalRings: number;
  public readonly geometry: THREE.BufferGeometry;
  public curve: THREE.CatmullRomCurve3;

  private readonly curveNodeVectors: THREE.Vector3[] = [];
  private readonly frames: SpineRMFFrame[] = [];
  private readonly positionsArray: Float32Array;
  private readonly uvsArray: Float32Array;
  private readonly indicesArray: Uint16Array;

  // Pre-allocated scratch vectors for Double Reflection RMF (zero GC in 60 FPS loop)
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _nL = new THREE.Vector3();
  private readonly _tL = new THREE.Vector3();
  private readonly _nRot = new THREE.Vector3();
  private readonly _bRot = new THREE.Vector3();

  constructor(axialSegments = 32, radialSegments = 24) {
    this.axialSegments = axialSegments;
    this.radialSegments = radialSegments;
    // Total rings = capRings (cranial dome) + (axialSegments + 1) (main spine) + capRings (caudal dome)
    this.totalRings = this.capRings + (this.axialSegments + 1) + this.capRings;

    for (let i = 0; i < 12; i++) {
      this.curveNodeVectors.push(new THREE.Vector3(0, 0, -1 + (i / 11) * 2));
    }

    for (let s = 0; s <= this.axialSegments; s++) {
      this.frames.push({
        position: new THREE.Vector3(),
        tangent: new THREE.Vector3(0, 0, 1),
        normal: new THREE.Vector3(1, 0, 0),
        binormal: new THREE.Vector3(0, 1, 0),
        radiusX: 0.95,
        radiusY: 0.95,
      });
    }

    this.curve = new THREE.CatmullRomCurve3(
      this.curveNodeVectors.slice(0, 6),
      false,
      'centripetal',
      0.5
    );

    // Vertex layout:
    // Index 0: Anterior (Cranial) Pole Vertex
    // Indices 1 .. totalRings * (radialSegments + 1): Seam-duplicated ring vertices for clean cylindrical UVs
    // Last Index: Posterior (Caudal) Pole Vertex
    const ringStride = this.radialSegments + 1;
    const totalVertices = 2 + this.totalRings * ringStride;
    this.positionsArray = new Float32Array(totalVertices * 3);
    this.uvsArray = new Float32Array(totalVertices * 2);

    const poleTriangles = this.radialSegments * 2;
    const stripTriangles = (this.totalRings - 1) * this.radialSegments * 2;
    this.indicesArray = new Uint16Array((poleTriangles + stripTriangles) * 3);

    this.geometry = new THREE.BufferGeometry();
    this.initTopologyAndUVs();
  }

  private initTopologyAndUVs(): void {
    const M = this.radialSegments;
    const ringStride = M + 1;
    const R = this.totalRings;
    const caudalPoleIndex = 1 + R * ringStride;

    // 1. Pre-populate static UVs so 3-layer PBR coat textures map seamlessly around the spine
    // Cranial pole UV
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

    // Caudal pole UV
    this.uvsArray[caudalPoleIndex * 2] = 0.5;
    this.uvsArray[caudalPoleIndex * 2 + 1] = 1.0;

    // 2. Build Triangle Index Buffer (CCW outward winding)
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

  /**
   * Smoothly interpolates horizontal (`radiusX`), vertical (`radiusY`), and axial roll (`rotationRoll`)
   * along normalized spline parameter `tNorm` in `[0, 1]`.
   */
  public getInterpolatedRadiiAtT(
    tNorm: number,
    nodes: readonly SpineVertebraNode[],
    torsoRadii: [number, number, number],
    sx: number,
    sy: number
  ): { rX: number; rY: number; roll: number } {
    const t = THREE.MathUtils.clamp(tNorm, 0, 1);
    if (!nodes || nodes.length === 0) {
      return { rX: 0.95 * sx, rY: 0.95 * sy, roll: 0 };
    }

    const n = nodes.length;
    const scaled = t * (n - 1);
    const idx0 = Math.floor(scaled);
    const idx1 = Math.min(n - 1, idx0 + 1);
    const frac = scaled - idx0;
    // Hermite C1 smoothstep interpolation between adjacent vertebra radii
    const smoothFrac = frac * frac * (3 - 2 * frac);

    const node0 = nodes[idx0];
    const node1 = nodes[idx1];

    const rx0 = node0.radiusX ?? node0.radius ?? 1.0;
    const rx1 = node1.radiusX ?? node1.radius ?? 1.0;
    const ry0 = node0.radiusY ?? node0.radius ?? 1.0;
    const ry1 = node1.radiusY ?? node1.radius ?? 1.0;
    const roll0 = node0.rotationRoll ?? 0;
    const roll1 = node1.rotationRoll ?? 0;

    const u = -1 + 2 * t;
    const [rFront, rMid, rRear] = torsoRadii;
    const zoneMult =
      u < 0
        ? THREE.MathUtils.lerp(rMid, rFront, -u)
        : THREE.MathUtils.lerp(rMid, rRear, u);

    // Subtle organic fusiform contour profile along the torso
    const bioEnvelope = 0.88 + 0.14 * Math.sin(t * Math.PI);

    const interpRx =
      THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(rx0, rx1, smoothFrac) * zoneMult,
        0.35,
        2.8
      ) *
      0.95 *
      bioEnvelope *
      sx;

    const interpRy =
      THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(ry0, ry1, smoothFrac) * zoneMult,
        0.35,
        2.8
      ) *
      0.92 *
      bioEnvelope *
      sy;

    const interpRoll = THREE.MathUtils.lerp(roll0, roll1, smoothFrac);

    return { rX: interpRx, rY: interpRy, roll: interpRoll };
  }

  /**
   * Recomputes the C2 Centripetal Catmull-Rom curve, Rotation Minimizing Frames (Double Reflection),
   * and elliptical cross-section skinning vertices & analytical normals in-place at 60 FPS.
   */
  public rebuildFromVertebraNodes(
    rawNodes: readonly SpineVertebraNode[],
    spineLength: number,
    torsoRadii: [number, number, number],
    sx: number,
    sy: number
  ): SpineVertebraNode[] {
    const nodes =
      rawNodes && rawNodes.length >= 4
        ? rawNodes.map((n) => ({ ...n }))
        : createDefaultSpineNodes(6, spineLength);

    // Enforce monotonic Z spacing to prevent self-intersecting loops
    const minZStep = 0.11;
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i].z < nodes[i - 1].z + minZStep) {
        nodes[i].z = nodes[i - 1].z + minZStep;
      }
    }

    const activeCount = Math.min(12, nodes.length);
    const activePoints: THREE.Vector3[] = [];
    for (let i = 0; i < activeCount; i++) {
      const vec = this.curveNodeVectors[i];
      vec.set(nodes[i].x, nodes[i].y, nodes[i].z);
      activePoints.push(vec);
    }

    this.curve.points = activePoints;
    this.curve.curveType = 'centripetal';
    this.curve.tension = 0.5;
    this.curve.updateArcLengths();

    // =========================================================================
    // STEP 1: Sample Positions & Tangents along Centripetal Catmull-Rom Curve
    // =========================================================================
    const K = this.axialSegments;
    for (let i = 0; i <= K; i++) {
      const t = i / K;
      const frame = this.frames[i];
      this.curve.getPointAt(t, frame.position);
      this.curve.getTangentAt(t, frame.tangent).normalize();

      const { rX, rY } = this.getInterpolatedRadiiAtT(
        t,
        nodes,
        torsoRadii,
        sx,
        sy
      );
      frame.radiusX = rX;
      frame.radiusY = rY;
    }

    // =========================================================================
    // STEP 2: Compute Rotation Minimizing Frames (Double Reflection Method)
    // =========================================================================
    const f0 = this.frames[0];
    // Initialize Frame 0: Normal N0 points laterally (+X), Binormal B0 points dorsally (+Y)
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

      // First reflection across bisector hyperplane of P_i and P_{i+1}
      const nDotV1 = (2 / c1) * this._v1.dot(curr.normal);
      this._nL.copy(curr.normal).addScaledVector(this._v1, -nDotV1);

      const tDotV1 = (2 / c1) * this._v1.dot(curr.tangent);
      this._tL.copy(curr.tangent).addScaledVector(this._v1, -tDotV1);

      // Second reflection across bisector hyperplane of T_i^L and T_{i+1}
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

    // Apply optional per-vertebra axial roll rotation onto the RMF frames
    for (let i = 0; i <= K; i++) {
      const t = i / K;
      const { roll } = this.getInterpolatedRadiiAtT(
        t,
        nodes,
        torsoRadii,
        sx,
        sy
      );
      if (Math.abs(roll) > 1e-4) {
        const f = this.frames[i];
        const c = Math.cos(roll);
        const s = Math.sin(roll);
        this._nRot
          .copy(f.normal)
          .multiplyScalar(c)
          .addScaledVector(f.binormal, s);
        this._bRot
          .copy(f.binormal)
          .multiplyScalar(c)
          .addScaledVector(f.normal, -s);
        f.normal.copy(this._nRot).normalize();
        f.binormal.copy(this._bRot).normalize();
      }
    }

    // =========================================================================
    // STEP 3: Generate Elliptical Cross-Section Rings & Hemispherical Polar Caps
    // =========================================================================
    const M = this.radialSegments;
    const ringStride = M + 1;
    const R = this.totalRings;
    const caudalPoleIndex = 1 + R * ringStride;

    const headFrame = this.frames[0];
    const tailFrame = this.frames[K];
    const headCapDepth = Math.min(headFrame.radiusX, headFrame.radiusY) * 0.88;
    const tailCapDepth = Math.min(tailFrame.radiusX, tailFrame.radiusY) * 0.92;

    // 3A. Cranial Pole Vertex (index 0) projected forward along -T_0
    this.positionsArray[0] =
      headFrame.position.x - headFrame.tangent.x * headCapDepth;
    this.positionsArray[1] =
      headFrame.position.y - headFrame.tangent.y * headCapDepth;
    this.positionsArray[2] =
      headFrame.position.z - headFrame.tangent.z * headCapDepth;

    const writeRingVertices = (
      ringIdx: number,
      centerX: number,
      centerY: number,
      centerZ: number,
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

        const vx =
          centerX + cosT * rX * normal.x + sinT * rY * binormal.x;
        const vy =
          centerY + cosT * rX * normal.y + sinT * rY * binormal.y;
        const vz =
          centerZ + cosT * rX * normal.z + sinT * rY * binormal.z;

        const idx3 = (baseVertex + j) * 3;
        this.positionsArray[idx3] = vx;
        this.positionsArray[idx3 + 1] = vy;
        this.positionsArray[idx3 + 2] = vz;
      }
    };

    // 3B. Cranial Cap Rings (rings 0 .. capRings - 1)
    for (let c = 0; c < this.capRings; c++) {
      const phi = ((c + 1) / (this.capRings + 1)) * (Math.PI * 0.5);
      const axialOffset = Math.cos(phi) * headCapDepth;
      const radialScale = Math.sin(phi);
      writeRingVertices(
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

    // 3C. Main Spine Cross-Section Rings (rings capRings .. capRings + K)
    for (let i = 0; i <= K; i++) {
      const f = this.frames[i];
      writeRingVertices(
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

    // 3D. Caudal Cap Rings (rings capRings + K + 1 .. totalRings - 1)
    for (let c = 0; c < this.capRings; c++) {
      const phi = ((c + 1) / (this.capRings + 1)) * (Math.PI * 0.5);
      const axialOffset = Math.sin(phi) * tailCapDepth;
      const radialScale = Math.cos(phi);
      writeRingVertices(
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

    // 3E. Caudal Pole Vertex (last index) projected backward along +T_K
    const pIdx3 = caudalPoleIndex * 3;
    this.positionsArray[pIdx3] =
      tailFrame.position.x + tailFrame.tangent.x * tailCapDepth;
    this.positionsArray[pIdx3 + 1] =
      tailFrame.position.y + tailFrame.tangent.y * tailCapDepth;
    this.positionsArray[pIdx3 + 2] =
      tailFrame.position.z + tailFrame.tangent.z * tailCapDepth;

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();

    return nodes;
  }

  /**
   * Evaluates the interpolated Rotation Minimizing Frame (Position, Tangent, Normal, Binormal, radiusX, radiusY)
   * at normalized spine parameter `tNorm` in `[0, 1]`.
   */
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
}
