#!/usr/bin/env python3
"""Write the Pulse Glow app icon, its Android adaptive layers, the splash mark and the favicon.

The mark is src/glow/mark.ts's heartbeat in dots; the ground is a glow card in the Energy ink, lit from below with a
dark pool behind the mark, the look of Today's hero (src/glow/light.ts). Needs numpy and Pillow:

    python3 scripts/brand/glow-icon.py
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/images"
INK = "#F66C28"  # INK.energy in src/glow/tokens.ts
N = 1024
SS = 4  # supersampling for the dots

src = (ROOT / "src/glow/mark.ts").read_text()
COLS = int(re.search(r"MARK_COLS = (\d+)", src).group(1))
ROWS = int(re.search(r"MARK_ROWS = (\d+)", src).group(1))
DOT = float(re.search(r"MARK_DOT = ([\d.]+)", src).group(1))
block = src[src.index("MARK_CELLS"):]
block = block[: block.index("];")]
CELLS = [(int(a), int(b)) for a, b in re.findall(r"\[(\d+), (\d+)\]", block)]


def rgb(h):
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)], float) / 255


def ground(visible=1.0):
    """The glow card. `visible` is the share of the layer a launcher shows (2/3 for an adaptive layer)."""
    yy, xx = np.mgrid[0:N, 0:N] / N
    m = (1 - visible) / 2
    xx, yy = (xx - m) / visible, (yy - m) / visible
    c = rgb(INK)
    lit = np.clip(1 - np.hypot(xx - 0.5, yy - 1.08) / 1.15, 0, 1)
    pool = np.clip(1 - np.hypot((xx - 0.5) / 0.5, (yy - 0.4) / 0.42), 0, 1) ** 1.3
    t = np.clip(0.22 + 0.85 * lit, 0, 1) * (1 - 0.85 * pool)
    stops = [(0, np.zeros(3)), (0.3, c * 0.18), (0.62, c * 0.62), (0.85, c), (1.0, c + (1 - c) * 0.35)]
    img = np.stack([np.interp(t, [s[0] for s in stops], [s[1][k] for s in stops]) for k in range(3)], -1)
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGB")


def mark(span, size=N, color=(255, 255, 255, 255)):
    """The dots, `span` of the image wide, centred."""
    S = size * SS
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pitch = span * S / (COLS - 1 + DOT)
    x0 = (S - pitch * (COLS - 1)) / 2
    y0 = (S - pitch * (ROWS - 1)) / 2
    r = pitch * DOT / 2
    for c, row in CELLS:
        x, y = x0 + c * pitch, y0 + row * pitch
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)
    return im.resize((size, size), Image.LANCZOS)


SPAN = 0.64  # of what the launcher shows
icon = ground().convert("RGBA")
icon.alpha_composite(mark(SPAN))
icon.convert("RGB").save(OUT / "icon.png")
icon.resize((48, 48), Image.LANCZOS).save(OUT / "favicon.png")
ground(2 / 3).save(OUT / "android-icon-background.png")
mark(SPAN * 2 / 3).save(OUT / "android-icon-foreground.png")
mark(SPAN * 2 / 3).save(OUT / "android-icon-monochrome.png")
tinted = Image.new("RGBA", (N, N), (0, 0, 0, 255))
tinted.alpha_composite(mark(SPAN))
tinted.convert("RGB").save(OUT / "icon-tinted.png")
# The splash: the mark alone, filling the width expo-splash-screen gives it (app.json imageWidth), on black.
mark(1.0).save(OUT / "splash-icon.png")
print("wrote", ", ".join(p.name for p in sorted(OUT.glob("*icon*.png"))))
