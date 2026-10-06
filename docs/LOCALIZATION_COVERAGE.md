# Localization Coverage

English is the reference language.

The project also includes partial interface coverage for French, Spanish, German, and Brazilian Portuguese, with English fallback for untranslated strings. Arabic remains a preview target for the localization architecture and is not presented as a complete translation.

## Current languages

| Language | Status | Notes |
| --- | --- | --- |
| English | Reference | Complete source locale |
| Français | Partial | Falls back to English where a translation is missing |
| Español | Partial | Falls back to English where a translation is missing |
| Deutsch | Partial | Falls back to English where a translation is missing |
| Português (Brasil) | Partial | Falls back to English where a translation is missing |
| العربية | Preview | RTL architecture work exists, but the translation pack is not complete |

## Rules

- Do not label a language complete while major screens still fall back to English.
- Missing interface strings should fall back to English instead of exposing raw translation keys.
- Safety, privacy, and handoff wording should receive human review before a translation is described as production-ready.
- User-entered observations, names, species text, organization names, and incident IDs are not automatically translated.
- Generated export labels can follow the selected interface language when a reviewed translation exists.

Automated locale tests protect against accidentally dropping existing translation keys. They are not a substitute for human language review.
