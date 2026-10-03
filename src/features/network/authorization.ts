/** UI WORKSPACE vs PROFESSIONAL ROLES vs SECURITY AUTHORIZATION.
 *
 * Three separate concepts (0.2.0-dev.8):
 *  1. WORKSPACE — which interface is presented (reporter / professional).
 *     Freely switchable; grants nothing.
 *  2. PROFESSIONAL ROLES — what the user does in a response organization.
 *     Until a server issues verified claims, roles here are LOCAL PREVIEW
 *     roles: they tailor the UI (dashboard widgets, help, tutorials) and
 *     nothing else. They are never presented as "verified".
 *  3. AUTHORIZATION — what a connected backend has verified SERVER-SIDE.
 *     There is no backend, so this is hard-unverified. No localStorage,
 *     settings toggle, URL or hidden field can change it.
 *
 * See docs/ROLE_CAPABILITY_MATRIX.md and
 * docs/NETWORK_SECURITY_AND_AUTH_PLAN.md.
 */

/** Professional roles. Verification requirements differ per role (data
 *  minimization: only shown to users applying for that role). */
export type ProfessionalRole =
  | "field_responder"
  | "dispatcher"
  | "rehabilitator"
  | "veterinary_professional"
  | "ranger_conservation_officer"
  | "organization_coordinator"
  | "organization_administrator"
  | "read_only_reviewer";

export type RoleState = "preview" | "verification_pending" | "verified";

export interface ProfessionalRoleEntry {
  role: ProfessionalRole;
  state: RoleState;
  /** ISO timestamp when the role was added / requested. */
  addedAt: string;
}

/** What each role conceptually may do in CONNECTED mode. Local preview NEVER
 *  enforces or grants these — this is the contract the future server will
 *  issue per verified role. UI may use it only to tailor presentation. */
export const ROLE_CAPABILITIES: Record<ProfessionalRole, string[]> = {
  field_responder: ["incident.read", "incident.update", "handoff.create", "handoff.accept", "location.precise.read"],
  dispatcher: ["incident.read", "incident.assign", "incident.update", "reporter.contact", "location.precise.read"],
  rehabilitator: ["incident.read", "incident.update", "handoff.create", "handoff.accept", "location.precise.read"],
  veterinary_professional: ["incident.read", "incident.update", "handoff.accept", "location.precise.read"],
  ranger_conservation_officer: ["incident.read", "incident.update", "incident.assign", "handoff.create", "location.precise.read"],
  organization_coordinator: ["incident.read", "incident.assign", "reporter.contact", "member.verify"],
  organization_administrator: ["incident.read", "incident.assign", "reporter.contact", "member.verify", "organization.manage"],
  read_only_reviewer: ["incident.read"],
};

/** Per-role verification pathway (conceptual; enforced server-side in
 *  connected mode). Only shown to users adding that specific role. */
export const ROLE_VERIFICATION_REQUIREMENTS: Record<ProfessionalRole, string> = {
  field_responder: "Organization invitation approved by an organization administrator.",
  dispatcher: "Organization invitation approved by an organization administrator.",
  rehabilitator: "Wildlife rehabilitation facility membership confirmed by the facility.",
  veterinary_professional: "Clinic or veterinary organization verification.",
  ranger_conservation_officer: "Agency or conservation organization membership.",
  organization_coordinator: "Designated by an organization administrator.",
  organization_administrator: "Provisioned during organization onboarding.",
  read_only_reviewer: "Invited by an organization administrator.",
};

export const PROFESSIONAL_ROLES: ProfessionalRole[] = [
  "field_responder",
  "dispatcher",
  "rehabilitator",
  "veterinary_professional",
  "ranger_conservation_officer",
  "organization_coordinator",
  "organization_administrator",
  "read_only_reviewer",
];

export function capabilitiesForRoles(roles: ProfessionalRoleEntry[]): string[] {
  const set = new Set<string>();
  for (const r of roles) {
    if (r.state === "verified") {
      for (const c of ROLE_CAPABILITIES[r.role] ?? []) set.add(c);
    }
  }
  return [...set];
}

// ---- Authorization (server-issued; currently always unverified) ----

export type FutureNetworkRole = ProfessionalRole | "reporter" | "organization_member";

export interface AuthorizationState {
  status: "unverified" | "pending_review" | "verified";
  roles: FutureNetworkRole[];
  organizationId: string | null;
  /** Server-issued; client code must never synthesize this. */
  claimsSource: "none" | "server";
}

export const UNVERIFIED_AUTHORIZATION: AuthorizationState = {
  status: "unverified",
  roles: [],
  organizationId: null,
  claimsSource: "none",
};

/** The ONLY authorization source. Currently hard-unverified: there is no
 *  backend, so no local state can elevate this. Returns a fresh object so
 *  callers cannot mutate the constant. */
export function getAuthorizationState(): AuthorizationState {
  return { ...UNVERIFIED_AUTHORIZATION, roles: [] };
}

export function isVerifiedResponder(): boolean {
  return getAuthorizationState().status === "verified" && getAuthorizationState().roles.includes("field_responder");
}

export const PROFESSIONAL_PREVIEW_LABEL = "Professional Preview";
