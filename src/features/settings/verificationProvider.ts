/**
 * VerificationProvider (0.3.0-dev.6, Part XIV.79): the honest architecture
 * seam for professional verification.
 *
 * The ONLY provider today is LocalPreparationOnly: it helps the user prepare
 * a structured evidence packet on this device. It NEVER marks anyone
 * "Verified Professional", never validates credentials, and never sends
 * anything. A future ConnectedOrganizationReview provider would submit
 * through a real reviewing organization — the UI must switch on this
 * interface, not on hardcoded local behavior.
 */
import type { ProfessionalRole } from "../network/authorization";

export interface VerificationProvider {
  id: string;
  displayName: string;
  /** True only when a real external reviewer can approve. */
  canVerifyExternally: boolean;
  /** Which structured evidence fields this provider needs for a role. */
  fieldsForRole: (role: ProfessionalRole) => EvidenceFieldSpec[];
}

export interface EvidenceFieldSpec {
  key: keyof RoleEvidenceValues;
  label: string;
  optional?: boolean;
  hint?: string;
}

export interface RoleEvidenceValues {
  organization: string;
  roleTitle: string;
  jurisdiction: string;
  credentialId: string;
  issuingAuthority: string;
  expiryDate: string;
  supervisorContact: string;
  organizationWebsite: string;
  professionalEmail: string;
  trainingCompleted: string;
}

/** Local-only preparation provider (the current, honest reality). */
export const LocalPreparationOnly: VerificationProvider = {
  id: "local-preparation-only",
  displayName: "Local preparation (no connected reviewer yet)",
  canVerifyExternally: false,
  fieldsForRole: (role) => {
    const org = { key: "organization" as const, label: "Organization / facility" };
    const title = { key: "roleTitle" as const, label: "Role title" };
    const jurisdiction = { key: "jurisdiction" as const, label: "Country / region of practice" };
    const supervisor = { key: "supervisorContact" as const, label: "Supervisor / organization contact", optional: true };
    const website = { key: "organizationWebsite" as const, label: "Organization website", optional: true };
    const email = { key: "professionalEmail" as const, label: "Professional email", optional: true };
    const credential = {
      key: "credentialId" as const,
      label: "Credential / license / permit number",
      hint: "Only if your jurisdiction issues one for this role",
    };
    const authority = { key: "issuingAuthority" as const, label: "Issuing authority", optional: true };
    const expiry = { key: "expiryDate" as const, label: "Expiration date (if applicable)", optional: true };
    const training = { key: "trainingCompleted" as const, label: "Training completed", optional: true };

    switch (role) {
      case "rehabilitator":
        return [org, title, jurisdiction, credential, authority, expiry, supervisor, website, email];
      case "field_responder":
      case "ranger_conservation_officer":
        return [org, title, jurisdiction, supervisor, training, credential];
      case "veterinary_professional":
        return [org, title, jurisdiction, credential, authority, email];
      case "dispatcher":
      case "organization_coordinator":
      case "organization_administrator":
        return [org, title, supervisor, jurisdiction];
      case "read_only_reviewer":
        return [org, title, supervisor];
      default:
        return [org, title, jurisdiction, supervisor];
    }
  },
};

export const ACTIVE_VERIFICATION_PROVIDER: VerificationProvider = LocalPreparationOnly;

/** Evidence readiness: how many of the provider's required sections are
 *  filled. This is COMPLETENESS of the packet — never identity confidence. */
export function evidenceReadiness(
  provider: VerificationProvider,
  role: ProfessionalRole,
  values: Partial<RoleEvidenceValues> | undefined
): { prepared: number; total: number } {
  const fields = provider.fieldsForRole(role).filter((f) => !f.optional);
  const prepared = fields.filter((f) => (values?.[f.key] ?? "").trim().length > 0).length;
  return { prepared, total: fields.length };
}
