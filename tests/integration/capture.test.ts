import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { zkCapture } from "../../src/tools/capture.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkCapture", () => {
  it("creates fleeting note", () => {
    const result = zkCapture(db, { title: "Тестова думка", thought: "Цікаво" });
    expect(result.path).toBe("1-Fleeting/Тестова думка.md");
    expect(existsSync(join(vault, result.path!))).toBe(true);
  });

  it("returns connections", () => {
    const result = zkCapture(db, { title: "Епістемологія", thought: "Знання", tags: ["epistemology"] });
    expect(result.connections).toBeDefined();
  });

  it("returns error for empty title", () => {
    const result = zkCapture(db, { title: "", thought: "x" });
    expect(result.error).toBeDefined();
  });

  it("includes custom tags", () => {
    zkCapture(db, { title: "Tagged", thought: "x", tags: ["custom"] });
    db.reindex();
    const note = db.getNoteByPath("1-Fleeting/Tagged.md");
    const tags = JSON.parse(note.tags);
    expect(tags).toContain("custom");
  });
});
