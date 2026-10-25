/** Axis-aligned box in lane space (see `RunnerConfig`). */
export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function createBox(): Box {
  return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
}

/**
 * Sets `out` from a centre in x and z, an underside height in y and full sizes, and returns it.
 * Writing into an existing box keeps collision checks allocation-free.
 */
export function setBox(
  out: Box,
  x: number,
  bottom: number,
  z: number,
  width: number,
  height: number,
  depth: number,
): Box {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  out.minX = x - halfWidth;
  out.maxX = x + halfWidth;
  out.minY = bottom;
  out.maxY = bottom + height;
  out.minZ = z - halfDepth;
  out.maxZ = z + halfDepth;
  return out;
}

/** True when the boxes overlap. Boxes that only touch do not collide. */
export function overlaps(a: Box, b: Box): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}
