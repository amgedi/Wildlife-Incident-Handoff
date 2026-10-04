/**
 * dev.18 — 10,000-incident performance budget (spec §45–§50).
 *
 * These are not just smoke tests: each block asserts a wall-clock budget so
 * a regression that re-freezes the dashboard fails CI instead of shipping.
 * Timings are logged so the completion report can quote real numbers.
 */
import { describe, it, expect } from "vitest";
import { makeIncident } from "./export/exportService.test";
import {
  getOpenCounts,
  getNeedsAttention,
  getStatusDistribution,
  getAnimalDistribution,
  getAgingBuckets,
  getActivityFeed,
  getTimeSeries,
} from "./network/incidentAnalytics";
import { findDuplicateCandidates } from "./network/networkService";
import { fuzzCoordinates } from "./network/mapProvider";
import type { Incident } from "../types/incident";

const N = 10_000;
const STATUSES = ["reported", "response_requested", "responder_assigned", "awaiting_pickup", "in_transport", "transferred", "in_care", "veterinary_care", "monitoring", "released", "deceased", "closed", "cancelled"] as const;
const ANIMALS = ["bird", "mammal", "reptile", "amphibian"] as const;

function syntheticDataset(): Incident[] {
  const out: Incident[] = [];
  const t0 = Date.UTC(2026, 8, 1);
  for (let i = 0; i < N; i++) {
    const inc = makeIncident({
      id: `perf-${i}`,
      humanReference: `WIH-2026-${String(i).padStart(6, "0")}`,
      status: STATUSES[i % STATUSES.length] as Incident["status"],
      createdAt: new Date(t0 + i * 60_000).toISOString(),
      updatedAt: new Date(t0 + i * 60_000 + 3_600_000).toISOString(),
    });
    inc.location = {
      ...inc.location,
      description: `Road ${i % 300} near grid ${(i % 97) + 1}`,
      precision: (["exact", "approximate", "sensitive"] as const)[i % 3] ?? null,
      latitude: 51.0 + (i % 100) * 0.01,
      longitude: -114.0 + (i % 100) * 0.01,
    };
    inc.animal = { ...inc.animal, group: ANIMALS[i % ANIMALS.length] as Incident["animal"]["group"] };
    out.push(inc);
  }
  return out;
}

const data = syntheticDataset();

function timed(name: string, budgetMs: number, fn: () => unknown): number {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  console.log(`[perf 10k] ${name}: ${ms.toFixed(1)} ms (budget ${budgetMs} ms)`);
  expect(ms, `${name} took ${ms.toFixed(0)}ms, budget ${budgetMs}ms`).toBeLessThan(budgetMs);
  return ms;
}

describe("10k incident performance budgets", () => {
  it("dashboard KPIs + distributions + attention stay interactive", () => {
    timed("getOpenCounts", 120, () => {
      const k = getOpenCounts(data);
      expect(Object.values(k).some((v) => typeof v === "number")).toBe(true);
    });
    timed("getNeedsAttention", 120, () => {
      const att = getNeedsAttention(data);
      expect(Array.isArray(att) || typeof att === "object").toBe(true);
    });
    timed("getStatusDistribution", 120, () => {
      expect(getStatusDistribution(data).length).toBeGreaterThan(0);
    });
    timed("getAnimalDistribution", 120, () => {
      expect(getAnimalDistribution(data).length).toBeGreaterThan(0);
    });
    timed("getAgingBuckets", 120, () => {
      expect(getAgingBuckets(data)).toBeTruthy();
    });
    timed("getActivityFeed", 120, () => {
      expect(getActivityFeed(data).length).toBeLessThanOrEqual(12);
    });
    timed("getTimeSeries(90d)", 300, () => {
      expect(getTimeSeries(data, 90).length).toBe(90);
    });
  });

  it("list search + filter + sort core stays responsive", () => {
    timed("search substring", 150, () => {
      const q = "road 12";
      const hits = data.filter(
        (i) => !i.deletedAt && (i.humanReference.toLowerCase().includes(q) || (i.location.description ?? "").toLowerCase().includes(q))
      );
      expect(hits.length).toBeGreaterThan(0);
    });
    timed("filter+sort (status, age desc)", 150, () => {
      const rows = data
        .filter((i) => i.status === "in_care" && !i.deletedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it("duplicate candidate detection stays sub-second at 10k", () => {
    timed("findDuplicateCandidates", 900, () => {
      const cands = findDuplicateCandidates(data, {});
      expect(Array.isArray(cands)).toBe(true);
    });
  });

  it("map marker geometry for 10k points is cheap", () => {
    timed("fuzz 10k markers", 120, () => {
      let n = 0;
      for (const i of data) {
        const la = i.location.latitude;
        const lo = i.location.longitude;
        if (la != null && lo != null && fuzzCoordinates(la, lo)) n++;
      }
      expect(n).toBe(N);
    });
  });
});
