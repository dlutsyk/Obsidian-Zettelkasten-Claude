import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import {
  buildSyncEntries,
  diffEntries,
  applyEntries,
  type SyncEntry,
} from "../../src/init/updater.js";

let tmp: string;
let templatesDir: string;
let vault: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "zk-upd-"));
  templatesDir = join(tmp, "templates");
  vault = join(tmp, "vault");
  mkdirSync(join(vault, ".zk"), { recursive: true });
  mkdirSync(join(vault, "Templates"), { recursive: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("diffEntries", () => {
  it("detects add when dest missing", () => {
    const entries: SyncEntry[] = [{ label: "a.md", srcContent: "new", destPath: join(vault, "a.md") }];
    expect(diffEntries(entries)).toEqual([{ file: "a.md", action: "add" }]);
  });

  it("detects update when content differs", () => {
    writeFileSync(join(vault, "a.md"), "old");
    const entries: SyncEntry[] = [{ label: "a.md", srcContent: "new", destPath: join(vault, "a.md") }];
    expect(diffEntries(entries)).toEqual([{ file: "a.md", action: "update" }]);
  });

  it("returns empty when up to date", () => {
    writeFileSync(join(vault, "a.md"), "same");
    const entries: SyncEntry[] = [{ label: "a.md", srcContent: "same", destPath: join(vault, "a.md") }];
    expect(diffEntries(entries)).toEqual([]);
  });
});

describe("applyEntries", () => {
  it("writes files, creating dirs as needed", () => {
    const dest = join(vault, "sub", "dir", "file.md");
    applyEntries([{ label: "x", srcContent: "content", destPath: dest }]);
    expect(readFileSync(dest, "utf-8")).toBe("content");
  });
});

describe("buildSyncEntries", () => {
  it("includes note templates", () => {
    mkdirSync(join(templatesDir, "vault-folders", "Templates"), { recursive: true });
    writeFileSync(join(templatesDir, "vault-folders", "Templates", "Fleeting Note.md"), "tpl");
    const entries = buildSyncEntries(templatesDir, vault, "uk", true);
    const tpl = entries.find((e) => e.label === "Templates/Fleeting Note.md");
    expect(tpl).toBeDefined();
    expect(tpl!.srcContent).toBe("tpl");
  });

  it("includes skills when installSkills=true", () => {
    mkdirSync(join(templatesDir, "claude", "skills", "zk-capture"), { recursive: true });
    writeFileSync(join(templatesDir, "claude", "skills", "zk-capture", "SKILL.md"), "skill");
    const entries = buildSyncEntries(templatesDir, vault, "uk", true);
    expect(entries.find((e) => e.label === ".claude/skills/zk-capture/SKILL.md")).toBeDefined();
  });

  it("excludes skills when installSkills=false", () => {
    mkdirSync(join(templatesDir, "claude", "skills", "zk-capture"), { recursive: true });
    writeFileSync(join(templatesDir, "claude", "skills", "zk-capture", "SKILL.md"), "skill");
    mkdirSync(join(templatesDir, "claude", "agents"), { recursive: true });
    writeFileSync(join(templatesDir, "claude", "agents", "bot.md"), "agent");
    const entries = buildSyncEntries(templatesDir, vault, "uk", false);
    expect(entries.filter((e) => e.label.startsWith(".claude/"))).toEqual([]);
  });

  it("includes agents", () => {
    mkdirSync(join(templatesDir, "claude", "agents"), { recursive: true });
    writeFileSync(join(templatesDir, "claude", "agents", "analyzer.md"), "agent");
    const entries = buildSyncEntries(templatesDir, vault, "uk", true);
    expect(entries.find((e) => e.label === ".claude/agents/analyzer.md")).toBeDefined();
  });

  it("includes CLAUDE.md with language substitution", () => {
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(join(templatesDir, "CLAUDE.md.template"), "lang: {{language}}");
    const entries = buildSyncEntries(templatesDir, vault, "en", true);
    const claude = entries.find((e) => e.label === "CLAUDE.md");
    expect(claude).toBeDefined();
    expect(claude!.srcContent).toBe("lang: en");
  });

  it("returns empty when templates dir missing", () => {
    expect(buildSyncEntries(join(tmp, "nope"), vault, "uk", true)).toEqual([]);
  });
});

describe("end-to-end: build → diff → apply", () => {
  it("detects and applies new template", () => {
    mkdirSync(join(templatesDir, "vault-folders", "Templates"), { recursive: true });
    writeFileSync(join(templatesDir, "vault-folders", "Templates", "Note.md"), "content");

    const entries = buildSyncEntries(templatesDir, vault, "uk", false);
    const changes = diffEntries(entries);
    expect(changes).toContainEqual({ file: "Templates/Note.md", action: "add" });

    applyEntries(entries.filter((e) => e.label === "Templates/Note.md"));
    expect(readFileSync(join(vault, "Templates", "Note.md"), "utf-8")).toBe("content");
  });

  it("detects update, re-diffing shows no changes", () => {
    mkdirSync(join(templatesDir, "vault-folders", "Templates"), { recursive: true });
    writeFileSync(join(templatesDir, "vault-folders", "Templates", "Note.md"), "v2");
    writeFileSync(join(vault, "Templates", "Note.md"), "v1");

    const entries = buildSyncEntries(templatesDir, vault, "uk", false);
    expect(diffEntries(entries)).toContainEqual({ file: "Templates/Note.md", action: "update" });

    applyEntries(entries);
    // Re-build and diff — should be empty now
    const entries2 = buildSyncEntries(templatesDir, vault, "uk", false);
    expect(diffEntries(entries2)).toEqual([]);
  });
});
