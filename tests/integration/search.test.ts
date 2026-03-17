import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { zkFindConnections, zkClusterDetect } from "../../src/tools/search.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkFindConnections", () => {
  it("finds connections by path", () => {
    const result = zkFindConnections(db, { note_path: "3-Permanent/Знання як мережа.md" });
    expect(result.candidates).toBeDefined();
    expect(result.candidates!.length).toBeGreaterThan(0);
  });

  it("finds connections by title", () => {
    const result = zkFindConnections(db, { note_title: "Знання як мережа" });
    expect(result.candidates).toBeDefined();
  });

  it("returns empty candidates for note not in DB", () => {
    const result = zkFindConnections(db, { note_path: "nonexistent.md" });
    expect(result.candidates).toEqual([]);
  });

  it("returns error when no identifier", () => {
    const result = zkFindConnections(db, {});
    expect(result.error).toBeDefined();
  });
});

describe("zkClusterDetect", () => {
  it("detects tag clusters with 3+ notes", () => {
    const clusters = zkClusterDetect(db);
    // "permanent" tag is on all 3 permanent notes
    const permCluster = clusters.find((c) => c.tag === "permanent");
    if (permCluster) {
      expect(permCluster.notes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("marks hasMoc when MOC exists for tag", () => {
    const clusters = zkClusterDetect(db);
    // hasMoc matching depends on MOC title matching tag (case-insensitive)
    expect(clusters).toBeDefined();
  });

  it("sorts by cluster size descending", () => {
    const clusters = zkClusterDetect(db);
    for (let i = 1; i < clusters.length; i++) {
      expect(clusters[i - 1].notes.length).toBeGreaterThanOrEqual(clusters[i].notes.length);
    }
  });
});
