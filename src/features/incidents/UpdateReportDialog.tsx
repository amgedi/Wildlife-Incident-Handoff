
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../components/Dialog";
import { addNote } from "../../storage/incidentService";
import { useApp } from "../../app/AppContext";
import type { Incident } from "../../types/incident";

const UPDATE_TYPES = [
  { key: "updateAnimalStillHere", event: "updateEventStillHere" },
  { key: "updateAnimalMoved", event: "updateEventMoved" },
  { key: "updateAnimalGone", event: "updateEventGone" },
  { key: "updateConditionChanged", event: "updateEventCondition" },
  { key: "updateResponderContacted", event: "updateEventResponder" },
  { key: "updateOther", event: "updateEventOther" },
] as const;

/** Reporter-facing quick updates. Every update is an appended timeline
 *  event (note_added) — previous history is never overwritten. */
export function UpdateReportDialog({
  incident, open, onClose, onChanged,
}: {
  incident: Incident;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { settings } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function submit() {
    if (!selected) return;
    const type = UPDATE_TYPES.find((u) => u.key === selected)!;
    const text = [t(`reports:${type.event}`), note.trim()].filter(Boolean).join(" — ");
    await addNote(incident, { kind: "incident_record", text, createdBy: settings.displayName || null });
    onClose();
    setSelected(null);
    setNote("");
    onChanged();
  }

  return (
    <Dialog
      open={open}
      title={t("reports:updateTitle")}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t("cancel")}</button>
          <button className="btn btn-primary" disabled={!selected} onClick={() => void submit()}>{t("save")}</button>
        </>
      }
    >
      <div className="chip-row" role="radiogroup" aria-label={t("reports:updateTitle")}>
        {UPDATE_TYPES.map((u) => (
          <button key={u.key} className="chip" role="radio" aria-checked={selected === u.key} onClick={() => setSelected(u.key)}>
            {t(`reports:${u.key}`)}
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: "var(--space-3)" }}>
        <label htmlFor="update-note">{t("reports:updateNotePlaceholder")}</label>
        <textarea id="update-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="hint">{t("reports:deleteBackupHint")}</p>
      </div>
    </Dialog>
  );
}
