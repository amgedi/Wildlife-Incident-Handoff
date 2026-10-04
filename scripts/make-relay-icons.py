"""0.3: draw the new handoff-relay emblem (replaces the paw artwork) and
generate public/icons + src-tauri/icons PNG family. Then run scripts/make-ico.py
for the .ico. Colors match the default forest-dark brand tokens; the SVG-in-app
mark stays theme-aware via tokens, these raster assets are the installer/
taskbar/Start-menu family.
Run: python scripts/make-relay-icons.py && python scripts/make-ico.py
"""
from PIL import Image, ImageDraw
import math

OUT = 512
SS = 4            # supersample factor for clean anti-aliasing
SIZE = OUT * SS   # working canvas
BG = (31, 61, 43, 255)      # #1f3d2b forest-dark header
FG = (238, 243, 233, 255)   # #eef3e9

im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
S = SIZE / 64.0

def P(x, y):
    return (x * S, y * S)

# rounded tile
d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=int(SIZE * 0.22), fill=BG)

# route: cubic bezier M20 44 C 31 44 33 20 44 20
def bezier(p0, p1, p2, p3, t):
    mt = 1 - t
    x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
    y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
    return x, y

p0, p1, p2, p3 = P(20, 44), P(31, 44), P(33, 20), P(44, 20)
pts = [bezier(p0, p1, p2, p3, i / 120) for i in range(121)]
w = 5.5 * S
r = w / 2
# draw the route as a filled outline polygon (perpendicular offsets) to avoid seams
left, right = [], []
for i in range(len(pts)):
    if i == 0:
        tang = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
    elif i == len(pts) - 1:
        tang = (pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1])
    else:
        tang = (pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1])
    ln = math.hypot(*tang) or 1
    nx, ny = -tang[1] / ln, tang[0] / ln
    left.append((pts[i][0] + nx * r, pts[i][1] + ny * r))
    right.append((pts[i][0] - nx * r, pts[i][1] - ny * r))
d.polygon(left + right[::-1], fill=FG)
# round caps
for p in (pts[0], pts[-1]):
    d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=FG)

# origin node: filled circle r 7.5 at (20,44)
ro = 7.5 * S
cx, cy = P(20, 44)
d.ellipse([cx - ro, cy - ro, cx + ro, cy + ro], fill=FG)

# destination node: ring r 8, stroke 5 at (44,20)
rr = 8 * S
st = 5 * S
cx, cy = P(44, 20)
d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=BG, outline=FG, width=int(st))

# downscale = anti-aliasing
im = im.resize((OUT, OUT), Image.LANCZOS)

# exports
im.save("public/icons/icon-512.png")
im.resize((192, 192), Image.LANCZOS).save("public/icons/icon-192.png")
im.resize((180, 180), Image.LANCZOS).save("public/icons/apple-touch-icon.png")

# maskable: emblem centered at 80% on solid bg
mask = Image.new("RGBA", (512, 512), BG)
inner = im.resize((410, 410), Image.LANCZOS)
mask.paste(inner, (51, 51), inner)
mask.save("public/icons/maskable-512.png")

# tauri icon family
for size, name in [(32, "32x32.png"), (64, "64x64.png"), (128, "128x128.png"), (256, "128x128@2x.png"), (256, "icon.png"), (512, "store-logo.png")]:
    im.resize((size, size), Image.LANCZOS).save(f"src-tauri/icons/{name}")
print("relay icon family written")
