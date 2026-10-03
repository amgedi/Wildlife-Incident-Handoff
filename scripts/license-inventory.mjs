/** Dependency inventory / SBOM-lite: writes docs/THIRD_PARTY_LICENSES.md
 *  from the installed node_modules of direct production dependencies.
 *  Run before each release: node scripts/license-inventory.mjs */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const lines = [
  "# Third-party licenses / dependency inventory",
  "",
  `Generated ${new Date().toISOString()} — application version ${pkg.version}.`,
  "Application license: AGPL-3.0-only. Runtime dependencies:",
  "",
  "| Package | Version | License |",
  "|---|---|---|",
];

for (const name of Object.keys(pkg.dependencies ?? {})) {
  const dir = join("node_modules", name);
  const pjPath = join(dir, "package.json");
  if (!existsSync(pjPath)) {
    lines.push(`| ${name} | (not installed) | ? |`);
    continue;
  }
  const pj = JSON.parse(readFileSync(pjPath, "utf-8"));
  let license = pj.license ?? "?";
  if (typeof license === "object") license = license.type ?? "?";
  lines.push(`| ${name} | ${pj.version} | ${license} |`);
}

// transitive quick count
let transitive = 0;
for (const scope of ["", "@"]) {
  try {
    const base = join("node_modules", scope);
    const fsMod = await import("fs");
    for (const d of fsMod.readdirSync(base)) {
      transitive += 1;
    }
  } catch { /* ignore */ }
}

lines.push("", `Transitive packages present in node_modules: ${transitive}.`);
lines.push("", "Notable runtime components and their licenses:");
lines.push("- React, React DOM — MIT");
lines.push("- MapLibre GL JS — BSD-3-Clause");
lines.push("- i18next, react-i18next — MIT");
lines.push("- idb — ISC");
lines.push("- libphonenumber-js — MIT");
lines.push("- @tauri-apps/api — Apache-2.0 OR MIT");
lines.push("- Floating UI (DOM) — MIT");
lines.push("", "Desktop (Rust) runtime: Tauri (Apache-2.0 OR MIT), tiny_http (MIT/Apache-2.0), ureq (MIT/Apache-2.0), serde (MIT/Apache-2.0), serde_json (MIT/Apache-2.0).");

writeFileSync("docs/THIRD_PARTY_LICENSES.md", lines.join("\n") + "\n");
console.log("wrote docs/THIRD_PARTY_LICENSES.md");
