/** International phone parsing/formatting via libphonenumber-js.
 *  Never assume +1: the caller's country/region is only a parsing hint,
 *  and raw input is preserved when it cannot be confidently parsed. */
import { parsePhoneNumberFromString, AsYouType, type CountryCode } from "libphonenumber-js";

function hintToCountry(country: string): CountryCode | undefined {
  const c = (country || "").toUpperCase();
  if (!c || c === "OTHER") return undefined;
  return /^[A-Z]{2}$/.test(c) ? (c as CountryCode) : undefined;
}

export interface PhoneParseResult {
  /** E.164 when confidently parsed (e.g. "+447700900123"), otherwise the raw input. */
  e164: string | null;
  /** Pretty international display (e.g. "+44 7700 900123"), when parsed. */
  display: string | null;
  /** National format for local display (e.g. "07700 900123"). */
  national: string | null;
  valid: boolean;
  country: string | null;
}

export function parsePhone(raw: string, countryHint = ""): PhoneParseResult {
  const input = (raw || "").trim();
  if (!input) return { e164: null, display: null, national: null, valid: false, country: null };
  const hint = hintToCountry(countryHint);
  const parsed = parsePhoneNumberFromString(input, hint) ?? (hint ? parsePhoneNumberFromString(input) : null);
  if (parsed) {
    return {
      e164: parsed.number,
      display: parsed.formatInternational(),
      national: parsed.formatNational(),
      valid: parsed.isValid(),
      country: parsed.country ?? null,
    };
  }
  return { e164: null, display: null, national: null, valid: false, country: null };
}

/** Live "as you type" formatting for input fields; returns the raw string unchanged when unparseable. */
export function formatAsYouType(raw: string, countryHint = ""): string {
  if (!raw.trim()) return raw;
  const typer = new AsYouType(hintToCountry(countryHint));
  return typer.input(raw) || raw;
}

/** True when the number parses and passes libphonenumber validation. */
export function isValidPhone(raw: string, countryHint = ""): boolean {
  return parsePhone(raw, countryHint).valid;
}

/** Best-effort storage normalization: E.164 when valid, raw when not (never destroys user data). */
export function normalizePhoneForStorage(raw: string, countryHint = ""): string {
  const p = parsePhone(raw, countryHint);
  return p.valid && p.e164 ? p.e164 : raw.trim();
}

/** Display string for a stored phone: international format when it looks like E.164. */
export function displayPhone(stored: string): string {
  const value = (stored || "").trim();
  if (!value) return "";
  if (value.startsWith("+")) {
    const p = parsePhone(value);
    if (p.display) return p.display;
  }
  return value;
}
