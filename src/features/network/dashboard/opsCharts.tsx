/** Dashboard chart pieces (0.3 overhaul — premium operations analytics).
 *
 *  AgingStrip = one segmented horizontal band (five aging buckets, widths
 *  proportional to counts, increasing intensity + hatch for the oldest
 *  bucket, visible counts per segment) inside a single button (onPick), with
 *  an aria-label summarizing the buckets, per-segment title tooltips and a
 *  small legend row so labels are never color-only.
 *
 *  BarDistribution = compact ranked bar list (descending, capped at 8 rows,
 *  remainder summarized as "Other (n)") with aligned tabular numbers and a
 *  subtle gradient fill per bar; each real row is a button with onPick.
 *  Props contracts unchanged. */
import type { DistributionEntry } from "../incidentAnalytics";
import { useTranslation } from "react-i18next";

const MAX_DIST_ROWS = 8;

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

  const ranked = [...entries].sort((a, b) => b.count - a.count);
  const visible = ranked.slice(0, MAX_DIST_ROWS);
  const rest = ranked.slice(MAX_DIST_ROWS);
  const restCount = rest.reduce((s, e) => s + e.count, 0);
  const rows: Array<DistributionEntry & { isOther?: boolean }> = [...visible];
  if (rest.length > 0) {
    rows.push({
      key: "__other__",
      label: t("axDistOther", { defaultValue: "Other ({{count}})", count: rest.length }),
      count: restCount,
      isOther: true,
    });
  }

  const peak = Math.max(1, ...ranked.map((e) => e.count));

  return (
    <div
      className="ax-dist"
      role="group"
      aria-label={t("distributionLabel", { defaultValue: "Distribution" })}
    >
      <ul className="ax-dist-list">
        {rows.map((e) => {
          const share = sum > 0 ? Math.round((e.count / sum) * 100) : 0;
          const widthPct = Math.max(e.count > 0 ? 4 : 0, (e.count / peak) * 100);
          const content = (
            <>
              <span
                className="ax-dist-fill"
                aria-hidden="true"
                style={{ width: `${widthPct}%`, ...(accent ? { background: accent, opacity: 0.22 } : null) }}
              />
              <span className="ax-dist-label">{e.label}</span>
              <span className="ax-dist-count">
                {e.count}
                {sum > 0 && !e.isOther ? <span className="ax-dist-share"> · {share}%</span> : null}
              </span>
            </>
          );
          return (
            <li key={e.key}>
              {onPick && !e.isOther ? (
                <button type="button" className="ax-dist-row" onClick={() => onPick(e.key)}>
                  {content}
                </button>
              ) : (
                <div className={`ax-dist-row${e.isOther ? " is-other" : ""}`}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {entries.length === 0 && (
        <p className="hint ax-dist-empty">{t("axDistEmpty", { defaultValue: "No data yet" })}</p>
      )}
      {note && <p className="hint ax-dist-note">{note}</p>}
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
    { key: "under30", label: t("agingUnder30", { defaultValue: "< 30 min" }), count: buckets.under30, level: 0 },
    { key: "min30to60", label: t("aging30to60", { defaultValue: "30–60 min" }), count: buckets.min30to60, level: 1 },
    { key: "h1to2", label: t("aging1to2", { defaultValue: "1–2 h" }), count: buckets.h1to2, level: 2 },
    { key: "h2to4", label: t("aging2to4", { defaultValue: "2–4 h" }), count: buckets.h2to4, level: 3 },
    { key: "over4", label: t("agingOver4", { defaultValue: "4+ h" }), count: buckets.over4, level: 4 },
  ];
  const sum = rows.reduce((s, r) => s + r.count, 0);

  const strip = (
    <>
      {rows.map((r) => (
        <span
          key={r.key}
          className="ax-aging-seg"
          data-level={r.level}
          style={{ width: `${sum > 0 ? (r.count / sum) * 100 : 20}%` }}
          title={t("axAgingBucketTitle", { defaultValue: "{{label}}: {{count}}", label: r.label, count: r.count })}
          aria-hidden="true"
        >
          <span className="ax-aging-seg-count">{r.count}</span>
        </span>
      ))}
    </>
  );

  return (
    <div className="ax-aging" role="group" aria-label={t("caseAging", { defaultValue: "Case aging" })}>
      {onPick ? (
        <button
          type="button"
          className="ax-aging-strip"
          onClick={onPick}
          aria-label={t("axAgingAria", {
            defaultValue:
              "Case aging: {{under30}} under 30 min, {{m30to60}} from 30 to 60 min, {{h1to2}} from 1 to 2 h, {{h2to4}} from 2 to 4 h, {{over4}} over 4 h.",
            under30: buckets.under30,
            m30to60: buckets.min30to60,
            h1to2: buckets.h1to2,
            h2to4: buckets.h2to4,
            over4: buckets.over4,
          })}
        >
          {strip}
        </button>
      ) : (
        <div className="ax-aging-strip is-static">{strip}</div>
      )}
      <div className="ax-aging-legend">
        {rows.map((r) => (
          <span key={r.key} className="ax-aging-legend-item">
            <span className="ax-aging-legend-label">{r.label}</span>
            <span className="ax-aging-legend-count">{r.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
