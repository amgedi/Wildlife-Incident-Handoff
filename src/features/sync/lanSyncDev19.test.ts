/** dev.19: ack exchange + adoptPeerAcks behavior (two-instance regression). */
import { describe, it, expect } from "vitest";
import { mergeIncidentsV2, exchangeBodyFrom, parseExchangeBody, incidentsFromPayload, recordVersion } from "./lanSync";
import { makeIncident } from "../export/exportService.test";

const PEER = { deviceId: "fp-b", name: "Field" };

describe("dev.19 ack exchange", () => {
  it("exchange body round-trips payload + acks", () => {
    const body = exchangeBodyFrom('{"incidents":[]}', { a: "2026-10-04T10:00:00Z" });
    const parsed = parseExchangeBody(body);
    expect(parsed.acks.a).toBe("2026-10-04T10:00:00Z");
    expect(parsed.payload).toBe('{"incidents":[]}');
    expect(incidentsFromPayload(parsed.payload)).toEqual([]);
  });

  it("plain snapshot (server reply) parses as payload with empty acks", () => {
    const parsed = parseExchangeBody('{"app":"x","incidents":[]}');
    expect(parsed.acks).toEqual({});
    expect(parsed.payload).toContain("incidents");
  });

  it("B's edit after initial sync is ACCEPTED on A (ack adopted, no conflict)", () => {
    const t0 = "2026-10-04T10:00:00Z";
    const t1 = "2026-10-04T11:00:00Z";
    const localA = makeIncident({ id: "qa", humanReference: "WIH-QA", createdAt: t0, occurredAt: t0, updatedAt: t0 });
    // B added the record via sync at t0 (B's ack says t0), then edited to t1.
    const bEdited = { ...makeIncident({ id: "qa", humanReference: "WIH-QA", createdAt: t0, occurredAt: t0, updatedAt: t1 }), status: "response_requested" as const };
    // A adopts B's ack for its unchanged local record:
    const peerAcks = { qa: t0 };
    const baseAck: Record<string, string> = {};
    const inc = localA;
    if (inc && (inc.updatedAt ?? inc.createdAt ?? "") === peerAcks.qa) baseAck.qa = peerAcks.qa;
    const result = mergeIncidentsV2([localA], [bEdited], baseAck, PEER, t1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.updated).toBe(1);
    expect(result.merged[0]!.updatedAt).toBe(t1);
  });

  it("genuinely both-changed edits still conflict (ack mismatch on both sides)", () => {
    const t0 = "2026-10-04T10:00:00Z";
    const t2 = "2026-10-04T12:00:00Z";
    const localA = makeIncident({ id: "qa", createdAt: t0, occurredAt: t0, updatedAt: t2 }); // A edited
    const bEdited = makeIncident({ id: "qa", createdAt: t0, occurredAt: t0, updatedAt: t2 }); // B edited too
    const result = mergeIncidentsV2([localA], [bEdited], { qa: t0 }, PEER, t2);
    expect(result.conflicts).toHaveLength(1);
  });
});

describe("dev.19 version acks: timestamp collision", () => {
  it("same-timestamp different-content edits still conflict (Windows clock granularity)", () => {
    const t0 = "2026-10-04T10:00:00Z";
    const tX = "2026-10-04T12:00:00Z"; // BOTH edits share one timestamp
    const localA = makeIncident({ id: "qa", createdAt: t0, occurredAt: t0, updatedAt: tX });
    localA.summary = "A edit";
    const bEdited = makeIncident({ id: "qa", createdAt: t0, occurredAt: t0, updatedAt: tX });
    bEdited.summary = "B edit";
    // Legacy ack on t0: both changed → conflict (never silent overwrite).
    const r1 = mergeIncidentsV2([localA], [bEdited], { qa: t0 }, PEER, tX);
    expect(r1.conflicts).toHaveLength(1);
    // Version acks: A accepted B's earlier version... simulate the live chain:
    // B acked A's version X (content "A edit"), then B's own edit also has X.
    const versionOfAEdit = recordVersion(localA);
    const r2 = mergeIncidentsV2([localA], [bEdited], { qa: versionOfAEdit }, PEER, tX);
    // A's local version ≠ ack (content differs? no — ack IS A's version) →
    // localChanged false, peerChanged true (B's content differs at same ts) → accept
    expect(r2.updated).toBe(1);
    expect(r2.conflicts).toHaveLength(0);
    // Reverse order: the ack is on B's version → the PEER hasn't changed
    // since the common ancestor, so keep ours (A's divergence propagates on
    // the next push, where B's side will see the conflict).
    const versionOfBEdit = recordVersion(bEdited);
    const r3 = mergeIncidentsV2([localA], [bEdited], { qa: versionOfBEdit }, PEER, tX);
    expect(r3.conflicts).toHaveLength(0);
    expect(r3.skipped).toBe(1);
    expect(r3.merged[0]!.summary).toBe("A edit");
  });

  it("recordVersion ignores syncSource but reacts to content", () => {
    const a = makeIncident({ id: "v1" });
    const b = { ...a, syncSource: { deviceId: "x", name: "y", at: "2026-10-04T00:00:00Z" } };
    expect(recordVersion(a)).toBe(recordVersion(b));
    const c = { ...a, summary: "changed" };
    expect(recordVersion(a)).not.toBe(recordVersion(c));
    expect(recordVersion(a)).toMatch(/^v3:/);
  });
});
