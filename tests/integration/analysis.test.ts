import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { zkUnprocessed, zkOrphans, zkReview } from "../../src/tools/analysis.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkUnprocessed", () => {
  it("returns grouped unprocessed notes", () => {
    const result = zkUnprocessed(db, {});
    expect(typeof result).toBe("object");
    const allNotes = Object.values(result).flat();
    expect(allNotes.length).toBeGreaterThan(0);
  });

  it("filters by type", () => {
    const result = zkUnprocessed(db, { type: "fleeting" });
    const allNotes = Object.values(result).flat() as any[];
    expect(allNotes.every((n) => n.type === "fleeting")).toBe(true);
  });

  it("calculates age and urgency", () => {
    const result = zkUnprocessed(db, {});
    const allNotes = Object.values(result).flat() as any[];
    for (const note of allNotes) {
      expect(note.age_days).toBeGreaterThanOrEqual(0);
      expect(["normal", "warning", "critical"]).toContain(note.urgency);
    }
  });

  it("sorts by age descending within group", () => {
    const result = zkUnprocessed(db, {});
    for (const group of Object.values(result) as any[][]) {
      for (let i = 1; i < group.length; i++) {
        expect(group[i - 1].age_days).toBeGreaterThanOrEqual(group[i].age_days);
      }
    }
  });
});

describe("zkOrphans", () => {
  it("returns orphan notes", () => {
    const result = zkOrphans(db, {});
    expect(result.length).toBeGreaterThan(0);
    for (const n of result) {
      expect(n.path).toBeDefined();
      expect(n.title).toBeDefined();
    }
  });

  it("filters by folder", () => {
    const result = zkOrphans(db, { folder: "3-Permanent" });
    expect(result.every((n: any) => n.folder === "3-Permanent")).toBe(true);
  });
});

describe("zkReview", () => {
  it("returns full vault health report", () => {
    const result = zkReview(db);
    expect(result.unprocessedFleeting).toBeDefined();
    expect(result.unprocessedLiterature).toBeDefined();
    expect(result.draftPermanent).toBeDefined();
    expect(result.orphanPermanent).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.stats.total).toBeGreaterThan(0);
  });
});
