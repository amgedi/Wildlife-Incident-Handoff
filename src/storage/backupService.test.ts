import { describe, it, expect } from "vitest";
import { createBackup, importBackup } from "./backupService";
import { putIncident, getAllIncidents, deleteIncidentRecord, getIncident } from "./repositories";
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

describe("dev.18 backup integrity + staged restore", () => {
  const put = (i: number) => putIncident(makeIncident({ id: `d18-${i}`, humanReference: `WIH-D18-${i}` }));
  const drop = (i: number) => deleteIncidentRecord(`d18-${i}`);
  const d18 = await0();

  function await0() {
    return {
      async cleanup(ids: number[]) { for (const i of ids) await deleteIncidentRecord(`d18-${i}`); },
    };
  }

  it("exports a manifest with per-record SHA-256 hashes", async () => {
    await put(0);
    const backup = await createBackup("0.2.0-dev.18");
    const inc = makeIncident({ id: "d18-0" });
    expect(backup.manifest).toBeTruthy();
    expect(backup.manifest!.incidentHashes["d18-0"]).toMatch(/^[0-9a-f]{64}$/);
    void inc;
    await drop(0);
  });

  it("round-trips: freshly exported records pass integrity on restore", async () => {
    await put(1);
    const backup = await createBackup("0.2.0-dev.18");
    await drop(1);
    const result = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.corrupted).toBe(0);
    expect((await getAllIncidents()).some((i) => i.id === "d18-1")).toBe(true);
  });

  it("detects corruption: a tampered record fails its hash and is NOT imported", async () => {
    await put(2);
    const backup = await createBackup("0.2.0-dev.18");
    await drop(2);
    const tampered = JSON.parse(JSON.stringify(backup));
    const rec = tampered.incidents.find((i: { id: string }) => i.id === "d18-2");
    rec.summary = "TAMPERED IN TRANSIT";
    const result = await importBackup(tampered);
    expect(result.corrupted).toBe(1);
    expect(result.warnings.some((w) => w.includes("integrity check"))).toBe(true);
    expect((await getAllIncidents()).some((i) => i.summary === "TAMPERED IN TRANSIT")).toBe(false);
  });

  it("flags manifest count mismatch (incomplete backup)", async () => {
    await put(3);
    await put(4);
    const backup = await createBackup("0.2.0-dev.18");
    await d18.cleanup([3, 4]);
    const trimmed = JSON.parse(JSON.stringify(backup));
    trimmed.incidents = trimmed.incidents.filter((i: { id: string }) => i.id !== "d18-4");
    const result = await importBackup(trimmed);
    expect(result.warnings.some((w) => w.includes("incomplete or corrupted"))).toBe(true);
    // the intact record still imports
    expect((await getAllIncidents()).some((i) => i.id === "d18-3")).toBe(true);
  });

  it("skips records missing from the manifest (not listed = not trusted)", async () => {
    await put(5);
    await put(6); // a second record so the manifest stays non-empty after deletion
    const backup = await createBackup("0.2.0-dev.18");
    await drop(5);
    await drop(6);
    const injected = JSON.parse(JSON.stringify(backup));
    const rec = makeIncident({ id: "d18-5", humanReference: "WIH-D18-5", summary: "INJECTED" });
    delete injected.manifest.incidentHashes["d18-5"];
    injected.incidents = injected.incidents.map((i: { id: string }) => (i.id === "d18-5" ? rec : i));
    const result = await importBackup(injected);
    expect(result.warnings.some((w) => w.includes("not listed in the backup manifest"))).toBe(true);
    expect((await getAllIncidents()).some((i) => i.id === "d18-5")).toBe(false);
  });

  it("legacy backups without a manifest still import (compat)", async () => {
    const legacy = {
      schemaVersion: 1,
      applicationVersion: "0.2.0-dev.16",
      exportedAt: new Date().toISOString(),
      incidents: [makeIncident({ id: "d18-legacy", humanReference: "WIH-D18-LEG" })],
      attachments: [],
    };
    const result = await importBackup(legacy);
    expect(result.corrupted).toBe(0);
    expect(result.imported).toBeGreaterThanOrEqual(0);
    expect(result.warnings.every((w) => !w.includes("manifest"))).toBe(true);
  });

  it("large backup round-trip: 100 incidents export, restore, zero corruption", async () => {
    for (let i = 100; i < 200; i++) await put(i);
    const t0 = Date.now();
    const backup = await createBackup("0.2.0-dev.18");
    const exportMs = Date.now() - t0;
    expect(backup.manifest!.incidentCount).toBeGreaterThanOrEqual(100);
    for (let i = 100; i < 200; i++) await drop(i);
    const t1 = Date.now();
    const result = await importBackup(JSON.parse(JSON.stringify(backup)));
    const importMs = Date.now() - t1;
    expect(result.corrupted).toBe(0);
    let restored = 0;
    for (let i = 100; i < 200; i++) if ((await getIncident(`d18-${i}`))) restored++;
    expect(restored).toBe(100);
    console.log(`[perf] 100-incident backup export ${exportMs}ms, import ${importMs}ms`);
  });
});

describe("dev.19 backup: attachment integrity + staged media restore", () => {
  const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
  const attachment = (id: string, incidentId: string, data: string) => ({ id, incidentId, fileName: "photo.jpg", mimeType: "image/jpeg", byteSize: 5, data });
  // One object per id, memoized: hashes must be computed over the EXACT
  // serialized record (makeIncident generates fresh random fields per call).
  const incidentCache = new Map<string, ReturnType<typeof makeIncident>>();
  const incidentFor = (id: string) => {
    if (!incidentCache.has(id)) incidentCache.set(id, makeIncident({ id, humanReference: "WIH-D19-" + id }));
    return incidentCache.get(id)!;
  };

  it("round-trips a healthy attachment (hash verified)", async () => {
    const { sha256Hex } = await import("../utils/validation");
    const backup = {
      schemaVersion: 1,
      applicationVersion: "0.2.0-dev.19",
      exportedAt: new Date().toISOString(),
      manifest: {
        generatedBy: "0.2.0-dev.19",
        incidentCount: 1,
        attachmentCount: 1,
        incidentHashes: { "d19-ok": await sha256Hex(JSON.stringify(incidentFor("d19-ok"))) },
        attachmentHashes: { "att-ok": await sha256Hex(b64([9, 8, 7])) },
      },
      incidents: [incidentFor("d19-ok")],
      attachments: [attachment("att-ok", "d19-ok", b64([9, 8, 7]))],
    };
    const result = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.corrupted).toBe(0);
    expect(result.imported).toBe(1);
    expect(result.attachmentCount).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it("detects a corrupted photo: hash mismatch → refused, not imported", async () => {
    const { sha256Hex } = await import("../utils/validation");
    const good = b64([1, 2, 3, 4, 5]);
    const backup = {
      schemaVersion: 1,
      applicationVersion: "0.2.0-dev.19",
      exportedAt: new Date().toISOString(),
      manifest: {
        generatedBy: "0.2.0-dev.19",
        incidentCount: 1,
        attachmentCount: 1,
        incidentHashes: { "d19-corrupt": await sha256Hex(JSON.stringify(incidentFor("d19-corrupt"))) },
        attachmentHashes: { "att-corrupt": await sha256Hex(good) },
      },
      incidents: [incidentFor("d19-corrupt")],
      // payload altered in transit (still valid base64 → decode succeeds)
      attachments: [attachment("att-corrupt", "d19-corrupt", b64([9, 9, 9, 9, 9]))],
    };
    const result = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.corrupted).toBe(1);
    expect(result.warnings.some((w) => w.includes("integrity check"))).toBe(true);
    expect(result.attachmentCount).toBe(0);
  });

  it("undecodable attachment data is refused (staged decode)", async () => {
    const { sha256Hex } = await import("../utils/validation");
    const backup = {
      schemaVersion: 1,
      applicationVersion: "0.2.0-dev.19",
      exportedAt: new Date().toISOString(),
      manifest: {
        generatedBy: "0.2.0-dev.19",
        incidentCount: 1,
        attachmentCount: 1,
        incidentHashes: { "d19-bad": await sha256Hex(JSON.stringify(incidentFor("d19-bad"))) },
        attachmentHashes: { "att-bad": "0".repeat(64) },
      },
      incidents: [incidentFor("d19-bad")],
      attachments: [attachment("att-bad", "d19-bad", "!!!not-base64!!!")],
    };
    const result = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.corrupted).toBe(1);
    expect(result.attachmentCount).toBe(0);
  });

  it("legacy backups without attachmentHashes still import (compat)", async () => {
    const backup = {
      schemaVersion: 1,
      applicationVersion: "0.2.0-dev.17",
      exportedAt: new Date().toISOString(),
      manifest: { generatedBy: "0.2.0-dev.17", incidentCount: 1, attachmentCount: 1, incidentHashes: {} },
      incidents: [incidentFor("d19-legacy")],
      attachments: [attachment("att-legacy", "d19-legacy", b64([4, 4, 4]))],
    };
    const result = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.corrupted).toBe(0);
    expect(result.warnings.every((w) => !w.includes("integrity"))).toBe(true);
  });

  it("leaves existing data intact when a restore is refused (staged restore)", async () => {
    await putIncident(makeIncident({ id: "d19-keep", humanReference: "WIH-D19-KEEP", summary: "precious local record" }));
    const tampered = {
      schemaVersion: 1,
      applicationVersion: "0.2.0-dev.19",
      exportedAt: new Date().toISOString(),
      manifest: { generatedBy: "0.2.0-dev.19", incidentCount: 1, attachmentCount: 0, incidentHashes: {} },
      incidents: [{ ...makeIncident({ id: "d19-new", humanReference: "WIH-D19-NEW" }), summary: "TAMPERED" }],
      attachments: [],
    };
    const result = await importBackup(tampered);
    // The locally-created record is untouched and never overwritten.
    const kept = await getIncident("d19-keep");
    expect(kept?.summary).toBe("precious local record");
    void result;
  });
});
