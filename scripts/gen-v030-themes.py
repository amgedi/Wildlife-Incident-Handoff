"""0.3 theme expansion: generate 4 dark + 2 light themes with full status
palettes, plus the window-material system and mono-dark legibility fixes.
Appends to src/styles/tokens.css. Run once (idempotent marker below)."""
import colorsys

MARKER = "/* === 0.3 THEME EXPANSION === */"
path = "src/styles/tokens.css"
if MARKER in open(path, encoding="utf-8").read():
    raise SystemExit("already applied")


def hx(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h % 360 / 360, l, s)
    return "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(b * 255))


NAMES = ["draft", "reported", "response_requested", "responder_assigned", "awaiting_pickup", "in_transport", "transferred", "in_care", "veterinary_care", "monitoring", "released", "deceased", "closed", "cancelled"]


def status_block(hues, lb, sb, lf, sf, lbo):
    out = []
    for name, (h, s) in zip(NAMES, hues):
        out.append(f"  --status-{name}-bg: {hx(h, sb, lb)};")
        out.append(f"  --status-{name}-fg: {hx(h, sf, lf)};")
        out.append(f"  --status-{name}-border: {hx(h, sb * 0.9, lbo)};")
    return "\n".join(out)


DARK_HUES = [
    (0, 0.02), (215, 0.45), (38, 0.5), (265, 0.35), (22, 0.5), (275, 0.35),
    (185, 0.4), (135, 0.3), (325, 0.3), (205, 0.4), (135, 0.35), (0, 0.0), (220, 0.06), (5, 0.45),
]


def amb(entries):
    return ",\n".join(f"    radial-gradient({r}, transparent 70%)" for r in entries)


def dark_theme(key, v, ambient_a, ambient_b, brand_bg, brand_fg):
    return f"""
[data-theme="{key}"] {{
  --c-bg: {v['bg']};
  --c-surface: {v['surface']};
  --c-surface-alt: {v['alt']};
  --c-header: {v['header']};
  --c-header-ink: {v['header_ink']};
  --c-ink: {v['ink']};
  --c-ink-soft: {v['ink_soft']};
  --c-ink-faint: {v['ink_faint']};
  --c-primary: {v['primary']};
  --c-primary-ink: {v['primary_ink']};
  --c-primary-hover: {v['primary_hover']};
  --c-accent: {v['accent']};
  --c-border: {v['border']};
  --c-border-strong: {v['border_strong']};
  --c-danger: {v['danger']};
  --c-danger-surface: {v['danger_s']};
  --c-warn: {v['warn']};
  --c-warn-surface: {v['warn_s']};
  --c-ok: {v['ok']};
  --c-ok-surface: {v['ok_s']};
  --c-info-surface: {v['info_s']};
  --c-focus: {v['focus']};
  --c-sidebar: {v['sidebar']};
  --c-sidebar-ink: {v['sidebar_ink']};
  --c-sidebar-active: {v['sidebar_active']};
  --c-shadow: 0 1px 2px rgb(0 0 0 / 0.5), 0 4px 14px rgb(0 0 0 / 0.4);
  --c-shadow-lift: 0 2px 4px rgb(0 0 0 / 0.55), 0 10px 28px rgb(0 0 0 / 0.5);
  --brand-icon-bg: {brand_bg};
  --brand-icon-fg: {brand_fg};
  --brand-icon-border: rgb(255 255 255 / 0.14);
{status_block(DARK_HUES, v['st_lb'], v['st_sb'], v['st_lf'], v['st_sf'], v['st_lbo'])}
}}
[data-theme="{key}"] body::before {{
{amb(ambient_a)}
}}
[data-theme="{key}"] body::after {{
{amb(ambient_b)}
}}
"""


themes = []

# 1) Forest Night — very dark green, amber accent
themes.append(dark_theme("forest-night", dict(
    bg="#0a120d", surface="#101b14", alt="#17251b", header="#070e0a", header_ink="#dfe9e0",
    ink="#dde8de", ink_soft="#a3b5a6", ink_faint="#7a8b7d", primary="#4e9d6f", primary_ink="#07120b",
    primary_hover="#5cb07d", accent="#d99a4e", border="#24382b", border_strong="#374d3c",
    danger="#e07a6a", danger_s="#2c1c19", warn="#d4b35a", warn_s="#2a2618", ok="#4e9d6f",
    ok_s="#16281d", info_s="#14262b", focus="#6db2ff", sidebar="#070e0a", sidebar_ink="#9db3a1",
    sidebar_active="#1f4430", st_lb=0.16, st_sb=0.35, st_lf=0.82, st_sf=0.5, st_lbo=0.30),
    ["42% 38% at 30% 25%, rgb(30 82 52 / 0.42)", "36% 34% at 75% 70%, rgb(16 60 44 / 0.4)"],
    ["40% 36% at 70% 20%, rgb(217 154 78 / 0.10)", "44% 40% at 20% 80%, rgb(24 74 50 / 0.34)"],
    "#162b1f", "#d7e8da"))

# 2) Midnight Ops — deep steel blue, cyan accent
themes.append(dark_theme("midnight-ops", dict(
    bg="#070c14", surface="#0e1622", alt="#141f2f", header="#050910", header_ink="#d8e4f2",
    ink="#dbe6f2", ink_soft="#9db0c4", ink_faint="#71839a", primary="#3d8bff", primary_ink="#050b14",
    primary_hover="#5c9dff", accent="#39c2d4", border="#1d2b3d", border_strong="#2c3f56",
    danger="#e07a6a", danger_s="#2a1a1e", warn="#e0b45c", warn_s="#2a2414", ok="#3fae7c",
    ok_s="#10241c", info_s="#101f30", focus="#7db4ff", sidebar="#050910", sidebar_ink="#93a7bd",
    sidebar_active="#153052", st_lb=0.15, st_sb=0.4, st_lf=0.84, st_sf=0.55, st_lbo=0.32),
    ["42% 38% at 30% 25%, rgb(28 70 130 / 0.45)", "36% 34% at 75% 70%, rgb(20 50 100 / 0.4)"],
    ["40% 36% at 70% 20%, rgb(57 194 212 / 0.10)", "44% 40% at 20% 80%, rgb(24 60 110 / 0.4)"],
    "#12233c", "#cfe2f5"))

# 3) Storm — graphite with violet accent
themes.append(dark_theme("storm", dict(
    bg="#0d0f13", surface="#15181f", alt="#1c202a", header="#090b0f", header_ink="#e0e4ec",
    ink="#dfe3ea", ink_soft="#a4abb8", ink_faint="#787f8d", primary="#7c8cf8", primary_ink="#0a0c12",
    primary_hover="#8f9dfa", accent="#c0a6f4", border="#262b36", border_strong="#3a4150",
    danger="#e07a6a", danger_s="#2a1b1d", warn="#d9c06a", warn_s="#282417", ok="#66c290",
    ok_s="#142019", info_s="#171c28", focus="#9aa8ff", sidebar="#090b0f", sidebar_ink="#9aa1b0",
    sidebar_active="#2b3350", st_lb=0.16, st_sb=0.3, st_lf=0.84, st_sf=0.45, st_lbo=0.32),
    ["42% 38% at 30% 25%, rgb(70 80 140 / 0.35)", "36% 34% at 75% 70%, rgb(45 55 90 / 0.35)"],
    ["40% 36% at 70% 20%, rgb(150 130 220 / 0.10)", "44% 40% at 20% 80%, rgb(50 60 100 / 0.35)"],
    "#252b3d", "#dcd9f2"))

# 4) Aurora — near-black with green/teal/violet
themes.append(dark_theme("aurora", dict(
    bg="#060b0d", surface="#0c1518", alt="#111e22", header="#04080a", header_ink="#d6e6e4",
    ink="#d8e8e6", ink_soft="#9ab5b2", ink_faint="#6e8785", primary="#2fbf9b", primary_ink="#04100c",
    primary_hover="#43d4af", accent="#8f7bf0", border="#17282b", border_strong="#24403f",
    danger="#e07a6a", danger_s="#281a1c", warn="#d8c46a", warn_s="#252314", ok="#2fbf9b",
    ok_s="#0e2320", info_s="#0f2026", focus="#5fd4c0", sidebar="#04080a", sidebar_ink="#8aa5a2",
    sidebar_active="#123a33", st_lb=0.15, st_sb=0.38, st_lf=0.84, st_sf=0.52, st_lbo=0.31),
    ["42% 38% at 30% 25%, rgb(24 120 100 / 0.4)", "36% 34% at 75% 70%, rgb(60 90 160 / 0.3)"],
    ["40% 36% at 70% 20%, rgb(120 90 220 / 0.14)", "44% 40% at 20% 80%, rgb(20 110 95 / 0.35)"],
    "#0e2a26", "#cdeadf"))

css = "\n".join(themes)

# Light themes: sand + arctic (inherit :root status tokens like ocean/slate do)
css += """
[data-theme="sand"] {
  --c-bg: #f6f1e7;
  --c-surface: #fffdf8;
  --c-surface-alt: #faf5ea;
  --c-header: #6b4f2a;
  --c-header-ink: #f9f3e6;
  --c-ink: #2d2517;
  --c-ink-soft: #5c503c;
  --c-ink-faint: #7d715c;
  --c-primary: #9a6b2f;
  --c-primary-ink: #ffffff;
  --c-primary-hover: #845a26;
  --c-accent: #2f6b5d;
  --c-border: #e3d9c6;
  --c-border-strong: #c9bda5;
  --c-sidebar: #3f3019;
  --c-sidebar-ink: #d8ccb4;
  --c-sidebar-active: #9a6b2f;
  --c-ok: #4c6b3c; --c-ok-surface: #edf2e4;
  --c-danger: #a33a2c; --c-danger-surface: #fbeeea;
  --c-warn: #8a6d1a; --c-warn-surface: #faf3dd;
  --c-info-surface: #f0ead9;
  --c-focus: #9a6b2f;
  --focus-ring: 2px solid var(--c-focus);
  --brand-icon-bg: #8a5f2a;
  --brand-icon-fg: #f9f2e2;
  --brand-icon-border: rgb(255 255 255 / 0.16);
}
[data-theme="sand"] body::before {
  background:
    radial-gradient(42% 38% at 30% 25%, rgb(216 182 122 / 0.3), transparent 70%),
    radial-gradient(36% 34% at 75% 70%, rgb(196 160 110 / 0.26), transparent 70%);
}
[data-theme="sand"] body::after {
  background:
    radial-gradient(40% 36% at 70% 20%, rgb(240 218 170 / 0.45), transparent 70%),
    radial-gradient(44% 40% at 20% 80%, rgb(180 160 120 / 0.28), transparent 70%);
}

[data-theme="arctic"] {
  --c-bg: #eef3f6;
  --c-surface: #ffffff;
  --c-surface-alt: #f3f8fa;
  --c-header: #1c4a5e;
  --c-header-ink: #eaf4f8;
  --c-ink: #14242e;
  --c-ink-soft: #42596a;
  --c-ink-faint: #64798a;
  --c-primary: #23708f;
  --c-primary-ink: #ffffff;
  --c-primary-hover: #1c5f7a;
  --c-accent: #c25e21;
  --c-border: #d2e0e8;
  --c-border-strong: #aec5d2;
  --c-sidebar: #10303f;
  --c-sidebar-ink: #b5cddd;
  --c-sidebar-active: #23708f;
  --c-ok: #23708f; --c-ok-surface: #e2eff4;
  --c-danger: #a33a2c; --c-danger-surface: #fbeeea;
  --c-warn: #8a6d1a; --c-warn-surface: #faf3dd;
  --c-info-surface: #e6f0f4;
  --c-focus: #23708f;
  --focus-ring: 2px solid var(--c-focus);
  --brand-icon-bg: #1d5e78;
  --brand-icon-fg: #e4f2f7;
  --brand-icon-border: rgb(255 255 255 / 0.16);
}
[data-theme="arctic"] body::before {
  background:
    radial-gradient(42% 38% at 30% 25%, rgb(150 195 220 / 0.34), transparent 70%),
    radial-gradient(36% 34% at 75% 70%, rgb(180 210 228 / 0.3), transparent 70%);
}
[data-theme="arctic"] body::after {
  background:
    radial-gradient(40% 36% at 70% 20%, rgb(220 238 246 / 0.5), transparent 70%),
    radial-gradient(44% 40% at 20% 80%, rgb(160 200 220 / 0.3), transparent 70%);
}
"""

css += """
/* ---------- Window material system (0.3) ----------
   Solid = opaque surfaces (classic). Frosted = gently translucent surfaces
   with a backdrop blur. Glass = the most translucent presentation.
   Dense data surfaces (tables, drawers) keep near-solid backgrounds in every
   material: data is primary. */

:root {
  --material-surface: var(--c-surface);
  --material-panel: var(--c-surface);
  --material-blur: 0px;
}
[data-material="frosted"] {
  --material-surface: color-mix(in srgb, var(--c-surface) 88%, transparent);
  --material-panel: color-mix(in srgb, var(--c-surface) 82%, transparent);
  --material-blur: 14px;
}
[data-material="glass"] {
  --material-surface: color-mix(in srgb, var(--c-surface) 72%, transparent);
  --material-panel: color-mix(in srgb, var(--c-surface) 62%, transparent);
  --material-blur: 20px;
}
[data-material="frosted"] .card,
[data-material="frosted"] .ops-panel,
[data-material="glass"] .card,
[data-material="glass"] .ops-panel {
  background: var(--material-surface);
  backdrop-filter: blur(var(--material-blur));
  -webkit-backdrop-filter: blur(var(--material-blur));
}
/* Dense data stays readable */
[data-material="glass"] .ops-table-wrap,
[data-material="glass"] .rflow-drawer,
[data-material="frosted"] .ops-table-wrap,
[data-material="frosted"] .rflow-drawer {
  background: var(--c-surface);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
[data-material="frosted"] .sidebar,
[data-material="glass"] .sidebar {
  background: color-mix(in srgb, var(--c-sidebar) 86%, transparent);
  backdrop-filter: blur(var(--material-blur));
  -webkit-backdrop-filter: blur(var(--material-blur));
}
@media (prefers-reduced-transparency: reduce) {
  [data-material="frosted"], [data-material="glass"] {
    --material-surface: var(--c-surface);
    --material-panel: var(--c-surface);
    --material-blur: 0px;
  }
  [data-material="frosted"] .card, [data-material="frosted"] .ops-panel,
  [data-material="glass"] .card, [data-material="glass"] .ops-panel { backdrop-filter: none; }
  [data-material="frosted"] .sidebar, [data-material="glass"] .sidebar { background: var(--c-sidebar); backdrop-filter: none; }
}

/* ---------- Monochrome Dark legibility fixes (0.3) ----------
   Deeper surface separation + stronger borders so hierarchy survives
   without hue; status glyphs (shape) already exist in the theme block. */
[data-theme="mono-dark"] {
  --c-bg: #000000;
  --c-surface: #141414;
  --c-surface-alt: #1f1f1f;
  --c-border: #3a3a3a;
  --c-border-strong: #5c5c5c;
  --c-sidebar: #060606;
  --c-sidebar-active: #333333;
  --c-shadow: 0 0 0 1px #3a3a3a;
  --c-shadow-lift: 0 0 0 1px #5c5c5c;
}
[data-theme="mono-dark"] .kpi-card,
[data-theme="mono-dark"] .attn-tile { border-color: #4a4a4a; }
[data-theme="mono-dark"] .rflow-node { border-color: #6a6a6a; }
[data-theme="mono-dark"] .rflow-stage.is-selected .rflow-node { border-color: #ffffff; box-shadow: 0 0 0 3px rgb(255 255 255 / 0.25); }
"""

with open(path, "a", encoding="utf-8") as f:
    f.write(MARKER + css)
print("appended", len(css), "chars")
