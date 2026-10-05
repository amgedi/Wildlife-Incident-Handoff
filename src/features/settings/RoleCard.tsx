/** Per-role card — Verification V6 (0.3.0-dev.6, Part XIV/XV).
 *
 * NOT a textarea pretending to be verification. A structured, role-specific
 * evidence checklist prepared LOCALLY: readiness counts completed packet
 * sections ("4 of 5 sections prepared"), never identity confidence. The
 * honest state labels are: Not verified / Evidence prepared (local) — and
 * the card states plainly that no connected reviewer exists, so nothing is
 * submitted and no external verification is implied. A selected document's
 * NAME is remembered as a reminder; the document itself is never copied,
 * uploaded, exported, synced, or included in backups.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../app/AppContext";
import { ACTIVE_VERIFICATION_PROVIDER, evidenceReadiness, type RoleEvidenceValues } from "./verificationProvider";
import type { ProfessionalRoleEntry, RoleEvidence } from "../network/authorization";

const EMPTY_EVIDENCE: RoleEvidenceValues = {
  organization: "",
  roleTitle: "",
  jurisdiction: "",
  credentialId: "",
  issuingAuthority: "",
  expiryDate: "",
  supervisorContact: "",
  organizationWebsite: "",
  professionalEmail: "",
  trainingCompleted: "",
};

export function RoleCard({ entry, isActive, canDeactivate }: { entry: ProfessionalRoleEntry; isActive: boolean; canDeactivate: boolean }) {
  const { settings, updateSettings, showToast } = useApp();
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoleEvidenceValues>(EMPTY_EVIDENCE);
  const [note, setNote] = useState("");
  const [proofName, setProofName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vr = entry.verificationRequest;
  const provider = ACTIVE_VERIFICATION_PROVIDER;
  const fields = provider.fieldsForRole(entry.role);
  const readiness = evidenceReadiness(provider, entry.role, vr?.evidence);

  const startEditing = () => {
    setDraft({ ...EMPTY_EVIDENCE, ...(vr?.evidence ?? {}) });
    setNote(vr?.note ?? "");
    setProofName(vr?.proofName ?? null);
    setOpen((v) => !v);
  };

  const saveLocal = () => {
    const evidence: RoleEvidence = { ...EMPTY_EVIDENCE, ...draft };
    const hasContent = Object.values(evidence).some((v) => v.trim()) || note.trim() || proofName;
    if (!hasContent) return;
    const roles = (settings.professionalRoles ?? []).map((r) =>
      r.role === entry.role
        ? { ...r, verificationRequest: { submittedAt: new Date().toISOString(), note: note.trim(), proofName, evidence } }
        : r
    );
    updateSettings({ professionalRoles: roles });
    setOpen(false);
    showToast(t("verifSavedLocalToast", { defaultValue: "Evidence saved on this device — nothing was sent" }));
  };

  return (
    <div className="card" style={{ boxShadow: "none", padding: "var(--space-3) var(--space-4)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600 }}>{t(`navigation:role_${entry.role}`, { ns: "navigation", defaultValue: entry.role.replaceAll("_", " ") })}</span>
        {vr ? (
          <span className="badge" style={{ background: "color-mix(in srgb, var(--c-primary) 18%, transparent)", color: "var(--c-primary)", fontWeight: 600 }}>
            {t("verifPreparedLocal", { defaultValue: "Evidence prepared (local) · Not externally verified" })}
          </span>
        ) : (
          <span className="badge warn">{t("roleStateNotVerified", { defaultValue: "Not verified" })}</span>
        )}
        {vr && (
          <span className="hint" style={{ margin: 0 }} data-testid="verification-readiness">
            {t("verifReadiness", { defaultValue: "Verification packet: {{prepared}} of {{total}} sections prepared", prepared: readiness.prepared, total: readiness.total })}
          </span>
        )}
        {isActive && <span className="badge open">{t("roleActive", { defaultValue: "Active" })}</span>}
        <span style={{ flex: 1 }} />
        {canDeactivate && (
          <button className="btn btn-secondary btn-sm" onClick={() => updateSettings({ activeProfessionalRole: entry.role })}>
            {t("roleSetActive", { defaultValue: "Use as active role" })}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={startEditing} aria-expanded={open}>
          {vr
            ? t("verifEditPrepared", { defaultValue: "Edit evidence packet" })
            : t("verifPrepare", { defaultValue: "Prepare verification evidence" })}
        </button>
        <button className="btn btn-quiet btn-sm" onClick={() => updateSettings({ professionalRoles: (settings.professionalRoles ?? []).filter((r) => r.role !== entry.role), activeProfessionalRole: settings.activeProfessionalRole === entry.role ? null : settings.activeProfessionalRole })}>
          {t("roleRemove", { defaultValue: "Remove" })}
        </button>
      </div>
      {vr?.evidence && (
        <ul className="verif-checklist" aria-label={t("verifChecklist", { defaultValue: "Evidence checklist" })}>
          {fields.map((f) => {
            const filled = ((vr.evidence as Partial<RoleEvidenceValues>)?.[f.key] ?? "").trim().length > 0;
            return (
              <li key={f.key} className={filled ? "done" : ""}>
                <span aria-hidden="true">{filled ? "✓" : "○"}</span>
                {f.label}
                {!f.optional && <span className="verif-req"> · {t("verifRequired", { defaultValue: "required" })}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {vr && (
        <p className="hint" style={{ margin: 0 }}>
          {t("verifPreparedHint", {
            defaultValue: "Saved on this device only — not submitted. No connected verification service exists yet, so no reviewer has received anything; this role stays Professional Preview and grants no extra permissions.",
            interpolation: { escapeValue: false },
          })}
        </p>
      )}
      {open && (
        <div style={{ border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: 12, display: "grid", gap: 10 }}>
          <p className="hint" style={{ margin: 0 }}>
            {t("verifBlurbHonest", {
              defaultValue: "Evidence stays on this device until you explicitly submit it through a future connected verification service — none exists today, so nothing can be submitted or verified from here.",
            })}
          </p>
          <div className="grid-2">
            {fields.map((f) => (
              <label key={f.key} className="field">
                <span>{f.label}{f.optional ? ` (${t("optional", { defaultValue: "optional" })})` : ""}</span>
                {f.key === "expiryDate" ? (
                  <input
                    type="date"
                    className="input"
                    value={draft.expiryDate}
                    onChange={(e) => setDraft((d) => ({ ...d, expiryDate: e.target.value }))}
                  />
                ) : (
                  <input
                    className="input"
                    value={draft[f.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.hint}
                  />
                )}
              </label>
            ))}
          </div>
          <label className="field">
            <span>{t("verifNote", { defaultValue: "Additional context" })} ({t("optional", { defaultValue: "optional" })})</span>
            <textarea
              className="textarea"
              style={{ minHeight: 56 }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("verifNotePlaceholder", { defaultValue: "Anything else a reviewing organization would want to know." })}
            />
          </label>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {proofName ?? t("verifAttachProof", { defaultValue: "Attach document (name reminder only)" })}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                setProofName(e.target.files?.[0]?.name ?? null);
                e.target.value = "";
              }}
            />
            <button className="btn btn-primary btn-sm" onClick={saveLocal}>
              {t("verifSaveLocalBtn", { defaultValue: "Save evidence on this device" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
