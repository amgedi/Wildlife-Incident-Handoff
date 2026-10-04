/** Device Center behavior tests (0.3, spec items 68–74). */
import { describe, it, expect } from "vitest";
import { collectThisDevice, detectOs } from "./DeviceCenter";
import { readFileSync } from "fs";

describe("device center", () => {
  it("this-device info carries safe identity only (no keys, no fingerprinting)", () => {
    const info = collectThisDevice("Amged", "laptop");
    expect(info.name).toBe("Amged");
    expect(info.type).toBe("laptop");
    expect(info.os).toBeTruthy();
    expect(info.appVersion).toBeTruthy();
    // fingerprint comes async from the LAN identity; never fabricated here
    expect(info.fingerprint).toBeNull();
  });

  it("falls back to a neutral name when no display name exists", () => {
    expect(collectThisDevice("", undefined).name).toBe("This device");
  });

  it("auto-detect never reports private key material or raw user agent", () => {
    const os = detectOs();
    expect(["Windows", "macOS", "Android", "iOS", "Linux", "Unknown"]).toContain(os);
  });

  it("honesty contract: no cloud-account recognition claims in the component source", () => {
    const src = readFileSync("src/features/devices/DeviceCenter.tsx", "utf-8");
    expect(src).toContain("no cloud account");
    expect(src).toContain("Private keys are never shown or exported");
    // device identity ≠ human profile
    expect(src).toContain("separate");
  });
});
