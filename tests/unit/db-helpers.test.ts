import { describe, it, expect } from "vitest";
import { sectionContent, extractFlags, extractSummary, luhmannProximity } from "../../src/db/index.js";

describe("sectionContent", () => {
  const body = `## Claim (Твердження)

Some claim text

## Elaboration (Розкриття)

Explanation here

## Evidence & Support (Докази та підтримка)

- Fact 1
- Fact 2`;

  it("extracts section between headings", () => {
    expect(sectionContent(body, "## Claim (Твердження)")).toBe("Some claim text");
  });

  it("extracts last section (no following heading)", () => {
    const content = sectionContent(body, "## Evidence & Support (Докази та підтримка)");
    expect(content).toContain("- Fact 1");
    expect(content).toContain("- Fact 2");
  });

  it("returns null for missing heading", () => {
    expect(sectionContent(body, "## Nonexistent")).toBeNull();
  });

  it("returns empty string for empty section", () => {
    const b = "## Claim (Твердження)\n\n## Next";
    expect(sectionContent(b, "## Claim (Твердження)")).toBe("");
  });
});

describe("extractFlags", () => {
  it("detects all filled sections for permanent note", () => {
    const fm = { confidence: "high", claim: "test" } as any;
    const body = `## Claim (Твердження)\n\nSome claim\n\n## Elaboration (Розкриття)\n\nSome elab\n\n## Evidence & Support (Докази та підтримка)\n\n- Evidence\n\n## Counterpoints & Limitations (Контраргументи та обмеження)\n\n- Counter`;
    const flags = extractFlags(fm, body, "permanent");
    expect(flags.has_claim).toBe(true);
    expect(flags.has_elaboration).toBe(true);
    expect(flags.has_evidence).toBe(true);
    expect(flags.has_counterpoints).toBe(true);
    expect(flags.has_confidence).toBe(true);
  });

  it("marks evidence false when only dash placeholder", () => {
    const fm = {} as any;
    const body = `## Evidence & Support (Докази та підтримка)\n\n-`;
    const flags = extractFlags(fm, body, "permanent");
    expect(flags.has_evidence).toBe(false);
  });

  it("marks counterpoints false when only dash", () => {
    const fm = {} as any;
    const body = `## Counterpoints & Limitations (Контраргументи та обмеження)\n\n-`;
    const flags = extractFlags(fm, body, "permanent");
    expect(flags.has_counterpoints).toBe(false);
  });

  it("detects fleeting thought section", () => {
    const fm = {} as any;
    const body = `## Thought (Думка)\n\nMy thought here`;
    const flags = extractFlags(fm, body, "fleeting");
    expect(flags.has_thought).toBe(true);
  });

  it("returns empty for unknown type", () => {
    expect(extractFlags({} as any, "body", "moc")).toEqual({});
  });

  it("returns empty for undefined type", () => {
    expect(extractFlags({} as any, "body", undefined)).toEqual({});
  });

  it("confidence from frontmatter sets flag", () => {
    const flags = extractFlags({ confidence: "high" } as any, "", "permanent");
    expect(flags.has_confidence).toBe(true);
  });
});

describe("extractSummary", () => {
  it("uses claim for permanent notes", () => {
    const fm = { claim: "My claim" } as any;
    expect(extractSummary(fm, "body text", "permanent")).toBe("My claim");
  });

  it("uses first paragraph for literature", () => {
    const body = "# Title\n\nFirst paragraph of summary.\n\n## Section";
    expect(extractSummary({} as any, body, "literature")).toBe("First paragraph of summary.");
  });

  it("uses Thought section for fleeting", () => {
    const body = "## Thought (Думка)\n\nMy thought text\n\n## Context";
    expect(extractSummary({} as any, body, "fleeting")).toBe("My thought text");
  });

  it("falls back to first 500 chars", () => {
    const body = "Some generic text here";
    expect(extractSummary({} as any, body, undefined)).toBe("Some generic text here");
  });

  it("truncates at 500 chars", () => {
    const long = "x".repeat(600);
    expect(extractSummary({} as any, long, undefined).length).toBe(500);
  });
});

describe("luhmannProximity", () => {
  it("returns 7 for parent-child", () => {
    expect(luhmannProximity("1", "1a")).toBe(7);
    expect(luhmannProximity("1a", "1")).toBe(7);
  });

  it("returns 5 for siblings", () => {
    expect(luhmannProximity("1a", "1b")).toBe(5);
  });

  it("returns 2 for cousins", () => {
    expect(luhmannProximity("1a1", "1b1")).toBe(2);
  });

  it("returns 0 for unrelated", () => {
    expect(luhmannProximity("1", "2")).toBe(0);
  });

  it("returns 0 for null IDs", () => {
    expect(luhmannProximity(null, "1")).toBe(0);
    expect(luhmannProximity("1", null)).toBe(0);
    expect(luhmannProximity(null, null)).toBe(0);
  });
});
