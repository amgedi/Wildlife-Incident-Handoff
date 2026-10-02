/**
 * Export service: builds handoff summaries (text + print-friendly HTML) with
 * privacy-aware redaction. SHAREABLE exports exclude precise location,
 * personal contact details and private notes unless explicitly included.
 */
import type { Incident } from "../../types/incident";
import { formatDateTime } from "../../utils/time";
import { escapeHtml } from "../../utils/text";
import { saveFile } from "../../utils/platformFile";
import { labelFor, STATUS_LABELS_BY_KEY, ANIMAL_LOCATIONS, URGENCIES, HAZARDS, LOCATION_PRECISIONS } from "../incidents/labels";

export interface ExportOptions {
  /** Include precise coordinates (INTERNAL only). */
  includeCoordinates: boolean;
  /** Include personal phone/email (INTERNAL or explicitly chosen). */
  includePersonalContacts: boolean;
  /** Include private working notes. */
  includePrivateNotes: boolean;
  /** Include the attachments index (metadata only — never embedded images). */
  includeAttachmentsIndex: boolean;
}

export const INTERNAL_EXPORT: ExportOptions = {
  includeCoordinates: true,
  includePersonalContacts: true,
  includePrivateNotes: true,
  includeAttachmentsIndex: true,
};

export const SHAREABLE_EXPORT: ExportOptions = {
  includeCoordinates: false,
  includePersonalContacts: false,
  includePrivateNotes: false,
  includeAttachmentsIndex: true,
};

export interface ExportSection {
  heading: string;
  lines: string[];
}

export function animalLabel(incident: Incident): string {
  const a = incident.animal;
  if (a.species) return a.species;
  const bits: string[] = [];
  if (a.description) bits.push(a.description);
  if (a.group && a.group !== "not_sure" && !(a.description ?? "").toLowerCase().includes(a.group)) bits.push(a.group);
  return bits.length > 0 ? bits.join(" — ") : "Unidentified animal";
}

import type { IncidentType } from "../../types/incident";

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
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

const ANIMAL_GROUP_LABELS: Record<string, string> = {
  bird: "Bird", mammal: "Mammal", reptile: "Reptile", amphibian: "Amphibian", fish: "Fish", invertebrate: "Invertebrate", other: "Other", not_sure: "Not sure",
};
const LIFE_STAGE_LABELS: Record<string, string> = { adult: "Adult", juvenile: "Juvenile", young: "Young", unknown: "Unknown" };
const SEX_LABELS: Record<string, string> = { male: "Male", female: "Female", unknown: "Unknown", not_recorded: "Not recorded" };

export function buildExportSections(incident: Incident, options: ExportOptions): ExportSection[] {
  const sections: ExportSection[] = [];
  const unknown = "Unknown / not recorded";

  sections.push({
    heading: "Incident",
    lines: [
      `Reference: ${incident.humanReference}`,
      `Status: ${STATUS_LABELS_BY_KEY[incident.status]}`,
      `Incident type: ${incident.incidentType ? INCIDENT_TYPE_LABELS[incident.incidentType] : unknown}`,
      `Date/time found: ${incident.occurredAt ? formatDateTime(incident.occurredAt) : unknown}`,
      `Record created: ${formatDateTime(incident.createdAt)}`,
    ],
  });

  sections.push({
    heading: "Animal",
    lines: [
      `Animal: ${animalLabel(incident)}`,
      `Group: ${incident.animal.group ? ANIMAL_GROUP_LABELS[incident.animal.group] : unknown}`,
      `Species: ${incident.animal.species ? `${incident.animal.species}${incident.animal.speciesConfirmed ? " (professionally confirmed)" : " (unconfirmed — as reported)"}` : unknown}`,
      `Number: ${incident.animal.count != null ? String(incident.animal.count) : unknown}`,
      `Life stage: ${incident.animal.lifeStage ? LIFE_STAGE_LABELS[incident.animal.lifeStage] : unknown}`,
      `Sex: ${incident.animal.sex ? SEX_LABELS[incident.animal.sex] : unknown}`,
    ],
  });

  const locationLines: string[] = [`Description: ${incident.location.description || unknown}`];
  if (incident.location.precision) {
    locationLines.push(`Precision: ${labelFor(LOCATION_PRECISIONS, incident.location.precision)}`);
  }  if (incident.location.landmark) locationLines.push(`Nearby landmark: ${incident.location.landmark}`);
  if (options.includeCoordinates && incident.location.latitude != null && incident.location.longitude != null) {
    locationLines.push(`Coordinates: ${incident.location.latitude.toFixed(5)}, ${incident.location.longitude.toFixed(5)}`);
  } else if (incident.location.latitude != null) {
    locationLines.push("Coordinates: redacted in this export");
  }
  sections.push({ heading: "Location", lines: locationLines });

  const urgency = incident.urgency ? labelFor(URGENCIES, incident.urgency) : unknown;
  const observationLines = [`Observed urgency (descriptive, not a diagnosis): ${urgency}`];
  if (incident.observations.length === 0) {
    observationLines.push("Observations: none recorded yet");
  } else {
    for (const obs of incident.observations) {
      observationLines.push(`• [${formatDateTime(obs.recordedAt)}] ${obs.category.replaceAll("_", " ")}: ${obs.text}`);
    }
  }
  sections.push({ heading: "Observed condition & observations", lines: observationLines });

  sections.push({
    heading: "Immediate hazards",
    lines:
      incident.hazards && incident.hazards.hazards.length > 0
        ? [
            ...incident.hazards.hazards.map((h) => `• ${labelFor(HAZARDS, h)}`),
            ...(incident.hazards.notes ? [`Notes: ${incident.hazards.notes}`] : []),
          ]
        : [unknown],
  });

  sections.push({
    heading: "Actions already taken",
    lines:
      incident.actions.length > 0
        ? incident.actions.map((a) => `• [${formatDateTime(a.recordedAt)}] ${a.text}`)
        : [unknown],
  });

  sections.push({
    heading: "Current situation",
    lines: [
      `Animal now: ${incident.animalNow ? labelFor(ANIMAL_LOCATIONS, incident.animalNow) : unknown}`,
      ...(incident.animalNowDescription ? [`Detail: ${incident.animalNowDescription}`] : []),
      `Next step: ${incident.nextStep || unknown}`,
    ],
  });

  const custody = incident.custody.filter((c) => !c.endedAt).at(-1);
  const custodyLines = [`Current: ${custody ? `${custody.holder}${custody.holderRole ? ` (${custody.holderRole})` : ""} since ${formatDateTime(custody.startedAt)}` : unknown}`];
  for (const c of incident.custody.filter((x) => x.endedAt)) {
    custodyLines.push(`Previous: ${c.holder}${c.holderRole ? ` (${c.holderRole})` : ""} — ${formatDateTime(c.startedAt)} to ${formatDateTime(c.endedAt!)}`);
  }
  sections.push({ heading: "Custody history", lines: custodyLines });

  if (options.includeAttachmentsIndex && incident.attachments.length > 0) {
    sections.push({
      heading: "Attachments index",
      lines: incident.attachments.map((a) => `• ${a.fileName}${a.caption ? ` — ${a.caption}` : ""} (added ${formatDateTime(a.addedAt)})`),
    });
  }

  const contactLines: string[] = [];
  for (const c of incident.contacts) {
    const parts = [c.name, c.organization].filter(Boolean);
    let line = `• ${c.role.replaceAll("_", " ")}: ${parts.join(" — ") || unknown}`;
    if (options.includePersonalContacts) {
      if (c.phone) line += ` — phone: ${c.phone}`;
      if (c.email) line += ` — email: ${c.email}`;
    }
    contactLines.push(line);
  }
  sections.push({ heading: "Contacts", lines: contactLines.length > 0 ? contactLines : [unknown] });

  const publicNotes = incident.notes.filter((n) => n.kind === "incident_record" || options.includePrivateNotes);
  if (publicNotes.length > 0) {
    sections.push({
      heading: "Notes",
      lines: publicNotes.map((n) => `• [${formatDateTime(n.createdAt)}]${n.kind === "private" ? " (private)" : ""} ${n.text}`),
    });
  }

  const highlights = [...incident.timeline]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-20);
  sections.push({
    heading: "Timeline highlights",
    lines: highlights.map((e) => `• [${formatDateTime(e.timestamp)}] ${e.summary}`),
  });

  if (!options.includeCoordinates) {
    sections.push({
      heading: "Privacy note",
      lines: ["This is a shareable export: precise coordinates, personal contact details and private notes were excluded unless explicitly included."],
    });
  }
  return sections;
}

export function buildPlainText(incident: Incident, options: ExportOptions): string {
  const sections = buildExportSections(incident, options);
  const lines: string[] = [
    "WILDLIFE INCIDENT HANDOFF SUMMARY",
    "=================================",
    "",
  ];
  for (const s of sections) {
    lines.push(s.heading.toUpperCase());
    for (const l of s.lines) lines.push(l);
    lines.push("");
  }
  lines.push(`Generated ${formatDateTime(new Date().toISOString())} — Wildlife Incident Handoff`);
  return lines.join("\n");
}

export function buildHtml(incident: Incident, options: ExportOptions): string {
  const sections = buildExportSections(incident, options);
  const body = sections
    .map(
      (s) => `<section><h2>${escapeHtml(s.heading)}</h2><ul>${s.lines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join("")}</ul></section>`
    )
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Handoff summary ${escapeHtml(incident.humanReference)}</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1a1a18;line-height:1.5}
h1{font-size:1.4rem;border-bottom:2px solid #2f5d3f;padding-bottom:.4rem}h2{font-size:1rem;margin:1.4rem 0 .4rem;color:#2f5d3f}
ul{margin:.2rem 0;padding-left:1.1rem}li{margin:.15rem 0}footer{margin-top:2rem;font-size:.85rem;color:#555}</style></head>
<body><h1>Wildlife Incident Handoff — ${escapeHtml(incident.humanReference)}</h1>${body}
<footer>Generated ${escapeHtml(formatDateTime(new Date().toISOString()))} — Wildlife Incident Handoff</footer></body></html>`;
}

export async function downloadPlainText(incident: Incident, options: ExportOptions): Promise<"saved" | "cancelled" | "browser"> {
  const text = buildPlainText(incident, options);
  return downloadTextFile(`handoff-${incident.humanReference}.txt`, text, "text/plain");
}

export async function downloadHtml(incident: Incident, options: ExportOptions): Promise<"saved" | "cancelled" | "browser"> {
  const html = buildHtml(incident, options);
  return downloadTextFile(`handoff-${incident.humanReference}.html`, html, "text/html");
}

export async function downloadTextFile(fileName: string, content: string, mimeType: string): Promise<"saved" | "cancelled" | "browser"> {
  const ext = fileName.slice(fileName.lastIndexOf("."));
  const result = await saveFile(content, fileName, ext);
  if (result !== "browser") return result;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "browser";
}

export function printSummary(incident: Incident, options: ExportOptions): void {
  const html = buildHtml(incident, options);
  const win = window.open("", "_blank", "width=780,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
