import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseFrontmatter, getBody, getTags, getWikilinks } from "../../src/vault/parser.js";
import { createTempVault, writeFixture, cleanupVault, FLEETING_NOTE, PERMANENT_NOTE, NO_FRONTMATTER_NOTE } from "../helpers/vault.js";

let vault: string;
beforeEach(() => { vault = createTempVault(); });
afterEach(() => { cleanupVault(vault); });

describe("parseFrontmatter", () => {
  it("parses standard YAML fields", () => {
    const p = writeFixture(vault, "test/note.md", PERMANENT_NOTE);
    const fm = parseFrontmatter(p);
    expect(fm.type).toBe("permanent");
    expect(fm.zk_id).toBe("1a");
    expect(fm.confidence).toBe("high");
  });

  it("parses array tags", () => {
    const p = writeFixture(vault, "test/note.md", FLEETING_NOTE);
    const fm = parseFrontmatter(p);
    expect(fm.tags).toEqual(["fleeting", "epistemology"]);
  });

  it("returns empty for file without frontmatter", () => {
    const p = writeFixture(vault, "test/note.md", NO_FRONTMATTER_NOTE);
    const fm = parseFrontmatter(p);
    expect(fm).toEqual({});
  });

  it("returns empty for missing file", () => {
    expect(parseFrontmatter("/nonexistent/path.md")).toEqual({});
  });

  it("parses empty array as []", () => {
    const content = `---
type: test
aliases: []
---
body`;
    const p = writeFixture(vault, "test/note.md", content);
    const fm = parseFrontmatter(p);
    expect(fm.aliases).toEqual([]);
  });

  it("parses quoted values stripping quotes", () => {
    const content = `---
claim: "Something with: colons"
---
body`;
    const p = writeFixture(vault, "test/note.md", content);
    const fm = parseFrontmatter(p);
    expect(fm.claim).toBe("Something with: colons");
  });
});

describe("getBody", () => {
  it("returns text after frontmatter", () => {
    const p = writeFixture(vault, "test/note.md", `---\ntype: test\n---\nBody here`);
    expect(getBody(p).trim()).toBe("Body here");
  });

  it("returns full text if no frontmatter", () => {
    const p = writeFixture(vault, "test/note.md", NO_FRONTMATTER_NOTE);
    expect(getBody(p)).toBe(NO_FRONTMATTER_NOTE);
  });

  it("returns empty for missing file", () => {
    expect(getBody("/nonexistent")).toBe("");
  });
});

describe("getTags", () => {
  it("filters out type tags", () => {
    const tags = getTags({ tags: ["fleeting", "epistemology", "permanent"] });
    expect(tags).toEqual(["epistemology"]);
  });

  it("handles string tag", () => {
    const tags = getTags({ tags: "epistemology" });
    expect(tags).toEqual(["epistemology"]);
  });

  it("returns empty for no tags", () => {
    expect(getTags({})).toEqual([]);
  });
});

describe("getWikilinks", () => {
  it("extracts wikilinks", () => {
    const p = writeFixture(vault, "test/note.md", "Some text [[Link One]] and [[Link Two]].");
    const links = getWikilinks(p);
    expect(links).toEqual(new Set(["Link One", "Link Two"]));
  });

  it("strips aliases", () => {
    const p = writeFixture(vault, "test/note.md", "See [[Target|display text]].");
    const links = getWikilinks(p);
    expect(links).toEqual(new Set(["Target"]));
  });

  it("deduplicates", () => {
    const p = writeFixture(vault, "test/note.md", "[[A]] and [[A]] again.");
    expect(getWikilinks(p).size).toBe(1);
  });

  it("returns empty set for missing file", () => {
    expect(getWikilinks("/nonexistent")).toEqual(new Set());
  });
});
