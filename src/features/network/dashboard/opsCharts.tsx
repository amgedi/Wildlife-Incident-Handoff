/** Reusable dashboard chart pieces: horizontal bar distribution with
 *  click-through, and the case-aging timeline strip. Accessible: each row
 *  is a real button with text (never color alone), and the whole chart has
 *  a text fallback by construction. */
import type { DistributionEntry } from "../incidentAnalytics";
import { useTranslation } from "react-i18next";

export function BarDistribution({
  entries,
  max,
  onPick,
  accent,
  note,
  total,
}: {
  entries: DistributionEntry[];
  max?: number;
  onPick?: (key: string) => void;
  accent?: string;
  note?: string | null;
  total?: number;
}) {
  const maxValue = Math.max(1, max ?? entries.reduce((m, e) => Math.max(m, e.count), 0));
  const sum = total ?? entries.reduce((s, e) => s + e.count, 0);
  return (
    <div role="group" aria-label="Distribution" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map((e) => {
        const pct = Math.round((e.count / maxValue) * 100);
        const share = sum > 0 ? Math.round((e.count / sum) * 100) : 0;
        const inner = onPick ? (
          <>
            <span style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "3px 10px" }}>
              <span>{e.label}</span>
              <span style={{ color: "var(--c-ink-faint)", fontSize: "0.8rem" }}>{e.count}{sum > 0 ? ` · ${share}%` : ""}</span>
            </span>
          </>
        ) : (
          <>
            <span style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "3px 10px" }}>
              <span>{e.label}</span>
              <span style={{ color: "var(--c-ink-faint)", fontSize: "0.8rem" }}>{e.count}{sum > 0 ? ` · ${share}%` : ""}</span>
            </span>
          </>
        );
        return (
          <button
            key={e.key}
            className="dist-row"
            onClick={onPick ? () => onPick(e.key) : undefined}
            disabled={!onPick}
            style={{ width: "100%", textAlign: "left", font: "inherit", cursor: onPick ? "pointer" : "default", border: "none", background: "transparent", padding: 0, borderRadius: 8 }}
          >
            <span
              aria-hidden="true"
              className="dist-bar"
              style={{
                position: "absolute", inset: 0, width: `${pct}%`, borderRadius: 8,
                background: accent ?? "var(--c-primary)", opacity: 0.22,
              }}
            />
            <span style={{ position: "relative", display: "flex", alignItems: "center" }}>{inner}</span>
          </button>
        );
      })}
      {entries.length === 0 && <p className="hint" style={{ margin: 0 }}>No data yet</p>}
      {note && (
        <p className="hint" style={{ margin: 0, color: "var(--c-warn)" }}>{note}</p>
      )}
    </div>
  );
}

export function AgingStrip({
  buckets,
  onPick,
}: {
  buckets: { under30: number; min30to60: number; h1to2: number; h2to4: number; over4: number };
  onPick?: () => void;
}) {
  const { t } = useTranslation("professional");
  const rows = [
    { key: "under30", label: t("agingUnder30", { defaultValue: "< 30 min" }), count: buckets.under30, level: "ok" },
    { key: "min30to60", label: t("aging30to60", { defaultValue: "30–60 min" }), count: buckets.min30to60, level: "ok" },
    { key: "h1to2", label: t("aging1to2", { defaultValue: "1–2 h" }), count: buckets.h1to2, level: "warn" },
    { key: "h2to4", label: t("aging2to4", { defaultValue: "2–4 h" }), count: buckets.h2to4, level: "warn" },
    { key: "over4", label: t("agingOver4", { defaultValue: "4+ h" }), count: buckets.over4, level: "alert" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div role="group" aria-label="Case aging" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r) => (
        <button
          key={r.key}
          onClick={onPick}
          disabled={!onPick}
          className="dist-row"
          style={{ display: "grid", gridTemplateColumns: "72px 1fr 34px", alignItems: "center", gap: 10, font: "inherit", color: "var(--c-ink)", border: "none", background: "transparent", padding: 0, cursor: onPick ? "pointer" : "default", textAlign: "left" }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--c-ink-faint)" }}>{r.label}</span>
          <span style={{ position: "relative", height: 10, borderRadius: 999, background: "var(--c-surface-raised, rgb(127 127 127 / 0.15))", overflow: "hidden" }}>
            <span
              aria-hidden="true"
              data-aging-level={r.level}
              style={{
                position: "absolute", inset: 0, width: `${(r.count / max) * 100}%`,
                borderRadius: 999, background: "currentColor", opacity: 0.8, transition: "width 400ms var(--ease, ease)",
              }}
            />
          </span>
          <span style={{ fontSize: "0.85rem", textAlign: "right" }}>{r.count}</span>
        </button>
      ))}
    </div>
  );
}
