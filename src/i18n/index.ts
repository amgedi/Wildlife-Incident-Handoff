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
import enGuide from "./locales/en/guide.json";
import enWorkspace from "./locales/en/workspace.json";
import enProfessional from "./locales/en/professional.json";
import enStatus from "./locales/en/status.json";
import enValidation from "./locales/en/validation.json";
import enTabs from "./locales/en/tabs.json";
import enGlossary from "./locales/en/glossary.json";
import enHelp from "./locales/en/help.json";
import enOnboarding from "./locales/en/onboarding.json";
import enSocial from "./locales/en/social.json";

export const EN_NAMESPACES = {
  common: enCommon,
  titlebar: enTitlebar,
  navigation: enNavigation,
  home: enHome,
  reports: enReports,
  wizard: enWizard,
  settings: enSettings,
  guidance: enGuidance,
  guide: enGuide,
  workspace: enWorkspace,
  professional: enProfessional,
  status: enStatus,
  validation: enValidation,
  tabs: enTabs,
  glossary: enGlossary,
  help: enHelp,
  onboarding: enOnboarding,
  social: enSocial,
};

export type NamespaceName = keyof typeof EN_NAMESPACES;

export interface LanguageMeta {
  code: string;
  nativeName: string;
  /** "complete" = full catalog (tests assert 0 missing keys); "beta" = partial, falls back to English. */
  completeness: "complete" | "beta";
  dir: "ltr" | "rtl";
  /** Selectable languages cover the full interface — they must work (P21/22).
   *  Incomplete languages are hidden from the normal picker and only appear
   *  in developer preview mode (Settings → Advanced → developer preview). */
  selectable?: boolean;
}

export const LANGUAGE_CATALOG: LanguageMeta[] = [
  { code: "en", nativeName: "English", completeness: "complete", dir: "ltr", selectable: true },
  { code: "fr", nativeName: "Français", completeness: "complete", dir: "ltr", selectable: true },
  { code: "es", nativeName: "Español", completeness: "complete", dir: "ltr", selectable: true },
  { code: "de", nativeName: "Deutsch", completeness: "complete", dir: "ltr", selectable: true },
  { code: "pt-BR", nativeName: "Português (Brasil)", completeness: "complete", dir: "ltr", selectable: true },
  { code: "nl", nativeName: "Nederlands", completeness: "beta", dir: "ltr" },
  { code: "it", nativeName: "Italiano", completeness: "beta", dir: "ltr" },
  { code: "pl", nativeName: "Polski", completeness: "beta", dir: "ltr" },
  { code: "tr", nativeName: "Türkçe", completeness: "beta", dir: "ltr" },
  { code: "ar", nativeName: "العربية", completeness: "beta", dir: "rtl" },
  { code: "zh-CN", nativeName: "简体中文", completeness: "beta", dir: "ltr" },
  { code: "ja", nativeName: "日本語", completeness: "beta", dir: "ltr" },
  { code: "ko", nativeName: "한국어", completeness: "beta", dir: "ltr" },
];

/** Languages a normal user may pick: only ones that cover the whole UI.
 *  A developer preview toggle (P25) additionally exposes incomplete locales
 *  and the expanding pseudo-locale zz-ZZ. */
export const PSEUDO_LOCALE = "zz-ZZ";

export function selectableLanguages(devPreview: boolean): LanguageMeta[] {
  const base = LANGUAGE_CATALOG.filter((l) => l.selectable);
  if (!devPreview) return base;
  return [...base, ...LANGUAGE_CATALOG.filter((l) => !l.selectable), { code: PSEUDO_LOCALE, nativeName: "Pseudo-locale (test)", completeness: "beta" as const, dir: "ltr" as const }];
}

/** Pseudo-locale processor: expands strings dramatically so hard-coded
 *  English (which stays short) and layout clipping become obvious. */
const pseudoPostProcessor = {
  type: "postProcessor" as const,
  name: "pseudo",
  process(value: string): string {
    if (!value.trim()) return value;
    const expanded = value
      .replace(/\{\{(\w+)\}\}/g, "{{$1}}")
      .split(" ")
      .join(" ");
    return `[!!! ${expanded} !!!]`;
  },
};
void pseudoPostProcessor;

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export function languageDir(lang: string): "rtl" | "ltr" {
  return RTL_LANGUAGES.has(lang.split("-")[0] ?? lang) ? "rtl" : "ltr";
}

const loadedLanguages = new Set<string>(["en"]);

export async function loadLanguagePack(lang: string): Promise<void> {
  if (loadedLanguages.has(lang)) return;
  // Pseudo-locale is handled directly in changeLanguage.
  if (lang === PSEUDO_LOCALE) {
    loadedLanguages.add(lang);
    return;
  }
  if (lang === "en") return;
  const mod = (await import(`./locales/${lang}.json`)) as { default: Record<string, Record<string, unknown>> };
  for (const [ns, data] of Object.entries(mod.default)) {
    i18next.addResourceBundle(lang, ns, data, true, true);
  }
  loadedLanguages.add(lang);
}

export async function changeLanguage(lang: string): Promise<void> {
  if (lang === PSEUDO_LOCALE) {
    await loadLanguagePack(lang);
    await i18next.changeLanguage("en");
    // Apply the pseudo post-processor for this session.
    for (const ns of Object.keys(EN_NAMESPACES)) {
      const bundle = i18next.getResourceBundle("en", ns) as Record<string, unknown>;
      i18next.addResourceBundle("zz-ZZ", ns, pseudoExpand(bundle), true, true);
    }
    await i18next.changeLanguage("zz-ZZ");
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    return;
  }
  await loadLanguagePack(lang);
  await i18next.changeLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = languageDir(lang);
}

function pseudoExpand(node: unknown): unknown {
  if (typeof node === "string") return `[!!! ${node} !!!]`;
  if (Array.isArray(node)) return node.map(pseudoExpand);
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, pseudoExpand(v)]));
  }
  return node;
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

i18next.use(pseudoPostProcessor);

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
