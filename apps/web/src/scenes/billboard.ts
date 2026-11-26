// Shared pieces for the textured cut-outs in the mall: quad geometry with its own UVs, and the
// one material setup the cut-outs use.
import { MeshBasicMaterial, PlaneGeometry, type Texture } from 'three';
import type { Quad } from './mall-manifest';

/**
 * A plane for one quad, standing on its ground pivot at the origin and facing +z. The UVs live
 * in the geometry, so atlas frames never need a texture offset (textures stay shareable).
 */
export function quadGeometry(quad: Quad): PlaneGeometry {
  const geometry = new PlaneGeometry(quad.width, quad.height);
  geometry.translate(quad.left + quad.width / 2, quad.bottom + quad.height / 2, 0);
  const uv = geometry.getAttribute('uv');
  // PlaneGeometry's corners: top left, top right, bottom left, bottom right.
  uv.setXY(0, quad.u0, quad.v1);
  uv.setXY(1, quad.u1, quad.v1);
  uv.setXY(2, quad.u0, quad.v0);
  uv.setXY(3, quad.u1, quad.v0);
  return geometry;
}

/**
 * The art is baked-lit, so it is drawn unlit (and still fogged). Alpha-tested with alpha to
 * coverage: crisp edges, softened by MSAA, and no sorting, because instances are never
 * depth-sorted. Front side only, so a mirrored back is never drawn.
 */
export function cutoutMaterial(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, alphaTest: 0.5, alphaToCoverage: true });
}

/** The y rotation that turns a +z-facing plane at (x, z) toward (targetX, targetZ). */
export function yawToward(x: number, z: number, targetX: number, targetZ: number): number {
  return Math.atan2(targetX - x, targetZ - z);
}
