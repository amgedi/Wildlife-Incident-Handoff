/**
 * Copy MapLibre GL's worker + shared chunks next to the built bundle.
 *
 * Root cause fixed for 0.3.0-dev.5 (owner reports: Terrain 3D never worked in
 * the packaged desktop app; "Worker failed to load" in the console): MapLibre
 * v6 resolves its module worker at RUNTIME via `new URL('./maplibre-gl-worker.mjs',
 * import.meta.url)` relative to the main bundle in dist/assets — a URL Vite
 * never emits because it is constructed from a plain string. Under `vite dev`
 * the file resolves inside node_modules, so development works and production
 * silently fails. This script copies the worker + shared chunks (prod + dev
 * variants) into dist/assets after every build.
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
if (copied === 0) throw new Error("fix-maplibre-worker: no maplibre-gl dist files found — is the dependency installed?");
console.log(`fix-maplibre-worker: copied ${copied} worker/shared files into dist/assets`);
