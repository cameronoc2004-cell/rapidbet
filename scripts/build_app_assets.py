#!/usr/bin/env python3
"""Generate the iOS app icon + splash from the RallyPot logo.

- Icon: reproduce the on-phone crop (center-crop 680px of the 1024 source,
  scaled back to 1024) so the logo fills the icon.
- Splash: the logo centered on a 2732x2732 canvas filled with the source's own
  background colour (seamless), sized small enough (~42% width) that iOS's
  scale-aspect-fill crop on tall phones never clips the raised hands.
"""
import os
from PIL import Image

HOME = os.path.expanduser("~")
SRC = os.path.join(HOME, "Desktop", "Rallypot stuff", "RallyPot_1024.png")
ICON = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
SPLASH_DIR = "ios/App/App/Assets.xcassets/Splash.imageset"
SPLASHES = ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]

im = Image.open(SRC).convert("RGB")
assert im.size == (1024, 1024), f"unexpected source size {im.size}"

# --- App icon: center-crop 680 -> resize 1024 (matches current phone icon) ---
crop = 680
off = (1024 - crop) // 2
icon = im.crop((off, off, off + crop, off + crop)).resize((1024, 1024), Image.LANCZOS)
icon.save(ICON)
print("icon ->", ICON, icon.size)

# --- Splash: source background colour, logo ~42% width, centered, uncropped ---
bg = im.getpixel((6, 6))  # corner = flat background
print("sampled bg", bg)
canvas = Image.new("RGB", (2732, 2732), bg)
inner = 2206  # source(52% logo) scaled so logo ~= 42% of 2732 -> aspect-fill safe
scaled = im.resize((inner, inner), Image.LANCZOS)
pos = (2732 - inner) // 2
canvas.paste(scaled, (pos, pos))
for name in SPLASHES:
    canvas.save(os.path.join(SPLASH_DIR, name))
print("splash ->", SPLASH_DIR, canvas.size, "x", len(SPLASHES))
