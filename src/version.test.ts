/** dev.19: all application version surfaces must agree (release blocker —
 *  a drifted src/version.ts already caused one release mismatch). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSurfaces(): Record<string, string | null> {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const conf = JSON.parse(readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
  const cargo = readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf8");
  const vts = readFileSync(path.join(root, "src", "version.ts"), "utf8");
  return {
    "package.json": pkg.version ?? null,
    "tauri.conf.json": conf.version ?? null,
    "Cargo.toml": cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null,
    "src/version.ts": vts.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1] ?? null,
  };
}

describe("version parity", () => {
  it("every version surface reports the same version", () => {
    const surfaces = readSurfaces();
    for (const [file, value] of Object.entries(surfaces)) {
      expect(value, `${file} is missing a version`).toBeTruthy();
    }
    const unique = new Set(Object.values(surfaces));
    expect([...unique].join(", "), `version surfaces disagree: ${JSON.stringify(surfaces)}`).toBe(
      surfaces["package.json"] as string
    );
  });

  it("matches a valid semver/prerelease shape", () => {
    expect(readSurfaces()["package.json"]).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });
});
