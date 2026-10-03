/** Dashboard chart pieces (0.2.0-dev.10 redesign).
 *
 *  Distribution = one stacked segmented bar (the shape of the whole) above a
 *  compact legend list with counts and shares; each segment/list row is a
 *  real button with text (never color alone). Aging = a single proportional
 *  strip where the 4h+ bucket gets attention emphasis, plus bucket counts.
 *  Both remain their own accessible data table by construction. */
import type { DistributionEntry } from "../incidentAnalytics";
import { useTranslation } from "react-i18next";

const SEGMENT_COLORS = [
  "var(--c-primary)",
  "color-mix(in srgb, var(--c-primary) 62%, var(--c-ink-soft))",
  "color-mix(in srgb, var(--c-primary) 34%, transparent)",
  "color-mix(in srgb, var(--c-primary) 18%, transparent)",
  "var(--c-ink-faint)",
];

export function BarDistribution({
  entries,
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
  const { t } = useTranslation("professional");
  const sum = total ?? entries.reduce((s, e) => s + e.count, 0);
  const colors = entries.map((_, i) => (accent ? accent : SEGMENT_COLORS[i % SEGMENT_COLORS.length]));
  return (
    <div role="group" aria-label={t("distributionLabel", { defaultValue: "Distribution" })} style={{ display: "grid", gap: 10 }}>
      {sum > 0 && (
        <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--c-surface-raised, rgb(127 127 127 / 0.14))" }} aria-hidden="true">
          {entries.map((e, i) =>
            e.count > 0 ? (
              <span
                key={e.key}
                style={{ width: `${(e.count / sum) * 100}%`, background: colors[i] }}
                title={`${e.label} · ${e.count}`}
              />
            ) : null
          )}
        </div>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
        {entries.map((e, i) => {
          const share = sum > 0 ? Math.round((e.count / sum) * 100) : 0;
          const row = (
            <>
              <span className="dist-dot" style={{ background: colors[i] }} aria-hidden="true" />
              <span style={{ flex: 1, textAlign: "left" }}>{e.label}</span>
              <span style={{ color: "var(--c-ink-faint)", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>
                {e.count}{sum > 0 ? ` · ${share}%` : ""}
              </span>
            </>
          );
          return (
            <li key={e.key}>
              {onPick ? (
                <button className="dist-row" onClick={() => onPick(e.key)} style={{ width: "100%" }}>{row}</button>
              ) : (
                <div className="dist-row" style={{ width: "100%" }}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {entries.length === 0 && <p className="hint" style={{ margin: 0 }}>{t("noDataYet", { defaultValue: "No data yet" })}</p>}
      {note && <p className="hint" style={{ margin: 0, color: "var(--c-warn)" }}>{note}</p>}
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
  const sum = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div role="group" aria-label={t("caseAging", { defaultValue: "Case aging" })} style={{ display: "grid", gap: 10 }}>
      <div
        style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--c-surface-raised, rgb(127 127 127 / 0.14))" }}
        aria-hidden="true"
      >
        {rows.map((r) =>
          r.count > 0 ? (
            <span
              key={r.key}
              data-aging-level={r.level}
              style={{ width: `${(r.count / sum) * 100}%`, opacity: r.level === "alert" ? 1 : 0.75 }}
              title={`${r.label} · ${r.count}`}
            />
          ) : null
        )}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
        {rows.map((r) => {
          const stale = r.level === "alert" && r.count > 0;
          const row = (
            <>
              <span style={{ fontSize: "0.8rem", color: stale ? "var(--c-danger, var(--c-warn))" : "var(--c-ink-faint)", fontWeight: stale ? 700 : 400 }}>{r.label}</span>
              <span style={{ flex: 1, textAlign: "right", fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", fontWeight: stale ? 700 : 400 }}>
                {r.count}
              </span>
            </>
          );
          return (
            <li key={r.key}>
              {onPick ? (
                <button className="dist-row" onClick={onPick} style={{ width: "100%" }}>{row}</button>
              ) : (
                <div className="dist-row" style={{ width: "100%" }}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
