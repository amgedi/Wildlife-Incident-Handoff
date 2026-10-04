/** Incident details tab: full record + safe corrections with preserved history. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Incident } from "../../../types/incident";
import { SectionHeading, TextField } from "../../../components/ui";
import { Dialog } from "../../../components/Dialog";
import { Icons } from "../../../components/Icons";
import { useApp } from "../../../app/AppContext";
import { correctField } from "../../../storage/incidentService";
import { ANIMAL_GROUPS, INCIDENT_TYPES, LIFE_STAGES, LOCATION_PRECISIONS, SEXES, labelFor } from "../labels";
import { correctionField, type CorrectionField, type CorrectionFieldKey } from "../correctionFields";
import { formatDateTime } from "../../../utils/time";

export function DetailsTab({ incident, onChanged }: { incident: Incident; onChanged: () => void }) {
  const { showToast } = useApp();
  const { t } = useTranslation("reports");
  const [editField, setEditField] = useState<null | { field: CorrectionField; current: string }>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");

  const corrections = incident.timeline.filter((e) => e.eventType === "field_corrected");

  /** Open the correction dialog from the registry — the label, placeholder and
   *  help text come from the field's own metadata, never a generic template. */
  const openCorrection = (key: CorrectionFieldKey, current: string) => {
    const field = correctionField(key);
    if (!field || !field.wired) return;
    setEditField({ field, current });
    setEditValue(current);
    setEditReason("");
  };

  const label = (field: CorrectionField) =>
    t(`${field.i18nKey}_label`, { defaultValue: field.displayName, ns: "reports" });

  return (
    <div className="stack">
      <div className="card">
        <SectionHeading help="The current values of every recorded field. Corrections never erase history — the original value stays on the timeline.">
          Incident details
        </SectionHeading>
        <dl className="kv">
          <dt>Reference</dt><dd><code>{incident.humanReference}</code></dd>
          <dt>Created</dt><dd>{formatDateTime(incident.createdAt)}</dd>
          <dt>Incident type</dt>
          <dd>
            {incident.incidentType ? labelFor(INCIDENT_TYPES, incident.incidentType) : <span className="unknown-chip">Unknown</span>}
          </dd>
          <dt>Found</dt><dd>{incident.occurredAt ? formatDateTime(incident.occurredAt) : "Unknown"}</dd>
          <dt>What happened</dt>
          <dd style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ whiteSpace: "pre-wrap" }}>{incident.summary ?? <span className="unknown-chip">Not recorded</span>}</span>
            <button className="btn btn-quiet btn-sm" onClick={() => openCorrection("summary", incident.summary ?? "")}>
              <Icons.edit size={13} /> Correct
            </button>
          </dd>
          <dt>Species</dt>
          <dd style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span>
              {incident.animal.species
                ? <>{incident.animal.species} <span className="tag">unconfirmed — as reported</span></>
                : <span className="unknown-chip">Unknown</span>}
            </span>
            <button className="btn btn-quiet btn-sm" onClick={() => openCorrection("species", incident.animal.species ?? "")}>
              <Icons.edit size={13} /> {incident.animal.species ? "Correct" : "Identify"}
            </button>
          </dd>
          <dt>Animal description</dt>
          <dd style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span>{incident.animal.description ?? <span className="unknown-chip">Not provided</span>}</span>
            <button className="btn btn-quiet btn-sm" onClick={() => openCorrection("description", incident.animal.description ?? "")}>
              <Icons.edit size={13} /> Correct
            </button>
          </dd>
          <dt>Animal group</dt><dd>{incident.animal.group ? labelFor(ANIMAL_GROUPS, incident.animal.group) : "Unknown"}</dd>
          <dt>Life stage</dt><dd>{incident.animal.lifeStage ? labelFor(LIFE_STAGES, incident.animal.lifeStage) : "Unknown"}</dd>
          <dt>Sex</dt><dd>{incident.animal.sex ? labelFor(SEXES, incident.animal.sex) : "Not recorded"}</dd>
          <dt>Number</dt><dd>{incident.animal.count ?? "Unknown"}</dd>
          <dt>Location</dt>
          <dd style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span>
              {incident.location.description ?? "Not recorded"}
              {incident.location.landmark ? ` — near ${incident.location.landmark}` : ""}
              {incident.location.address ? `, ${incident.location.address}` : ""}
            </span>
            <button className="btn btn-quiet btn-sm" onClick={() => openCorrection("locationDescription", incident.location.description ?? "")}>
              <Icons.edit size={13} /> Correct
            </button>
          </dd>
          <dt>Location precision</dt>
          <dd>{incident.location.precision ? labelFor(LOCATION_PRECISIONS, incident.location.precision) : "Unknown"}</dd>
          <dt>Coordinates</dt>
          <dd>
            {incident.location.latitude != null && incident.location.longitude != null
              ? `${incident.location.latitude.toFixed(5)}, ${incident.location.longitude.toFixed(5)}`
              : <span className="unknown-chip">Not recorded</span>}
          </dd>
          <dt>Tags</dt>
          <dd>{incident.tags.length > 0 ? incident.tags.map((tg) => <span key={tg} className="tag" style={{ marginRight: 6 }}>{tg}</span>) : "None"}</dd>
        </dl>
      </div>

      <div className="card">
        <h3>Correction history</h3>
        {corrections.length === 0 ? (
          <p style={{ color: "var(--c-ink-faint)" }}>No corrections recorded. If a field is ever wrong, correct it here — the original entry stays visible in the timeline.</p>
        ) : (
          <ul style={{ paddingLeft: 20 }}>
            {corrections.map((c) => (
              <li key={c.eventId} style={{ marginBottom: 8 }}>
                <strong>{c.summary}</strong> — {formatDateTime(c.timestamp)}
                <div style={{ fontSize: "0.88rem", color: "var(--c-ink-soft)" }}>
                  Original: “{c.metadata?.previousValue}” → New: “{c.metadata?.newValue}”
                </div>
                {c.details && <div style={{ fontSize: "0.85rem" }}>Reason: {c.details}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={editField !== null}
        title={editField ? t("correctionDialogTitle", { defaultValue: "Correct {{field}}", field: label(editField.field) }) : ""}
        onClose={() => setEditField(null)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setEditField(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (editField) {
                  await correctField(incident, editField.field.key as Parameters<typeof correctField>[1], editValue, editReason || null);
                  showToast("Corrected — original value preserved in history");
                }
                setEditField(null);
                onChanged();
              }}
            >
              Save correction
            </button>
          </>
        }
      >
        {editField && (
          <>
            {editField.field.inputType === "select" ? (
              <div className="field">
                <label htmlFor="correction-value">{editField.field.inputLabel}</label>
                <select
                  id="correction-value"
                  className="input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                >
                  {editField.field.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {editField.field.helpText && <p className="hint">{t(`${editField.field.i18nKey}_help`, { defaultValue: editField.field.helpText })}</p>}
              </div>
            ) : (
              <TextField
                label={t(`${editField.field.i18nKey}_input`, { defaultValue: editField.field.inputLabel })}
                value={editValue}
                onChange={setEditValue}
                multiline={editField.field.inputType === "textarea"}
                type={editField.field.inputType === "number" ? "number" : "text"}
                placeholder={editField.field.placeholder ? t(`${editField.field.i18nKey}_placeholder`, { defaultValue: editField.field.placeholder }) : undefined}
                hint={editField.field.helpText ? t(`${editField.field.i18nKey}_help`, { defaultValue: editField.field.helpText }) : undefined}
              />
            )}
            <div
              data-testid="correction-preview"
              className="notice"
              style={{ fontSize: "0.88rem", margin: "var(--space-3) 0" }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {t("correctionPreview", { defaultValue: "Current → Proposed" })}
              </div>
              <span>
                <strong>{label(editField.field)}:</strong>{" "}
                “{editField.current || t("correctionEmpty", { defaultValue: "(empty)" })}” → “{editValue || t("correctionEmpty", { defaultValue: "(empty)" })}”
              </span>
            </div>
            {editField.field.privacyNote && (
              <p style={{ fontSize: "0.85rem", color: "var(--c-ink-faint)" }}>
                {t(`${editField.field.i18nKey}_privacy`, { defaultValue: editField.field.privacyNote })}
              </p>
            )}
            <p style={{ fontSize: "0.85rem", color: "var(--c-ink-faint)" }}>
              {t("correctionCurrentLabel", { defaultValue: "Current {{field}}:", field: label(editField.field) })} “{editField.current || t("correctionEmpty", { defaultValue: "(empty)" })}”
            </p>
            <TextField
              label={t("correctionReason", { defaultValue: "Reason for correction" })}
              value={editReason}
              onChange={setEditReason}
              optional
              placeholder={t(`${editField.field.i18nKey}_reasonExample`, { defaultValue: `e.g. ${editField.field.reasonExample}` })}
            />
          </>
        )}
      </Dialog>
    </div>
  );
}
