/**
 * i18n runtime — one application-wide localization system.
 *
 * - English namespace files live in locales/en/*.json (feature namespaces)
 *   and are bundled (they are also the fallback for every other language).
 * - Every other language is a single lazy-loaded pack (locales/<lang>.json)
 *   with the same top-level namespaces — loaded on demand, never at startup.
 * - Completeness metadata (LANGUAGE_CATALOG) drives the picker and the
 *   LOCALIZATION_COVERAGE document; a language is only advertised as
 *   "complete" when it truly covers the full key set (asserted by tests).
 * - RTL languages flip document direction; user data (IDs, coordinates,
 *   filenames) is bidi-isolated at render sites via <bdi> where needed.
 * - Live switching: changeLanguage() updates every screen without restart.
 * - Development missing-key warnings; production falls back to English.
 */
import i18next, { type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enTitlebar from "./locales/en/titlebar.json";
import enNavigation from "./locales/en/navigation.json";
import enHome from "./locales/en/home.json";
import enReports from "./locales/en/reports.json";
import enWizard from "./locales/en/wizard.json";
import enSettings from "./locales/en/settings.json";
import enGuidance from "./locales/en/guidance.json";
import enWorkspace from "./locales/en/workspace.json";
import enProfessional from "./locales/en/professional.json";
import enStatus from "./locales/en/status.json";
import enValidation from "./locales/en/validation.json";
import enTabs from "./locales/en/tabs.json";

export const EN_NAMESPACES = {
  common: enCommon,
  titlebar: enTitlebar,
  navigation: enNavigation,
  home: enHome,
  reports: enReports,
  wizard: enWizard,
  settings: enSettings,
  guidance: enGuidance,
  workspace: enWorkspace,
  professional: enProfessional,
  status: enStatus,
  validation: enValidation,
  tabs: enTabs,
};

export type NamespaceName = keyof typeof EN_NAMESPACES;

export interface LanguageMeta {
  code: string;
  nativeName: string;
  /** "complete" = full catalog (tests assert 0 missing keys); "beta" = partial, falls back to English. */
  completeness: "complete" | "beta";
  dir: "ltr" | "rtl";
}

export const LANGUAGE_CATALOG: LanguageMeta[] = [
  { code: "en", nativeName: "English", completeness: "complete", dir: "ltr" },
  { code: "fr", nativeName: "Français", completeness: "complete", dir: "ltr" },
  { code: "es", nativeName: "Español", completeness: "complete", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", completeness: "beta", dir: "ltr" },
  { code: "pt-BR", nativeName: "Português (Brasil)", completeness: "beta", dir: "ltr" },
  { code: "nl", nativeName: "Nederlands", completeness: "beta", dir: "ltr" },
  { code: "it", nativeName: "Italiano", completeness: "beta", dir: "ltr" },
  { code: "pl", nativeName: "Polski", completeness: "beta", dir: "ltr" },
  { code: "tr", nativeName: "Türkçe", completeness: "beta", dir: "ltr" },
  { code: "ar", nativeName: "العربية", completeness: "beta", dir: "rtl" },
  { code: "zh-CN", nativeName: "简体中文", completeness: "beta", dir: "ltr" },
  { code: "ja", nativeName: "日本語", completeness: "beta", dir: "ltr" },
  { code: "ko", nativeName: "한국어", completeness: "beta", dir: "ltr" },
];

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export function languageDir(lang: string): "rtl" | "ltr" {
  return RTL_LANGUAGES.has(lang.split("-")[0] ?? lang) ? "rtl" : "ltr";
}

const loadedLanguages = new Set<string>(["en"]);

export async function loadLanguagePack(lang: string): Promise<void> {
  if (loadedLanguages.has(lang)) return;
  if (lang === "en") return;
  const mod = (await import(`./locales/${lang}.json`)) as { default: Record<string, Record<string, unknown>> };
  for (const [ns, data] of Object.entries(mod.default)) {
    i18next.addResourceBundle(lang, ns, data, true, true);
  }
  loadedLanguages.add(lang);
}

export async function changeLanguage(lang: string): Promise<void> {
  await loadLanguagePack(lang);
  await i18next.changeLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = languageDir(lang);
}

export function suggestLanguage(): string {
  const candidates = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : ["en"];
  for (const cand of candidates) {
    const exact = LANGUAGE_CATALOG.find((l) => l.code.toLowerCase() === cand.toLowerCase());
    if (exact) return exact.code;
    const base = (cand.split("-")[0] ?? "").toLowerCase();
    const partial = LANGUAGE_CATALOG.find((l) => l.code.split("-")[0] === base);
    if (partial) return partial.code;
  }
  return "en";
}

void i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: Object.keys(EN_NAMESPACES),
  resources: { en: EN_NAMESPACES as never },
  interpolation: { escapeValue: false },
  returnNull: false,
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (_lngs, _ns, key) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing key: ${key}`);
    }
  },
});

document.documentElement.dir = languageDir(i18next.language);
document.documentElement.lang = i18next.language;

export const i18n: I18n = i18next;
export type { I18n };
