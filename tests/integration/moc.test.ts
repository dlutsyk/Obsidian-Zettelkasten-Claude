import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { zkMoc } from "../../src/tools/moc.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkMoc", () => {
  it("creates MOC note", () => {
    const result = zkMoc(db, { topic: "Тестова тема" });
    expect(result.path).toBe("4-MOC/Тестова тема.md");
    expect(existsSync(join(vault, result.path))).toBe(true);
  });

  it("auto-pulls notes by tag", () => {
    const result = zkMoc(db, { topic: "Епістемологія 2", tags: ["epistemology"] });
    expect(result.included.length).toBeGreaterThan(0);
    expect(result.included.some((n: any) => n.type === "permanent")).toBe(true);
  });

  it("includes explicit note_paths", () => {
    const result = zkMoc(db, { topic: "Manual", note_paths: ["3-Permanent/Знання як мережа.md"] });
    expect(result.included.some((n: any) => n.title === "Знання як мережа")).toBe(true);
  });

  it("categorizes notes in body", () => {
    zkMoc(db, { topic: "Тема", tags: ["epistemology"] });
    const content = readFileSync(join(vault, "4-MOC/Тема.md"), "utf-8");
    expect(content).toContain("## Core Notes");
    expect(content).toContain("## Supporting Literature");
  });
});
