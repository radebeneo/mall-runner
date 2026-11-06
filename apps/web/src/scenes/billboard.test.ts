import { FrontSide, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { cutoutMaterial, quadGeometry, yawToward } from './billboard';
import type { Quad } from './mall-manifest';

const QUAD: Quad = {
  width: 1.2,
  height: 1.5,
  left: -0.6,
  bottom: -0.05,
  u0: 0.1,
  v0: 0.2,
  u1: 0.6,
  v1: 0.9,
};

describe('billboard helpers', () => {
  it('builds a plane standing on its pivot with the quad’s own UVs', () => {
    const geometry = quadGeometry(QUAD);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    // Geometry attributes are 32-bit floats, so compare to about 6 decimal places.
    expect(box?.min.x).toBeCloseTo(-0.6, 6);
    expect(box?.max.x).toBeCloseTo(0.6, 6);
    expect(box?.min.y).toBeCloseTo(-0.05, 6);
    expect(box?.max.y).toBeCloseTo(1.45, 6);
    expect(box?.min.z).toBe(0);
    const uv = geometry.getAttribute('uv');
    // Top left, top right, bottom left, bottom right.
    const corners: [number, number][] = [
      [0.1, 0.9],
      [0.6, 0.9],
      [0.1, 0.2],
      [0.6, 0.2],
    ];
    corners.forEach(([u, v], index) => {
      expect(uv.getX(index), `u${String(index)}`).toBeCloseTo(u, 6);
      expect(uv.getY(index), `v${String(index)}`).toBeCloseTo(v, 6);
    });
  });

  it('draws cut-outs alpha-tested, front side only, without sorting', () => {
    const map = new Texture();
    const material = cutoutMaterial(map);
    expect(material.map).toBe(map);
    expect(material.alphaTest).toBe(0.5);
    expect(material.alphaToCoverage).toBe(true);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.side).toBe(FrontSide);
    expect(material.fog).toBe(true);
  });

  it('turns a +z-facing plane toward a target', () => {
    expect(yawToward(0, 0, 0, 5)).toBe(0);
    expect(yawToward(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(yawToward(2, -10, 2, 6)).toBe(0);
  });
});
