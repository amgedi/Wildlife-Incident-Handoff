/** Per-role card with the verification submission flow (dev.17). Submitting
 *  evidence marks the role "Verification submitted" — it stays Preview until
 *  a real organization approves it server-side; permissions never change. */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../app/AppContext";
import type { ProfessionalRoleEntry } from "../network/authorization";

export function RoleCard({ entry, isActive, canDeactivate }: { entry: ProfessionalRoleEntry; isActive: boolean; canDeactivate: boolean }) {
  const { settings, updateSettings, showToast } = useApp();
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [proofName, setProofName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vr = entry.verificationRequest;

  const submit = () => {
    if (!note.trim()) return;
    const roles = (settings.professionalRoles ?? []).map((r) =>
      r.role === entry.role
        ? { ...r, verificationRequest: { submittedAt: new Date().toISOString(), note: note.trim(), proofName } }
        : r
    );
    updateSettings({ professionalRoles: roles });
    setOpen(false);
    setNote("");
    setProofName(null);
    showToast(t("verifSubmittedToast", { defaultValue: "Verification submitted — pending organization review" }));
  };

  return (
    <div className="card" style={{ boxShadow: "none", padding: "var(--space-3) var(--space-4)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600 }}>{t(`navigation:role_${entry.role}`, { ns: "navigation", defaultValue: entry.role.replaceAll("_", " ") })}</span>
        {vr ? (
          <span className="badge" style={{ background: "color-mix(in srgb, var(--c-primary) 18%, transparent)", color: "var(--c-primary)", fontWeight: 600 }}>
            {t("verifPending", { defaultValue: "Verification submitted — pending review" })}
          </span>
        ) : (
          <span className="badge warn">{t("roleStatePreview", { defaultValue: "Professional Preview" })}</span>
        )}
        {isActive && <span className="badge open">{t("roleActive", { defaultValue: "Active" })}</span>}
        <span style={{ flex: 1 }} />
        {canDeactivate && (
          <button className="btn btn-secondary btn-sm" onClick={() => updateSettings({ activeProfessionalRole: entry.role })}>
            {t("roleSetActive", { defaultValue: "Use as active role" })}
          </button>
        )}
        {!vr && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {t("verifSubmit", { defaultValue: "Submit verification" })}
          </button>
        )}
        <button className="btn btn-quiet btn-sm" onClick={() => updateSettings({ professionalRoles: (settings.professionalRoles ?? []).filter((r) => r.role !== entry.role), activeProfessionalRole: settings.activeProfessionalRole === entry.role ? null : settings.activeProfessionalRole })}>
          {t("roleRemove", { defaultValue: "Remove" })}
        </button>
      </div>
      {vr && (
        <p className="hint" style={{ margin: 0 }}>
          {t("verifPendingHint", {
            defaultValue: "Submitted {{when}}{{proof}}. Your organization reviews this — until it approves you server-side, this role stays Preview and grants no extra permissions.",
            when: new Date(vr.submittedAt).toLocaleString(),
            proof: vr.proofName ? ` · proof: ${vr.proofName}` : "",
            interpolation: { escapeValue: false },
          })}
        </p>
      )}
      {open && !vr && (
        <div style={{ border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: 10, display: "grid", gap: 8 }}>
          <p className="hint" style={{ margin: 0 }}>
            {t("verifBlurb", {
              defaultValue: "Attach your evidence (certificate photo, badge, supervisor email…) and add context. It stays on this device until a connected organization reviews it — this does NOT unlock permissions by itself.",
            })}
          </p>
          <textarea
            className="textarea"
            style={{ minHeight: 64 }}
            placeholder={t("verifNotePlaceholder", { defaultValue: "e.g. Wildlife rescue certificate #1234, supervisor: J. Smith at Calgary Wildlife Response" })}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label={t("verifNote", { defaultValue: "Verification context" })}
          />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {proofName ? proofName.slice(0, 34) : t("verifAttachProof", { defaultValue: "Attach proof (optional)" })}
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
            <button className="btn btn-primary btn-sm" disabled={!note.trim()} onClick={submit}>
              {t("verifSubmitBtn", { defaultValue: "Submit for review" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
