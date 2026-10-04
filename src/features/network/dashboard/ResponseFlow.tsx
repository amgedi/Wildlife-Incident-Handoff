/**
 * Response Flow v3 — a stage rail, not a row of cards.
 *
 * Contract (0.3 spec items 4–12):
 * - Default state: NO stage selected. The drawer is not mounted until the
 *   user selects a stage ("Select a stage to inspect cases." hint instead).
 * - Counts and the case drawer derive from the SAME scope array (the parent
 *   passes `scope`; see getPipelineStageCases — invariant-tested).
 * - Selected visual: stronger number/label, node ring, accent underline and a
 *   subtle halo — never a giant filled rectangle around the stage.
 * - Hover: subtle brightening only. Keyboard focus: independent focus ring.
 * - Accessibility: each stage is a real <button> with aria-pressed; the rail
 *   is a tablist-like group; the drawer is a labelled region.
 * - The drawer is compact: count, Earliest/Latest sort (hidden when it cannot
 *   change anything), bounded case rows with "Show more".
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../components/ui";
import { Icons } from "../../../components/Icons";
import { relativeTime } from "../../../utils/time";
import { animalLabel } from "../../export/exportService";
import { getPipelineCounts, getPipelineStageCases, RESPONSE_FLOW_STAGES } from "../incidentAnalytics";
import type { Incident } from "../../../types/incident";

const DRAWER_PAGE = 8;

export function ResponseFlow({ scope }: { scope: Incident[] }) {
  const { t } = useTranslation("professional");
  const [selected, setSelected] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const stages = useMemo(() => getPipelineCounts(scope), [scope]);
  const total = stages.reduce((sum, s) => sum + s.count, 0);

  // Keyboard: arrow keys move selection within the rail (tab-like semantics).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = stages.findIndex((s) => s.key === selected);
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = stages[(idx + dir + stages.length) % stages.length] ?? stages[0];
    if (next) {
      setSelected(next.key);
      const btn = railRef.current?.querySelector<HTMLButtonElement>(`[data-stage="${next.key}"]`);
      btn?.focus();
    }
  };

  return (
    <div className="rflow">
      <div className="rflow-rail" ref={railRef} role="group" aria-label={t("pipelineTitle", { defaultValue: "Response flow" })} onKeyDown={onKeyDown} data-tour-id="rflow-rail">
        {stages.map((s, idx) => (
          <Fragment key={s.key}>
            {idx > 0 && <span className="rflow-link" aria-hidden="true" data-active={selected === s.key || stages[idx - 1]!.key === selected || undefined} />}
            <button
              data-stage={s.key}
              aria-pressed={selected === s.key}
              aria-label={`${s.label}: ${s.count}`}
              className={`rflow-stage${s.count === 0 ? " is-zero" : ""}${selected === s.key ? " is-selected" : ""}`}
              onClick={() => setSelected(selected === s.key ? null : s.key)}
            >
              <span className="rflow-node" aria-hidden="true">
                <AnimatedCount value={s.count} />
              </span>
              <span className="rflow-label">{s.label}</span>
            </button>
          </Fragment>
        ))}
      </div>

      {selected == null ? (
        <p className="hint rflow-hint">{t("rflowSelectHint", { defaultValue: "Select a stage to inspect cases." })}</p>
      ) : (
        <StageDrawer
          stage={selected}
          scope={scope}
          onClose={() => setSelected(null)}
        />
      )}
      {total === 0 && selected == null && (
        <p className="hint rflow-hint" style={{ marginTop: 4 }}>
          {t("rflowEmpty", { defaultValue: "Cases will appear at each stage as incidents move through response." })}
        </p>
      )}
    </div>
  );
}

/** Compact case drawer for a selected stage. Mounted only when a stage is selected. */
function StageDrawer({ stage, scope, onClose }: { stage: string; scope: Incident[]; onClose: () => void }) {
  const { t } = useTranslation("professional");
  const navigate = useNavigate();
  const [sort, setSort] = useState<"earliest" | "latest">("earliest");
  const [shown, setShown] = useState(DRAWER_PAGE);
  const drawerRef = useRef<HTMLDivElement>(null);

  const def = RESPONSE_FLOW_STAGES.find((s) => s.key === stage);
  const cases = useMemo(() => {
    const list = getPipelineStageCases(scope, stage);
    return sort === "earliest" ? list : [...list].reverse();
  }, [scope, stage, sort]);

  useEffect(() => {
    setShown(DRAWER_PAGE);
  }, [stage, scope]);

  // Drawer animates open on mount.
  useEffect(() => {
    drawerRef.current?.classList.add("is-open");
  }, []);

  if (!def) return null;
  const sortUseful = cases.length > 1;

  return (
    <div className="rflow-drawer" ref={drawerRef} role="region" aria-label={`${def.label}: ${t("rflowCases", { defaultValue: "cases" })}`}>
      <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
        <strong className="rflow-drawer-title">
          {t("rflowDrawerCount", { defaultValue: "{{count}} case(s) at this stage", count: cases.length })}
        </strong>
        <span className="row" style={{ gap: 8 }}>
          {sortUseful && (
            <div className="segmented segmented-sm" role="group" aria-label={t("rflowSort", { defaultValue: "Sort" })}>
              <button aria-pressed={sort === "earliest"} onClick={() => setSort("earliest")}>{t("sortEarliest", { defaultValue: "Earliest" })}</button>
              <button aria-pressed={sort === "latest"} onClick={() => setSort("latest")}>{t("sortLatest", { defaultValue: "Latest" })}</button>
            </div>
          )}
          <button className="btn btn-quiet btn-sm" onClick={onClose} aria-label={t("close", { defaultValue: "Close" })}>
            <Icons.x size={14} />
          </button>
        </span>
      </div>
      {cases.length === 0 ? (
        <p className="hint rflow-empty">{t("rflowStageEmpty", { defaultValue: "Nothing at this stage right now." })}</p>
      ) : (
        <ul className="rflow-cases">
          {cases.slice(0, shown).map((i) => (
            <li key={i.id}>
              <button className="rflow-case-row" onClick={() => navigate(`/incidents/${i.id}`)}>
                <StatusBadge status={i.status} />
                <span className="rflow-case-main">
                  <span className="rflow-case-ref">{i.humanReference}</span>
                  <span className="rflow-case-sub">
                    {animalLabel(i)} · {relativeTime(i.occurredAt ?? i.createdAt)}
                    {i.location.description ? ` · ${i.location.description}` : ""}
                  </span>
                </span>
                <Icons.chevronRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {cases.length > shown && (
        <button className="btn btn-quiet btn-sm rflow-more" onClick={() => setShown((n) => n + DRAWER_PAGE * 2)}>
          {t("rflowShowMore", { defaultValue: "Show more ({{n}} more)", n: cases.length - shown })}
        </button>
      )}
    </div>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)")?.matches) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 400);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value]);
  return <>{display}</>;
}
