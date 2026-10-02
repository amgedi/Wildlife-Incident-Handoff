/** Export tab: privacy-aware handoff summaries (print, text, HTML). */
import { useState } from "react";
import type { Incident } from "../../../types/incident";
import { SectionHeading, Checkbox } from "../../../components/ui";
import { Icons } from "../../../components/Icons";
import { useApp } from "../../../app/AppContext";
import {
  INTERNAL_EXPORT, SHAREABLE_EXPORT, type ExportOptions,
  downloadPlainText, downloadHtml, printSummary,
} from "../../export/exportService";

export function ExportTab({ incident }: { incident: Incident }) {
  const { showToast } = useApp();
  // Respect the sharing profile chosen at creation, when present.
  const initialMode: "shareable" | "internal" = incident.shareProfile === "responder" ? "internal" : "shareable";
  const [mode, setMode] = useState<"shareable" | "internal">(initialMode);
  const [opts, setOpts] = useState<ExportOptions>(
    initialMode === "internal" ? { ...INTERNAL_EXPORT } : { ...SHAREABLE_EXPORT }
  );

  function chooseMode(m: "shareable" | "internal") {
    setMode(m);
    setOpts(m === "internal" ? { ...INTERNAL_EXPORT } : { ...SHAREABLE_EXPORT });
  }

  const toggle = (key: keyof ExportOptions) => setOpts((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className="stack">
      <div className="card">
        <SectionHeading help="Never assume every export should expose everything. Shareable exports leave out precise location, personal contacts and private notes by default.">
          Handoff summary
        </SectionHeading>

        <div className="segmented" role="group" aria-label="Export type">
          <button aria-pressed={mode === "shareable"} onClick={() => chooseMode("shareable")}>Shareable</button>
          <button aria-pressed={mode === "internal"} onClick={() => chooseMode("internal")}>Internal / full</button>
        </div>

        <div className="card" style={{ boxShadow: "none", marginTop: "var(--space-4)", padding: "var(--space-4)" }}>
          <h3 style={{ marginTop: 0 }}>What's included</h3>
          <div className="stack">
            <Checkbox
              label="Precise coordinates"
              checked={opts.includeCoordinates}
              onChange={() => toggle("includeCoordinates")}
              trailing={incident.location.latitude != null ? undefined : "No coordinates recorded"}
              hint={opts.includeCoordinates && incident.location.latitude != null ? "Included by default only in Internal exports." : undefined}
            />
            <Checkbox
              label="Personal phone & email"
              checked={opts.includePersonalContacts}
              onChange={() => toggle("includePersonalContacts")}
              trailing={incident.contacts.some((c) => c.phone || c.email) ? undefined : "None recorded"}
              hint={opts.includePersonalContacts && incident.contacts.some((c) => c.phone || c.email) ? "Contact details are private — include only when the recipient needs them." : undefined}
            />
            <Checkbox
              label="Private working notes"
              checked={opts.includePrivateNotes}
              onChange={() => toggle("includePrivateNotes")}
              trailing={incident.notes.some((n) => n.kind === "private") ? undefined : "None recorded"}
            />
            <Checkbox
              label="Attachments index (file names & captions only)"
              checked={opts.includeAttachmentsIndex}
              onChange={() => toggle("includeAttachmentsIndex")}
              trailing={incident.attachments.length > 0 ? undefined : "None recorded"}
            />
          </div>
          {mode === "shareable" && (
            <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem", margin: "var(--space-3) 0 0" }}>
              A privacy note is added to shareable exports explaining what was excluded.
            </p>
          )}
        </div>

        <div className="row" style={{ marginTop: "var(--space-4)" }}>
          <button className="btn btn-primary" onClick={() => { printSummary(incident, opts); }}>
            <Icons.print size={16} /> Print / save as PDF
          </button>
          <button className="btn btn-secondary" onClick={async () => {
            const r = await downloadPlainText(incident, opts);
            if (r !== "cancelled") showToast("Text summary exported");
          }}>
            <Icons.download size={16} /> Download text
          </button>
          <button className="btn btn-secondary" onClick={async () => {
            const r = await downloadHtml(incident, opts);
            if (r !== "cancelled") showToast("HTML summary exported");
          }}>
            <Icons.download size={16} /> Download HTML
          </button>
        </div>
        <p style={{ color: "var(--c-ink-faint)", fontSize: "0.82rem", marginTop: "var(--space-2)" }}>
          Printing uses your browser's print dialog — choose “Save as PDF” there for a PDF copy.
        </p>
      </div>
    </div>
  );
}
