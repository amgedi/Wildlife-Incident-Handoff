# Role Capability Matrix

Status: 0.2.0-dev.8. Two columns are documented per capability:
**Preview UI** (what the local, unconnected workspace shows or tailors today) and
**Connected permission** (what a verified role will be granted server-side; see
`NETWORK_SECURITY_AND_AUTH_PLAN.md`). Preview roles NEVER grant authorization;
nothing here is enforced client-side as security.

| Capability | Reporter | Field responder | Dispatcher | Rehabilitator | Veterinary | Org admin |
| --- | --- | --- | --- | --- | --- | --- |
| Create own report locally | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Read incidents in workspace | own only (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Accept / self-assign incident | unavailable in connected mode until authorized | ✓ (preview) | ✓ (preview) | ✓ (preview) | unavailable | ✓ (preview) |
| Assign to another responder | unavailable | unavailable | ✓ (preview UI) | unavailable | unavailable | ✓ (preview UI) |
| Update incident / timeline | own reports (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Record handoff | preview UI present | ✓ (preview) | unavailable | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Read precise location | per-report consent (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| See reporter contact | only if included (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Verify members (`member.verify`) | unavailable | unavailable | unavailable | unavailable | unavailable | server-side only |
| Manage organization (`organization.manage`) | unavailable | unavailable | unavailable | unavailable | unavailable | server-side only |

Roles not shown, including coordinator, ranger or conservation officer, and read-only reviewer, follow the same rule: read and assign scopes come from `src/features/network/authorization.ts` (`ROLE_CAPABILITIES`). Preview means interface tailoring; connected means server-enforced. Verification requirements per role are shown only to users adding that role for data minimization.
