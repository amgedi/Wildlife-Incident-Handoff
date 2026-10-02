/**
 * Safe text helpers. All user-supplied text must be rendered with these
 * semantics: React escapes by default, so the rule is simply "never use
 * innerHTML/dangerouslySetInnerHTML with user data". These helpers also
 * strip control characters for file names and clipboard-safe text.
 */

/** Remove control characters and trim — used before storing free text. */
export function cleanText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

/** Strip anything unsafe for use inside a file name. */
export function safeFileName(name: string, fallback = "attachment"): string {
  const base = name.split(/[/\\]/).pop() ?? fallback;
  const cleaned = base.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "_").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Simple word-based search: case-insensitive, all terms must match. */
export function matchesSearch(haystacks: (string | null | undefined)[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = haystacks.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((term) => hay.includes(term));
}
