import { ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifestJson from '../assets/mall/manifest.json';
import { MALL_TEXTURE_IDS, type MallArt, cloneArtTextures, createMallArtLoader } from './mall-art';
import { parseMallManifest } from './mall-manifest';

const FILES = parseMallManifest(manifestJson).files;
const URLS: Readonly<Record<string, string>> = Object.fromEntries(
  FILES.map((file) => [file, `/assets/${file}`]),
);

function fakeLoad(): { urls: string[]; load: (url: string) => Promise<Texture> } {
  const urls: string[] = [];
  return {
    urls,
    load: (url) => {
      urls.push(url);
      return Promise.resolve(new Texture());
    },
  };
}

async function loadArt(): Promise<MallArt> {
  const art = await createMallArtLoader(fakeLoad().load, URLS, manifestJson).preload();
  if (art === null) throw new Error('The test art did not load.');
  return art;
}

/** Counts `dispose` calls on a texture. */
function watchDispose(texture: Texture): () => number {
  let count = 0;
  texture.addEventListener('dispose', () => {
    count += 1;
  });
  return () => count;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mall art loader', () => {
  it('loads every texture once, however often it is asked', async () => {
    const { urls, load } = fakeLoad();
    const loader = createMallArtLoader(load, URLS, manifestJson);
    const first = loader.preload();
    expect(loader.preload()).toBe(first);
    // Never waits: nothing is ready until the load finishes.
    expect(loader.current()).toBeNull();
    const art = await first;
    expect(art).not.toBeNull();
    expect(loader.current()).toBe(art);
    expect(urls).toHaveLength(MALL_TEXTURE_IDS.length);
    expect(urls).toContain('/assets/runner-atlas.webp');
    expect(urls).not.toContain('/assets/mall-background-desktop.webp');
  });

  it('marks the art as sRGB and repeats only the floor textures', async () => {
    const { textures } = await loadArt();
    for (const id of MALL_TEXTURE_IDS) expect(textures[id].colorSpace, id).toBe(SRGBColorSpace);
    expect(textures['floor-tile'].wrapS).toBe(RepeatWrapping);
    expect(textures['floor-tile'].wrapT).toBe(RepeatWrapping);
    expect(textures['floor-band'].wrapS).toBe(ClampToEdgeWrapping);
    expect(textures['floor-band'].wrapT).toBe(RepeatWrapping);
    expect(textures.runner.wrapS).toBe(ClampToEdgeWrapping);
  });

  it('falls back to the procedural mall when a file is not bundled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const urls = { ...URLS };
    delete urls['runner-atlas.webp'];
    const loader = createMallArtLoader(fakeLoad().load, urls, manifestJson);
    await expect(loader.preload()).resolves.toBeNull();
    expect(loader.current()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('falls back when an image fails to load or the manifest is broken', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = createMallArtLoader(
      () => Promise.reject(new Error('offline')),
      URLS,
      manifestJson,
    );
    await expect(failing.preload()).resolves.toBeNull();
    const broken = createMallArtLoader(fakeLoad().load, URLS, { version: 1 });
    await expect(broken.preload()).resolves.toBeNull();
    expect(broken.current()).toBeNull();
  });

  it('only fills its cache when a load finishes after a run has started', async () => {
    let finish = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const loader = createMallArtLoader(
      async () => {
        await gate;
        return new Texture();
      },
      URLS,
      manifestJson,
    );
    const pending = loader.preload();
    // A scene built now sees no art and draws the procedural mall for the whole run.
    expect(loader.current()).toBeNull();
    finish();
    await pending;
    // The late result is only cached, for the next run.
    expect(loader.current()).not.toBeNull();
  });
});

describe('per-scene texture clones', () => {
  it('gives each scene its own textures over the shared images', async () => {
    const art = await loadArt();
    const a = cloneArtTextures(art, 16);
    const b = cloneArtTextures(art, 16);
    for (const id of MALL_TEXTURE_IDS) {
      expect(a.textures[id], id).not.toBe(art.textures[id]);
      expect(a.textures[id], id).not.toBe(b.textures[id]);
      expect(a.textures[id].source, id).toBe(art.textures[id].source);
      expect(a.textures[id].colorSpace, id).toBe(SRGBColorSpace);
    }
    expect(a.textures['floor-tile'].anisotropy).toBe(8);
    expect(a.textures['floor-band'].anisotropy).toBe(8);
    expect(cloneArtTextures(art, 4).textures['floor-tile'].anisotropy).toBe(4);
    expect(a.textures.runner.anisotropy).toBe(1);
  });

  it('disposes one scene without touching the shared art or another scene', async () => {
    const art = await loadArt();
    // As in a StrictMode remount: two scenes exist, then the first is torn down.
    const first = cloneArtTextures(art, 1);
    const second = cloneArtTextures(art, 1);
    const template = watchDispose(art.textures.coin);
    const mine = watchDispose(first.textures.coin);
    const theirs = watchDispose(second.textures.coin);
    first.dispose();
    expect(mine()).toBe(1);
    expect(template()).toBe(0);
    expect(theirs()).toBe(0);
    // A later scene can still clone the untouched templates.
    expect(cloneArtTextures(art, 1).textures.coin.source).toBe(art.textures.coin.source);
  });
});
