"""
Generate the canonical multi-size Windows .ico from public/icons/icon-512.png.

- Rounded-rect alpha mask (radius 22%) so corners are transparent.
- 8% transparent safe-area margin so artwork never touches the bitmap edge.
- Frames: 16, 20, 24, 32, 40, 48, 64, 128 (32bpp BGRA BMP) + 256 (PNG).
Source of truth: public/icons/icon-512.png (the approved artwork).
"""
from PIL import Image, ImageDraw
import struct

SRC = "public/icons/icon-512.png"
OUT = "src-tauri/icons/icon.ico"
SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

src = Image.open(SRC).convert("RGBA")

def render(size: int) -> Image.Image:
    # safe area: artwork occupies 84% of the frame, centered
    art = (src.resize((size, size), Image.LANCZOS))
    scale = 0.84
    inner = int(size * scale)
    art_small = src.resize((inner, inner), Image.LANCZOS)
    # rounded-rect mask on the artwork itself
    mask = Image.new("L", (inner, inner), 0)
    d = ImageDraw.Draw(mask)
    radius = int(inner * 0.22)
    d.rounded_rectangle([0, 0, inner - 1, inner - 1], radius=radius, fill=255)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - inner) // 2
    canvas.paste(art_small, (offset, offset), mask)
    return canvas

def bmp_frame(img: Image.Image) -> bytes:
    """32bpp BGRA BMP (BITMAPINFOHEADER, height doubled, no palette)."""
    w, h = img.size
    header = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, w * h * 4, 0, 0, 0, 0)
    px = img.tobytes()
    row = b""
    # rows bottom-up, BGRA
    bgra = bytearray(w * h * 4)
    for y in range(h - 1, -1, -1):
        row_start = y * w * 4
        for x in range(w):
            r, g, b, a = px[row_start + x * 4: row_start + x * 4 + 4]
            i = ((h - 1 - y) * w + x) * 4
            bgra[i] = b; bgra[i + 1] = g; bgra[i + 2] = r; bgra[i + 3] = a
    return header + bytes(bgra)

frames = []
for size in SIZES:
    img = render(size)
    if size == 256:
        png = io.BytesIO() if False else None
        import io as _io
        buf = _io.BytesIO()
        img.save(buf, "PNG")
        frames.append((size, 32, buf.getvalue(), True))
    else:
        frames.append((size, 32, bmp_frame(img), False))

count = len(frames)
header = struct.pack("<HHH", 0, 1, count)
offset = 6 + count * 16
entries = b""
data = b""
for size, bpp, payload, is_png in frames:
    w = size if size < 256 else 0
    h = size if size < 256 else 0
    entries += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(payload), offset)
    data += payload
    offset += len(payload)

with open(OUT, "wb") as f:
    f.write(header + entries + data)
print(f"ICO written: {OUT} ({count} frames)")
