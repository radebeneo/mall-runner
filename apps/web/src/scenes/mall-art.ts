// Loads the prepared mall art (src/assets/mall) once, away from the game loop. A run uses the art
// only if it had finished loading when the run's scene was built; otherwise the scene draws the
// procedural mall. So art never pops in mid-run, no hazard is ever drawn without a visual, and a
// load that finishes after a scene is gone touches nothing but this cache.
import {
  ClampToEdgeWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three';
import manifestJson from '../assets/mall/manifest.json';
import { type MallManifest, PROP_IDS, type PropId, parseMallManifest } from './mall-manifest';

export type MallTextureId = PropId | 'runner' | 'floor-tile' | 'floor-band';

export const MALL_TEXTURE_IDS: readonly MallTextureId[] = [
  ...PROP_IDS,
  'runner',
  'floor-tile',
  'floor-band',
];

export interface MallArt {
  readonly manifest: MallManifest;
  /** Shared templates. Scenes draw their own clones (`cloneArtTextures`), never these. */
  readonly textures: Readonly<Record<MallTextureId, Texture>>;
}

export type LoadTexture = (url: string) => Promise<Texture>;

export interface MallArtLoader {
  /** Starts loading once; later calls return the same promise. Resolves null if anything fails. */
  readonly preload: () => Promise<MallArt | null>;
  /** The art if it has finished loading, else null. Never waits. */
  readonly current: () => MallArt | null;
}

function fileOf(manifest: MallManifest, id: MallTextureId): string {
  switch (id) {
    case 'runner':
      return manifest.runner.file;
    case 'floor-tile':
      return manifest.floorTile.file;
    case 'floor-band':
      return manifest.floorBand.file;
    default:
      return manifest.props[id].file;
  }
}

function prepare(texture: Texture, id: MallTextureId): Texture {
  texture.colorSpace = SRGBColorSpace;
  if (id === 'floor-tile') {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  } else if (id === 'floor-band') {
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
}

/**
 * A loader over `urls` (bundled file name to URL). `load` is injected so tests can run without
 * images or WebGL.
 */
export function createMallArtLoader(
  load: LoadTexture,
  urls: Readonly<Record<string, string>>,
  rawManifest: unknown,
): MallArtLoader {
  let loaded: MallArt | null = null;
  let pending: Promise<MallArt | null> | null = null;

  const run = async (): Promise<MallArt | null> => {
    try {
      const manifest = parseMallManifest(rawManifest);
      const entries = await Promise.all(
        MALL_TEXTURE_IDS.map(async (id) => {
          const file = fileOf(manifest, id);
          const url = urls[file];
          if (url === undefined) throw new Error(`${file} is not bundled.`);
          return [id, prepare(await load(url), id)] as const;
        }),
      );
      loaded = {
        manifest,
        textures: Object.fromEntries(entries) as Record<MallTextureId, Texture>,
      };
      return loaded;
    } catch (error) {
      console.warn('The mall art could not load, so the runner draws the procedural mall.', error);
      return null;
    }
  };

  return {
    preload: () => (pending ??= run()),
    current: () => loaded,
  };
}

export interface SceneTextures {
  readonly textures: Readonly<Record<MallTextureId, Texture>>;
  /** Frees this scene's GPU copies. The shared templates and other scenes are unaffected. */
  readonly dispose: () => void;
}

/**
 * Clones of the art's textures for one scene. Clones share the decoded image (one download, one
 * decode) but are disposed separately, so a StrictMode remount or a second scene is safe.
 */
export function cloneArtTextures(art: MallArt, maxAnisotropy: number): SceneTextures {
  const textures = {} as Record<MallTextureId, Texture>;
  for (const id of MALL_TEXTURE_IDS) {
    const copy = art.textures[id].clone();
    if (id === 'floor-tile' || id === 'floor-band') copy.anisotropy = Math.min(maxAnisotropy, 8);
    copy.needsUpdate = true;
    textures[id] = copy;
  }
  return {
    textures,
    dispose: () => {
      for (const id of MALL_TEXTURE_IDS) textures[id].dispose();
    },
  };
}

const BUNDLED: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/mall/*.webp', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

const loader = createMallArtLoader(
  (url) => new TextureLoader().loadAsync(url),
  BUNDLED,
  manifestJson,
);

/** Starts loading the mall art. Safe to call more than once. */
export const preloadMallArt = loader.preload;
/** The mall art if it has loaded, else null (the scene then draws the procedural mall). */
export const loadedMallArt = loader.current;
