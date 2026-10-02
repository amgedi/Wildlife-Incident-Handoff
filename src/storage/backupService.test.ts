import { describe, it, expect } from "vitest";
import { createBackup, importBackup } from "./backupService";
import { putIncident, getAllIncidents } from "./repositories";
import { makeIncident } from "../features/export/exportService.test";
import type { Incident } from "../types/incident";

describe("backup export/import", () => {
  it("exports a versioned container with incidents", async () => {
    await putIncident(makeIncident());
    const backup = await createBackup("0.1.0-test");
    expect(backup.schemaVersion).toBe(1);
    expect(backup.applicationVersion).toBe("0.1.0-test");
    expect(backup.exportedAt).toBeTruthy();
    expect(backup.incidents).toHaveLength(1);
  });

  it("imports a valid backup", async () => {
    const backup = {
      schemaVersion: 1,
      applicationVersion: "0.1.0-test",
      exportedAt: new Date().toISOString(),
      incidents: [makeIncident()],
      attachments: [],
    };
    const result = await importBackup(backup);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(await getAllIncidents()).toHaveLength(1);
  });

  it("never overwrites existing incidents with ID conflicts", async () => {
    const original = makeIncident();
    await putIncident(original);
    const conflicting: Incident = { ...makeIncident(), summary: "Overwrite attempt" };
    const result = await importBackup({
      schemaVersion: 1, applicationVersion: "test", exportedAt: new Date().toISOString(),
      incidents: [conflicting], attachments: [],
    });
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(await getAllIncidents()).toHaveLength(1);
    expect((await getAllIncidents())[0]!.summary).not.toBe("Overwrite attempt");
  });

  it("rejects malformed backup structures", async () => {
    const result = await importBackup({ hello: "world" });
    expect(result.imported).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("skips records with out-of-range coordinates and reports why", async () => {
    const bad = { ...makeIncident(), location: { ...makeIncident().location, latitude: 999 } };
    const result = await importBackup({
      schemaVersion: 1, applicationVersion: "test", exportedAt: new Date().toISOString(),
      incidents: [bad], attachments: [],
    });
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.warnings.some((w) => w.includes("latitude"))).toBe(true);
  });

  it("treats strings and arrays as invalid", async () => {
    expect((await importBackup("string")).imported).toBe(0);
    expect((await importBackup([1, 2, 3])).imported).toBe(0);
    expect((await importBackup(null)).imported).toBe(0);
  });
});
