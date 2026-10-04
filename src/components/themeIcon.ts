/**
 * Theme-aware runtime window icon (0.3.0-dev.3, spec 58–61).
 *
 * The PAW SHAPE is canonical everywhere. On theme change, the desktop window
 * (and with it the taskbar/switcher entry) gets a paw icon re-rendered in
 * that theme's brand palette. The INSTALLER / Start Menu shortcut keep the
 * canonical static paw — we never rewrite installed .ico resources (spec 59).
 *
 * Honesty: Windows shell icon caching can keep an older taskbar bitmap until
 * restart; the static fallback remains the canonical paw either way.
 * Non-Tauri (web/PWA) surfaces: no-op.
 */
import type { ThemeName } from "../types/settings";

/** Per-theme accent palettes for the paw (background tile / paw fill). */
export const THEME_ICON_PALETTES: Record<string, { bg: string; fg: string }> = {
  "forest-dark": { bg: "#1f3d2b", fg: "#eef3e9" },
  "forest-light": { bg: "#2f5d3f", fg: "#f4f7f1" },
  "forest-night": { bg: "#0a120d", fg: "#4e9d6f" },
  midnight: { bg: "#0c1118", fg: "#4f9d6e" },
  "midnight-ops": { bg: "#050910", fg: "#3d8bff" },
  storm: { bg: "#090b0f", fg: "#7c8cf8" },
  aurora: { bg: "#04080a", fg: "#2fbf9b" },
  "warm-field": { bg: "#4a3b28", fg: "#f2e7d4" },
  moss: { bg: "#3f5233", fg: "#eceee4" },
  sand: { bg: "#6b4f2a", fg: "#f9f3e6" },
  ocean: { bg: "#123a5c", fg: "#e2f1f6" },
  arctic: { bg: "#1c4a5e", fg: "#eaf4f8" },
  slate: { bg: "#2d3748", fg: "#e8edf4" },
  "high-contrast-dark": { bg: "#000000", fg: "#ffffff" },
  "mono-dark": { bg: "#000000", fg: "#ffffff" },
  "mono-light": { bg: "#111111", fg: "#fafafa" },
};

/** Deterministic paw icon as PNG bytes at the requested size (32/48/64/256). */
export async function renderThemePawIcon(theme: ThemeName, size = 32): Promise<Uint8Array> {
  const palette = THEME_ICON_PALETTES[theme] ?? THEME_ICON_PALETTES["forest-dark"]!;
  // Draw with OffscreenCanvas when available (desktop WebView2 has it);
  // the geometry mirrors the canonical paw mark.
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  const S = size / 64;
  ctx.clearRect(0, 0, size, size);
  // rounded tile
  const r = 14 * S;
  ctx.fillStyle = palette.bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();
  ctx.fillStyle = palette.fg;
  // four toes + pad (same geometry constants as BrandMark)
  const toes = [
    { cx: 15.5, cy: 28, rot: -26 },
    { cx: 25.5, cy: 17.5, rot: -9 },
    { cx: 38.5, cy: 17.5, rot: 9 },
    { cx: 48.5, cy: 28, rot: 26 },
  ];
  for (const toe of toes) {
    ctx.save();
    ctx.translate(toe.cx * S, toe.cy * S);
    ctx.rotate((toe.rot * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7 * S, 10 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(32 * S, 33.5 * S);
  ctx.bezierCurveTo(21.5 * S, 33.5 * S, 13.5 * S, 41 * S, 13.5 * S, 49.5 * S);
  ctx.bezierCurveTo(13.5 * S, 55.5 * S, 18.4 * S, 59.3 * S, 24.6 * S, 59.3 * S);
  ctx.bezierCurveTo(27.5 * S, 59.3 * S, 29.6 * S, 58.4 * S, 32 * S, 58.4 * S);
  ctx.bezierCurveTo(34.4 * S, 58.4 * S, 36.5 * S, 59.3 * S, 39.4 * S, 59.3 * S);
  ctx.bezierCurveTo(45.6 * S, 59.3 * S, 50.5 * S, 55.5 * S, 50.5 * S, 49.5 * S);
  ctx.bezierCurveTo(50.5 * S, 41 * S, 42.5 * S, 33.5 * S, 32 * S, 33.5 * S);
  ctx.fill();
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

/** Apply the theme paw to the current desktop window. Fails silently on web. */
export async function applyThemeWindowIcon(theme: ThemeName): Promise<boolean> {
  const w = window as unknown as { __TAURI__?: { window?: { getCurrentWindow?: () => { setIcon: (bytes: Uint8Array) => Promise<void> } } } };
  const current = w.__TAURI__?.window?.getCurrentWindow?.();
  if (!current?.setIcon) return false;
  try {
    const bytes = await renderThemePawIcon(theme, 32);
    await current.setIcon(bytes);
    return true;
  } catch {
    // permission missing or unsupported shell — canonical static paw remains
    return false;
  }
}
