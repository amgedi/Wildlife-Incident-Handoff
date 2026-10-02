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
import { SearchableCombobox } from "../../components/SearchableCombobox";
import { DateTimeField } from "../../components/DateTimeField";
import { useTranslation } from "react-i18next";
import { TextField } from "../../components/ui";
import { Icons } from "../../components/Icons";
import {
  ANIMAL_GROUPS, ANIMAL_SUBGROUPS, ANIMAL_LOCATIONS, HAZARDS, INCIDENT_TYPES, LIFE_STAGES,
  LOCATION_PRECISIONS, OBSERVATION_CATEGORIES, SEXES, URGENCIES,
} from "./labels";
import type {
  AnimalGroup, AnimalLocation, AttachmentMeta, Hazard, IncidentType,
  LifeStage, LocationPrecision, ObservationCategory, ObservedUrgency, Sex,
} from "../../types/incident";
import { deleteDraft, getDraft, saveDraft, putAttachmentBlob, getSetting, setSetting } from "../../storage/repositories";
import { createIncident } from "../../storage/incidentService";
import { isoToLocalInput, localInputToIso, nowIso } from "../../utils/time";
import { uuid } from "../../utils/id";
import { cleanText } from "../../utils/text";

const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"] as const;

const SAFETY_NOTE =
  "Wildlife Incident Handoff records information — it is not medical or veterinary advice. Avoid unnecessary handling, keep people and pets away, and contact a licensed wildlife professional when needed.";

interface DraftState {
  occurredAt: string;
  incidentType: IncidentType | null;
  summary: string;
  animal: {
    group: AnimalGroup | null;
    subgroup: string | null;
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
    accuracyMeters: number | null;
    capturedAt: string | null;
    fromDevice: boolean;
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
  includeContact: boolean;
  reporter: { name: string; phone: string; email: string; preferred: string };
  rememberContact: boolean;
  shareProfile: "private" | "responder" | "public";
}

function emptyDraft(): DraftState {
  return {
    occurredAt: nowIso(),
    incidentType: null,
    summary: "",
    animal: { group: null, subgroup: null, species: "", count: "", lifeStage: null, sex: null, description: "" },
    location: { description: "", precision: "approximate", landmark: "", address: "", lat: "", lon: "", notes: "", accuracyMeters: null, capturedAt: null, fromDevice: false },
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
    includeContact: false,
    reporter: { name: "", phone: "", email: "", preferred: "phone" },
    rememberContact: false,
    shareProfile: "private",
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
  const { t } = useTranslation();
  const { status: saveStatus, markSaving } = useSaveStatus();
  const [searchParams] = useSearchParams();
  const guide = searchParams.get("guide") === "1";
  const [step, setStep] = useState(0);
  const [state, setState] = useState<DraftState>(emptyDraft);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Prefill remembered reporter contact (only when the user asked to remember it).
  useEffect(() => {
    if (resumed) return;
    getSetting<{ name: string; phone: string; email: string; preferred: string } | null>("saved-reporter-contact").then((saved) => {
      if (saved && saved.name) {
        setState((prev) => ({ ...prev, reporter: { ...prev.reporter, ...saved } }));
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing draft if resuming.
  useEffect(() => {
    if (resumed) return;
    setResumed(true);
    if (searchParams.get("resume")) {
      getDraft("draft").then((d) => {
        if (d && d.data) {
          setState({ ...emptyDraft(), ...(d.data as DraftState) });
          setStep(Math.min(d.step ?? 0, STEP_KEYS.length - 1));
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
        setError(t("validation:coordinatesNumeric"));
        return;
      }
      if (state.location.lat && (lat < -90 || lat > 90)) {
        setError(t("validation:latitudeRange"));
        return;
      }
      if (state.location.lon && (lon < -180 || lon > 180)) {
        setError(t("validation:longitudeRange"));
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
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
        subgroup: s.animal.subgroup ?? null,
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
        accuracyMeters: s.location.accuracyMeters ?? null,
        capturedAt: s.location.capturedAt ?? null,
        fromDevice: s.location.fromDevice,
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
      contacts: [
        ...(s.includeContact && (cleanText(s.reporter.name) || cleanText(s.reporter.phone) || cleanText(s.reporter.email))
          ? [{
              id: uuid(),
              role: "finder" as const,
              name: cleanText(s.reporter.name) || null,
              organization: null,
              phone: cleanText(s.reporter.phone) || null,
              email: cleanText(s.reporter.email) || null,
              preferredContactMethod: (s.reporter.preferred as "phone") ?? null,
              markedPrivate: true,
            }]
          : []),
        ...s.contacts
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
      ],
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
      shareProfile: s.shareProfile,
      createdVia: (guide ? "guide" : "form") as "guide" | "form",
      actor: settings.displayName || null,
    };

    try {
      const incident = await createIncident(incidentData);
      for (const p of s.photos) {
        await putAttachmentBlob({ id: p.meta.id, incidentId: incident.id, fileName: p.meta.fileName, mimeType: p.meta.mimeType, byteSize: p.meta.byteSize, data: p.blob });
      }
      await deleteDraft("draft");
      // Remember reporter contact only if the user opted in.
      if (s.includeContact && s.rememberContact) {
        await setSetting("saved-reporter-contact", s.reporter);
      }
      showToast(t("reports:reportCreatedToast", { ref: incident.humanReference }));
      navigate(`/incidents/${incident.id}`);
    } catch (e) {
      setError(t("validation:saveFailedStorage"));
      showToast(t("validation:couldNotSave"));
    }
  }

  return (
    <main className="content" id="main-content" style={{ maxWidth: 760 }}>
      <div className="row between" style={{ marginBottom: "var(--space-2)" }}>
        <h1>{settings.workspace === "professional" ? t("wizard:createTitlePro") : t("wizard:createTitle")}</h1>
        <span className="save-status" role="status">
          {saveStatus === "saving" ? t("wizard:saving") : saveStatus === "saved" ? t("wizard:draftSaved") : ""}
        </span>
      </div>
      <p style={{ color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
        {t(`wizard:${STEP_KEYS[step]}`)} — {t("wizard:stepOf", { current: step + 1, total: STEP_KEYS.length })}
      </p>

      <div className="wizard-steps" role="tablist" aria-label="Wizard steps">
        {STEP_KEYS.map((key, i) => (
          <button
            key={key}
            className={`wizard-step-dot${i === step ? " current" : ""}${i < step ? " done" : ""}`}
            onClick={() => { setStep(i); window.scrollTo({ top: 0 }); }}
            aria-current={i === step ? "step" : undefined}
          >
            {i + 1}. {t(`wizard:${key}`)}
          </button>
        ))}
      </div>

      {guide && <GuideCoach step={step} onExit={() => navigate("/incidents/new")} />}
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
        {step === 9 && <StepReview state={state} update={update} />}
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
            {step < STEP_KEYS.length - 1 ? (
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
      <DateTimeField
        label="When was the animal found?"
        value={state.occurredAt}
        onChange={(iso) => update("occurredAt", iso || nowIso())}
        hint="Defaults to now — quick chips cover the common cases, and manual entry is always available."
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
      <SearchableCombobox
        label="Animal type"
        value={state.animal.group}
        options={ANIMAL_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
        onChange={(v) => update("animal", { ...state.animal, group: v as AnimalGroup, subgroup: null })}
        optional
        hint="“Not sure” is a perfectly good answer. Search by typing."
      />
      {state.animal.group && ANIMAL_SUBGROUPS[state.animal.group] && (
        <SearchableCombobox
          label={`More specifically (${ANIMAL_GROUPS.find((g) => g.value === state.animal.group)?.label.toLowerCase()})`}
          value={state.animal.subgroup}
          options={ANIMAL_SUBGROUPS[state.animal.group]!.map((sg) => ({ value: sg, label: sg, group: ANIMAL_GROUPS.find((g) => g.value === state.animal.group)?.label }))}
          onChange={(v) => update("animal", { ...state.animal, subgroup: v })}
          optional
          hint="Entirely optional — a broad group is enough."
        />
      )}
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
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "ok" | "denied" | "unavailable">("idle");

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("location", {
          ...state.location,
          lat: pos.coords.latitude.toFixed(6),
          lon: pos.coords.longitude.toFixed(6),
          accuracyMeters: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
          capturedAt: nowIso(),
          fromDevice: true,
        });
        setGeoStatus("ok");
      },
      (err) => {
        // Permission denied or unavailable: the form stays fully usable with manual entry.
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="fade-in">
      <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <h3 style={{ marginTop: 0 }}>Use my current location</h3>
        <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem", margin: "0 0 var(--space-3)" }}>
          Optional. Your browser will ask for permission first — nothing is captured unless you allow it, and
          coordinates are stored only in this report on your device.
        </p>
        <button type="button" className="btn btn-secondary" onClick={useMyLocation} disabled={geoStatus === "locating"}>
          <Icons.compass size={16} />
          {geoStatus === "locating" ? "Locating…" : "Use my current location"}
        </button>
        {geoStatus === "ok" && state.location.accuracyMeters != null && (
          <p className="hint" style={{ marginTop: 8 }}>
            Captured {new Date(state.location.capturedAt ?? Date.now()).toLocaleTimeString()} — accuracy about ±{state.location.accuracyMeters} m.
            {state.location.accuracyMeters > 100 && " This accuracy is poor; treat the position as approximate."}
          </p>
        )}
        {geoStatus === "denied" && (
          <p className="error-text" style={{ marginTop: 8 }}>
            Location permission was declined. No problem — enter the location manually below.
          </p>
        )}
        {geoStatus === "unavailable" && (
          <p className="error-text" style={{ marginTop: 8 }}>
            Your device couldn't provide a location. Enter the location manually below.
          </p>
        )}
      </div>
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
      <h3>Would you like to include your contact information?</h3>
      <p style={{ color: "var(--c-ink-soft)" }}>
        A responder may need to contact you for clarification or to locate the animal — but this is entirely optional.
        Contact details are treated as <strong>private</strong> and are excluded from shareable exports unless you explicitly include them.
      </p>
      <div className="stack" role="radiogroup" aria-label="Include your contact information?">
        <button className="chip" role="radio" aria-checked={!state.includeContact} style={{ display: "block", width: "100%", textAlign: "left", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)" }} onClick={() => update("includeContact", false)}>
          <strong>No, keep this report anonymous</strong>
          <div style={{ fontSize: "0.85rem", color: "var(--c-ink-faint)" }}>The record is still complete for anyone handling the case.</div>
        </button>
        <button className="chip" role="radio" aria-checked={state.includeContact} style={{ display: "block", width: "100%", textAlign: "left", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)" }} onClick={() => update("includeContact", true)}>
          <strong>Yes, include my contact information</strong>
          <div style={{ fontSize: "0.85rem", color: "var(--c-ink-faint)" }}>Only what you enter below is added, marked private.</div>
        </button>
      </div>
      {state.includeContact && (
        <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <div className="grid-2">
            <TextField label="Your name" value={state.reporter.name} onChange={(v) => update("reporter", { ...state.reporter, name: v })} optional />
            <TextField label="Phone" type="tel" value={state.reporter.phone} onChange={(v) => update("reporter", { ...state.reporter, phone: v })} optional hint="International format welcome, e.g. +44 7700 900123" />
            <TextField label="Email" type="email" value={state.reporter.email} onChange={(v) => update("reporter", { ...state.reporter, email: v })} optional />
            <Select
              label="Preferred contact method"
              value={state.reporter.preferred}
              options={[
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
                { value: "in_person", label: "In person" },
                { value: "other", label: "Other" },
              ]}
              onChange={(v) => update("reporter", { ...state.reporter, preferred: v })}
              optional
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.9rem", cursor: "pointer" }}>
            <input type="checkbox" checked={state.rememberContact} onChange={(e) => update("rememberContact", e.target.checked)} />
            Remember my contact details on this device
          </label>
          <p className="hint">
            Off by default. When on, they are stored only in this browser and prefilled for your next report — you'll always
            see them before anything is saved or shared, and can clear them in Settings → Privacy.
          </p>
        </div>
      )}
      <h3 style={{ marginTop: "var(--space-5)" }}>Other contacts</h3>
      <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem" }}>
        For example, a rescue line you called or the receiving organization. Every field is optional.
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


function GuideCoach({ step, onExit }: { step: number; onExit: () => void }) {
  const { t } = useTranslation("guideCoach");
  const has = step >= 0 && step <= 9;
  if (!has) return null;
  return (
    <div className="notice" style={{ marginBottom: "var(--space-4)", borderColor: "var(--c-primary)" }} data-testid="guide-coach">
      <Icons.compass size={20} />
      <div style={{ flex: 1 }}>
        <strong>{t(`s${step}t`)}</strong>
        <p style={{ margin: "4px 0 0", color: "var(--c-ink-soft)" }}>{t(`s${step}b`)}</p>
      </div>
      <button className="btn btn-quiet btn-sm" onClick={onExit}>{t("guideExit", { ns: "guidance" })}</button>
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

const PROFILE_INFO: Record<string, string> = {
  private: "Keep personal and location information local. Share nothing unless you choose to later.",
  responder: "Include useful response details (like coordinates and how to reach you) when you share this report with a responder.",
  public: "Shareable exports will redact personal contact information and precise location by default.",
};

function StepReview({ state, update }: { state: DraftState; update: StepProps["update"] }) {
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
            <strong>Contacts:</strong>{" "}
            {state.includeContact && (cleanText(state.reporter.name) || cleanText(state.reporter.phone) || cleanText(state.reporter.email))
              ? "You — " + [state.reporter.name, state.reporter.phone, state.reporter.email].filter(Boolean).join(" · ") + " (kept private)"
              : state.contacts.length > 0
                ? state.contacts.length + " added (kept private by default)"
                : <span className="unknown-chip">Anonymous — none provided</span>}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Photos:</strong> {state.photos.length === 0 ? <span className="unknown-chip">None</span> : state.photos.length + " attached"}
          </p>
        </div>

        <div className="card" style={{ boxShadow: "none", padding: "var(--space-4)", borderColor: "var(--c-primary)" }}>
          <h3>Information included in this report</h3>
          <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem" }}>
            Everything below stays on this device either way. Choose what should be included when this report is shared
            with someone — you can change this later in the Export tab.
          </p>
          <div className="stack">
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem" }}>
              <input type="checkbox" checked={state.includeContact} readOnly disabled />
              {state.includeContact
                ? "My contact details (" + [state.reporter.name && "name", state.reporter.phone && "phone", state.reporter.email && "email"].filter(Boolean).join(", ") + ")"
                : "My contact details — not included (anonymous)"}
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem" }}>
              <input type="checkbox" checked={state.shareProfile !== "public" && !!state.location.lat} readOnly disabled />
              {state.location.lat ? "Precise coordinates" : "Precise coordinates — not provided"}
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem" }}>
              <input type="checkbox" checked readOnly disabled />
              Animal details, observations, hazards, photos and timeline
            </label>
          </div>
          <Select
            label="Default sharing profile"
            value={state.shareProfile}
            onChange={(v) => update("shareProfile", v as DraftState["shareProfile"])}
            options={[
              { value: "private", label: "Private record", hint: "Keep personal/location information local." },
              { value: "responder", label: "Responder report", hint: "Include useful response details when sharing with responders." },
              { value: "public", label: "Public / shareable", hint: "Redact personal contacts and precise location by default." },
            ]}
            hint={PROFILE_INFO[state.shareProfile]}
          />
        </div>
      </div>
    </div>
  );
}
