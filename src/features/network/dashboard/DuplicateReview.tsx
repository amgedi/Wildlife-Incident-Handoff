/**
 * Duplicate Review V4 (0.3.0-dev.4, spec 18–24): compact summary + grouped
 * candidates with signal chips and compare actions. Replaces the old pale
 * yellow pair-permutation wall. Nothing is ever merged automatically.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../components/Icons";
import { relativeTime } from "../../../utils/time";
import type { DuplicateCandidate } from "../networkService";
import { groupDuplicateCandidates, type DuplicateGroup } from "../duplicateGroups";
import type { Incident } from "../../../types/incident";

export function DuplicateReview({
  pairs,
  incidentsById,
  onViewOnMap,
}: {
  pairs: DuplicateCandidate[];
  incidentsById: Map<string, Incident>;
  onViewOnMap?: (group: DuplicateGroup) => void;
}) {
  const { t } = useTranslation("professional");
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupDuplicateCandidates(pairs, incidentsById), [pairs, incidentsById]);
  if (groups.length === 0) return null;
  const shown = expanded ? groups : groups.slice(0, 3);

  return (
    <section className="card dup-review" data-testid="duplicate-review" aria-labelledby="dup-review-title">
      <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 id="dup-review-title" className="section-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.flag size={14} /> {t("dupReviewTitle", { defaultValue: "Possible duplicates" })}
        </h2>
        <span className="hint" style={{ margin: 0 }}>
          {t("dupReviewCount", { defaultValue: "{{n}} group(s) need review", n: groups.length })}
        </span>
      </div>
      <p className="hint" style={{ margin: "4px 0 10px" }}>
        {t("dupReviewBlurb", { defaultValue: "These reports may describe the same incident. Nothing is merged automatically." })}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {shown.map((group) => (
          <li key={group.id} className="dup-group" style={{ borderTop: "1px solid var(--c-border)", padding: "10px 0" }}>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {group.members.map((m) => (
                <Link key={m.id} to={`/incidents/${m.id}`} className="dup-ref">
                  {m.humanReference}
                </Link>
              ))}
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {group.signals.map((sig) => (
                <span key={sig} className="chip">{sig}</span>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/incidents/${group.members[0]!.id}`)}
              >
                {t("dupCompare", { defaultValue: "Compare {{n}} reports", n: group.members.length })}
              </button>
              {onViewOnMap && (
                <button className="btn btn-quiet btn-sm" onClick={() => onViewOnMap(group)}>
                  {t("dupViewMap", { defaultValue: "View on map" })}
                </button>
              )}
              <span className="hint" style={{ margin: 0 }}>
                {t("dupOldest", { defaultValue: "Oldest" })}: {relativeTime(group.members[0]!.occurredAt ?? group.members[0]!.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {groups.length > 3 && (
        <button className="btn btn-quiet btn-sm" style={{ marginTop: 8 }} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? t("dupShowLess", { defaultValue: "Show fewer" })
            : t("dupShowAll", { defaultValue: "Show all {{n}} groups", n: groups.length })}
        </button>
      )}
    </section>
  );
}
