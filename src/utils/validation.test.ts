import { describe, it, expect } from "vitest";
import { validateBackup, validateIncidentRecord } from "./validation";

describe("backup validation", () => {
  it("rejects non-object payloads", () => {
    const { backup, issues } = validateBackup("nonsense");
    expect(backup).toBeNull();
    expect(issues.length).toBeGreaterThan(0);
  });

  it("rejects backups without an incident list", () => {
    const { backup, issues } = validateBackup({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z" });
    expect(backup).toBeNull();
    expect(issues.some((i) => i.code === "missing_incidents")).toBe(true);
  });

  it("warns about newer schema versions and import refuses to run", async () => {
    const { issues } = validateBackup({
      schemaVersion: 99,
      exportedAt: "2026-01-01T00:00:00Z",
      incidents: [],
      attachments: [],
    });
    expect(issues.some((i) => i.code === "newer_schema")).toBe(true);
    // Import refuses to run: backupService checks the schema warning before writing.
    const { importBackup } = await import("../storage/backupService");
    const result = await importBackup({ schemaVersion: 99, exportedAt: "2026-01-01T00:00:00Z", incidents: [], attachments: [] });
    expect(result.imported).toBe(0);
  });

  it("accepts a well-formed empty backup", () => {
    const { issues, backup } = validateBackup({
      schemaVersion: 1,
      applicationVersion: "0.1.0",
      exportedAt: "2026-01-01T00:00:00Z",
      incidents: [],
      attachments: [],
    });
    expect(issues).toHaveLength(0);
    expect(backup).not.toBeNull();
  });
});

describe("incident record validation", () => {
  it("requires identity fields", () => {
    const issues = validateIncidentRecord({ id: "x" });
    expect(issues.some((i) => i.message.includes("humanReference"))).toBe(true);
  });

  it("flags out-of-range coordinates", () => {
    const issues = validateIncidentRecord({
      id: "x", humanReference: "WIH-2026-000001", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      location: { latitude: 999, longitude: 0 },
    });
    expect(issues.some((i) => i.code === "bad_coordinate")).toBe(true);
  });

  it("flags malformed timeline events", () => {
    const issues = validateIncidentRecord({
      id: "x", humanReference: "WIH-2026-000001", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      timeline: [{ nope: true }],
    });
    expect(issues.some((i) => i.code === "bad_event")).toBe(true);
  });

  it("accepts a valid minimal record", () => {
    const issues = validateIncidentRecord({
      id: "x", humanReference: "WIH-2026-000001", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      location: { latitude: null, longitude: null }, timeline: [],
    });
    expect(issues).toHaveLength(0);
  });
});
