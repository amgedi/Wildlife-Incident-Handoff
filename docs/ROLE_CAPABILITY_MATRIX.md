# Role Capability Matrix

Status: 0.2.0-dev.8. Two columns are documented per capability:
**Preview UI** (what the local, unconnected workspace shows/tailors today) and
**Connected permission** (what a verified role will be granted server-side —
see `NETWORK_SECURITY_AND_AUTH_PLAN.md`). Preview roles NEVER grant
authorization; nothing here is enforced client-side as security.

| Capability | Reporter | Field responder | Dispatcher | Rehabilitator | Veterinary | Org admin |
| --- | --- | --- | --- | --- | --- | --- |
| Create own report locally | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Read incidents in workspace | own only (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Accept / self-assign incident | — (preview UI present) | ✓ (preview) | ✓ (preview) | ✓ (preview) | — | ✓ (preview) |
| Assign to another responder | — | — | ✓ (preview UI) | — | — | ✓ (preview UI) |
| Update incident / timeline | own reports (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Record handoff | — (preview UI present) | ✓ (preview) | — | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Read precise location | per-report consent (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| See reporter contact | only if included (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) | ✓ (preview) |
| Verify members (`member.verify`) | — | — | — | — | — | server-side only |
| Manage organization (`organization.manage`) | — | — | — | — | — | server-side only |

Roles not shown (coordinator, ranger/conservation officer, read-only
reviewer) follow the same rule: read/assign scopes per
`src/features/network/authorization.ts` (`ROLE_CAPABILITIES`), preview = UI
tailoring, connected = server-enforced. Verification requirements per role
are shown only to users adding that role (data minimization, P11).
