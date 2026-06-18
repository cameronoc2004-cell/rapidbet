#!/usr/bin/env python3
"""Make a transparent, tightly-cropped RallyPot logo for the loading screen.

Keys out the flat dark-slate background of RallyPot_1024.png by alpha = distance
from the background colour, then trims to the logo's bounding box so it renders
large and crisp at small sizes. Output: public/brand/rallypot-mark.png (RGBA).
"""
import os
import numpy as np
from PIL import Image

SRC = os.path.expanduser("~/Desktop/Rallypot stuff/RallyPot_1024.png")
OUT = "public/brand/rallypot-mark.png"
os.makedirs("public/brand", exist_ok=True)

im = Image.open(SRC).convert("RGB")
arr = np.asarray(im).astype(np.float32)

# Background = average of the four corners (flat slate).
corners = np.concatenate([
    arr[:8, :8].reshape(-1, 3), arr[:8, -8:].reshape(-1, 3),
    arr[-8:, :8].reshape(-1, 3), arr[-8:, -8:].reshape(-1, 3),
])
bg = corners.mean(axis=0)

# Distance from bg -> alpha ramp. < LO transparent, > HI opaque, smooth between.
dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))
LO, HI = 26.0, 70.0
alpha = np.clip((dist - LO) / (HI - LO), 0.0, 1.0)
alpha = (alpha * 255).astype(np.uint8)

rgba = np.dstack([arr.astype(np.uint8), alpha])
out = Image.fromarray(rgba, "RGBA")

# Trim to content (bbox of any non-transparent pixel) with a small margin.
bbox = out.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
if bbox:
    pad = 12
    l, t, r, b = bbox
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(out.width, r + pad), min(out.height, b + pad)
    out = out.crop((l, t, r, b))

out.save(OUT)
print("bg", tuple(int(x) for x in bg), "-> size", out.size, "->", OUT)
