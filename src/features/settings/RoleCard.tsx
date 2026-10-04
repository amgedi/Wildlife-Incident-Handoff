/** Per-role card — dev.18 honest wording. There is NO connected verification
 *  service: nothing is ever submitted or "pending review". The user can only
 *  prepare evidence notes LOCALLY for a future connected flow. The selected
 *  document's name is remembered as a reminder; the document itself is never
 *  copied, uploaded, exported, synced, or included in backups. */
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

  const saveLocal = () => {
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
    showToast(t("verifSavedLocalToast", { defaultValue: "Evidence notes saved on this device — nothing was sent" }));
  };

  return (
    <div className="card" style={{ boxShadow: "none", padding: "var(--space-3) var(--space-4)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600 }}>{t(`navigation:role_${entry.role}`, { ns: "navigation", defaultValue: entry.role.replaceAll("_", " ") })}</span>
        {vr ? (
          <span className="badge" style={{ background: "color-mix(in srgb, var(--c-primary) 18%, transparent)", color: "var(--c-primary)", fontWeight: 600 }}>
            {t("verifPreparedLocal", { defaultValue: "Evidence prepared locally — not submitted" })}
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
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => { if (!v) setNote(entry.verificationRequest?.note ?? ""); return !v; })} aria-expanded={open}>
          {vr
            ? t("verifEditPrepared", { defaultValue: "Edit prepared notes" })
            : t("verifPrepare", { defaultValue: "Prepare verification evidence" })}
        </button>
        <button className="btn btn-quiet btn-sm" onClick={() => updateSettings({ professionalRoles: (settings.professionalRoles ?? []).filter((r) => r.role !== entry.role), activeProfessionalRole: settings.activeProfessionalRole === entry.role ? null : settings.activeProfessionalRole })}>
          {t("roleRemove", { defaultValue: "Remove" })}
        </button>
      </div>
      {vr && (
        <p className="hint" style={{ margin: 0 }}>
          {t("verifPreparedHint", {
            defaultValue: "Prepared {{when}}{{proof}}. Saved on this device only — not submitted. Connected verification is not available yet, so no reviewer has received anything; this role stays Professional Preview and grants no extra permissions.",
            when: new Date(vr.submittedAt).toLocaleString(),
            proof: vr.proofName ? ` · reminder: “${vr.proofName}”` : "",
            interpolation: { escapeValue: false },
          })}
        </p>
      )}
      {open && (
        <div style={{ border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: 10, display: "grid", gap: 8 }}>
          <p className="hint" style={{ margin: 0 }}>
            {t("verifBlurbHonest", {
              defaultValue: "Connected verification is not available yet — there is no reviewer to receive evidence. You can prepare notes locally to use later. If you pick a document, only its file name is remembered as a reminder: the document itself is never copied, sent, or included in backups or exports.",
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
              {proofName ?? vr?.proofName ?? t("verifAttachProof", { defaultValue: "Attach document (reminder only)" })}
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
            <button className="btn btn-primary btn-sm" disabled={!note.trim()} onClick={saveLocal}>
              {t("verifSaveLocalBtn", { defaultValue: "Save notes on this device" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
