import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { zkBacklinks } from "../../src/tools/backlinks.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkBacklinks", () => {
  it("finds by zk_id", () => {
    const result = zkBacklinks(db, { zk_id: "1a" });
    expect(result.note).toBeDefined();
    expect(result.note!.title).toBe("Знання є мережею зв'язків");
    expect(result.outgoing).toBeDefined();
  });

  it("finds by note_path", () => {
    const result = zkBacklinks(db, { note_path: "3-Permanent/Знання як мережа.md" });
    expect(result.note).toBeDefined();
  });

  it("finds by note_title", () => {
    const result = zkBacklinks(db, { note_title: "Знання як мережа" });
    expect(result.note).toBeDefined();
  });

  it("returns error for missing zk_id", () => {
    const result = zkBacklinks(db, { zk_id: "999" });
    expect(result.error).toBeDefined();
  });

  it("returns error when no identifier", () => {
    const result = zkBacklinks(db, {});
    expect(result.error).toBeDefined();
  });

  it("enriches links with note data", () => {
    const result = zkBacklinks(db, { zk_id: "1a" });
    if (result.outgoing && result.outgoing.length > 0) {
      expect(result.outgoing[0].title).toBeDefined();
      expect(result.outgoing[0].type).toBeDefined();
    }
  });
});
