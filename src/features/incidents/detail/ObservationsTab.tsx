/** Observations tab: append new observations over time; never overwrite earlier ones. */
import { useState } from "react";
import type { Incident, ObservationCategory } from "../../../types/incident";
import { SectionHeading } from "../../../components/ui";
import { Select } from "../../../components/Select";
import { TextField, ContextHelp } from "../../../components/ui";
import { Dialog } from "../../../components/Dialog";
import { OBSERVATION_CATEGORIES, labelFor, URGENCIES } from "../labels";
import { addObservation, changeStatus } from "../../../storage/incidentService";
import { useApp } from "../../../app/AppContext";
import { formatDateTime } from "../../../utils/time";
import { Icons } from "../../../components/Icons";

export function ObservationsTab({ incident, onChanged }: { incident: Incident; onChanged: () => void }) {
  const { showToast, settings } = useApp();
  const [category, setCategory] = useState<ObservationCategory>("behavior");
  const [text, setText] = useState("");
  const [urgencyOpen, setUrgencyOpen] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    await addObservation(incident, { category, text: text.trim(), recordedBy: settings.displayName || null }, settings.displayName || null);
    setText("");
    showToast("Observation added");
    onChanged();
  }

  return (
    <div className="stack">
      <div className="card">
        <SectionHeading help="Record what you saw rather than guessing the diagnosis. New observations are appended to the timeline — earlier ones stay untouched.">
          Observations
        </SectionHeading>
        {incident.observations.length === 0 ? (
          <p><span className="unknown-chip">No observations recorded yet</span></p>
        ) : (
          <div className="stack">
            {[...incident.observations].reverse().map((o) => (
              <div key={o.id} style={{ borderLeft: "3px solid var(--c-primary)", paddingLeft: 12 }}>
                <div style={{ fontSize: "0.78rem", color: "var(--c-ink-faint)" }}>
                  {formatDateTime(o.recordedAt)} · {labelFor(OBSERVATION_CATEGORIES, o.category)}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{o.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Add observation</h3>
        <div className="notice" style={{ marginBottom: "var(--space-3)" }}>
          <Icons.eye size={18} />
          <span>Describe what you can <strong>see</strong> — “right wing hangs lower”, not “broken wing” — unless a professional confirmed the diagnosis.</span>
        </div>
        <Select label="Category" value={category} options={OBSERVATION_CATEGORIES} onChange={(v) => setCategory(v as ObservationCategory)} />
        <TextField label="Observation" multiline value={text} onChange={setText} placeholder="What did you observe?" />
        <button className="btn btn-primary" onClick={submit} disabled={!text.trim()}>
          <Icons.plus size={16} /> Add observation
        </button>
      </div>

      <div className="card">
        <h3>Observed condition</h3>
        <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem" }}>
          {incident.urgency ? labelFor(URGENCIES, incident.urgency) : "Not recorded"}
          {" "}<ContextHelp text="Descriptive urgency — what you observed, never a veterinary assessment." />
        </p>
        <button className="btn btn-secondary btn-sm" onClick={() => setUrgencyOpen(true)}>
          <Icons.edit size={14} /> {incident.urgency ? "Update" : "Record condition"}
        </button>
      </div>

      <ConditionDialog incident={incident} open={urgencyOpen} onClose={() => setUrgencyOpen(false)} onChanged={onChanged} />
    </div>
  );
}

function ConditionDialog({ incident, open, onClose, onChanged }: { incident: Incident; open: boolean; onClose: () => void; onChanged: () => void }) {
  const { showToast } = useApp();
  const [value, setValue] = useState(incident.urgency);
  return (
    <Dialog
      open={open}
      title="Observed condition"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (value && value !== incident.urgency) {
                await changeStatus(incident, incident.status, null, `Observed condition updated: ${labelFor(URGENCIES, value)}`);
                const { putIncident } = await import("../../../storage/repositories");
                await putIncident({ ...incident, urgency: value });
                showToast("Observed condition updated");
              }
              onClose();
              onChanged();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <Select
        label="Condition (descriptive, observational)"
        value={value}
        options={URGENCIES}
        onChange={(v) => setValue(v as typeof incident.urgency)}
        hint="This is not medical triage and does not imply veterinary assessment."
      />
    </Dialog>
  );
}
