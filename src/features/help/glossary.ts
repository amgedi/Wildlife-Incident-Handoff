/** Single source of truth for glossary definitions. Contextual help
 *  popovers (ContextHelp glossaryTerm) and Help → Glossary both read from
 *  here via the "glossary" namespace (en JSON is the source of the keys). */

export const GLOSSARY_TERMS = [
  "incident",
  "responder",
  "handoff",
  "custody",
  "response_requested",
  "approximate_location",
  "sensitive_location",
  "assignment",
  "service_area",
  "professional_assessment",
  "private_note",
  "shareable_report",
  "internal_report",
  "location_accuracy",
  "unknown_species",
] as const;

export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number];
