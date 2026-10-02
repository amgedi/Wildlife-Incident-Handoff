/** People & handoffs tab: contacts, transfer/handoff workflow, custody history. */
import { useState } from "react";
import type { Handoff, HandoffItem, Incident } from "../../../types/incident";
import { SectionHeading, TextField } from "../../../components/ui";
import { Select } from "../../../components/Select";
import { Dialog } from "../../../components/Dialog";
import { Icons } from "../../../components/Icons";
import { useApp } from "../../../app/AppContext";
import { addContact, recordHandoff } from "../../../storage/incidentService";
import { HANDOFF_ITEM_SUGGESTIONS } from "../labels";
import { formatDateTime, isoToLocalInput, localInputToIso, nowIso } from "../../../utils/time";
import { cleanText } from "../../../utils/text";

export function PeopleTab({ incident, onChanged }: { incident: Incident; onChanged: () => void }) {
  const { showToast, settings } = useApp();
  const [contactOpen, setContactOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const currentCustody = incident.custody.filter((c) => !c.endedAt).at(-1);

  return (
    <div className="stack">
      <div className="card">
        <SectionHeading help="This shows who currently has responsibility for the animal, and every previous transfer.">
          Custody history
        </SectionHeading>
        <CustodyChain incident={incident} />
        {currentCustody && (
          <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem", marginTop: "var(--space-3)" }}>
            Current: <strong>{currentCustody.holder}</strong>
            {currentCustody.holderRole ? ` (${currentCustody.holderRole})` : ""} — since {formatDateTime(currentCustody.startedAt)}
          </p>
        )}
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Transfers / handoffs</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setHandoffOpen(true)}>
            <Icons.handoff size={15} />
            Transfer / hand off incident
          </button>
        </div>
        {incident.handoffs.length === 0 ? (
          <p style={{ marginTop: "var(--space-3)" }}>
            <span className="unknown-chip">No handoffs recorded</span>
          </p>
        ) : (
          <div className="stack" style={{ marginTop: "var(--space-3)" }}>
            {[...incident.handoffs].reverse().map((h) => (
              <div key={h.id} style={{ border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                <div className="row between">
                  <strong>{h.fromParty || "Unknown"} → {h.toParty || "Unknown"}</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--c-ink-faint)" }}>{formatDateTime(h.occurredAt)}</span>
                </div>
                {h.toOrganization && <div style={{ fontSize: "0.88rem" }}>Receiving organization: {h.toOrganization}</div>}
                {h.receivingPerson && <div style={{ fontSize: "0.88rem" }}>Receiving person: {h.receivingPerson}</div>}
                {h.method && <div style={{ fontSize: "0.88rem" }}>Method: {h.method}</div>}
                {h.conditionNotes && <div style={{ fontSize: "0.88rem", color: "var(--c-ink-soft)" }}>Condition at handoff: {h.conditionNotes}</div>}
                {h.items.length > 0 && (
                  <div style={{ fontSize: "0.85rem", marginTop: 4 }}>
                    Items: {h.items.filter((i) => i.included).map((i) => i.label).join(", ")}
                  </div>
                )}
                {h.notes && <div style={{ fontSize: "0.85rem", color: "var(--c-ink-soft)" }}>{h.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Contacts</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setContactOpen(true)}>
            <Icons.plus size={15} /> Add contact
          </button>
        </div>
        {incident.contacts.length === 0 ? (
          <p style={{ marginTop: "var(--space-3)" }}><span className="unknown-chip">No contacts recorded</span></p>
        ) : (
          <div className="stack" style={{ marginTop: "var(--space-3)" }}>
            {incident.contacts.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--c-border)", paddingBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>{c.role.replaceAll("_", " ")}</strong>
                  {c.name && <div>{c.name}</div>}
                  {c.organization && <div style={{ color: "var(--c-ink-soft)" }}>{c.organization}</div>}
                </div>
                <div style={{ textAlign: "right", fontSize: "0.88rem" }}>
                  {c.phone && <div>{c.phone}</div>}
                  {c.email && <div>{c.email}</div>}
                  {c.markedPrivate && <span className="tag">private</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddContactDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        onSubmit={async (contact) => {
          await addContact(incident, contact, settings.displayName || null);
          showToast("Contact added");
          setContactOpen(false);
          onChanged();
        }}
      />

      {handoffOpen && (
        <HandoffDialog
          incident={incident}
          onClose={() => setHandoffOpen(false)}
          onSubmit={async (handoff) => {
            await recordHandoff(incident, handoff, settings.displayName || null);
            showToast("Handoff recorded");
            setHandoffOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function CustodyChain({ incident }: { incident: Incident }) {
  if (incident.custody.length === 0) {
    return <p><span className="unknown-chip">No custody recorded yet</span> — record where the animal is now, or create a handoff.</p>;
  }
  return (
    <ol style={{ margin: 0, paddingLeft: 20 }}>
      {incident.custody.map((c) => (
        <li key={c.id} style={{ marginBottom: 6 }}>
          <strong>{c.holder}</strong>
          {c.holderRole ? ` (${c.holderRole})` : ""} — {formatDateTime(c.startedAt)}
          {c.endedAt ? ` until ${formatDateTime(c.endedAt)}` : " · current holder"}
        </li>
      ))}
    </ol>
  );
}

function AddContactDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (c: Omit<Incident["contacts"][number], "id">) => Promise<void>;
}) {
  const [role, setRole] = useState("finder");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  return (
    <Dialog
      open={open}
      title="Add contact"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() =>
              void onSubmit({
                role: role as "finder",
                name: cleanText(name) || null,
                organization: cleanText(organization) || null,
                phone: cleanText(phone) || null,
                email: cleanText(email) || null,
                preferredContactMethod: null,
                markedPrivate: true,
              })
            }
          >
            Add contact
          </button>
        </>
      }
    >
      <p style={{ color: "var(--c-ink-soft)", fontSize: "0.88rem" }}>
        Contact details are marked <span className="tag">private</span> and are excluded from shareable exports unless explicitly included.
      </p>
      <Select label="Role" value={role} onChange={setRole} options={[
        { value: "finder", label: "Finder" },
        { value: "responder", label: "Responder" },
        { value: "receiving_organization", label: "Receiving organization" },
        { value: "receiving_person", label: "Receiving person" },
        { value: "other", label: "Other" },
      ]} />
      <div className="grid-2">
        <TextField label="Name" value={name} onChange={setName} optional />
        <TextField label="Organization" value={organization} onChange={setOrganization} optional />
        <TextField label="Phone" type="tel" value={phone} onChange={setPhone} optional />
        <TextField label="Email" type="email" value={email} onChange={setEmail} optional />
      </div>
    </Dialog>
  );
}

function HandoffDialog({
  incident,
  onClose,
  onSubmit,
}: {
  incident: Incident;
  onClose: () => void;
  onSubmit: (h: Omit<Handoff, "id">) => Promise<void>;
}) {
  const currentCustody = incident.custody.filter((c) => !c.endedAt).at(-1);
  const [fromParty, setFromParty] = useState(currentCustody?.holder ?? "");
  const [toParty, setToParty] = useState("");
  const [toOrganization, setToOrganization] = useState("");
  const [receivingPerson, setReceivingPerson] = useState("");
  const [method, setMethod] = useState("");
  const [occurredAt, setOccurredAt] = useState(isoToLocalInput(nowIso()));
  const [conditionNotes, setConditionNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<HandoffItem[]>(HANDOFF_ITEM_SUGGESTIONS.map((label) => ({ label, included: label === "Animal" })));

  return (
    <Dialog
      open
      title="Transfer / hand off incident"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!cleanText(toParty)) return;
              void onSubmit({
                fromParty: cleanText(fromParty),
                toParty: cleanText(toParty),
                fromOrganization: null,
                toOrganization: cleanText(toOrganization) || null,
                receivingPerson: cleanText(receivingPerson) || null,
                method: cleanText(method) || null,
                occurredAt: localInputToIso(occurredAt) ?? nowIso(),
                conditionNotes: cleanText(conditionNotes) || null,
                items,
                notes: cleanText(notes) || null,
                completedAt: nowIso(),
                recordedBy: null,
              });
            }}
            disabled={!cleanText(toParty)}
          >
            Record handoff
          </button>
        </>
      }
    >
      <p style={{ color: "var(--c-ink-soft)", fontSize: "0.88rem" }}>
        This records the transfer of responsibility. The previous custody stays visible in history.
      </p>
      <div className="grid-2">
        <TextField label="From" value={fromParty} onChange={setFromParty} hint="Who has the animal now" />
        <TextField label="To" value={toParty} onChange={setToParty} hint="Who is receiving responsibility" />
        <TextField label="Receiving organization" value={toOrganization} onChange={setToOrganization} optional />
        <TextField label="Receiving person" value={receivingPerson} onChange={setReceivingPerson} optional />
      </div>
      <div className="grid-2">
        <TextField
          label="Date & time"
          type="datetime-local"
          value={occurredAt}
          onChange={(v) => setOccurredAt(v)}
        />
        <TextField label="Method" value={method} onChange={setMethod} optional placeholder="e.g. In person, by volunteer transport" />
      </div>
      <TextField label="Current condition / observations at handoff" multiline rows={2} value={conditionNotes} onChange={setConditionNotes} optional placeholder="Descriptive only — what the receiving person should expect to see." />
      <div className="field">
        <span style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>Items transferred</span>
        <div className="chip-row">
          {items.map((item, i) => (
            <button
              key={item.label}
              className="chip"
              aria-pressed={item.included}
              onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, included: !x.included } : x)))}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <TextField label="Notes" multiline rows={2} value={notes} onChange={setNotes} optional />
    </Dialog>
  );
}
