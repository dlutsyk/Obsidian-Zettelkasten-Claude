import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ZkDatabase } from "../../src/db/index.js";
import { createTempVault, writeFixture, cleanupVault, FLEETING_NOTE, PERMANENT_NOTE, PERMANENT_NOTE_2 } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); });
afterEach(() => { db?.close(); cleanupVault(vault); });

describe("ZkDatabase constructor", () => {
  it("creates .zk directory and database", () => {
    db = new ZkDatabase(vault);
    expect(existsSync(join(vault, ".zk", "zettelkasten.db"))).toBe(true);
  });
});

describe("reindex", () => {
  it("indexes all vault notes", () => {
    writeFixture(vault, "1-Fleeting/note.md", FLEETING_NOTE);
    writeFixture(vault, "3-Permanent/perm.md", PERMANENT_NOTE_2);
    db = new ZkDatabase(vault);
    const result = db.reindex();
    expect(result.added).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("skips unchanged files on re-index", () => {
    writeFixture(vault, "1-Fleeting/note.md", FLEETING_NOTE);
    db = new ZkDatabase(vault);
    db.reindex();
    const result = db.reindex();
    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
  });

  it("detects removed files", () => {
    writeFixture(vault, "1-Fleeting/note.md", FLEETING_NOTE);
    db = new ZkDatabase(vault);
    db.reindex();
    unlinkSync(join(vault, "1-Fleeting/note.md"));
    const result = db.reindex();
    expect(result.removed).toBe(1);
  });

  it("detects updated files", () => {
    writeFixture(vault, "1-Fleeting/note.md", FLEETING_NOTE);
    db = new ZkDatabase(vault);
    db.reindex();
    writeFixture(vault, "1-Fleeting/note.md", FLEETING_NOTE + "\nExtra content");
    const result = db.reindex();
    expect(result.updated).toBe(1);
  });
});

describe("indexNote", () => {
  it("inserts note with correct fields", () => {
    writeFixture(vault, "3-Permanent/note.md", PERMANENT_NOTE);
    db = new ZkDatabase(vault);
    db.indexNote("3-Permanent/note.md");
    const note = db.getNoteByPath("3-Permanent/note.md");
    expect(note).toBeTruthy();
    expect(note.type).toBe("permanent");
    expect(note.zk_id).toBe("1a");
    expect(note.status).toBe("draft");
    expect(note.folder).toBe("3-Permanent");
  });

  it("populates links from wikilinks", () => {
    writeFixture(vault, "3-Permanent/note.md", PERMANENT_NOTE);
    db = new ZkDatabase(vault);
    db.indexNote("3-Permanent/note.md");
    const links = db.getLinksFrom("3-Permanent/note.md");
    expect(links.length).toBeGreaterThan(0);
  });
});

describe("removeNote", () => {
  it("deletes note and its links", () => {
    db = seedAndIndex(vault);
    db.removeNote("3-Permanent/Знання є мережею зв'язків.md");
    expect(db.getNoteByPath("3-Permanent/Знання є мережею зв'язків.md")).toBeUndefined();
    expect(db.getLinksFrom("3-Permanent/Знання є мережею зв'язків.md")).toHaveLength(0);
  });
});

describe("query methods", () => {
  beforeEach(() => { db = seedAndIndex(vault); });

  it("getNoteById returns note by zk_id", () => {
    const note = db.getNoteById("1a");
    expect(note).toBeTruthy();
    expect(note.title).toBe("Знання є мережею зв'язків");
  });

  it("getNoteById returns undefined for missing", () => {
    expect(db.getNoteById("999")).toBeUndefined();
  });

  it("getAllZkIds returns map of IDs", () => {
    const ids = db.getAllZkIds();
    expect(ids.has("1")).toBe(true);
    expect(ids.has("1a")).toBe(true);
    expect(ids.has("1a1")).toBe(true);
  });

  it("listNotes filters by type", () => {
    const fleeting = db.listNotes({ type: "fleeting" });
    expect(fleeting.every((n: any) => n.type === "fleeting")).toBe(true);
  });

  it("listNotes filters by status", () => {
    const finalized = db.listNotes({ status: "finalized" });
    expect(finalized.length).toBeGreaterThan(0);
    expect(finalized.every((n: any) => n.status === "finalized")).toBe(true);
  });

  it("getUnprocessed returns unprocessed/draft notes", () => {
    const notes = db.getUnprocessed();
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n: any) => ["unprocessed", "draft"].includes(n.status))).toBe(true);
  });

  it("getUnprocessed filters by type", () => {
    const fleeting = db.getUnprocessed("fleeting");
    expect(fleeting.every((n: any) => n.type === "fleeting")).toBe(true);
  });

  it("getOrphans returns notes with no incoming links", () => {
    const orphans = db.getOrphans();
    expect(orphans.length).toBeGreaterThan(0);
  });

  it("getStats returns counts", () => {
    const stats = db.getStats();
    expect(stats.total).toBe(6);
    expect(stats.linkCount).toBeGreaterThan(0);
  });
});

describe("findConnections", () => {
  beforeEach(() => { db = seedAndIndex(vault); });

  it("finds candidates by shared tags", () => {
    const candidates = db.findConnections("1-Fleeting/Знання як процес.md");
    expect(candidates.length).toBeGreaterThan(0);
    const reasons = candidates.flatMap((c) => c.reasons);
    expect(reasons.some((r) => r.startsWith("tag:"))).toBe(true);
  });

  it("scores luhmann proximity", () => {
    const candidates = db.findConnections("3-Permanent/Знання як мережа.md");
    const sibling = candidates.find((c) => c.reasons.some((r) => r.includes("luhmann")));
    expect(sibling).toBeTruthy();
  });

  it("excludes already-linked notes", () => {
    const note = db.getNoteByPath("3-Permanent/Знання є мережею зв'язків.md");
    const linkedTargets = db.getLinksFrom(note.path).map((l: any) => l.target);
    const candidates = db.findConnections(note.path);
    for (const c of candidates) {
      expect(linkedTargets).not.toContain(c.path);
    }
  });

  it("returns max 15 candidates", () => {
    const candidates = db.findConnections("3-Permanent/Знання як мережа.md");
    expect(candidates.length).toBeLessThanOrEqual(15);
  });
});

describe("shareMoc", () => {
  beforeEach(() => { db = seedAndIndex(vault); });

  it("returns true for notes sharing a MOC", () => {
    expect(db.shareMoc("3-Permanent/Знання як мережа.md", "3-Permanent/Знання є мережею зв'язків.md")).toBe(true);
  });

  it("returns false for notes not sharing a MOC", () => {
    expect(db.shareMoc("1-Fleeting/Знання як процес.md", "3-Permanent/Контекст визначає значення.md")).toBe(false);
  });
});
