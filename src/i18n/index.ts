/**
 * Minimal i18n layer. English is complete; other locales can be added by
 * adding a dictionary and falling back to English keys.
 */
import { en } from "./en";

export type LocaleKey = keyof typeof en;

const dictionaries: Record<string, Partial<Record<LocaleKey, string>>> = {
  en,
};

let currentLocale = "en";

export function setLocale(locale: string): void {
  if (dictionaries[locale]) currentLocale = locale;
}

export function t(key: LocaleKey, vars?: Record<string, string | number>): string {
  const dict = dictionaries[currentLocale] ?? en;
  let text = dict[key] ?? en[key] ?? String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
