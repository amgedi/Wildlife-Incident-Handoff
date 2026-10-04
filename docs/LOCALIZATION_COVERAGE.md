# Localization coverage

Source locale: **English** — 1,031 keys across 13 feature namespaces
(counted by `src/i18n/localesParity.test.ts`, the dev.19 completeness gate;
it replaces the earlier `completeness.test.ts`).

dev.19 honest state: the four production languages (fr, es, de, pt-BR) fully
cover the core navigation/titlebar namespaces plus the settings section
labels; **998 keys per language still fall back to English at runtime**
(i18next fallback — the app never shows a raw key). Mass machine-filling the
gap without human review risks wrong safety/privacy wording in a wildlife
safety app, so the dev.19 gate guards against REGRESSION (no newly missing
keys) and the fallback is disclosed here rather than overstated. The gap list
is stable and documented for a dedicated translation pass with human review.

| Language | Core UI (nav/titlebar) | Full parity | Status | Review state |
| --- | --- | --- | --- | --- |
| English (en) | complete (reference) | complete (reference) | complete | human verified |
| Français (fr) | complete | 33/1,031 keys missing (fallback: en) | partial | machine-assisted, not yet human reviewed |
| Español (es) | complete | 33/1,031 keys missing (fallback: en) | partial | machine-assisted, not yet human reviewed |
| Deutsch (de) | complete | 33/1,031 keys missing (fallback: en) | partial | machine-assisted, not yet human reviewed |
| Português (Brasil) (pt-BR) | complete | 33/1,031 keys missing (fallback: en) | partial | machine-assisted, not yet human reviewed |
| العربية (ar) | — | — | preview | RTL-ready architecture; pack pending (stays preview) |

(Newly written dev.19 sync-copy strings are translated in all four production
languages; longer feature namespaces (settings detail, professional, help)
still fall back to English.)

## Rules

- Never label a language “complete” while major screens remain English — the completeness test enforces this.
- Beta packs are safe to select: every missing key falls back to English at runtime; dev builds log missing keys.
- User-entered content (observations, names, species, organization names, IDs) is never translated.
- Exports use the interface language for generated labels only.
