import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createNote, updateFrontmatterField, moveNote, updateSection, deleteNote } from "../../src/vault/writer.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";

let vault: string;
beforeEach(() => { vault = createTempVault(); });
afterEach(() => { cleanupVault(vault); });

describe("createNote", () => {
  it("creates file with frontmatter and body", () => {
    const path = createNote(vault, "1-Fleeting", "Test", { type: "fleeting", tags: ["fleeting"] }, "# Body");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("---");
    expect(content).toContain("type: fleeting");
    expect(content).toContain("# Body");
  });

  it("creates missing directories", () => {
    const path = createNote(vault, "new/nested", "Note", { type: "test" }, "body");
    expect(existsSync(path)).toBe(true);
  });

  it("serializes array fields", () => {
    const path = createNote(vault, "1-Fleeting", "Test", { tags: ["a", "b"] }, "");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("  - a");
    expect(content).toContain("  - b");
  });

  it("serializes empty array as []", () => {
    const path = createNote(vault, "1-Fleeting", "Test", { aliases: [] as any }, "");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("aliases: []");
  });

  it("quotes special characters", () => {
    const path = createNote(vault, "1-Fleeting", "Test", { claim: "has: colon" }, "");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain('"has: colon"');
  });
});

describe("updateFrontmatterField", () => {
  it("updates existing field", () => {
    const path = createNote(vault, "1-Fleeting", "Test", { status: "draft" }, "body");
    updateFrontmatterField(path, "status", "finalized");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("status: finalized");
    expect(content).not.toContain("status: draft");
  });

  it("adds new field", () => {
    const path = createNote(vault, "1-Fleeting", "Test", { type: "test" }, "body");
    updateFrontmatterField(path, "confidence", "high");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("confidence: high");
  });

  it("no-op for file without frontmatter", () => {
    const path = join(vault, "1-Fleeting", "plain.md");
    writeFileSync(path, "no frontmatter here", "utf-8");
    updateFrontmatterField(path, "status", "x");
    expect(readFileSync(path, "utf-8")).toBe("no frontmatter here");
  });
});

describe("moveNote", () => {
  it("moves file to destination folder", () => {
    const path = createNote(vault, "1-Fleeting", "Moving", { type: "test" }, "");
    const newPath = moveNote(path, "Archive", vault);
    expect(existsSync(newPath)).toBe(true);
    expect(existsSync(path)).toBe(false);
    expect(newPath).toContain("Archive");
  });

  it("creates destination directory", () => {
    const path = createNote(vault, "1-Fleeting", "Moving", { type: "test" }, "");
    const newPath = moveNote(path, "NewFolder/Sub", vault);
    expect(existsSync(newPath)).toBe(true);
  });
});

describe("updateSection", () => {
  it("replaces section content", () => {
    const path = createNote(vault, "test", "Sec", { type: "test" }, `# Title

## Claim (Твердження)

Old content

## Elaboration (Розкриття)

Other stuff
`);
    updateSection(path, "Claim (Твердження)", "New claim text");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("New claim text");
    expect(content).not.toContain("Old content");
    expect(content).toContain("Other stuff");
  });

  it("no-op for missing section", () => {
    const path = createNote(vault, "test", "Sec", { type: "test" }, "# Title\n\n## Other\n\ncontent");
    updateSection(path, "Nonexistent", "stuff");
    const content = readFileSync(path, "utf-8");
    expect(content).not.toContain("stuff");
  });
});

describe("deleteNote", () => {
  it("removes file from disk", () => {
    const path = createNote(vault, "1-Fleeting", "ToDelete", { type: "test" }, "");
    deleteNote(path);
    expect(existsSync(path)).toBe(false);
  });
});
