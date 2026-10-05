/**
 * Concern model V5 (0.3.0-dev.5, spec Part XII).
 *
 * Wildlife Incident Handoff is no longer limited to individual animal
 * incidents. Reports carry a top-level concern type. Labels are purely
 * descriptive — the app NEVER records or implies legal conclusions
 * (no "poaching", "crime", "illegal activity"): a reporter describes what
 * they observed; only a professional may record determinations.
 */
import type { Incident } from "../../types/incident";

export type ConcernType =
  | "wildlife_animal"
  | "habitat_site"
  | "environmental_hazard"
  | "infrastructure_hazard"
  | "human_wildlife_conflict"
  | "other";

export interface ConcernTypeDescriptor {
  value: ConcernType;
  label: string;
  /** Shown under the picker — what belongs in this category. */
  hint: string;
  /** Dynamic intake: does this concern collect animal details? */
  requiresAnimal: boolean;
  /** The intake focus for non-animal concerns. */
  focus?: string;
}

export const CONCERN_TYPES: ConcernTypeDescriptor[] = [
  {
    value: "wildlife_animal",
    label: "Wildlife animal",
    hint: "An individual or group of animals — injured, sick, orphaned, trapped, dead, or in danger.",
    requiresAnimal: true,
  },
  {
    value: "habitat_site",
    label: "Habitat / site concern",
    hint: "Nest or den disturbance, habitat damage, or a site hazard affecting wildlife.",
    requiresAnimal: false,
    focus: "Describe the site and what disturbance or damage you observed.",
  },
  {
    value: "environmental_hazard",
    label: "Environmental hazard",
    hint: "Pollution, spill, contamination, or dangerous debris that could affect wildlife or people.",
    requiresAnimal: false,
    focus: "Describe the hazard, the material involved (if known), and the area affected.",
  },
  {
    value: "infrastructure_hazard",
    label: "Wildlife infrastructure hazard",
    hint: "Fencing, window-strike sites, road hazards, entanglement structures, or power-line concerns.",
    requiresAnimal: false,
    focus: "Describe the structure or hazard and where wildlife interact with it.",
  },
  {
    value: "human_wildlife_conflict",
    label: "Human-wildlife conflict",
    hint: "An observed conflict or interaction that needs professional review — described factually, no conclusions.",
    requiresAnimal: false,
    focus: "Describe what you observed factually — what happened, where, and when.",
  },
  {
    value: "other",
    label: "Other wildlife concern",
    hint: "Something else worth recording — describe what you observed.",
    requiresAnimal: false,
    focus: "Describe what you observed in your own words.",
  },
];

export function concernDescriptor(value: ConcernType | null | undefined): ConcernTypeDescriptor {
  return CONCERN_TYPES.find((c) => c.value === value) ?? CONCERN_TYPES[0]!;
}

/** Legacy records (pre-dev.5) are animal incidents by definition. */
export function concernOf(incident: Pick<Incident, "concernType">): ConcernType {
  return incident.concernType ?? "wildlife_animal";
}

export function isAnimalConcern(value: ConcernType | null | undefined): boolean {
  return concernDescriptor(value).requiresAnimal;
}
