/** Overview tab: what happened, what's happening now, what needs attention, custody, latest update. */
import { useState } from "react";
import type { Incident } from "../../../types/incident";
import { Icons } from "../../../components/Icons";
import { StatusBadge, ContextHelp } from "../../../components/ui";
import { Dialog } from "../../../components/Dialog";
import { Select } from "../../../components/Select";
import { TextField } from "../../../components/ui";
import { changeStatus, closeIncident, reopenIncident, updateCurrentLocation } from "../../../storage/incidentService";
import { useApp } from "../../../app/AppContext";
import { ANIMAL_LOCATIONS, STATUS_LABELS_BY_KEY, URGENCIES, HAZARDS, labelFor } from "../labels";
import { formatDateTime, relativeTime } from "../../../utils/time";
import type { AnimalLocation, IncidentStatus } from "../../../types/incident";

const CLOSE_OUTCOMES = [
  "Released",
  "Transferred elsewhere",
  "Remains in care",
  "Deceased",
  "Unable to determine",
  "Other",
];

export function OverviewTab({ incident, onChanged }: { incident: Incident; onChanged: () => void }) {
  const { showToast } = useApp();
  const [nextStepOpen, setNextStepOpen] = useState(false);
  const [nextStepValue, setNextStepValue] = useState(incident.nextStep ?? "");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locValue, setLocValue] = useState<AnimalLocation | null>(incident.animalNow);
  const [locDesc, setLocDesc] = useState(incident.animalNowDescription ?? "");
  const [closeOpen, setCloseOpen] = useState(false);
  const [outcome, setOutcome] = useState(CLOSE_OUTCOMES[0]!);
  const [finalNotes, setFinalNotes] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusValue, setStatusValue] = useState<IncidentStatus | null>(null);

  const sorted = [...incident.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = sorted[0];
  const currentCustody = incident.custody.filter((c) => !c.endedAt).at(-1);
  const isClosed = incident.status === "closed";

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          What's happening now <ContextHelp text="The overview answers: what happened, what is happening now, who has the animal, and what needs attention next." />
        </h2>
        <dl className="kv">
          <dt>Status</dt>
          <dd><StatusBadge status={incident.status} /></dd>
          <dt>Current custody</dt>
          <dd>
            {currentCustody ? (
              <>
                {currentCustody.holder}
                {currentCustody.holderRole ? ` (${currentCustody.holderRole})` : ""} — since {formatDateTime(currentCustody.startedAt)}
              </>
            ) : (
              <span className="unknown-chip">No custody recorded</span>
            )}
          </dd>
          <dt>Animal now</dt>
          <dd>
            {incident.animalNow ? (
              <>
                {labelFor(ANIMAL_LOCATIONS, incident.animalNow)}
                <button className="btn btn-quiet btn-sm" onClick={() => setLocationOpen(true)} style={{ marginLeft: 8 }}>
                  <Icons.edit size={13} /> Update
                </button>
              </>
            ) : (
              <>
                <span className="unknown-chip">Unknown</span>
                <button className="btn btn-quiet btn-sm" onClick={() => setLocationOpen(true)} style={{ marginLeft: 8 }}>
                  <Icons.edit size={13} /> Record
                </button>
              </>
            )}
            {incident.animalNowDescription && <div style={{ color: "var(--c-ink-soft)", fontSize: "0.88rem" }}>{incident.animalNowDescription}</div>}
          </dd>
          <dt>Next step</dt>
          <dd>
            {incident.nextStep ?? <span className="unknown-chip">Not set</span>}
            <button className="btn btn-quiet btn-sm" onClick={() => { setNextStepValue(incident.nextStep ?? ""); setNextStepOpen(true); }} style={{ marginLeft: 8 }}>
              <Icons.edit size={13} /> {incident.nextStep ? "Correct" : "Set"}
            </button>
          </dd>
        </dl>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>What happened?</h3>
          {incident.summary ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{incident.summary}</p>
          ) : (
            <p><span className="unknown-chip">Not recorded</span></p>
          )}
          <dl className="kv">
            <dt>Type</dt><dd>{incident.incidentType ? incidentTypeLabel(incident.incidentType) : "Unknown"}</dd>
            <dt>Urgency</dt><dd>{incident.urgency ? labelFor(URGENCIES, incident.urgency) : <span className="unknown-chip">Unknown</span>}</dd>
            <dt>Hazards</dt>
            <dd>
              {incident.hazards && incident.hazards.hazards.length > 0
                ? incident.hazards.hazards.map((h) => labelFor(HAZARDS, h)).join(", ")
                : <span className="unknown-chip">Unknown</span>}
            </dd>
          </dl>
        </div>
        <div className="card">
          <h3>Latest update</h3>
          {latest ? (
            <>
              <p style={{ fontWeight: 600 }}>{latest.summary}</p>
              {latest.details && <p style={{ whiteSpace: "pre-wrap", color: "var(--c-ink-soft)" }}>{latest.details}</p>}
              <p style={{ color: "var(--c-ink-faint)", fontSize: "0.82rem" }}>{formatDateTime(latest.timestamp)} · {relativeTime(latest.timestamp)}</p>
            </>
          ) : (
            <p><span className="unknown-chip">No updates yet</span></p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Case actions</h3>
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={() => { setStatusValue(null); setStatusOpen(true); }}>
            <Icons.edit size={14} /> Change status
          </button>
          {!isClosed ? (
            <button className="btn btn-secondary btn-sm" onClick={() => setCloseOpen(true)}>
              <Icons.check size={14} /> Close incident
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                await reopenIncident(incident);
                showToast("Incident reopened — closure history preserved");
                onChanged();
              }}
            >
              <Icons.undo size={14} /> Reopen incident
            </button>
          )}
        </div>
        <p style={{ color: "var(--c-ink-faint)", fontSize: "0.82rem", margin: "var(--space-3) 0 0" }}>
          Closing asks for an outcome and keeps the full history. Closed incidents remain searchable.
        </p>
      </div>

      {/* Next step correction dialog */}
      <Dialog
        open={nextStepOpen}
        title={incident.nextStep ? "Correct next step" : "Set next step"}
        onClose={() => setNextStepOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setNextStepOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                const { correctField } = await import("../../../storage/incidentService");
                await correctField(incident, "nextStep", nextStepValue, null);
                showToast("Next step saved — previous value kept in history");
                setNextStepOpen(false);
                onChanged();
              }}
            >
              Save
            </button>
          </>
        }
      >
        <TextField label="Next step" multiline rows={3} value={nextStepValue} onChange={setNextStepValue} optional placeholder="e.g. Waiting for receiving rehabilitation facility" />
        {incident.nextStep && (
          <p style={{ fontSize: "0.85rem", color: "var(--c-ink-faint)" }}>Current value: “{incident.nextStep}”. The previous value will remain visible in the timeline.</p>
        )}
      </Dialog>

      {/* Animal location dialog */}
      <Dialog
        open={locationOpen}
        title="Where is the animal now?"
        onClose={() => setLocationOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setLocationOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                await updateCurrentLocation(incident, locValue, locDesc || null);
                showToast("Animal location updated");
                setLocationOpen(false);
                onChanged();
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Select label="Location" value={locValue} options={ANIMAL_LOCATIONS} onChange={(v) => setLocValue(v as AnimalLocation)} optional />
        <TextField label="Detail" value={locDesc} onChange={setLocDesc} optional multiline rows={2} placeholder="e.g. Ventilated transport container" />
      </Dialog>

      {/* Close dialog */}
      <Dialog
        open={closeOpen}
        title="Close incident"
        onClose={() => setCloseOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setCloseOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                await closeIncident(incident, outcome, finalNotes || null);
                showToast("Incident closed");
                setCloseOpen(false);
                onChanged();
              }}
            >
              Close incident
            </button>
          </>
        }
      >
        <Select label="Outcome" value={outcome} options={CLOSE_OUTCOMES.map((o) => ({ value: o, label: o }))} onChange={setOutcome} />
        <TextField label="Final notes" multiline rows={3} value={finalNotes} onChange={setFinalNotes} optional />
        <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem" }}>You can reopen the incident later; the closure stays in the timeline.</p>
      </Dialog>

      {/* Status dialog (duplicate entry point) */}
      <Dialog
        open={statusOpen}
        title="Change status"
        onClose={() => setStatusOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setStatusOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!statusValue}
              onClick={async () => {
                if (statusValue) {
                  await changeStatus(incident, statusValue);
                  showToast(`Status changed to ${STATUS_LABELS_BY_KEY[statusValue]}`);
                }
                setStatusOpen(false);
                onChanged();
              }}
            >
              Save status
            </button>
          </>
        }
      >
        <Select
          label="New status"
          value={statusValue}
          options={Object.entries(STATUS_LABELS_BY_KEY).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setStatusValue(v as IncidentStatus)}
          hint={`Current status: ${STATUS_LABELS_BY_KEY[incident.status]}`}
        />
      </Dialog>
    </div>
  );
}

function incidentTypeLabel(t: string): string {
  const map: Record<string, string> = {
    injured_wildlife: "Injured wildlife",
    sick_unusual: "Sick / unusual behavior",
    orphaned_young: "Orphaned / separated young",
    trapped_entangled: "Trapped / entangled",
    collision: "Collision",
    hazardous_location: "Wildlife in hazardous location",
    dead_wildlife: "Dead wildlife",
    human_wildlife_conflict: "Human-wildlife conflict",
    other: "Other",
    not_sure: "Not sure",
  };
  return map[t] ?? t;
}
