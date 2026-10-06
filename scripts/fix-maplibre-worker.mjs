/**
 * Copy MapLibre GL's worker and shared chunks next to the built bundle.
 *
 * MapLibre v6 resolves its module worker at runtime with
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)` relative to the main
 * bundle in dist/assets. Vite does not emit that URL automatically because it
 * is constructed from a plain string. Development can therefore work while a
 * packaged production build fails to load the worker.
 *
 * This script copies the worker and shared chunks into dist/assets after each
 * build so packaged map rendering has the same runtime files as development.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "node_modules", "maplibre-gl", "dist");
const out = join(root, "dist", "assets");
mkdirSync(out, { recursive: true });

const files = [
  "maplibre-gl-worker.mjs",
  "maplibre-gl-worker.mjs.map",
  "maplibre-gl-worker-dev.mjs",
  "maplibre-gl-worker-dev.mjs.map",
  "maplibre-gl-shared.mjs",
  "maplibre-gl-shared.mjs.map",
  "maplibre-gl-shared-dev.mjs",
  "maplibre-gl-shared-dev.mjs.map",
];

let copied = 0;
for (const f of files) {
  const from = join(src, f);
  if (!existsSync(from)) continue;
  copyFileSync(from, join(out, f));
  copied++;
}
if (copied === 0) throw new Error("fix-maplibre-worker: no maplibre-gl dist files found; is the dependency installed?");
console.log(`fix-maplibre-worker: copied ${copied} worker/shared files into dist/assets`);
