import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { scanVault } from "../../src/vault/scanner.js";
import { createTempVault, writeFixture, cleanupVault } from "../helpers/vault.js";

let vault: string;
beforeEach(() => { vault = createTempVault(); });
afterEach(() => { cleanupVault(vault); });

describe("scanVault", () => {
  it("finds .md files in subdirs", () => {
    writeFixture(vault, "1-Fleeting/note1.md", "# Note");
    writeFixture(vault, "3-Permanent/note2.md", "# Note");
    const notes = scanVault(vault);
    expect(notes.length).toBe(2);
    expect(notes.map((n) => n.relPath).sort()).toEqual(["1-Fleeting/note1.md", "3-Permanent/note2.md"]);
  });

  it("skips .obsidian, .claude, .zk, Templates", () => {
    writeFixture(vault, ".obsidian/config.md", "x");
    writeFixture(vault, ".claude/skills.md", "x");
    writeFixture(vault, ".zk/meta.md", "x");
    writeFixture(vault, "Templates/tmpl.md", "x");
    writeFixture(vault, "1-Fleeting/real.md", "# Real");
    const notes = scanVault(vault);
    expect(notes).toHaveLength(1);
    expect(notes[0].relPath).toBe("1-Fleeting/real.md");
  });

  it("skips CLAUDE.md, Home.md, README.md at any level", () => {
    writeFixture(vault, "1-Fleeting/CLAUDE.md", "x");
    writeFixture(vault, "1-Fleeting/Home.md", "x");
    writeFixture(vault, "1-Fleeting/README.md", "x");
    writeFixture(vault, "1-Fleeting/real.md", "ok");
    const notes = scanVault(vault);
    expect(notes).toHaveLength(1);
  });

  it("skips root-level .md files", () => {
    writeFixture(vault, "1-Fleeting/note.md", "ok");
    writeFileSync(`${vault}/root-note.md`, "root", "utf-8");
    const notes = scanVault(vault);
    expect(notes).toHaveLength(1);
    expect(notes[0].relPath).toBe("1-Fleeting/note.md");
  });

  it("filters by folder", () => {
    writeFixture(vault, "1-Fleeting/a.md", "x");
    writeFixture(vault, "3-Permanent/b.md", "x");
    const notes = scanVault(vault, "3-Permanent");
    expect(notes).toHaveLength(1);
    expect(notes[0].relPath).toBe("3-Permanent/b.md");
  });

  it("returns empty for empty vault", () => {
    expect(scanVault(vault)).toHaveLength(0);
  });
});
