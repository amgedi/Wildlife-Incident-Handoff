# Contributing to Wildlife Incident Handoff

Thank you for helping make wildlife handoffs clearer and safer! Contributions are welcome, and beginners are explicitly encouraged — this project exists partly as a learning resource.

## Getting set up

```bash
git clone https://github.com/YOUR-USERNAME/wildlife-incident-handoff.git
cd wildlife-incident-handoff
npm install
npm run dev        # http://localhost:5173
```

Before proposing changes:

```bash
npm test           # the whole suite must pass
npm run typecheck  # strict TypeScript must be clean
npm run build      # production build must succeed
```

## Ground rules

### Accessibility is a feature, not a follow-up

- Every interactive element must be keyboard-reachable with a visible focus indicator.
- Every form field needs a real label; validation messages must explain how to fix the problem.
- Never convey status by color alone; text or icons must carry the meaning.
- Respect the motion preference — animations never delay actions.

### Privacy is part of correctness

- Never log, transmit, or store user incident data anywhere except the user's own browser.
- New features must respect the existing boundaries: shareable exports exclude precise location, personal contacts, and private notes unless explicitly included.
- Treat all imported/user text as untrusted — no `innerHTML` with user data, sanitize file names.

### Product philosophy

- **Unknown is a valid answer.** Don't force users to guess or pretend.
- **Append, don't erase.** Corrections preserve the original value in the timeline.
- Observations, not diagnoses. Avoid features that imply veterinary assessment.
- Every new feature must serve: recording, understanding, handoff, history, privacy, export, or usability. No feature-count inflation.

## Branches and commits

- Branch names: `feat/short-description`, `fix/short-description`, `docs/...`, `a11y/...`
- Commit messages: short imperative summary, e.g. `feat: add urgency filter to incident list`
- One logical change per commit is ideal; don't bundle unrelated fixes.

## Issues

- **Bug reports**: what you did, what you expected, what happened, browser + OS. Please use fictional data only — never paste real wildlife locations or personal contact details.
- **Feature requests**: describe the *problem* you're trying to solve first.
- **Accessibility issues**: mention the screen, the assistive technology or keyboard path, and what blocked you. These are treated as bugs, not enhancements.

## Testing your change

Add or update tests for anything touching incident data, history preservation, or exports. The end-to-end style tests in `src/features/incidents/finderWorkflow.test.ts` and `src/storage/incidentService.test.ts` are good templates.

## Questions?

Open a discussion or issue — no question is too basic.
