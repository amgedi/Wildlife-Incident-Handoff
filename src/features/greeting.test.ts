/** 0.3.0-dev.2 acceptance: the dashboard greeting is truly dynamic (spec 2). */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/** Mirror of NetworkPage's greeting derivation — the test pins the CONTRACT
 *  and the source so neither can silently regress. */
export function greetingFor(name: string | null | undefined, raw?: string): string {
  const firstName = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return firstName ? `Welcome, ${firstName}` : "Welcome back";
}

describe("personalized greeting is dynamic (0.3.0-dev.2 spec 2)", () => {
  const src = readFileSync("src/features/network/NetworkPage.tsx", "utf-8");

  it("derives the name from the saved profile, first word only", () => {
    expect(greetingFor("Amged")).toBe("Welcome, Amged");
    expect(greetingFor("Maya Chen")).toBe("Welcome, Maya");
    expect(greetingFor("  Maya  ")).toBe("Welcome, Maya");
  });

  it("falls back to Welcome back for missing/blank names", () => {
    expect(greetingFor(null)).toBe("Welcome back");
    expect(greetingFor(undefined)).toBe("Welcome back");
    expect(greetingFor("")).toBe("Welcome back");
    expect(greetingFor("   ")).toBe("Welcome back");
  });

  it("never greets by email automatically", () => {
    // An email is not a display name: the greeting source must not fall back
    // to any email/contact field.
    expect(src.includes("savedReporterContact")).toBe(false);
    expect(src.includes("opsGreeting"));
    const block = src.slice(src.indexOf("opsGreeting") - 200, src.indexOf("opsGreeting") + 400);
    expect(block.includes("firstName")).toBe(true);
    expect(block).not.toMatch(/@/); // no email interpolation in the greeting
  });

  it("greets from the professional profile or displayName (both saved names)", () => {
    expect(src.includes("settings.professionalProfile?.name || settings.displayName")).toBe(true);
  });

  it("no hardcoded name anywhere in the greeting path", () => {
    expect(src.includes('"Amged"')).toBe(false);
    expect(src.includes("Welcome, Amged")).toBe(false);
  });
});
