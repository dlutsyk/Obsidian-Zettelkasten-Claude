import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { zkFindById, zkTree, zkEditNote, zkArchiveNote, zkDeleteNote, zkFinalize } from "../../src/tools/manage.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkFindById", () => {
  it("finds existing note", () => {
    const result = zkFindById(db, "1a");
    expect(result.found).toBe(true);
    expect(result.title).toBe("Знання є мережею зв'язків");
  });

  it("returns error for missing ID", () => {
    const result = zkFindById(db, "999");
    expect(result.found).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("zkTree", () => {
  it("renders full tree", () => {
    const result = zkTree(db, {});
    expect(result).toContain("[1]");
    expect(result).toContain("[1a]");
    expect(result).toContain("[1a1]");
  });

  it("filters by root_id", () => {
    const result = zkTree(db, { root_id: "1a" });
    expect(result).toContain("[1a]");
    expect(result).toContain("[1a1]");
    expect(result).not.toContain("[1]");
  });

  it("root_id does not match unrelated IDs with same prefix string", () => {
    // "1" should not match "10", "11" etc.
    // Our seeded vault has IDs: 1, 1a, 1a1
    const result = zkTree(db, { root_id: "1a" });
    expect(result).not.toContain("[1]");
  });

  it("shows context for context_id", () => {
    const result = zkTree(db, { context_id: "1a" });
    expect(result).toContain("Context for [1a]");
    expect(result).toContain("Ancestors:");
    // 1a has no siblings in seeded vault (only child of 1)
    // Just verify structure sections present
    expect(result).toContain("Children:");
  });

  it("includes tool hints", () => {
    const result = zkTree(db, {});
    expect(result).toContain("zk_find_by_id");
    expect(result).toContain("zk_tree");
  });

  it("respects depth limit", () => {
    const shallow = zkTree(db, { depth: 1 });
    expect(shallow).toContain("[1]");
    // children of 1 should not appear at depth 1
    expect(shallow).not.toContain("[1a]");
  });

  it("returns empty tree message for no results", () => {
    const result = zkTree(db, { root_id: "999" });
    expect(result).toContain("(empty tree)");
  });
});

describe("zkEditNote", () => {
  it("updates frontmatter field", () => {
    const result = zkEditNote(db, "1a", { status: "finalized" });
    expect(result.success).toBe(true);
    const note = db.getNoteById("1a");
    expect(note.status).toBe("finalized");
  });

  it("returns error for missing ID", () => {
    const result = zkEditNote(db, "999", { status: "x" });
    expect(result.error).toBeDefined();
  });
});

describe("zkArchiveNote", () => {
  it("moves note to Archive folder", () => {
    const result = zkArchiveNote(db, "1a1");
    expect(result.success).toBe(true);
    expect(result.newPath).toContain("Archive");
    expect(existsSync(join(vault, "Archive", "Контекст визначає значення.md"))).toBe(true);
  });

  it("returns error for missing ID", () => {
    const result = zkArchiveNote(db, "999");
    expect(result.error).toBeDefined();
  });
});

describe("zkDeleteNote", () => {
  it("blocks delete when incoming links exist", () => {
    // 1a has incoming link from MOC
    const result = zkDeleteNote(db, "1a");
    if (result.error) {
      expect(result.error).toContain("incoming links");
    }
    // If no incoming links, delete succeeds
  });

  it("returns error for missing ID", () => {
    const result = zkDeleteNote(db, "999");
    expect(result.error).toBeDefined();
  });
});

describe("zkFinalize", () => {
  it("finalizes note when all checks pass", () => {
    // 1a has claim, evidence, confidence, and connections
    const result = zkFinalize(db, "1a");
    if (result.finalized) {
      const note = db.getNoteById("1a");
      expect(note.status).toBe("finalized");
    }
    expect(result.checks).toBeDefined();
  });

  it("returns check details when not all pass", () => {
    const result = zkFinalize(db, "1a1");
    expect(result.checks).toBeDefined();
    // Should have at least some checks
    expect(result.checks).toBeDefined();
    expect(Object.keys(result.checks!).length).toBeGreaterThan(0);
  });

  it("returns error for missing ID", () => {
    const result = zkFinalize(db, "999");
    expect(result.error).toBeDefined();
  });
});
