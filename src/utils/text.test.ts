import { describe, it, expect } from "vitest";
import { cleanText, safeFileName, escapeHtml, truncate, matchesSearch } from "./text";

describe("text safety utilities", () => {
  it("strips control characters", () => {
    expect(cleanText("hello\u0000\u0007world")).toBe("helloworld");
    expect(cleanText("  padded  ")).toBe("padded");
  });

  it("sanitizes file names against traversal and injection", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName('report"<>|?.pdf')).toBe("report_____.pdf");
    expect(safeFileName("")).toBe("attachment");
  });

  it("escapes HTML entities", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });

  it("truncates with ellipsis", () => {
    expect(truncate("abcdefgh", 5)).toBe("abcd…");
    expect(truncate("ab", 5)).toBe("ab");
  });

  it("matches multi-term search case-insensitively", () => {
    expect(matchesSearch(["WIH-2026-000014", "Roadside near wetland"], "wih roadside")).toBe(true);
    expect(matchesSearch(["WIH-2026-000014"], "missing")).toBe(false);
    expect(matchesSearch(["anything"], "  ")).toBe(true);
  });
});
