#!/usr/bin/env node
/**
 * Single command to set the application version everywhere.
 *
 *   node scripts/set-version.mjs 0.2.0-dev.19
 *
 * Canonical surfaces (must all agree, enforced by src/version.test.ts):
 *   - package.json
 *   - src-tauri/tauri.conf.json
 *   - src-tauri/Cargo.toml
 *   - src/version.ts (APP_VERSION)
 * Run with no argument to verify parity only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SURFACES = {
  packageJson: path.join(root, "package.json"),
  tauriConf: path.join(root, "src-tauri", "tauri.conf.json"),
  cargoToml: path.join(root, "src-tauri", "Cargo.toml"),
  versionTs: path.join(root, "src", "version.ts"),
};

const VERSION_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

function readAll() {
  const pkg = JSON.parse(readFileSync(SURFACES.packageJson, "utf8"));
  const conf = JSON.parse(readFileSync(SURFACES.tauriConf, "utf8"));
  const cargo = readFileSync(SURFACES.cargoToml, "utf8");
  const vts = readFileSync(SURFACES.versionTs, "utf8");
  return { pkg, conf, cargo, vts };
}

function extract({ pkg, conf, cargo, vts }) {
  return {
    packageJson: pkg.version,
    tauriConf: conf.version,
    cargoToml: cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null,
    versionTs: vts.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1] ?? null,
  };
}

const current = extract(readAll());
const values = new Set(Object.values(current));

if (process.argv.length > 2) {
  const next = process.argv[2];
  if (!VERSION_RE.test(next)) {
    console.error(`Invalid version: ${next} (expected semver like 0.2.0-dev.19)`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(SURFACES.packageJson, "utf8"));
  pkg.version = next;
  writeFileSync(SURFACES.packageJson, JSON.stringify(pkg, null, 2) + "\n");
  const conf = JSON.parse(readFileSync(SURFACES.tauriConf, "utf8"));
  conf.version = next;
  writeFileSync(SURFACES.tauriConf, JSON.stringify(conf, null, 2) + "\n");
  const cargo = readFileSync(SURFACES.cargoToml, "utf8");
  writeFileSync(SURFACES.cargoToml, cargo.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${next}"`));
  const vts = readFileSync(SURFACES.versionTs, "utf8");
  writeFileSync(SURFACES.versionTs, vts.replace(/(APP_VERSION\s*=\s*)"[^"]+"/, `$1"${next}"`));
  console.log(`Version set to ${next} in all 4 surfaces.`);
  process.exit(0);
}

if (values.size !== 1 || current.packageJson == null) {
  console.error("VERSION MISMATCH across surfaces:\n" + JSON.stringify(current, null, 2));
  process.exit(1);
}
console.log(`Version parity OK: ${current.packageJson}`);
