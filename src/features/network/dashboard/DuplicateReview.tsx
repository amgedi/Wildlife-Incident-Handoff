/**
 * Duplicate Review V6 (0.3.0-dev.6, Part IX): a real review workflow, not a
 * debug panel.
 *
 * - Collapsed (dashboard): one compact summary line + [Review].
 * - Expanded: each group renders as side-by-side report comparison cards
 *   (ref, time, concern, location, status) with the shared signals between
 *   them and plain-language confidence ("Strong candidate" — never
 *   scientific/fraud wording).
 * - Actions: Not duplicates / Mark related persist locally per group and
 *   remove it from the queue; Compare opens the primary record; View on map.
 * - Nothing is ever merged automatically (unchanged rule).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../components/Icons";
import { relativeTime } from "../../../utils/time";
import { getSetting, setSetting } from "../../../storage/repositories";
import { STATUS_REGISTRY, statusColor } from "../../incidents/statusRegistry";
import { animalLabel } from "../../export/exportService";
import type { DuplicateCandidate } from "../networkService";
import { groupDuplicateCandidates, type DuplicateGroup } from "../duplicateGroups";
import type { Incident } from "../../../types/incident";

const DECISIONS_KEY = "duplicate-review-decisions";

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
  const [reviewing, setReviewing] = useState(false);
  const [decided, setDecided] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getSetting<string[]>(DECISIONS_KEY).then((d) => setDecided(new Set(d ?? [])));
  }, []);

  const groups = useMemo(() => groupDuplicateCandidates(pairs, incidentsById), [pairs, incidentsById]);
  const open = useMemo(() => groups.filter((g) => !decided.has(g.id)), [groups, decided]);

  const decide = async (groupId: string) => {
    const next = new Set(decided);
    next.add(groupId);
    setDecided(next);
    await setSetting(DECISIONS_KEY, [...next]);
  };

  if (open.length === 0) return null;

  if (!reviewing) {
    return (
      <section className="card dup6-summary" data-testid="duplicate-review" aria-labelledby="dup6-title">
        <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
          <span id="dup6-title" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Icons.flag size={15} />
            {t("dup6Summary", {
              defaultValue: "{{n}} duplicate group(s) may describe the same event",
              n: open.length,
            })}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setReviewing(true)}>
            {t("dup6Review", { defaultValue: "Review" })}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card dup6" data-testid="duplicate-review" aria-labelledby="dup6-title">
      <div className="row between" style={{ flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        <h2 id="dup6-title" style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.flag size={15} /> {t("dup6Title", { defaultValue: "Possible duplicate review" })}
        </h2>
        <button className="btn btn-quiet btn-sm" onClick={() => setReviewing(false)}>
          {t("dup6Collapse", { defaultValue: "Collapse" })}
        </button>
      </div>
      <p className="hint" style={{ margin: "0 0 10px" }}>
        {t("dup6Blurb", { defaultValue: "Reports that may describe the same event. Review and decide — nothing is merged automatically, and signals are never accusations." })}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
        {open.slice(0, 4).map((group) => (
          <DuplicateGroupCard key={group.id} group={group} onDecide={decide} onViewOnMap={onViewOnMap} onOpen={(id) => navigate(`/incidents/${id}`)} />
        ))}
      </ul>
      {open.length > 4 && (
        <p className="hint" style={{ margin: "8px 0 0" }}>
          {t("dup6More", { defaultValue: "{{n}} more groups after these.", n: open.length - 4 })}
        </p>
      )}
    </section>
  );
}

function confidenceLabel(count: number): { label: string; key: string; defaultValue: string } {
  if (count >= 3) return { label: "", key: "dup6Strong", defaultValue: "Strong candidate" };
  if (count === 2) return { label: "", key: "dup6Moderate", defaultValue: "Worth reviewing" };
  return { label: "", key: "dup6Weak", defaultValue: "Weak signals" };
}

function DuplicateGroupCard({
  group,
  onDecide,
  onViewOnMap,
  onOpen,
}: {
  group: DuplicateGroup;
  onDecide: (id: string) => void;
  onViewOnMap?: (group: DuplicateGroup) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("professional");
  const conf = confidenceLabel(group.signals.length + (group.members.length > 2 ? 1 : 0));
  return (
    <li className="dup6-group">
      <div className="row between" style={{ flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <span className="dup6-confidence" data-strength={group.strength > 2 ? "strong" : "normal"}>
          {t(conf.key, { defaultValue: conf.defaultValue })}
        </span>
        <span className="hint" style={{ margin: 0 }}>
          {t("dup6Oldest", { defaultValue: "Oldest" })}: {relativeTime(group.members[0]!.occurredAt ?? group.members[0]!.createdAt)}
        </span>
      </div>
      <div className="dup6-compare">
        {group.members.slice(0, 3).map((m, idx) => (
          <div className="dup6-report" key={m.id}>
            <span className="dup6-report-label">
              {t("dup6Report", { defaultValue: "Report {{letter}}", letter: String.fromCharCode(65 + idx) })}
            </span>
            <button className="dup6-report-ref" onClick={() => onOpen(m.id)}>{m.humanReference}</button>
            <span className="dup6-report-row">{relativeTime(m.occurredAt ?? m.createdAt)}</span>
            <span className="dup6-report-row">{animalLabel(m)}</span>
            {m.location.description && <span className="dup6-report-row dup6-loc">{m.location.description}</span>}
            <span className="dup6-report-status" style={{ color: statusColor(m.status) }}>
              {STATUS_REGISTRY[m.status]?.glyph} {STATUS_REGISTRY[m.status]?.label ?? m.status}
            </span>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        {group.signals.map((sig) => (
          <span key={sig} className="chip">{sig}</span>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => void onDecide(group.id)}>
          {t("dup6NotDuplicates", { defaultValue: "Not duplicates" })}
        </button>
        <button className="btn btn-quiet btn-sm" onClick={() => void onDecide(group.id)}>
          {t("dup6MarkRelated", { defaultValue: "Mark related" })}
        </button>
        {onViewOnMap && (
          <button className="btn btn-quiet btn-sm" onClick={() => onViewOnMap(group)}>
            {t("dup6ViewMap", { defaultValue: "View on map" })}
          </button>
        )}
        <button className="btn btn-quiet btn-sm" onClick={() => onOpen(group.members[0]!.id)}>
          {t("dup6OpenIncidents", { defaultValue: "Open incidents" })}
        </button>
      </div>
    </li>
  );
}
