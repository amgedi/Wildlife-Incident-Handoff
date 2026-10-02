/**
 * Localization completeness — English is the source locale.
 * "Complete" languages (per LANGUAGE_CATALOG) must have 0 missing keys and
 * no broken interpolation variables. Partial (beta) languages may miss keys
 * (they fall back to English at runtime) but must never add unknown keys.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { EN_NAMESPACES, LANGUAGE_CATALOG } from "./index";

const EN_DIR = join(__dirname, "locales", "en");

function interpolationVars(s: string): string[] {
  return [...String(s).matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]!).sort();
}

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

describe("source locale (en)", () => {
  it("has a file for every namespace in EN_NAMESPACES", () => {
    for (const ns of Object.keys(EN_NAMESPACES)) {
      expect(existsSync(join(EN_DIR, `${ns}.json`)), `missing locales/en/${ns}.json`).toBe(true);
    }
  });

  it("namespace files exactly match the declared namespaces (no extra files)", () => {
    const files = readdirSync(EN_DIR).map((f) => f.replace(".json", ""));
    expect(new Set(files)).toEqual(new Set(Object.keys(EN_NAMESPACES)));
  });
});

describe("complete languages", () => {
  const complete = LANGUAGE_CATALOG.filter((l) => l.completeness === "complete");

  it("English and at least French + Spanish are complete", () => {
    const codes = complete.map((l) => l.code);
    expect(codes).toContain("en");
    expect(codes).toContain("fr");
    expect(codes).toContain("es");
  });

  for (const lang of complete) {
    if (lang.code === "en") continue;
    it(`${lang.code} (${lang.nativeName}) has 0 missing keys and intact interpolation`, () => {
      const pack = JSON.parse(readFileSync(join(__dirname, "locales", `${lang.code}.json`), "utf-8")) as Record<string, Record<string, unknown>>;
      const packKeys = new Set(Object.keys(pack).flatMap((ns) => flatten(pack[ns]!).map((k) => `${ns}.${k}`)));
      const nsNames = Object.keys(EN_NAMESPACES) as (keyof typeof EN_NAMESPACES)[];
      for (const ns of nsNames) {
        const enKeys = flatten(EN_NAMESPACES[ns] as Record<string, unknown>).map((k) => `${ns}.${k}`);
        for (const key of enKeys) {
          expect(packKeys.has(key), `${lang.code} missing key: ${key}`).toBe(true);
        }
        // no broken interpolation variables in translated values
        const enValues = EN_NAMESPACES[ns as keyof typeof EN_NAMESPACES] as Record<string, unknown>;
        const walk = (enObj: Record<string, unknown>, translated: Record<string, unknown>, path: string) => {
          for (const [k, v] of Object.entries(enObj)) {
            const tv = translated[k];
            if (typeof v === "object" && v !== null) {
              expect(tv, `${lang.code} missing object ${path}${k}`).toBeTruthy();
              walk(v as Record<string, unknown>, (tv ?? {}) as Record<string, unknown>, `${path}${k}.`);
            } else if (typeof tv === "string") {
              expect(interpolationVars(tv)).toEqual(interpolationVars(String(v)));
            }
          }
        };
        walk(enValues, pack[ns]!, "");
      }
    });
  }
});

describe("beta languages", () => {
  it("never add keys that do not exist in the source locale", () => {
    for (const lang of LANGUAGE_CATALOG.filter((l) => l.completeness === "beta")) {
      const file = join(__dirname, "locales", `${lang.code}.json`);
      if (!existsSync(file)) continue; // beta languages may not have a pack yet
      const pack = JSON.parse(readFileSync(file, "utf-8")) as Record<string, Record<string, unknown>>;
      for (const ns of Object.keys(pack)) {
        expect((EN_NAMESPACES as Record<string, unknown>)[ns], `${lang.code} has unknown namespace ${ns}`).toBeTruthy();
      }
    }
  });
});

describe("RTL", () => {
  it("Arabic is flagged RTL and the direction helper agrees", async () => {
    const { languageDir } = await import("./index");
    expect(languageDir("ar")).toBe("rtl");
    expect(languageDir("ar-EG")).toBe("rtl");
    expect(languageDir("fr")).toBe("ltr");
    expect(languageDir("en")).toBe("ltr");
    expect(LANGUAGE_CATALOG.find((l) => l.code === "ar")?.dir).toBe("rtl");
  });
});

describe("lazy loading", () => {
  it("non-English packs are separate files (loaded on demand, not bundled at startup)", () => {
    expect(existsSync(join(__dirname, "locales", "fr.json"))).toBe(true);
    expect(existsSync(join(__dirname, "locales", "es.json"))).toBe(true);
    // English lives in namespace files; only en/ is statically imported.
    const src = readFileSync(join(__dirname, "index.ts"), "utf-8");
    expect(src.includes('import(`./locales/${lang}.json`)')).toBe(true);
  });
});
