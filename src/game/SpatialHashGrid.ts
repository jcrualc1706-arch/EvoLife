import { GAME_CONFIG } from './config';

/**
 * Lightweight 2D Spatial Hash Grid covering the 480x480m arena (-240..+240 in X and Z)
 * with 32m cells. Eliminates O(N^2) collision and AI loops to maintain a locked 60 FPS.
 */
export class SpatialHashGrid<T> {
  private readonly cellSize: number;
  private readonly halfSpan: number;
  private readonly cols: number;
  private readonly buckets: T[][];

  constructor(
    arenaRadius = GAME_CONFIG.WORLD.ARENA_RADIUS,
    cellSize = GAME_CONFIG.WORLD.SPATIAL_GRID_CELL_SIZE
  ) {
    this.cellSize = cellSize;
    this.halfSpan = arenaRadius + cellSize;
    this.cols = Math.ceil((this.halfSpan * 2) / this.cellSize);
    const totalBuckets = this.cols * this.cols;
    this.buckets = new Array(totalBuckets);
    for (let i = 0; i < totalBuckets; i++) {
      this.buckets[i] = [];
    }
  }

  public clear(): void {
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i].length = 0;
    }
  }

  private toCellCoord(val: number): number {
    const idx = Math.floor((val + this.halfSpan) / this.cellSize);
    if (idx < 0) return 0;
    if (idx >= this.cols) return this.cols - 1;
    return idx;
  }

  public insert(item: T, x: number, z: number): void {
    const cx = this.toCellCoord(x);
    const cz = this.toCellCoord(z);
    this.buckets[cz * this.cols + cx].push(item);
  }

  /**
   * Populates `outResults` with all items in the cell at (x, z) and its surrounding `cellRadius` neighbors.
   */
  public queryCells(
    x: number,
    z: number,
    cellRadius = 1,
    outResults: T[] = []
  ): T[] {
    outResults.length = 0;
    const cx = this.toCellCoord(x);
    const cz = this.toCellCoord(z);

    const minX = Math.max(0, cx - cellRadius);
    const maxX = Math.min(this.cols - 1, cx + cellRadius);
    const minZ = Math.max(0, cz - cellRadius);
    const maxZ = Math.min(this.cols - 1, cz + cellRadius);

    for (let rz = minZ; rz <= maxZ; rz++) {
      const rowOffset = rz * this.cols;
      for (let rx = minX; rx <= maxX; rx++) {
        const bucket = this.buckets[rowOffset + rx];
        for (let i = 0; i < bucket.length; i++) {
          outResults.push(bucket[i]);
        }
      }
    }

    return outResults;
  }
}
