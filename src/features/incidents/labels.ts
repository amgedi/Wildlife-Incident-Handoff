/** Friendly labels for enums and option lists used across the UI and exports. */
import type {
  AnimalGroup,
  AnimalLocation,
  Hazard,
  IncidentStatus,
  IncidentType,
  LifeStage,
  LocationPrecision,
  ObservationCategory,
  ObservedUrgency,
  Sex,
} from "../../types/incident";

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  draft: "Draft",
  reported: "Reported",
  response_requested: "Response requested",
  responder_assigned: "Responder assigned",
  awaiting_pickup: "Awaiting pickup",
  in_transport: "In transport",
  transferred: "Transferred",
  in_care: "In care",
  veterinary_care: "Veterinary care",
  monitoring: "Monitoring",
  released: "Released",
  deceased: "Deceased",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: "injured_wildlife", label: "Injured wildlife" },
  { value: "sick_unusual", label: "Sick / unusual behavior" },
  { value: "orphaned_young", label: "Orphaned / separated young" },
  { value: "trapped_entangled", label: "Trapped / entangled" },
  { value: "collision", label: "Collision" },
  { value: "hazardous_location", label: "Wildlife in hazardous location" },
  { value: "dead_wildlife", label: "Dead wildlife" },
  { value: "human_wildlife_conflict", label: "Human-wildlife conflict" },
  { value: "other", label: "Other" },
  { value: "not_sure", label: "Not sure" },
];

export const ANIMAL_GROUPS: { value: AnimalGroup; label: string }[] = [
  { value: "bird", label: "Bird" },
  { value: "mammal", label: "Mammal" },
  { value: "reptile", label: "Reptile" },
  { value: "amphibian", label: "Amphibian" },
  { value: "fish", label: "Fish" },
  { value: "other", label: "Other" },
  { value: "not_sure", label: "Not sure" },
];

export const LIFE_STAGES: { value: LifeStage; label: string }[] = [
  { value: "adult", label: "Adult" },
  { value: "juvenile", label: "Juvenile" },
  { value: "young", label: "Young" },
  { value: "unknown", label: "Unknown" },
];

export const SEXES: { value: Sex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
  { value: "not_recorded", label: "Not recorded" },
];

export const LOCATION_PRECISIONS: { value: LocationPrecision; label: string; hint: string }[] = [
  { value: "exact", label: "Exact location", hint: "Full detail, including coordinates if provided." },
  { value: "approximate", label: "Approximate location", hint: "Description of the general area only." },
  { value: "sensitive", label: "Sensitive location", hint: "Deliberately vague — for sensitive sites or species." },
];

export const URGENCIES: { value: ObservedUrgency; label: string }[] = [
  { value: "immediate_danger", label: "Immediate danger present" },
  { value: "appears_distressed", label: "Animal appears distressed" },
  { value: "appears_stable", label: "Animal appears stable" },
  { value: "condition_unclear", label: "Condition unclear" },
  { value: "deceased", label: "Animal deceased" },
];

export const HAZARDS: { value: Hazard; label: string }[] = [
  { value: "traffic", label: "Traffic" },
  { value: "water", label: "Water" },
  { value: "predators", label: "Predators" },
  { value: "pets", label: "Pets" },
  { value: "people", label: "People" },
  { value: "machinery", label: "Machinery" },
  { value: "extreme_weather", label: "Extreme weather" },
  { value: "fishing_line_hooks", label: "Fishing line / hooks" },
  { value: "chemicals", label: "Chemicals" },
  { value: "unsafe_structure", label: "Unsafe structure" },
  { value: "other", label: "Other" },
  { value: "none_observed", label: "None observed" },
  { value: "unknown", label: "Unknown" },
];

export const ANIMAL_LOCATIONS: { value: AnimalLocation; label: string }[] = [
  { value: "original_location", label: "At original location" },
  { value: "being_observed", label: "Being observed" },
  { value: "contained", label: "Contained" },
  { value: "with_finder", label: "With finder" },
  { value: "with_responder", label: "With responder" },
  { value: "in_transport", label: "In transport" },
  { value: "rehab_facility", label: "At wildlife rehabilitation facility" },
  { value: "vet_facility", label: "At veterinary facility" },
  { value: "released", label: "Released" },
  { value: "deceased", label: "Deceased" },
  { value: "unknown", label: "Unknown" },
  { value: "other", label: "Other" },
];

export const OBSERVATION_CATEGORIES: { value: ObservationCategory; label: string }[] = [
  { value: "movement", label: "Movement" },
  { value: "breathing", label: "Breathing" },
  { value: "bleeding", label: "Bleeding" },
  { value: "visible_injury", label: "Visible injury" },
  { value: "behavior", label: "Behavior" },
  { value: "responsiveness", label: "Responsiveness" },
  { value: "entanglement", label: "Entanglement" },
  { value: "body_position", label: "Body position" },
  { value: "other", label: "Other" },
];

export const HANDOFF_ITEM_SUGGESTIONS = [
  "Animal",
  "Transport container",
  "Photos",
  "Paper notes",
  "Medication provided by a professional",
  "Other materials",
];

export function labelFor(list: { value: string; label: string }[], value: string | null): string {
  if (!value) return "Unknown";
  return list.find((o) => o.value === value)?.label ?? value;
}

export const STATUS_LABELS_BY_KEY = STATUS_LABELS;
