"""Generate external brand assets from the supplied logo artwork.

Outputs (all under the repo root):
  branding/wildlife-incident-handoff-logo.png   full logo (paw + wordmark), black bg removed
  branding/wildlife-incident-handoff-emblem.png paw emblem only (no wordmark), transparent
  src-tauri/icons/icon.ico / icon.png / 32/64/128/128@2x   desktop icons from the emblem
  public/icons/icon-192.png / icon-512.png / apple-touch-icon.png / maskable-512.png
"""
from PIL import Image, ImageFilter, ImageDraw
import os

SRC = "branding-source.png"
ROOT = "."
BRAND = "branding"
os.makedirs(BRAND, exist_ok=True)

im = Image.open(SRC).convert("RGBA")
W, H = im.size  # 1254

# ---- 1) remove the near-black background (flood fill from borders) --------
px = im.load()
BG_THRESHOLD = 30  # max channel value treated as background black


def is_bg(p):
    r, g, b, a = p
    return a == 0 or (r <= BG_THRESHOLD and g <= BG_THRESHOLD and b <= BG_THRESHOLD)


seen = [[False] * W for _ in range(H)]
stack = []
for x in range(W):
    for y in (0, H - 1):
        if is_bg(px[x, y]) and not seen[y][x]:
            stack.append((x, y)); seen[y][x] = True
for y in range(H):
    for x in (0, W - 1):
        if is_bg(px[x, y]) and not seen[y][x]:
            stack.append((x, y)); seen[y][x] = True
while stack:
    x, y = stack.pop()
    px[x, y] = (0, 0, 0, 0)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and is_bg(px[nx, ny]):
            seen[ny][nx] = True
            stack.append((nx, ny))

full = im
full.save(f"{BRAND}/wildlife-incident-handoff-logo.png")

# ---- 2) emblem = paw only (top region, no wordmark) ------------------------
# Blank the wordmark's leaf (it pokes above the text line, next to the pad),
# then crop the paw region and trim to content.
leaf = Image.new("RGBA", (int(W * 0.12), int(H * 0.14)), (0, 0, 0, 0))
full.paste(leaf, (int(W * 0.625), int(H * 0.655)))
emblem = full.crop((0, 0, W, int(H * 0.71)))
bbox = emblem.getbbox()
emblem = emblem.crop(bbox)
# square-pad it
s = max(emblem.size)
sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
sq.paste(emblem, ((s - emblem.width) // 2, (s - emblem.height) // 2), emblem)
emblem = sq
emblem.save(f"{BRAND}/wildlife-incident-handoff-emblem.png")

# ---- 3) desktop icons -------------------------------------------------------
def with_tile(src, size, radius_ratio=0.0):
    img = src.resize((size, size), Image.LANCZOS)
    return img

emblem512 = emblem.resize((512, 512), Image.LANCZOS)
emblem512.save("src-tauri/icons/icon.png")
emblem512.resize((256, 256), Image.LANCZOS).save("src-tauri/icons/128x128@2x.png")
emblem512.resize((128, 128), Image.LANCZOS).save("src-tauri/icons/128x128.png")
emblem512.resize((64, 64), Image.LANCZOS).save("src-tauri/icons/64x64.png")
emblem512.resize((32, 32), Image.LANCZOS).save("src-tauri/icons/32x32.png")

ico_sizes = [16, 24, 32, 48, 64, 128, 256]
frames = [emblem.resize((s, s), Image.LANCZOS) for s in ico_sizes]
frames[-1].save("src-tauri/icons/icon.ico", format="ICO", sizes=[(s, s) for s in ico_sizes])

# ---- 4) PWA icons -----------------------------------------------------------
public = "public/icons"
os.makedirs(public, exist_ok=True)
emblem512.resize((192, 192), Image.LANCZOS).save(f"{public}/icon-192.png")
emblem512.save(f"{public}/icon-512.png")
emblem512.resize((180, 180), Image.LANCZOS).save(f"{public}/apple-touch-icon.png")

# maskable: emblem on a dark-green tile with safe-area padding
tile = Image.new("RGBA", (512, 512), (26, 58, 40, 255))
inner = emblem.resize((360, 360), Image.LANCZOS)
tile.paste(inner, ((512 - 360) // 2, (512 - 360) // 2), inner)
tile.save(f"{public}/maskable-512.png")

# Windows Store logos (solid tiles with centered emblem)
def store(size, name):
    t = Image.new("RGBA", (size, size), (26, 58, 40, 255))
    inner_s = int(size * 0.72)
    e = emblem.resize((inner_s, inner_s), Image.LANCZOS)
    t.paste(e, ((size - inner_s) // 2, (size - inner_s) // 2), e)
    t.save(f"src-tauri/icons/{name}")

for size, name in [
    (44, "Square44x44Logo.png"), (71, "Square71x71Logo.png"), (89, "Square89x89Logo.png"),
    (107, "Square107x107Logo.png"), (142, "Square142x142Logo.png"), (150, "Square150x150Logo.png"),
    (284, "Square284x284Logo.png"), (310, "Square310x310Logo.png"), (50, "StoreLogo.png"),
]:
    store(size, name)

print("brand assets written")
