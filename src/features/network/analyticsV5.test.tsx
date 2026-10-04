/**
 * Analytics V5 tests (0.3.0-dev.5, spec 138–140):
 * - deterministic fixture bucket counts must be exact
 * - buckets can never be negative (counts and geometry)
 * - clicking a bucket opens the detail drawer for the correct window
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { computeBuckets, bucketSpecFor, METRIC_REGISTRY } from "./analytics/metricRegistry";
import { AnalyticsChart } from "./analytics/AnalyticsChart";
import { AnalyticsDetailDrawer } from "./analytics/AnalyticsDetailDrawer";
import { makeIncident } from "../export/exportService.test";
import type { Incident } from "../../types/incident";

const NOW = new Date("2026-10-04T18:00:00");

function incWith(over: Partial<Incident>): Incident {
  return { ...makeIncident(), ...over };
}

describe("bucket spec", () => {
  it("24h hourly, 7d/30d daily, 90d weekly", () => {
    expect(bucketSpecFor(1).kind).toBe("hour");
    expect(bucketSpecFor(1).count).toBe(24);
    expect(bucketSpecFor(7).kind).toBe("day");
    expect(bucketSpecFor(7).count).toBe(7);
    expect(bucketSpecFor(30).kind).toBe("day");
    expect(bucketSpecFor(30).count).toBe(30);
    expect(bucketSpecFor(90).kind).toBe("week");
    expect(bucketSpecFor(90).count).toBe(13);
  });
  it("every metric carries a definition, includes and excludes", () => {
    for (const m of Object.values(METRIC_REGISTRY)) {
      expect(m.definition.length).toBeGreaterThan(10);
      expect(m.includes.length).toBeGreaterThan(10);
      expect(m.excludes.length).toBeGreaterThan(5);
    }
  });
});

describe("bucket count accuracy", () => {
  it("counts reported/assigned/closed exactly in deterministic daily buckets", () => {
    const mk = (id: string, created: string, to?: string, toTime?: string) =>
      incWith({
        id,
        humanReference: id,
        isDemo: false,
        createdAt: created,
        updatedAt: created,
        timeline: to
          ? [{ eventId: `${id}-ev`, incidentId: id, eventType: "status_changed", timestamp: toTime ?? created, actor: null, summary: "", details: null, metadata: { to }, relatedAttachmentIds: [] }]
          : [],
      });
    const incidents = [
      mk("a", "2026-10-04T09:00:00.000Z"),                                            // reported today
      mk("b", "2026-10-03T09:00:00.000Z", "responder_assigned", "2026-10-03T10:00:00.000Z"),
      mk("c", "2026-10-02T09:00:00.000Z", "closed", "2026-10-02T12:00:00.000Z"),
      mk("d", "2026-09-20T09:00:00.000Z", "released", "2026-10-01T12:00:00.000Z"),     // closed within 30d
    ];
    const buckets = computeBuckets(incidents, { range: 30, now: NOW });
    const total = buckets.reduce((s, b) => s + b.reported, 0);
    const assigned = buckets.reduce((s, b) => s + b.assigned, 0);
    const closed = buckets.reduce((s, b) => s + b.closed, 0);
    expect(total).toBe(4);
    expect(assigned).toBe(1);
    expect(closed).toBe(2);
    // today bucket contains exactly incident a
    const today = buckets[buckets.length - 1]!;
    expect(today.incidentIds).toContain("a");
  });
  it("never produces negative counts", () => {
    const buckets = computeBuckets([makeIncident()], { range: 90, now: NOW });
    for (const b of buckets) {
      expect(b.reported).toBeGreaterThanOrEqual(0);
      expect(b.assigned).toBeGreaterThanOrEqual(0);
      expect(b.closed).toBeGreaterThanOrEqual(0);
    }
  });
  it("excludes demo records unless opted in", () => {
    const demo = incWith({ id: "demo-1", isDemo: true, createdAt: "2026-10-04T10:00:00.000Z" });
    const without = computeBuckets([demo], { range: 7, now: NOW });
    const withDemo = computeBuckets([demo], { range: 7, now: NOW, includeDemo: true });
    expect(without.reduce((s, b) => s + b.reported, 0)).toBe(0);
    expect(withDemo.reduce((s, b) => s + b.reported, 0)).toBe(1);
  });
});

describe("chart interaction", () => {
  const buckets = computeBuckets([makeIncident()], { range: 7, now: NOW });

  it("renders bars whose geometry derives from non-negative counts only", () => {
    render(<AnalyticsChart buckets={buckets} selected={null} onSelect={() => {}} />);
    const svg = document.querySelector(".ax5-svg")!;
    const rects = Array.from(svg.querySelectorAll("rect")).filter((r) => r.getAttribute("fill")?.includes("--c"));
    for (const r of rects) {
      expect(Number(r.getAttribute("height"))).toBeGreaterThanOrEqual(0);
      expect(Number(r.getAttribute("y"))).toBeLessThanOrEqual(Number(r.getAttribute("y")) + Number(r.getAttribute("height")));
    }
  });

  it("clicking a bucket opens the detail drawer for its window", () => {
    function Harness() {
      const [selected, setSelected] = useState<number | null>(null);
      return (
        <>
          <AnalyticsChart buckets={buckets} selected={selected} onSelect={setSelected} />
          <AnalyticsDetailDrawer bucket={selected != null ? buckets[selected]! : null} onClose={() => setSelected(null)} onOpenIncidents={() => {}} />
        </>
      );
    }
    const { container } = render(<Harness />);
    const svg = container.querySelector(".ax5-svg")!;
    // Keyboard path (jsdom has no layout: pointer hit-testing is untestable here).
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    fireEvent.keyDown(svg, { key: "Enter" });
    expect(container.querySelector(".ax5-drawer")).toBeTruthy();
    expect(container.querySelector(".ax5-drawer-window")?.textContent).toBe(buckets[0]!.windowLabel);
  });

  it("drawer shows the window label, metric rows and drilldown action", () => {
    const withIncident = buckets.map((b) => ({ ...b, incidentIds: ["x"], incidentRefs: ["WIH-2026-000001"] }));
    const b = withIncident[withIncident.length - 1]!;
    render(<AnalyticsDetailDrawer bucket={b} onClose={() => {}} onOpenIncidents={() => {}} />);
    expect(screen.getByText(b.windowLabel)).toBeTruthy();
    expect(screen.getByText("Reported")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open filtered incidents" })).toBeTruthy();
  });
});
