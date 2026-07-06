#!/usr/bin/env python3
"""Remove near-white backgrounds from PNG images (makes white -> transparent)."""
from __future__ import annotations

import math
from collections import deque
from pathlib import Path

from PIL import Image


def is_backdrop_pixel(r: int, g: int, b: int, a: int, threshold: int = 232) -> bool:
    if a < 8:
        return True
    if r >= threshold and g >= threshold and b >= threshold:
        return True
    # AI cream/yellow matte common on generated coin art
    if r >= 245 and g >= 240 and 160 <= b <= 210:
        return True
    brightness = r + g + b
    if brightness >= threshold * 3 - 40 and max(r, g, b) - min(r, g, b) < 35:
        return True
    return False


def flood_remove_backdrop(img: Image.Image, threshold: int = 232) -> None:
    px = img.load()
    w, h = img.size
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_backdrop_pixel(*px[x, y][:3], px[x, y][3], threshold):
                q.append((x, y))
                visited[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x] and is_backdrop_pixel(*px[x, y][:3], px[x, y][3], threshold):
                q.append((x, y))
                visited[y][x] = True

    while q:
        x, y = q.popleft()
        px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, a = px[nx, ny]
                if is_backdrop_pixel(r, g, b, a, threshold):
                    visited[ny][nx] = True
                    q.append((nx, ny))


def circular_trim_coin(img: Image.Image) -> Image.Image:
    """Trim square AI mattes outside a round coin silhouette."""
    px = img.load()
    w, h = img.size
    opaque = [(x, y, px[x, y][3]) for y in range(h) for x in range(w) if px[x, y][3] > 32]
    if not opaque:
        return img

    total_a = sum(a for _, _, a in opaque)
    cx = sum(x * a for x, _, a in opaque) / total_a
    cy = sum(y * a for _, y, a in opaque) / total_a
    dists = sorted(math.hypot(x - cx, y - cy) for x, y, _ in opaque)
    radius = dists[int(len(dists) * 0.995)] + 2

    for y in range(h):
        for x in range(w):
            if math.hypot(x - cx, y - cy) > radius:
                px[x, y] = (0, 0, 0, 0)

    xs = [x for x, y, _ in opaque if px[x, y][3] > 16]
    ys = [y for x, y, _ in opaque if px[x, y][3] > 16]
    pad = 4
    left, top = max(0, min(xs) - pad), max(0, min(ys) - pad)
    right, bottom = min(w - 1, max(xs) + pad), min(h - 1, max(ys) + pad)
    cropped = img.crop((left, top, right + 1, bottom + 1))

    px2 = cropped.load()
    cw, ch = cropped.size
    xs2 = [x for y in range(ch) for x in range(cw) if px2[x, y][3] > 16]
    ys2 = [y for y in range(ch) for x in range(cw) if px2[x, y][3] > 16]
    cx2 = (min(xs2) + max(xs2)) / 2
    cy2 = (min(ys2) + max(ys2)) / 2
    side = max(max(xs2) - min(xs2), max(ys2) - min(ys2)) + 16
    left2 = int(cx2 - side / 2)
    top2 = int(cy2 - side / 2)
    return cropped.crop((left2, top2, left2 + side, top2 + side))


def remove_white_background(path: Path, threshold: int = 232) -> None:
    img = Image.open(path).convert("RGBA")
    flood_remove_backdrop(img, threshold)

    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (r, g, b, 0)

    if path.name == "bridgeys-logo.png":
        img = circular_trim_coin(img)

    img.save(path, "PNG")
    print(f"  cleaned {path.name}")


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    targets: list[Path] = []

    for pattern in [
        "public/house/exterior/*.png",
        "public/house/furniture/*.png",
        "public/brand/bridgeys-logo.png",
        "public/house/player.png",
    ]:
        targets.extend(root.glob(pattern))

    if not targets:
        print("No PNG files found.")
        return

    print(f"Removing white backgrounds from {len(targets)} files...")
    for p in sorted(set(targets)):
        remove_white_background(p)
    print("Done.")


if __name__ == "__main__":
    main()
