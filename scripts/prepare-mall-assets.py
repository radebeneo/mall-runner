#!/usr/bin/env python3
"""Builds the runtime mall art in apps/web/src/assets/mall/ from the source renders in 3D-assets/.

The source files are never modified. Run from the repository root:

    python scripts/prepare-mall-assets.py
    pnpm exec prettier --write apps/web/src/assets/mall/manifest.json

Requires Python 3.10+, Pillow with WebP support and numpy. Output is deterministic: the same
sources give the same files. Previews on dark, light and magenta backgrounds are written to
<temp>/mall-asset-previews (override with MALL_ASSET_PREVIEW_DIR) for visual inspection.

What it does (see docs/decisions.md, "Mall art pass"):

- Cut-outs: drops near-zero alpha speckles, replaces the colour of every partly transparent edge
  pixel with colour bled from the solid interior (the sources' edges are blended with the light
  grey checkerboard, which shows as a halo), resizes with premultiplied alpha, then bleeds colour
  into the transparent padding so texture filtering and mipmaps cannot pull grey in. Opaque pixels
  keep their colour, so white shoes, highlights and metal are untouched.
- runner.png: finds the six poses by their real alpha bounds, normalises scale (only when head
  widths disagree), aligns the head tops and torso centres, and packs uniform padded cells with
  one shared ground pivot.
- coin-3d.png: used as supplied (edge clean-up and resizing only).
- HUD images (DOM, not in the manifest): packages/ui/src/assets/coin.webp from coin-3d.png for
  the points icon, and apps/web/src/assets/art/runner-avatar.webp from the first runner frame
  for the timeline avatar. Both are real cut-outs with transparent backgrounds.
- bench.png and wheeled-bucket.png are drawn from above, so their far legs and wheels end well
  above the lowest pixel. They stand on their highest foot or wheel instead (`ground_contact`),
  so nothing floats; the nearer feet reach just below the floor line.
- sale-board.png: removes the lettering inside the panel and adds a plain tag shape.
- floor.png is a perspective illustration, so it is not used as a material. A seamless top-down
  stone tile and a terracotta/charcoal edge band are generated from colours sampled from it.
- mall-background.png: the floor area has a grey transparency checkerboard baked in (an export
  artefact; the real stone tiles survive only at the edges). Those pixels are replaced with the
  generated floor projected in perspective.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, features

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "3D-assets"
OUT = ROOT / "apps" / "web" / "src" / "assets" / "mall"
# Small DOM images for the HUD. They live outside OUT, so the scene manifest does not list them.
HUD_UI = ROOT / "packages" / "ui" / "src" / "assets"
HUD_WEB = ROOT / "apps" / "web" / "src" / "assets" / "art"
PREVIEW = Path(
    os.environ.get("MALL_ASSET_PREVIEW_DIR", Path(tempfile.gettempdir()) / "mall-asset-previews")
)

PAD = 8
SOLID = 0.95
NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))

# Generated floor scale: one stone tile is a lane wide (1.6 m), so grout lines fall on lane edges.
TILE_METRES = 1.6
FLOOR_PX_PER_METRE = 160
FLOOR_TEXTURE_METRES = 2 * TILE_METRES
BAND_METRES = 0.4

# Props drawn from above, whose far feet or wheels sit higher in the image than the near ones.
# They stand on their highest contact (see `ground_contact`) rather than their lowest pixel.
GROUND_CONTACT_PROPS = {"bench", "bucket"}
# A contact must stand at least this many source pixels proud of the outline on both sides.
CONTACT_RISE_PX = 8


# ---------------------------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------------------------


def load(name: str) -> np.ndarray:
    with Image.open(SRC / name) as image:
        return np.asarray(image.convert("RGBA"), dtype=np.float32) / 255.0


def to_image(rgba: np.ndarray) -> Image.Image:
    data = (np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(data, "RGBA" if data.shape[2] == 4 else "RGB")


def alpha_bbox(alpha: np.ndarray, threshold: float = 0.03) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(alpha > threshold)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def bleed(
    rgb: np.ndarray, known: np.ndarray, iterations: int, until: np.ndarray | None = None
) -> np.ndarray:
    """Spreads colour from `known` pixels into their neighbours, one ring per iteration."""
    rgb = rgb.copy()
    known = known.copy()
    for _ in range(iterations):
        if until is not None and not (until & ~known).any():
            break
        if known.all():
            break
        total = np.zeros_like(rgb)
        count = np.zeros(known.shape, np.float32)
        for dy, dx in NEIGHBOURS:
            k = np.roll(known, (dy, dx), (0, 1))
            total += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]
            count += k
        new = (~known) & (count > 0)
        rgb[new] = total[new] / count[new][:, None]
        known |= new
    if not known.all():
        fill = rgb[known].mean(axis=0) if known.any() else np.full(3, 0.5, np.float32)
        rgb[~known] = fill
    return rgb


def clean_edges(rgba: np.ndarray) -> np.ndarray:
    """Removes checkerboard contamination from partly transparent edge pixels."""
    out = rgba.copy()
    alpha = out[..., 3]
    alpha[alpha < 8 / 255] = 0
    solid = alpha >= SOLID
    bled = bleed(out[..., :3], solid, 6)
    out[..., :3] = np.where(solid[..., None], out[..., :3], bled)
    return out


def resize_premultiplied(rgba: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    width, height = size
    alpha = rgba[..., 3]
    channels = [rgba[..., i] * alpha for i in range(3)] + [alpha]
    resized = [
        np.asarray(
            Image.fromarray(np.ascontiguousarray(c, dtype=np.float32), "F").resize(
                (width, height), Image.Resampling.LANCZOS
            )
        )
        for c in channels
    ]
    new_alpha = np.clip(resized[3], 0, 1)
    rgb = np.stack(resized[:3], -1) / np.maximum(new_alpha, 1e-4)[..., None]
    out = np.dstack([np.clip(rgb, 0, 1), new_alpha]).astype(np.float32)
    out[..., 3][out[..., 3] < 2 / 255] = 0
    return out


def finalize(rgba: np.ndarray) -> np.ndarray:
    """Gives fully transparent pixels a nearby colour so filtering never darkens or greys edges."""
    out = rgba.copy()
    known = out[..., 3] >= 0.5
    bled = bleed(out[..., :3], known, 24)
    clear = out[..., 3] < 0.02
    out[..., :3] = np.where(clear[..., None], bled, out[..., :3])
    return out


def fit_prop(rgba: np.ndarray, max_w: int, max_h: int) -> tuple[np.ndarray, dict]:
    x0, y0, x1, y1 = alpha_bbox(rgba[..., 3])
    crop = rgba[y0:y1, x0:x1]
    cw, ch = x1 - x0, y1 - y0
    scale = min(max_w / cw, max_h / ch, 1.0)
    tw, th = max(1, round(cw * scale)), max(1, round(ch * scale))
    small = resize_premultiplied(crop, (tw, th))
    canvas = np.zeros((th + 2 * PAD, tw + 2 * PAD, 4), np.float32)
    canvas[PAD : PAD + th, PAD : PAD + tw] = small
    return finalize(canvas), {"sourceBox": [x0, y0, cw, ch], "contentRect": [PAD, PAD, tw, th]}


def hud_image(rgba: np.ndarray, box_w: int | None, box_h: int, pad: int = 2) -> np.ndarray:
    """Crops a cut-out to its alpha bounds and fits it in a small HUD image, centred.

    With `box_w` None the width follows the content's aspect ratio (a tight crop).
    """
    x0, y0, x1, y1 = alpha_bbox(rgba[..., 3])
    crop = rgba[y0:y1, x0:x1]
    cw, ch = x1 - x0, y1 - y0
    if box_w is None:
        box_w = round(cw * (box_h - 2 * pad) / ch) + 2 * pad
    scale = min((box_w - 2 * pad) / cw, (box_h - 2 * pad) / ch)
    tw, th = max(1, round(cw * scale)), max(1, round(ch * scale))
    small = resize_premultiplied(crop, (tw, th))
    canvas = np.zeros((box_h, box_w, 4), np.float32)
    ox, oy = (box_w - tw) // 2, (box_h - th) // 2
    canvas[oy : oy + th, ox : ox + tw] = small
    return finalize(canvas)


def save_hud(image: Image.Image, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=92, alpha_quality=100, method=6, exact=True)
    return path


def save(image: Image.Image, name: str, quality: int = 90) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    if name.endswith(".webp"):
        # `exact` keeps the bled colour under transparent pixels.
        image.save(path, "WEBP", quality=quality, alpha_quality=100, method=6, exact=True)
    else:
        image.save(path, "PNG", optimize=True)
    return path


def periodic_noise(height: int, width: int, sigma: float, rng: np.random.Generator) -> np.ndarray:
    """Gaussian-filtered noise that tiles seamlessly (filtered in the frequency domain)."""
    noise = rng.standard_normal((height, width))
    fy = np.fft.fftfreq(height)[:, None]
    fx = np.fft.fftfreq(width)[None, :]
    kernel = np.exp(-2 * (np.pi**2) * (sigma**2) * (fx**2 + fy**2))
    out = np.real(np.fft.ifft2(np.fft.fft2(noise) * kernel))
    return (out / (out.std() + 1e-9)).astype(np.float32)


def segments(profile: np.ndarray, threshold: int, min_gap: int, min_len: int) -> list[list[int]]:
    on = profile > threshold
    found: list[list[int]] = []
    start = None
    for i, value in enumerate(on):
        if value and start is None:
            start = i
        if not value and start is not None:
            found.append([start, i])
            start = None
    if start is not None:
        found.append([start, len(on)])
    merged: list[list[int]] = []
    for seg in found:
        if merged and seg[0] - merged[-1][1] < min_gap:
            merged[-1][1] = seg[1]
        else:
            merged.append(seg)
    return [s for s in merged if s[1] - s[0] >= min_len]


def dominant_colour(pixels: np.ndarray) -> np.ndarray:
    q = np.round(pixels * 31).astype(np.int64)
    keys = q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]
    values, counts = np.unique(keys, return_counts=True)
    key = int(values[counts.argmax()])
    return np.array([key // 1024, (key // 32) % 32, key % 32], np.float32) / 31


def supersampled_mask(size: tuple[int, int], draw_fn, factor: int = 4) -> np.ndarray:
    big = Image.new("L", (size[0] * factor, size[1] * factor), 0)
    draw_fn(ImageDraw.Draw(big), factor)
    small = big.resize(size, Image.Resampling.LANCZOS)
    return np.asarray(small, np.float32) / 255.0


# ---------------------------------------------------------------------------------------------
# Derivatives
# ---------------------------------------------------------------------------------------------


def ground_contact(alpha: np.ndarray, name: str) -> tuple[int, list[dict]]:
    """Finds the feet or wheels of a prop drawn from above.

    A contact is a run of columns whose lowest solid pixel is a local low point that the outline
    rises away from on both sides. Seen from above, the far contacts sit higher in the image than
    the near ones, so standing the prop on its lowest pixel leaves the far ones in the air.
    Returns the row just under the highest contact (the new ground line, in source pixels) and
    every contact found.
    """
    solid = alpha > 0.5
    cols = np.nonzero(solid.any(axis=0))[0]
    x0, x1 = int(cols.min()), int(cols.max()) + 1
    bottom = np.array([int(np.nonzero(solid[:, x])[0].max()) if solid[:, x].any() else -1 for x in range(x0, x1)])
    window = max((x1 - x0) // 14, 8)
    contacts: list[dict] = []
    for i in range(len(bottom)):
        lo, hi = max(0, i - window), min(len(bottom), i + window + 1)
        if bottom[i] < bottom[lo:hi].max():
            continue
        if contacts and x0 + i - contacts[-1]["x"][1] <= 2:
            contacts[-1]["x"][1] = x0 + i
            continue
        # At the outline's ends there is nothing to rise towards, so that side does not count.
        left = int(bottom[i] - bottom[lo:i].min()) if i > lo else CONTACT_RISE_PX
        right = int(bottom[i] - bottom[i + 1 : hi].min()) if i + 1 < hi else CONTACT_RISE_PX
        if left >= CONTACT_RISE_PX and right >= CONTACT_RISE_PX:
            contacts.append({"x": [x0 + i, x0 + i], "bottom": int(bottom[i])})
    if len(contacts) < 2:
        sys.exit(f"{name}: expected at least two feet or wheels, found {len(contacts)}. Set the pivot by hand.")
    return min(c["bottom"] for c in contacts) + 1, contacts


def text_free_board(rgba: np.ndarray) -> tuple[np.ndarray, dict]:
    """Removes the lettering inside the sale board's panel and adds a plain tag shape."""
    out = rgba.copy()
    alpha = out[..., 3]
    rgb = out[..., :3]
    x0, y0, x1, y1 = alpha_bbox(alpha, 0.5)
    opaque = alpha > 0.95
    upper = np.zeros_like(opaque)
    upper[y0 : y0 + int(0.65 * (y1 - y0)), x0:x1] = True
    dom = dominant_colour(rgb[opaque & upper])
    chroma = rgb / (rgb.sum(-1, keepdims=True) + 1e-4)
    dom_chroma = dom / (dom.sum() + 1e-4)
    chroma_dist = np.abs(chroma - dom_chroma).max(-1)
    lum_ratio = rgb.mean(-1) / max(float(dom.mean()), 1e-3)
    panel = opaque & (chroma_dist < 0.045) & (lum_ratio > 0.55) & (lum_ratio < 1.45)

    grid = Image.fromarray(np.where(panel, 0, 255).astype(np.uint8), "L")
    ImageDraw.floodfill(grid, (0, 0), 128)
    holes = np.asarray(grid) == 255
    pys, pxs = np.nonzero(panel)
    inside = np.zeros_like(holes)
    inside[pys.min() : pys.max() + 1, pxs.min() : pxs.max() + 1] = True
    holes &= inside
    ratio = float(holes.sum() / max(int(panel.sum()), 1))
    if not 0.01 < ratio < 0.6:
        sys.exit(
            f"sale-board.png: lettering detection failed (hole ratio {ratio:.3f}). "
            "Prepare the text-free board by hand."
        )
    grown = Image.fromarray((holes * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(7))
    holes = (np.asarray(grown) > 0) & (alpha > 0.5)

    # Rebuild the whole panel interior rather than patching the letters: the lettering's dark
    # drop-shadows fall inside the panel's colour range and would otherwise survive as ghosts.
    # The panel's real shading is kept as a fitted plane (light falloff), not as texture.
    closed = (
        Image.fromarray(((panel | holes) * 255).astype(np.uint8), "L")
        .filter(ImageFilter.MaxFilter(5))
        .filter(ImageFilter.MinFilter(5))
        .filter(ImageFilter.MinFilter(9))
    )
    interior = (np.asarray(closed) > 0) & (alpha > 0.95)
    sample = panel & ~holes & interior
    sy, sx = np.nonzero(sample)
    if len(sx) < 500:
        sys.exit("sale-board.png: too few clean panel pixels to rebuild the panel.")
    shade_samples = rgb[sample].mean(-1) / max(float(dom.mean()), 1e-3)
    design = np.stack([np.ones(len(sx)), sx, sy], -1).astype(np.float64)
    coef, *_ = np.linalg.lstsq(design, shade_samples.astype(np.float64), rcond=None)
    gy, gx = np.mgrid[0 : alpha.shape[0], 0 : alpha.shape[1]].astype(np.float32)
    shade = np.clip(coef[0] + coef[1] * gx + coef[2] * gy, 0.7, 1.3).astype(np.float32)
    flat = dom[None, None, :] * shade[..., None]
    feather = (
        np.asarray(
            Image.fromarray((interior * 255).astype(np.uint8), "L").filter(
                ImageFilter.GaussianBlur(2)
            ),
            np.float32,
        )
        / 255.0
    )[..., None]
    rgb = rgb * (1 - feather) + flat * feather

    hy, hx = np.nonzero(holes)
    lx0, lx1, ly0, ly1 = hx.min(), hx.max(), hy.min(), hy.max()
    tcx, tcy = (lx0 + lx1) / 2, (ly0 + ly1) / 2
    tw = max(0.62 * (lx1 - lx0), 0.3 * (pxs.max() - pxs.min()))
    th = min(max(0.7 * (ly1 - ly0), 0.22 * (pys.max() - pys.min())), tw * 0.6)
    bx0, bx1 = tcx - tw / 2, tcx + tw / 2
    by0, by1 = tcy - th / 2, tcy + th / 2
    neck = bx0 + 0.24 * tw

    def tag(canvas: ImageDraw.ImageDraw, f: int) -> None:
        canvas.polygon(
            [(bx0 * f, tcy * f), (neck * f, by0 * f), (bx1 * f, by0 * f), (bx1 * f, by1 * f), (neck * f, by1 * f)],
            fill=255,
        )

    def hole(canvas: ImageDraw.ImageDraw, f: int) -> None:
        r = 0.11 * th
        hcx = neck - 0.02 * tw
        canvas.ellipse([(hcx - r) * f, (tcy - r) * f, (hcx + r) * f, (tcy + r) * f], fill=255)

    def stripe(canvas: ImageDraw.ImageDraw, f: int) -> None:
        sx0, sx1 = neck + 0.16 * tw, bx1 - 0.12 * tw
        canvas.rounded_rectangle(
            [sx0 * f, (tcy - 0.07 * th) * f, sx1 * f, (tcy + 0.07 * th) * f],
            radius=0.07 * th * f,
            fill=255,
        )

    size = (alpha.shape[1], alpha.shape[0])
    light_panel = float(dom.mean()) > 0.6
    tag_colour = np.array([0.78, 0.35, 0.25] if light_panel else [0.98, 0.95, 0.88], np.float32)
    tag_mask = supersampled_mask(size, tag)[..., None]
    cut = np.clip(supersampled_mask(size, hole) + supersampled_mask(size, stripe), 0, 1)[..., None]
    rgb = rgb * (1 - tag_mask) + tag_colour * tag_mask
    rgb = rgb * (1 - cut * tag_mask) + dom * cut * tag_mask
    out[..., :3] = rgb
    return out, {"panelColour": [round(float(c), 3) for c in dom], "letteringRatio": round(ratio, 3)}


def floor_palette(rgba: np.ndarray) -> dict[str, np.ndarray]:
    alpha, rgb = rgba[..., 3], rgba[..., :3]
    ok = alpha > 0.95
    lum = rgb.mean(-1)
    sat = rgb.max(-1) - rgb.min(-1)

    def median(mask: np.ndarray, default: list[float]) -> np.ndarray:
        chosen = ok & mask
        if chosen.sum() < 200:
            return np.array(default, np.float32)
        return np.median(rgb[chosen], axis=0).astype(np.float32)

    return {
        "cream": median((lum > 0.72) & (sat > 0.03) & (sat < 0.2), [0.93, 0.89, 0.82]),
        "terracotta": median(
            (rgb[..., 0] > rgb[..., 2] + 0.18) & (lum > 0.3) & (lum < 0.7) & (sat > 0.25),
            [0.74, 0.42, 0.3],
        ),
        "charcoal": median(lum < 0.25, [0.2, 0.2, 0.21]),
    }


def floor_tile(palette: dict[str, np.ndarray]) -> np.ndarray:
    """A seamless top-down texture of 2 x 2 cream stone tiles, each one lane (1.6 m) wide."""
    size = int(FLOOR_TEXTURE_METRES * FLOOR_PX_PER_METRE)
    half = size // 2
    rng = np.random.default_rng(20261026)
    cream = palette["cream"]
    yy, xx = np.mgrid[0:size, 0:size]
    tint = np.where(((yy // half) + (xx // half)) % 2 == 0, 1.0, 0.975)[..., None]
    mottle = 0.022 * periodic_noise(size, size, 7, rng) + 0.012 * periodic_noise(size, size, 1.6, rng)
    veins = np.abs(periodic_noise(size, size, 22, rng)) < 0.05
    rgb = cream[None, None, :] * tint * (1 + mottle[..., None])
    rgb = np.where(veins[..., None], rgb * 0.965, rgb)
    # Grout centred on every tile edge: pixels [-2, 1] around 0 and half.
    edge_x = np.minimum(np.abs(((xx + 2) % half) - 2), 3)
    edge_y = np.minimum(np.abs(((yy + 2) % half) - 2), 3)
    grout = (edge_x <= 1) | (edge_y <= 1)
    bevel = (edge_x == 2) | (edge_y == 2)
    grout_colour = cream * 0.8 * 0.88 + palette["charcoal"] * 0.12
    rgb = np.where(bevel[..., None], rgb * 0.94, rgb)
    rgb = np.where(grout[..., None], grout_colour, rgb)
    return np.clip(rgb, 0, 1).astype(np.float32)


def floor_band(palette: dict[str, np.ndarray]) -> np.ndarray:
    """A seamless terracotta inlay band with charcoal edges and cream diamonds at tile edges."""
    width = int(BAND_METRES * FLOOR_PX_PER_METRE)
    height = int(FLOOR_TEXTURE_METRES * FLOOR_PX_PER_METRE)
    rng = np.random.default_rng(20261027)
    yy, xx = np.mgrid[0:height, 0:width]
    rgb = palette["terracotta"][None, None, :] * (
        1 + 0.03 * periodic_noise(height, width, 4, rng)[..., None]
    )
    edge = np.minimum(xx, width - 1 - xx)
    rgb = np.where((edge < 3)[..., None], palette["cream"] * 0.92, rgb)
    rgb = np.where(((edge >= 6) & (edge < 10))[..., None], palette["charcoal"], rgb)
    period = height // 2
    dy = ((yy + period // 2) % period) - period // 2
    diamond = np.abs(xx - width / 2 + 0.5) + np.abs(dy) 
    rgb = np.where((diamond < 15)[..., None], palette["charcoal"], rgb)
    rgb = np.where((diamond < 11)[..., None], palette["cream"], rgb)
    return np.clip(rgb, 0, 1).astype(np.float32)


def repair_background(
    rgba: np.ndarray, tile: np.ndarray, band: np.ndarray
) -> tuple[np.ndarray, dict]:
    """Replaces the painted checkerboard floor with the generated floor in perspective."""
    rgb = rgba[..., :3].copy()
    height, width = rgb.shape[:2]
    lum = rgb.mean(-1)
    sat = rgb.max(-1) - rgb.min(-1)
    rows = np.arange(height)[:, None]
    raw = (sat < 0.035) & (lum > 0.66) & (lum < 0.86) & (rows >= int(height * 0.42))
    mask_image = Image.fromarray((raw * 255).astype(np.uint8), "L")
    mask_image = mask_image.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    mask_image = mask_image.filter(ImageFilter.MaxFilter(5))
    mask = np.asarray(mask_image) > 0

    centre = mask[:, width // 3 : 2 * width // 3].mean(axis=1)
    top = int(np.argmax(centre > 0.3))
    horizon = top - 0.03 * height

    focal = float(width)
    eye = 1.6
    tile_h, tile_w = tile.shape[:2]
    band_h, band_w = band.shape[:2]
    accum = np.zeros_like(rgb)
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    for ox, oy in ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)):
        dy = np.maximum(yy + oy - horizon, 0.5)
        depth = focal * eye / dy
        lateral = (xx + ox - width / 2) * eye / dy
        u = ((lateral / FLOOR_TEXTURE_METRES + 0.25) % 1) * tile_w
        v = ((depth / FLOOR_TEXTURE_METRES) % 1) * tile_h
        sample = tile[v.astype(int) % tile_h, u.astype(int) % tile_w]
        side = np.abs(lateral)
        in_band = (side > 3.2) & (side < 3.2 + BAND_METRES)
        bu = (np.clip((side - 3.2) / BAND_METRES, 0, 0.999) * band_w).astype(int)
        bv = (((depth / FLOOR_TEXTURE_METRES) % 1) * band_h).astype(int) % band_h
        sample = np.where(in_band[..., None], band[bv, bu], sample)
        far = np.clip((depth - 12) / 30, 0, 1)[..., None]
        sample = sample * (1 - far * 0.85) + tile.reshape(-1, 3).mean(0) * far * 0.85
        glow = 0.93 + 0.09 * np.exp(-((lateral / 3.0) ** 2))
        accum += sample * glow[..., None]
    floor = accum / 4

    haze_row = max(int(horizon), 0)
    haze = np.median(rgb[max(haze_row - 6, 0) : haze_row + 1].reshape(-1, 3), axis=0)
    fade = np.clip((yy - horizon) / (0.25 * height), 0, 1)[..., None]
    floor = floor * fade + haze * (1 - fade) * 0.35 + floor * (1 - fade) * 0.65

    soft = (
        np.asarray(Image.fromarray((mask * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.2)), np.float32)
        / 255.0
    )[..., None]
    out = rgb * (1 - soft) + floor * soft
    return out.astype(np.float32), {
        "replacedFraction": round(float(mask.mean()), 4),
        "horizonY": round(float(horizon), 1),
    }


def runner_atlas(rgba: np.ndarray) -> tuple[np.ndarray, dict]:
    alpha = rgba[..., 3]
    solid = alpha > 0.06
    frames = []
    for r0, r1 in segments(solid.sum(axis=1), 2, 6, 40):
        for c0, c1 in segments(solid[r0:r1].sum(axis=0), 1, 6, 30):
            ys, xs = np.nonzero(solid[r0:r1, c0:c1])
            frames.append((c0 + int(xs.min()), r0 + int(ys.min()), c0 + int(xs.max()) + 1, r0 + int(ys.max()) + 1))
    if len(frames) != 6:
        sys.exit(f"runner.png: expected 6 poses, found {len(frames)}. Check the sheet by hand.")

    measures = []
    for x0, y0, x1, y1 in frames:
        sub = solid[y0:y1, x0:x1]
        h = y1 - y0
        widths = []
        for row in sub[int(0.04 * h) : max(int(0.1 * h), int(0.04 * h) + 1)]:
            cols = np.nonzero(row)[0]
            if len(cols):
                widths.append(cols.max() - cols.min() + 1)
        torso = sub[int(0.2 * h) : int(0.45 * h)]
        tys, txs = np.nonzero(torso)
        measures.append(
            {
                "headWidth": float(np.median(widths)),
                "centreX": x0 + float(txs.mean()),
                "height": h,
            }
        )
    head_widths = np.array([m["headWidth"] for m in measures])
    spread = float(head_widths.max() / head_widths.min())
    scales = [1.0] * 6 if spread < 1.1 else list(np.median(head_widths) / head_widths)

    cell_w, cell_h, margin, gutter = 256, 480, 10, 8
    standing = max(m["height"] * s for m, s in zip(measures, scales))
    half_w = max(
        max(m["centreX"] - f[0], f[2] - m["centreX"]) * s for m, f, s in zip(measures, frames, scales)
    )
    out_scale = min((cell_h - 2 * margin) / standing, (cell_w / 2 - margin) / half_w)
    ground = margin + standing * out_scale

    atlas_w = gutter + 3 * (cell_w + gutter)
    atlas_h = gutter + 2 * (cell_h + gutter)
    atlas = np.zeros((atlas_h, atlas_w, 4), np.float32)
    rects = []
    for i, ((x0, y0, x1, y1), m, s) in enumerate(zip(frames, measures, scales)):
        k = s * out_scale
        tw, th = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
        small = resize_premultiplied(rgba[y0:y1, x0:x1], (tw, th))
        cell = np.zeros((cell_h, cell_w, 4), np.float32)
        px = int(round(cell_w / 2 - (m["centreX"] - x0) * k))
        py = margin
        sx0, sy0 = max(px, 0), max(py, 0)
        sx1, sy1 = min(px + tw, cell_w), min(py + th, cell_h)
        cell[sy0:sy1, sx0:sx1] = small[sy0 - py : sy1 - py, sx0 - px : sx1 - px]
        cell = finalize(cell)
        col, row = i % 3, i // 3
        ax, ay = gutter + col * (cell_w + gutter), gutter + row * (cell_h + gutter)
        atlas[ay : ay + cell_h, ax : ax + cell_w] = cell
        rects.append({"x": ax, "y": ay, "w": cell_w, "h": cell_h, "source": [x0, y0, x1 - x0, y1 - y0]})
    return atlas, {
        "frames": rects,
        "pivot": [cell_w / 2, round(ground, 1)],
        "standingHeightPx": round(standing * out_scale, 1),
        "headWidthSpread": round(spread, 3),
        "scaleNormalised": spread >= 1.1,
    }


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------


def preview_sheet(images: list[tuple[str, Image.Image]]) -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    tile = 320
    sheet = Image.new("RGB", (tile * 3, tile * len(images)), (0, 0, 0))
    for row, (_, image) in enumerate(images):
        thumb = image.convert("RGBA")
        thumb.thumbnail((tile - 16, tile - 16))
        for col, bg in enumerate(((24, 26, 30), (240, 236, 226), (255, 0, 255))):
            cell = Image.new("RGBA", (tile, tile), bg + (255,))
            cell.alpha_composite(thumb, ((tile - thumb.width) // 2, (tile - thumb.height) // 2))
            sheet.paste(cell.convert("RGB"), (col * tile, row * tile))
    sheet.save(PREVIEW / "contact.png")


def main() -> None:
    if not features.check("webp"):
        sys.exit("Pillow was built without WebP support; install a Pillow wheel with WebP.")
    assets: list[dict] = []
    previews: list[tuple[str, Image.Image]] = []

    def record(asset_id: str, image: Image.Image, file: str, entry: dict, quality: int = 90) -> None:
        path = save(image, file, quality)
        w, h = image.size
        entry = {
            "id": asset_id,
            "file": file,
            "width": w,
            "height": h,
            "bytes": path.stat().st_size,
            # RGBA8 with a full mip chain.
            "gpuBytesEstimate": int(w * h * 4 * 4 / 3),
            **entry,
        }
        assets.append(entry)
        previews.append((asset_id, image))
        print(f"{file:28} {w}x{h} {entry['bytes'] / 1024:7.1f} KiB")

    props = [
        # id, source, max size, world size, pivot kind, use
        ("coin", "coin-3d.png", 256, 256, {"axis": "width", "metres": 0.62}, "COIN collectible billboard"),
        ("bucket", "wheeled-bucket.png", 360, 512, {"axis": "height", "metres": 1.5}, "CART obstacle billboard"),
        ("wet-floor", "wet-floor-sign.png", 320, 512, {"axis": "height", "metres": 1.0}, "WET_FLOOR obstacle billboard"),
        ("plant", "plant.png", 420, 512, {"axis": "height", "metres": 1.7}, "Decorative planter beside storefronts"),
        ("bench", "bench.png", 512, 420, {"axis": "width", "metres": 1.9}, "Decorative bench in seating areas"),
        ("sale-board", "sale-board.png", 300, 512, {"axis": "height", "metres": 1.3}, "Decorative freestanding board beside shops"),
    ]
    for asset_id, source, max_w, max_h, world, use in props:
        rgba = clean_edges(load(source))
        notes = [
            "Edge colours decontaminated (bled from the solid interior); premultiplied resize.",
            f"Source alpha is genuine; {float((load(source)[..., 3] < 8 / 255).mean()):.0%} of source pixels are fully transparent.",
        ]
        extra: dict = {}
        ground_row: int | None = None
        if asset_id == "coin":
            notes.append("Artwork used exactly as supplied; only edges cleaned and resized.")
        if asset_id == "sale-board":
            rgba, extra = text_free_board(rgba)
            notes.append("Lettering removed from the panel and replaced by a plain tag shape (text-free).")
        if asset_id in GROUND_CONTACT_PROPS:
            ground_row, contacts = ground_contact(rgba[..., 3], source)
            extra["groundContacts"] = contacts
            notes.append(
                "Drawn from above: stands on its highest foot or wheel, so none float; the nearer "
                "ones reach below the floor line and are drawn over the floor."
            )
        prepared, rects = fit_prop(rgba, max_w, max_h)
        cx, cy, cw, ch = rects["contentRect"]
        # Ground contact at the bottom centre of the content, or on the highest contact.
        pivot_y: float = cy + ch
        if ground_row is not None:
            source_top, source_h = rects["sourceBox"][1], rects["sourceBox"][3]
            pivot_y = round(cy + (ground_row - source_top) * ch / source_h, 1)
        record(
            asset_id,
            to_image(prepared),
            f"{asset_id}.webp",
            {
                "source": f"3D-assets/{source}",
                "use": use,
                **rects,
                "pivot": [cx + cw / 2, pivot_y],
                "worldSize": world,
                "notes": notes,
                **extra,
            },
        )

    atlas, runner = runner_atlas(clean_edges(load("runner.png")))
    record(
        "runner",
        to_image(atlas),
        "runner-atlas.webp",
        {
            "source": "3D-assets/runner.png",
            "use": "Player run cycle, rear view; frames in reading order of the source sheet",
            **runner,
            "worldSize": {"axis": "standingHeight", "metres": 1.75},
            "notes": [
                "Frames found from alpha bounds, not equal cells.",
                "Head tops and torso centres aligned; one shared ground pivot per cell.",
                "Frame order is the source sheet's reading order (assumed to be the cycle order).",
                "No jump, roll or crash poses exist in the source; the scene adapts these frames.",
            ],
        },
    )

    # HUD images (DOM, not textures): the points coin and the avatar on the run timeline.
    # Both are drawn at 2x their CSS size: the coin up to 48 px (size-12), the avatar 36 px tall (h-9).
    first = runner["frames"][0]
    hud = [
        ("coin", HUD_UI / "coin.webp", hud_image(clean_edges(load("coin-3d.png")), 96, 96)),
        (
            "runner-avatar",
            HUD_WEB / "runner-avatar.webp",
            hud_image(atlas[first["y"] : first["y"] + first["h"], first["x"] : first["x"] + first["w"]], None, 72, 1),
        ),
    ]
    for hud_id, hud_path, hud_rgba in hud:
        hud_img = to_image(hud_rgba)
        save_hud(hud_img, hud_path)
        previews.append((f"hud-{hud_id}", hud_img))
        print(f"{hud_path.relative_to(ROOT).as_posix():44} {hud_img.width}x{hud_img.height} {hud_path.stat().st_size / 1024:7.1f} KiB (HUD)")

    palette = floor_palette(load("floor.png"))
    tile = floor_tile(palette)
    band = floor_band(palette)
    palette_note = {k: [round(float(c), 3) for c in v] for k, v in palette.items()}
    record(
        "floor-tile",
        to_image(tile),
        "floor-tile.webp",
        {
            "source": "generated (palette sampled from 3D-assets/floor.png)",
            "use": "Seamless top-down floor; 2 x 2 tiles of one lane width each",
            "metres": [FLOOR_TEXTURE_METRES, FLOOR_TEXTURE_METRES],
            "palette": palette_note,
            "notes": [
                "floor.png is a perspective illustration, so it is not mapped onto the floor.",
                "Generated with periodic noise, so it tiles without seams.",
            ],
        },
        quality=88,
    )
    record(
        "floor-band",
        to_image(band),
        "floor-band.webp",
        {
            "source": "generated (palette sampled from 3D-assets/floor.png)",
            "use": "Terracotta and charcoal inlay band beside the running area",
            "metres": [BAND_METRES, FLOOR_TEXTURE_METRES],
            "notes": ["Seamless along its length; diamonds line up with the floor grout."],
        },
        quality=88,
    )

    background, bg_info = repair_background(load("mall-background.png"), tile, band)
    bg_image = to_image(background)
    # The source is square, so each layout gets its own crop instead of relying on CSS `cover`.
    # Desktop: 16:9 with the horizon at about 45% of the height. Mobile: 9:16 down the centre aisle.
    size = bg_image.width
    horizon = float(bg_info["horizonY"])
    desk_h = round(size * 9 / 16)
    desk_top = int(min(max(round(horizon - 0.45 * desk_h), 0), size - desk_h))
    mob_w = round(size * 9 / 16)
    mob_left = (size - mob_w) // 2
    crops = [
        ("background-desktop", "mall-background-desktop.webp", (0, desk_top, size, desk_top + desk_h), "16:9 landscape crop for wide screens"),
        ("background-mobile", "mall-background-mobile.webp", (mob_left, 0, mob_left + mob_w, size), "9:16 portrait crop for phones"),
    ]
    for crop_id, crop_file, box, crop_use in crops:
        record(
            crop_id,
            bg_image.crop(box),
            crop_file,
            {
                "source": "3D-assets/mall-background.png",
                "use": f"App background behind decision screens (CSS, no UI baked in); {crop_use}",
                "cropBox": list(box),
                **bg_info,
                "notes": [
                    "The source has a grey checkerboard painted into the floor; those pixels are replaced with the generated floor in perspective.",
                    "horizonY is in the uncropped 1024 px source; subtract cropBox[1] for this file.",
                ],
            },
            quality=84,
        )

    preview_sheet(previews)
    tiled = Image.new("RGB", (tile.shape[1] * 2, tile.shape[0] * 2))
    tile_image = to_image(tile)
    for ox in (0, 1):
        for oy in (0, 1):
            tiled.paste(tile_image, (ox * tile.shape[1], oy * tile.shape[0]))
    tiled.save(PREVIEW / "floor-tiled.png")
    bg_image.save(PREVIEW / "background.png")
    to_image(atlas).save(PREVIEW / "runner-atlas.png")

    manifest = {
        "version": 1,
        "generatedBy": "scripts/prepare-mall-assets.py",
        "assets": assets,
    }
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    total = sum(a["bytes"] for a in assets)
    gpu = sum(a["gpuBytesEstimate"] for a in assets if not a["id"].startswith("background"))
    print(f"total download {total / 1024:.1f} KiB; scene GPU estimate {gpu / 1048576:.1f} MiB")
    print(f"previews: {PREVIEW}")


if __name__ == "__main__":
    main()
