/** UI WORKSPACE vs SECURITY AUTHORIZATION.
 *
 * Switching workspace in Settings (or answering onboarding questions) only
 * changes WHICH INTERFACE the app presents. It must NEVER grant professional
 * privileges. Until a server-side authorization system exists, every local
 * user is "unverified" and the professional experience is labeled
 * "Professional Preview" / "Local Professional Workspace".
 *
 * When a real backend lands, roles will be issued and enforced SERVER-SIDE
 * (organization invitation → admin approval → verified membership). This
 * module is the single seam where those claims will plug in; the UI reads
 * authorization state from here, never from localStorage, URL params, or
 * workspace settings. See docs/NETWORK_SECURITY_AND_AUTH_PLAN.md.
 */

export type FutureNetworkRole =
  | "reporter"
  | "verified_responder"
  | "dispatcher"
  | "rehabilitator"
  | "veterinary_professional"
  | "organization_member"
  | "organization_administrator"
  | "read_only_reviewer";

export interface AuthorizationState {
  /** What the server has verified about this account. Locally always "unverified". */
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
  return getAuthorizationState().status === "verified" && getAuthorizationState().roles.includes("verified_responder");
}

export const PROFESSIONAL_PREVIEW_LABEL = "Professional Preview";
