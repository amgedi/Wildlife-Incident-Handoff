# Localization coverage

Source locale: **English** — 404 keys across 13 feature namespaces.

A language is listed as **complete** only when it contains every key (asserted by `src/i18n/completeness.test.ts`).
Complete-but-machine-assisted languages still need human review before being called *verified*.

| Language | Total keys | Translated | Missing | Status | Review state |
| --- | --- | --- | --- | --- | --- |
| English (en) | 404 | 404 | 0 | complete | human verified |
| Français (fr) | 404 | 404 | 0 | complete | machine-assisted, not yet human reviewed |
| Español (es) | 404 | 404 | 0 | complete | machine-assisted, not yet human reviewed |
| Deutsch (de) | 404 | 0 | 404 | beta | — |
| Português (Brasil) (pt-BR) | 404 | 0 | 404 | beta | — |
| Nederlands (nl) | 404 | 0 | 404 | beta | — |
| Italiano (it) | 404 | 0 | 404 | beta | — |
| Polski (pl) | 404 | 0 | 404 | beta | — |
| Türkçe (tr) | 404 | 0 | 404 | beta | — |
| العربية (ar) | 404 | 0 | 404 | beta | RTL — architecture ready, pack pending |
| 简体中文 (zh-CN) | 404 | 0 | 404 | beta | — |
| 日本語 (ja) | 404 | 0 | 404 | beta | — |
| 한국어 (ko) | 404 | 0 | 404 | beta | — |

## Rules

- Never label a language “complete” while major screens remain English — the completeness test enforces this.
- Beta packs are safe to select: every missing key falls back to English at runtime; dev builds log missing keys.
- User-entered content (observations, names, species, organization names, IDs) is never translated.
- Exports use the interface language for generated labels only.
