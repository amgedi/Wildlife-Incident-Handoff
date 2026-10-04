/**
 * Field metadata registry for incident correction dialogs (0.3.0-dev.3,
 * spec items 44–48, 96, 110).
 *
 * Every correctable field declares its own display name, dialog title, input
 * label, input shape and a field-specific reason example — so the dialog never
 * falls back to a generic "New value" label. The registry is the single source
 * of truth: the dialog renders whatever the registry declares, and the tests
 * assert no generic label can appear for any field.
 *
 * `wired: false` entries describe fields that are displayed and correctable in
 * principle but not yet accepted by `correctField` (storage layer) — listed so
 * the UI can be honest and the contract is explicit.
 */

export type CorrectionInputType = "text" | "number" | "textarea" | "select";

/** Field keys the storage layer (`correctField`) accepts today. */
export type CorrectableFieldKey =
  | "species"
  | "description"
  | "locationDescription"
  | "nextStep"
  | "summary";

/** Additional fields the registry describes for future wiring. */
export type PlannedFieldKey = "landmark" | "animalCount" | "lifeStage" | "sex";

export type CorrectionFieldKey = CorrectableFieldKey | PlannedFieldKey;

export interface CorrectionField {
  key: CorrectionFieldKey;
  /** i18n key suffix under the `reports` namespace: correctionField_<key>_* . */
  i18nKey: string;
  /** English fallback display name, e.g. "Species". */
  displayName: string;
  /** English fallback input label, e.g. "New species". */
  inputLabel: string;
  inputType: CorrectionInputType;
  /** Options for select fields (value + English fallback label). */
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  helpText?: string;
  /** Privacy hint shown in the dialog when relevant (e.g. locations). */
  privacyNote?: string;
  /** Field-specific example for the "reason for correction" placeholder. */
  reasonExample: string;
  /** True when `correctField` accepts this field today. */
  wired: boolean;
}

export const CORRECTION_FIELDS: CorrectionField[] = [
  {
    key: "locationDescription",
    i18nKey: "correctionField_locationDescription",
    displayName: "Location description",
    inputLabel: "New location description",
    inputType: "textarea",
    placeholder: "e.g. North bank of the river, below the footbridge",
    helpText: "Describe the place so someone else could find it without asking you.",
    privacyNote: "Location details can identify places people care about — share only what responders need.",
    reasonExample: "Visited the site again and can describe the spot more precisely.",
    wired: true,
  },
  {
    key: "landmark",
    i18nKey: "correctionField_landmark",
    displayName: "Landmark",
    inputLabel: "New landmark",
    inputType: "text",
    placeholder: "e.g. Bench 12, Riverside Park",
    helpText: "A nearby named object or place that helps responders orient.",
    reasonExample: "The nearest named landmark was confirmed on site.",
    wired: false,
  },
  {
    key: "description",
    i18nKey: "correctionField_description",
    displayName: "Animal description",
    inputLabel: "New animal description",
    inputType: "textarea",
    placeholder: "e.g. Juvenile rabbit, brown, injured left hind leg",
    helpText: "What the animal looks like — size, color, visible condition. Observations, not diagnosis.",
    reasonExample: "Closer look from a safe distance showed more detail.",
    wired: true,
  },
  {
    key: "species",
    i18nKey: "correctionField_species",
    displayName: "Species",
    inputLabel: "New species",
    inputType: "text",
    placeholder: "e.g. Eastern cottontail",
    helpText: "Species stays 'unconfirmed — as reported' unless a professional confirms it.",
    reasonExample: "Identified from a clear photo by a rehabilitator.",
    wired: true,
  },
  {
    key: "animalCount",
    i18nKey: "correctionField_animalCount",
    displayName: "Animal count",
    inputLabel: "New animal count",
    inputType: "number",
    placeholder: "e.g. 3",
    helpText: "How many animals were seen. An honest estimate is fine.",
    reasonExample: "Two more young animals were spotted nearby after the first report.",
    wired: false,
  },
  {
    key: "lifeStage",
    i18nKey: "correctionField_lifeStage",
    displayName: "Life stage",
    inputLabel: "New life stage",
    inputType: "select",
    options: [
      { value: "adult", label: "Adult" },
      { value: "juvenile", label: "Juvenile" },
      { value: "young", label: "Young (nestling / kit / cub)" },
      { value: "unknown", label: "Unknown" },
    ],
    helpText: "Life stage affects care decisions — record what you actually observed.",
    reasonExample: "Size and plumage observed on site indicate a juvenile.",
    wired: false,
  },
  {
    key: "sex",
    i18nKey: "correctionField_sex",
    displayName: "Sex",
    inputLabel: "New sex",
    inputType: "select",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "unknown", label: "Unknown" },
      { value: "not_recorded", label: "Not recorded" },
    ],
    helpText: "Only record sex when it can actually be observed.",
    reasonExample: "Sex confirmed during veterinary intake.",
    wired: false,
  },
  {
    key: "summary",
    i18nKey: "correctionField_summary",
    displayName: "What happened",
    inputLabel: "New summary of what happened",
    inputType: "textarea",
    placeholder: "e.g. Found a grounded fledgling near the path; parents not seen for an hour",
    helpText: "One clear sentence about what happened. Corrections keep the original on the timeline.",
    reasonExample: "First summary was written in a hurry at the scene.",
    wired: true,
  },
  {
    key: "nextStep",
    i18nKey: "correctionField_nextStep",
    displayName: "Next step",
    inputLabel: "New next step",
    inputType: "text",
    placeholder: "e.g. Await callback from Riverside Wildlife Rescue",
    helpText: "The single most useful thing to do next.",
    reasonExample: "The rehabilitator confirmed a different drop-off time.",
    wired: true,
  },
];

export function correctionField(key: CorrectionFieldKey): CorrectionField | undefined {
  return CORRECTION_FIELDS.find((f) => f.key === key);
}

/** Fields the dialog may currently be opened for (wired into correctField). */
export const WIRED_CORRECTION_FIELDS = CORRECTION_FIELDS.filter((f) => f.wired);

/** Guard for tests + UI: the generic label that must never appear again. */
export const FORBIDDEN_GENERIC_LABEL = "New value" as const;
