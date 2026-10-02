/**
 * Guided incident-creation wizard: 10 short steps, Back/Next navigation,
 * autosaved draft, and a review screen that distinguishes Known / Unknown /
 * Not provided. Unknown is always valid; nothing is required except the
 * review confirmation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp, useSaveStatus } from "../../app/AppContext";
import { Select } from "../../components/Select";
import { TextField } from "../../components/ui";
import { Icons } from "../../components/Icons";
import {
  ANIMAL_GROUPS, ANIMAL_LOCATIONS, HAZARDS, INCIDENT_TYPES, LIFE_STAGES,
  LOCATION_PRECISIONS, OBSERVATION_CATEGORIES, SEXES, URGENCIES,
} from "./labels";
import type {
  AnimalGroup, AnimalLocation, AttachmentMeta, Hazard, IncidentType,
  LifeStage, LocationPrecision, ObservationCategory, ObservedUrgency, Sex,
} from "../../types/incident";
import { deleteDraft, getDraft, saveDraft, putAttachmentBlob } from "../../storage/repositories";
import { createIncident } from "../../storage/incidentService";
import { isoToLocalInput, localInputToIso, nowIso } from "../../utils/time";
import { uuid } from "../../utils/id";
import { cleanText } from "../../utils/text";

const STEPS = [
  "What happened?",
  "The animal",
  "Where was it found?",
  "What did you observe?",
  "Anything dangerous?",
  "Already done",
  "Where is the animal now?",
  "Contacts",
  "Photos",
  "Review",
];

const SAFETY_NOTE =
  "Wildlife Incident Handoff records information — it is not medical or veterinary advice. Avoid unnecessary handling, keep people and pets away, and contact a licensed wildlife professional when needed.";

interface DraftState {
  occurredAt: string;
  incidentType: IncidentType | null;
  summary: string;
  animal: {
    group: AnimalGroup | null;
    species: string;
    count: string;
    lifeStage: LifeStage | null;
    sex: Sex | null;
    description: string;
  };
  location: {
    description: string;
    precision: LocationPrecision | null;
    landmark: string;
    address: string;
    lat: string;
    lon: string;
    notes: string;
  };
  urgency: ObservedUrgency | null;
  observations: { category: ObservationCategory; text: string }[];
  hazards: Hazard[];
  hazardNotes: string;
  actions: string[];
  actionNotes: string;
  animalNow: AnimalLocation | null;
  animalNowDescription: string;
  contacts: { role: string; name: string; organization: string; phone: string; email: string }[];
  photos: { meta: AttachmentMeta; blob: Blob }[];
  tags: string;
}

function emptyDraft(): DraftState {
  return {
    occurredAt: nowIso(),
    incidentType: null,
    summary: "",
    animal: { group: null, species: "", count: "", lifeStage: null, sex: null, description: "" },
    location: { description: "", precision: "approximate", landmark: "", address: "", lat: "", lon: "", notes: "" },
    urgency: null,
    observations: [],
    hazards: [],
    hazardNotes: "",
    actions: [],
    actionNotes: "",
    animalNow: null,
    animalNowDescription: "",
    contacts: [],
    photos: [],
    tags: "",
  };
}

const OBSERVATION_EXAMPLES_GOOD = [
  "unable to fly", "one wing hangs lower", "eyes closed most of the time",
  "moving slowly", "bleeding visible near leg", "tangled in fishing line",
  "calling repeatedly", "no visible movement",
];

const ACTION_SUGGESTIONS = [
  "Moved people away",
  "Contacted wildlife rescue",
  "Animal contained",
  "Animal moved away from immediate traffic danger",
  "Photos taken",
  "No action taken",
];

export function CreateIncidentPage() {
  const navigate = useNavigate();
  const { settings, showToast } = useApp();
  const { status: saveStatus, markSaving } = useSaveStatus();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<DraftState>(emptyDraft);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load existing draft if resuming.
  useEffect(() => {
    if (resumed) return;
    setResumed(true);
    if (searchParams.get("resume")) {
      getDraft("draft").then((d) => {
        if (d && d.data) {
          setState({ ...emptyDraft(), ...(d.data as DraftState) });
          setStep(Math.min(d.step ?? 0, STEPS.length - 1));
        }
      });
    }
  }, [resumed, searchParams]);

  // Autosave draft (debounced).
  useEffect(() => {
    if (!resumed) return;
    const timer = window.setTimeout(() => {
      void saveDraft({ id: "draft", step, data: stateRef.current, savedAt: nowIso() });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [state, step, resumed]);

  const update = useCallback(
    <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
      setState((s) => ({ ...s, [key]: value }));
      markSaving();
    },
    [markSaving]
  );

  const observationTexts = state.observations;
  const canContinue = true; // everything skippable; review enforces the one required confirmation

  const goNext = () => {
    if (step === 2) {
      // Validate coordinates if entered.
      const lat = parseFloat(state.location.lat);
      const lon = parseFloat(state.location.lon);
      if ((state.location.lat && !Number.isFinite(lat)) || (state.location.lon && !Number.isFinite(lon))) {
        setError("Coordinates must be numbers, e.g. 45.123 for latitude.");
        return;
      }
      if (state.location.lat && (lat < -90 || lat > 90)) {
        setError("Latitude must be between -90 and 90.");
        return;
      }
      if (state.location.lon && (lon < -180 || lon > 180)) {
        setError("Longitude must be between -180 and 180.");
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0 });
  };

  async function handleCreate() {
    const s = stateRef.current;
    const incidentData = {
      status: "reported" as const,
      incidentType: s.incidentType,
      occurredAt: localInputToIso(isoToLocalInput(s.occurredAt)) ?? s.occurredAt,
      urgency: s.urgency,
      summary: cleanText(s.summary) || null,
      nextStep: null,
      animal: {
        group: s.animal.group,
        species: cleanText(s.animal.species) || null,
        speciesConfirmed: false,
        count: s.animal.count ? parseInt(s.animal.count, 10) : null,
        lifeStage: s.animal.lifeStage,
        sex: s.animal.sex,
        description: cleanText(s.animal.description) || null,
      },
      location: {
        description: cleanText(s.location.description) || null,
        precision: s.location.precision,
        landmark: cleanText(s.location.landmark) || null,
        address: cleanText(s.location.address) || null,
        latitude: s.location.lat ? parseFloat(s.location.lat) : null,
        longitude: s.location.lon ? parseFloat(s.location.lon) : null,
        notes: cleanText(s.location.notes) || null,
      },
      observations: s.observations
        .filter((o) => cleanText(o.text))
        .map((o) => ({ id: uuid(), category: o.category, text: cleanText(o.text), recordedAt: nowIso(), recordedBy: settings.displayName || null })),
      hazards:
        s.hazards.length > 0 || cleanText(s.hazardNotes)
          ? { hazards: s.hazards, notes: cleanText(s.hazardNotes) || null, recordedAt: nowIso() }
          : null,
      actions: s.actions
        .map((a) => ({ id: uuid(), text: cleanText(a), recordedAt: nowIso(), recordedBy: settings.displayName || null }))
        .concat(cleanText(s.actionNotes) ? [{ id: uuid(), text: cleanText(s.actionNotes), recordedAt: nowIso(), recordedBy: settings.displayName || null }] : []),
      animalNow: s.animalNow,
      animalNowDescription: cleanText(s.animalNowDescription) || null,
      contacts: s.contacts
        .filter((c) => cleanText(c.name) || cleanText(c.organization) || cleanText(c.phone) || cleanText(c.email))
        .map((c) => ({
          id: uuid(),
          role: c.role as "finder",
          name: cleanText(c.name) || null,
          organization: cleanText(c.organization) || null,
          phone: cleanText(c.phone) || null,
          email: cleanText(c.email) || null,
          preferredContactMethod: null,
          markedPrivate: true,
        })),
      custody:
        s.animalNow === "with_finder" || s.animalNow === "with_responder" || s.animalNow === "rehab_facility" || s.animalNow === "vet_facility"
          ? [{
              id: uuid(),
              holder: s.animalNow === "with_finder" ? "Finder" : s.animalNow === "with_responder" ? "Responder" : s.animalNow === "rehab_facility" ? "Rehabilitation facility" : "Veterinary facility",
              holderRole: "",
              location: cleanText(s.animalNowDescription) || null,
              startedAt: nowIso(),
              endedAt: null,
              handoffId: null,
            }]
          : [],
      handoffs: [],
      attachments: s.photos.map((p) => p.meta),
      notes: [],
      tags: s.tags.split(",").map((t) => cleanText(t)).filter(Boolean),
      archivedAt: null,
      deletedAt: null,
      isDemo: false,
      actor: settings.displayName || null,
    };

    try {
      const incident = await createIncident(incidentData);
      for (const p of s.photos) {
        await putAttachmentBlob({ id: p.meta.id, incidentId: incident.id, fileName: p.meta.fileName, mimeType: p.meta.mimeType, byteSize: p.meta.byteSize, data: p.blob });
      }
      await deleteDraft("draft");
      showToast(`Incident ${incident.humanReference} created`);
      navigate(`/incidents/${incident.id}`);
    } catch (e) {
      setError("We couldn't save this incident, most likely because browser storage is full. Try exporting a backup first, then removing large photos.");
      showToast("Could not save incident");
    }
  }

  return (
    <main className="content" id="main-content" style={{ maxWidth: 760 }}>
      <div className="row between" style={{ marginBottom: "var(--space-2)" }}>
        <h1>Create incident</h1>
        <span className="save-status" role="status">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Draft saved" : ""}
        </span>
      </div>
      <p style={{ color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
        {STEPS[step]} — step {step + 1} of {STEPS.length}. Everything not marked required can be left out or left Unknown.
      </p>

      <div className="wizard-steps" role="tablist" aria-label="Wizard steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            className={`wizard-step-dot${i === step ? " current" : ""}${i < step ? " done" : ""}`}
            onClick={() => { setStep(i); window.scrollTo({ top: 0 }); }}
            aria-current={i === step ? "step" : undefined}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="card">
        {step === 0 && <StepWhatHappened state={state} update={update} />}
        {step === 1 && <StepAnimal state={state} update={update} detail={settings.detailLevel} />}
        {step === 2 && <StepLocation state={state} update={update} defaultPrecision={settings.defaultLocationPrecision} />}
        {step === 3 && <StepObservations state={state} update={update} observationTexts={observationTexts} />}
        {step === 4 && <StepHazards state={state} update={update} />}
        {step === 5 && <StepActions state={state} update={update} />}
        {step === 6 && <StepAnimalNow state={state} update={update} />}
        {step === 7 && <StepContacts state={state} update={update} />}
        {step === 8 && <StepPhotos state={state} update={update} showToast={showToast} />}
        {step === 9 && <StepReview state={state} />}
        {error && <p className="error-text" role="alert">{error}</p>}

        {step < 3 && <div className="notice" style={{ marginTop: "var(--space-4)" }}><Icons.info size={18} /><span>{SAFETY_NOTE}</span></div>}

        <div className="wizard-nav">
          <button className="btn btn-secondary" onClick={goBack} disabled={step === 0}>
            <Icons.chevronLeft size={16} />
            Back
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-quiet" onClick={() => { void deleteDraft("draft"); navigate("/"); }}>
              Cancel
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={goNext} disabled={!canContinue}>
                Next
                <Icons.chevronRight size={16} />
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={handleCreate}>
                <Icons.check size={18} />
                Create incident
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

type StepProps = { state: DraftState; update: <K extends keyof DraftState>(k: K, v: DraftState[K]) => void };

function StepWhatHappened({ state, update }: StepProps) {
  return (
    <div className="fade-in">
      <TextField
        label="When was the animal found?"
        type="datetime-local"
        value={isoToLocalInput(state.occurredAt)}
        onChange={(v) => update("occurredAt", localInputToIso(v) ?? nowIso())}
        hint="Defaults to now — edit it if the animal was found earlier."
      />
      <Select
        label="What kind of incident is this?"
        value={state.incidentType}
        options={INCIDENT_TYPES}
        onChange={(v) => update("incidentType", v as IncidentType)}
        optional
      />
      <TextField
        label="Describe what happened"
        multiline
        value={state.summary}
        onChange={(v) => update("summary", v)}
        optional
        placeholder="e.g. Found a bird beside the road that couldn't fly. Called local rescue, waiting for a volunteer."
        hint="Your own words. There are no wrong answers — record what you know."
      />
    </div>
  );
}

function StepAnimal({ state, update, detail }: StepProps & { detail: string }) {
  return (
    <div className="fade-in">
      <Select
        label="Animal type"
        value={state.animal.group}
        options={ANIMAL_GROUPS}
        onChange={(v) => update("animal", { ...state.animal, group: v as AnimalGroup })}
        optional
        hint="“Not sure” is a perfectly good answer."
      />
      <TextField
        label="Species (if known)"
        value={state.animal.species}
        onChange={(v) => update("animal", { ...state.animal, species: v })}
        optional
        placeholder="Leave empty if unknown"
        hint="The app never treats a typed species as verified. Professionals can correct it later — the original entry stays in history."
      />
      <TextField
        label="Short description"
        value={state.animal.description}
        onChange={(v) => update("animal", { ...state.animal, description: v })}
        optional
        placeholder='e.g. "Unknown raptor", "small brown bird", "juvenile duck"'
        hint="Useful when the species is unknown. This is what appears on cards and summaries."
      />
      <div className="grid-2">
        <TextField
          label="Approximate number of animals"
          type="number"
          min={1}
          value={state.animal.count}
          onChange={(v) => update("animal", { ...state.animal, count: v })}
          optional
        />
        <Select
          label="Life stage"
          value={state.animal.lifeStage}
          options={LIFE_STAGES}
          onChange={(v) => update("animal", { ...state.animal, lifeStage: v as LifeStage })}
          optional
        />
      </div>
      {detail === "professional" && (
        <Select
          label="Sex"
          value={state.animal.sex}
          options={SEXES}
          onChange={(v) => update("animal", { ...state.animal, sex: v as Sex })}
          optional
        />
      )}
    </div>
  );
}

function StepLocation({ state, update, defaultPrecision }: StepProps & { defaultPrecision: string }) {
  return (
    <div className="fade-in">
      <TextField
        label="Location description"
        value={state.location.description}
        onChange={(v) => update("location", { ...state.location, description: v })}
        optional
        placeholder="e.g. Roadside near the wetland entrance"
        hint="A human-readable description is often more useful than coordinates."
      />
      <Select
        label="Location precision"
        value={state.location.precision ?? (defaultPrecision as LocationPrecision)}
        options={LOCATION_PRECISIONS}
        onChange={(v) => update("location", { ...state.location, precision: v as LocationPrecision })}
        hint="Sensitive locations stay vague in shareable exports — exact coordinates are never exposed by accident."
      />
      <TextField
        label="Nearby landmark"
        value={state.location.landmark}
        onChange={(v) => update("location", { ...state.location, landmark: v })}
        optional
      />
      <TextField
        label="Address"
        value={state.location.address}
        onChange={(v) => update("location", { ...state.location, address: v })}
        optional
      />
      <div className="grid-2">
        <TextField label="Latitude" type="number" step="any" value={state.location.lat} onChange={(v) => update("location", { ...state.location, lat: v })} optional hint="-90 to 90" />
        <TextField label="Longitude" type="number" step="any" value={state.location.lon} onChange={(v) => update("location", { ...state.location, lon: v })} optional hint="-180 to 180" />
      </div>
    </div>
  );
}

function StepObservations({ state, update }: StepProps & { observationTexts: unknown }) {
  const [category, setCategory] = useState<ObservationCategory>("behavior");
  const [text, setText] = useState("");
  return (
    <div className="fade-in">
      <div className="notice">
        <Icons.eye size={18} />
        <span>
          Describe what you can <strong>see</strong> rather than diagnosing the cause.
          Good: <em>“right wing hangs lower”</em>. Avoid: <em>“broken wing”</em> — unless a professional confirmed it.
        </span>
      </div>
      <div style={{ margin: "var(--space-3) 0" }}>
        <p className="hint" style={{ marginBottom: 6 }}>Examples of helpful observations:</p>
        <div className="chip-row">
          {OBSERVATION_EXAMPLES_GOOD.map((ex) => (
            <button key={ex} className="chip" onClick={() => setText((t) => (t ? `${t}; ${ex}` : ex))} aria-label={`Add example: ${ex}`}>
              {ex}
            </button>
          ))}
        </div>
      </div>
      <Select label="Observation category" value={category} options={OBSERVATION_CATEGORIES} onChange={(v) => setCategory(v as ObservationCategory)} />
      <TextField label="What did you observe?" multiline value={text} onChange={setText} optional placeholder="Describe what you can see…" />
      <button
        className="btn btn-secondary"
        disabled={!cleanText(text)}
        onClick={() => {
          update("observations", [...state.observations, { category, text: cleanText(text) }]);
          setText("");
        }}
      >
        <Icons.plus size={16} />
        Add observation
      </button>

      {state.urgency === null && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <Select
            label="Overall condition (descriptive — this is not medical triage)"
            value={state.urgency}
            options={URGENCIES}
            onChange={(v) => update("urgency", v as ObservedUrgency)}
            optional
            hint="Says what you observed, not a veterinary assessment."
          />
        </div>
      )}

      {state.observations.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <h3>Observations so far</h3>
          <ul style={{ paddingLeft: 20 }}>
            {state.observations.map((o, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <span className="tag">{o.category.replaceAll("_", " ")}</span> {o.text}{" "}
                <button className="btn btn-quiet btn-sm" onClick={() => update("observations", state.observations.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepHazards({ state, update }: StepProps) {
  function toggle(h: Hazard) {
    const has = state.hazards.includes(h);
    let next = has ? state.hazards.filter((x) => x !== h) : [...state.hazards, h];
    if (!has && h === "none_observed") next = ["none_observed"];
    else next = next.filter((x) => x !== "none_observed");
    update("hazards", next);
  }
  return (
    <div className="fade-in">
      <p style={{ color: "var(--c-ink-soft)" }}>
        Is anything dangerous <strong>right now</strong>? Think about the animal's surroundings — and your own safety first.
      </p>
      <div className="chip-row" role="group" aria-label="Hazards">
        {HAZARDS.map((h) => (
          <button key={h.value} className="chip" aria-pressed={state.hazards.includes(h.value)} onClick={() => toggle(h.value)}>
            {h.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "var(--space-4)" }}>
        <TextField label="Hazard notes" multiline value={state.hazardNotes} onChange={(v) => update("hazardNotes", v)} optional placeholder="e.g. Busy road at rush hour; animal near the water's edge." />
      </div>
    </div>
  );
}

function StepActions({ state, update }: StepProps) {
  return (
    <div className="fade-in">
      <p style={{ color: "var(--c-ink-soft)" }}>
        Record actions <strong>factually</strong>. Never feel encouraged to handle an animal unsafely — safety comes first.
      </p>
      <div className="chip-row" role="group" aria-label="Actions already taken">
        {ACTION_SUGGESTIONS.map((a) => (
          <button
            key={a}
            className="chip"
            aria-pressed={state.actions.includes(a)}
            onClick={() =>
              update("actions", state.actions.includes(a) ? state.actions.filter((x) => x !== a) : [...state.actions, a])
            }
          >
            {a}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "var(--space-4)" }}>
        <TextField label="Action notes" multiline value={state.actionNotes} onChange={(v) => update("actionNotes", v)} optional placeholder="Anything else that was already done." />
      </div>
    </div>
  );
}

function StepAnimalNow({ state, update }: StepProps) {
  return (
    <div className="fade-in">
      <Select
        label="Where is the animal now?"
        value={state.animalNow}
        options={ANIMAL_LOCATIONS}
        onChange={(v) => update("animalNow", v as AnimalLocation)}
        optional
        hint="This becomes the starting point of the custody history."
      />
      <TextField
        label="Detail (container, location description)"
        value={state.animalNowDescription}
        onChange={(v) => update("animalNowDescription", v)}
        optional
        placeholder="e.g. In a ventilated cardboard box in a quiet room"
        hint="Useful if the animal is contained. No treatment instructions are needed here."
      />
    </div>
  );
}

const CONTACT_ROLES = [
  { value: "finder", label: "Finder" },
  { value: "responder", label: "Responder" },
  { value: "receiving_organization", label: "Receiving organization" },
  { value: "receiving_person", label: "Receiving person" },
  { value: "other", label: "Other" },
];

function StepContacts({ state, update }: StepProps) {
  return (
    <div className="fade-in">
      <p style={{ color: "var(--c-ink-soft)" }}>
        Every contact field is optional. Contact details are treated as <strong>private</strong> and are excluded from shareable exports unless you explicitly include them.
      </p>
      {state.contacts.map((c, i) => (
        <div key={i} className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-3)", boxShadow: "none" }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{CONTACT_ROLES.find((r) => r.value === c.role)?.label ?? "Contact"}</h3>
            <button className="btn btn-quiet btn-sm" onClick={() => update("contacts", state.contacts.filter((_, j) => j !== i))}>
              <Icons.trash size={14} /> Remove
            </button>
          </div>
          <div className="grid-2" style={{ marginTop: "var(--space-3)" }}>
            <TextField label="Name" value={c.name} onChange={(v) => update("contacts", state.contacts.map((x, j) => (j === i ? { ...x, name: v } : x)))} optional />
            <TextField label="Organization" value={c.organization} onChange={(v) => update("contacts", state.contacts.map((x, j) => (j === i ? { ...x, organization: v } : x)))} optional />
            <TextField label="Phone" type="tel" value={c.phone} onChange={(v) => update("contacts", state.contacts.map((x, j) => (j === i ? { ...x, phone: v } : x)))} optional />
            <TextField label="Email" type="email" value={c.email} onChange={(v) => update("contacts", state.contacts.map((x, j) => (j === i ? { ...x, email: v } : x)))} optional />
          </div>
        </div>
      ))}
      <button
        className="btn btn-secondary"
        onClick={() => update("contacts", [...state.contacts, { role: "finder", name: "", organization: "", phone: "", email: "" }])}
      >
        <Icons.plus size={16} />
        Add contact
      </button>
    </div>
  );
}

function StepPhotos({ state, update, showToast }: StepProps & { showToast: (m: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 8)) {
      if (!file.type.startsWith("image/")) {
        showToast(`${file.name} is not an image and was skipped`);
        continue;
      }
      const meta: AttachmentMeta = {
        id: uuid(),
        fileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        caption: null,
        addedAt: nowIso(),
        sourceAttribution: null,
        sensitive: false,
      };
      update("photos", [...state.photos, { meta, blob: file }]);
    }
    if (inputRef.current) inputRef.current.value = "";
  }
  return (
    <div className="fade-in">
      <p style={{ color: "var(--c-ink-soft)" }}>
        Photos are stored locally on this device. The app never analyzes or diagnoses wildlife from photos.
      </p>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => void onFiles(e.target.files)} id="photo-input" />
      <button className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
        <Icons.camera size={16} />
        Add photos
      </button>
      <label htmlFor="photo-input" className="sr-only">Add photos</label>
      {state.photos.length > 0 && (
        <div className="photo-grid" style={{ marginTop: "var(--space-4)" }}>
          {state.photos.map((p) => (
            <div key={p.meta.id} className="photo-card">
              <img src={URL.createObjectURL(p.blob)} alt={p.meta.caption ?? p.meta.fileName} />
              <div className="photo-caption">
                <input
                  className="input"
                  style={{ fontSize: "0.8rem", minHeight: 32 }}
                  placeholder="Caption (optional)"
                  value={p.meta.caption ?? ""}
                  onChange={(e) =>
                    update("photos", state.photos.map((x) => (x.meta.id === p.meta.id ? { ...x, meta: { ...x.meta, caption: e.target.value } } : x)))
                  }
                />
                <button className="btn btn-quiet btn-sm" onClick={() => update("photos", state.photos.filter((x) => x.meta.id !== p.meta.id))}>
                  <Icons.trash size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewRow({ label, value, unknown }: { label: string; value: React.ReactNode; unknown?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--c-border)", alignItems: "baseline" }}>
      <dt style={{ color: "var(--c-ink-faint)", minWidth: 150, flexShrink: 0 }}>{label}</dt>
      <dd style={{ margin: 0 }}>
        {unknown ? <span className="unknown-chip">{value}</span> : value}
      </dd>
    </div>
  );
}

function StepReview({ state }: { state: DraftState }) {
  const known = (v: string | null | undefined) => (cleanText(v ?? "") ? { text: cleanText(v!), unknown: false } : { text: "Not provided", unknown: true });
  const animalLine = state.animal.species || state.animal.description || (state.animal.group ? ANIMAL_GROUPS.find((g) => g.value === state.animal.group)?.label : null);
  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>Ready to create incident</h2>
      <p style={{ color: "var(--c-ink-soft)" }}>
        Check the summary below. Clearly <em>Unknown</em> or <em>Not provided</em> information is shown — you can still go back and fill it, or leave it honestly unknown.
      </p>
      <div className="stack">
        <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)" }}>
          <h3>Animal</h3>
          <dl style={{ margin: 0 }}>
            <ReviewRow label="Animal" value={animalLine ?? "Unknown"} unknown={!animalLine} />
            <ReviewRow label="Species" value={known(state.animal.species).text} unknown={known(state.animal.species).unknown} />
            <ReviewRow label="Life stage" value={state.animal.lifeStage ? LIFE_STAGES.find((l) => l.value === state.animal.lifeStage)?.label : "Unknown"} unknown={!state.animal.lifeStage} />
          </dl>
        </div>
        <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)" }}>
          <h3>Location</h3>
          <dl style={{ margin: 0 }}>
            <ReviewRow label="Description" value={known(state.location.description).text} unknown={known(state.location.description).unknown} />
            <ReviewRow label="Precision" value={state.location.precision ? LOCATION_PRECISIONS.find((p) => p.value === state.location.precision)?.label : "Unknown"} unknown={!state.location.precision} />
          </dl>
        </div>
        <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)" }}>
          <h3>Observations</h3>
          {state.observations.length === 0 ? (
            <span className="unknown-chip">None recorded</span>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {state.observations.map((o, i) => (
                <li key={i}>{o.text}</li>
              ))}
            </ul>
          )}
          {state.urgency && <p style={{ margin: "8px 0 0" }}>Condition: {URGENCIES.find((u) => u.value === state.urgency)?.label}</p>}
        </div>
        <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)" }}>
          <h3>Hazards · Actions · Current situation</h3>
          <p style={{ margin: "0 0 4px" }}>
            <strong>Hazards:</strong>{" "}
            {state.hazards.length === 0 ? <span className="unknown-chip">Not recorded</span> : state.hazards.map((h) => HAZARDS.find((x) => x.value === h)?.label).join(", ")}
          </p>
          <p style={{ margin: "0 0 4px" }}>
            <strong>Actions:</strong>{" "}
            {state.actions.length === 0 && !cleanText(state.actionNotes) ? <span className="unknown-chip">None recorded</span> : [...state.actions, cleanText(state.actionNotes)].filter(Boolean).join("; ")}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Animal now:</strong>{" "}
            {state.animalNow ? ANIMAL_LOCATIONS.find((a) => a.value === state.animalNow)?.label : <span className="unknown-chip">Unknown</span>}
          </p>
        </div>
        <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)" }}>
          <h3>Contacts & attachments</h3>
          <p style={{ margin: "0 0 4px" }}>
            <strong>Contacts:</strong> {state.contacts.length === 0 ? <span className="unknown-chip">None provided</span> : `${state.contacts.length} added (kept private by default)`}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Photos:</strong> {state.photos.length === 0 ? <span className="unknown-chip">None</span> : `${state.photos.length} attached`}
          </p>
        </div>
      </div>
    </div>
  );
}
