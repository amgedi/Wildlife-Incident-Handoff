/** 0.3 analytics overhaul tests: TrendChart, AgingStrip, BarDistribution.
 *  Covers the spec items 46–53 acceptance criteria: svg with aria-label,
 *  sr-only data table values, five aging bucket labels + counts, ranked
 *  distribution capped at 8 rows with an "Other (n)" remainder row, and
 *  no crashes at 90 points / zero data. */
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { i18n } from "../../i18n";
import { TrendChart, type SeriesPoint } from "./TrendChart";
import { AgingStrip, BarDistribution } from "./dashboard/opsCharts";

function seededPoints(count: number): SeriesPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    day: `D${String(i + 1).padStart(2, "0")}`,
    reported: ((i * 7) % 11) + 1,
    resolved: ((i * 5) % 9) + 1,
  }));
}

beforeAll(async () => {
  if (!i18n.isInitialized) await i18n.init();
  await i18n.changeLanguage("en");
});

describe("TrendChart (0.3)", () => {
  it("renders a focusable svg with an aria-label summary and an sr-only data table", () => {
    render(<TrendChart points={seededPoints(14)} />);
    const svg = document.querySelector("svg.ax-trend-svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("role")).toBe("img");
    expect(svg!.getAttribute("tabindex")).toBe("0");
    const label = svg!.getAttribute("aria-label") ?? "";
    expect(label).toContain("Reports over time");
    const table = document.querySelector("table.sr-only");
    expect(table).not.toBeNull();
    expect(table!.querySelector("tbody tr")).not.toBeNull();
  });

  it("sr-only data table carries the exact point values", () => {
    const points: SeriesPoint[] = [
      { day: "Mon", reported: 5, resolved: 3 },
      { day: "Tue", reported: 8, resolved: 6 },
      { day: "Wed", reported: 2, resolved: 2 },
    ];
    render(<TrendChart points={points} />);
    const rows = document.querySelectorAll("table.sr-only tbody tr");
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain("Mon");
    expect(rows[0]!.textContent).toContain("5");
    expect(rows[1]!.textContent).toContain("8");
    expect(rows[1]!.textContent).toContain("6");
    expect(rows[2]!.textContent).toContain("Wed");
  });

  it("survives 90 points and zero data without crashing", () => {
    render(<TrendChart points={seededPoints(90)} />);
    expect(document.querySelectorAll("table.sr-only tbody tr")).toHaveLength(90);
    render(<TrendChart points={[]} />);
    const svg = document.querySelector("svg.ax-trend-svg");
    expect(svg).not.toBeNull();
  });
});

describe("AgingStrip (0.3)", () => {
  const buckets = { under30: 4, min30to60: 3, h1to2: 2, h2to4: 1, over4: 2 };

  it("renders one button strip with all five segments and visible counts", () => {
    render(<AgingStrip buckets={buckets} onPick={() => {}} />);
    const strip = screen.getByRole("button");
    expect(strip.className).toContain("ax-aging-strip");
    const segs = strip.querySelectorAll(".ax-aging-seg");
    expect(segs).toHaveLength(5);
    // visible counts inside segments and in the legend (not color-only)
    for (const c of ["4", "3", "2", "1", "2"]) {
      expect(Array.from(strip.querySelectorAll(".ax-aging-seg-count, .ax-aging-legend-count")).some((el) => el.textContent === c)).toBe(true);
    }
  });

  it("labels all five buckets and summarizes them in the accessible name", () => {
    render(<AgingStrip buckets={buckets} onPick={() => {}} />);
    expect(screen.getByText("< 30 min")).toBeTruthy();
    expect(screen.getByText("30–60 min")).toBeTruthy();
    expect(screen.getByText("1–2 h")).toBeTruthy();
    expect(screen.getByText("2–4 h")).toBeTruthy();
    expect(screen.getByText("4+ h")).toBeTruthy();
    const strip = screen.getByRole("button");
    const name = strip.getAttribute("aria-label") ?? "";
    expect(name).toContain("Case aging");
    expect(name).toContain("4");
  });

  it("oldest bucket gets the hatch treatment (data-level 4)", () => {
    render(<AgingStrip buckets={buckets} />);
    const oldest = document.querySelector('.ax-aging-seg[data-level="4"]');
    expect(oldest).not.toBeNull();
  });
});

describe("BarDistribution (0.3)", () => {
  it("caps visible rows at 8 and summarizes the remainder as Other (n)", () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      key: `k${i}`,
      label: `Category ${i}`,
      count: 12 - i,
    }));
    const picks: string[] = [];
    render(<BarDistribution entries={entries} onPick={(k) => picks.push(k)} />);
    const rows = screen.getAllByText(/Category \d+|^Other/);
    expect(rows).toHaveLength(9); // 8 ranked rows + 1 "Other" remainder row
    expect(screen.getByText("Other (4)")).toBeTruthy();
    fireEvent.click(screen.getAllByText(/Category \d+/)[0]!.closest("button")!);
    expect(picks).toEqual(["k0"]);
  });

  it("renders exactly 8 or fewer rows and keeps every row a button with onPick", () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({ key: `s${i}`, label: `S${i}`, count: i + 1 }));
    render(<BarDistribution entries={entries} onPick={() => {}} />);
    expect(document.querySelectorAll("button.ax-dist-row")).toHaveLength(8);
    expect(screen.queryByText(/Other/)).toBeNull();
  });

  it("handles empty and zero-count entries without crashing", () => {
    render(<BarDistribution entries={[]} />);
    expect(screen.getByText("No data yet")).toBeTruthy();
    render(
      <BarDistribution
        entries={[
          { key: "a", label: "A", count: 0 },
          { key: "b", label: "B", count: 0 },
        ]}
      />
    );
    expect(document.querySelectorAll(".ax-dist-row")).toHaveLength(2);
  });

  it("ranks rows by descending count with tabular numbers", () => {
    const entries = [
      { key: "low", label: "Low", count: 2 },
      { key: "high", label: "High", count: 9 },
      { key: "mid", label: "Mid", count: 5 },
    ];
    render(<BarDistribution entries={entries} />);
    const labels = Array.from(document.querySelectorAll(".ax-dist-label")).map((el) => el.textContent);
    expect(labels).toEqual(["High", "Mid", "Low"]);
    const counts = Array.from(document.querySelectorAll(".ax-dist-count")).map((el) => el.textContent);
    expect(counts[0]).toContain("9");
  });
});
