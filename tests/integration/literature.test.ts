import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { zkLiterature } from "../../src/tools/literature.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkLiterature", () => {
  const baseArgs = {
    title: "Нова книга",
    source_type: "книга",
    source_title: "Test Book",
    source_author: "Author",
    summary: "Тестове резюме",
    key_ideas: ["Ідея 1", "Ідея 2"],
  };

  it("creates literature note", () => {
    const result = zkLiterature(db, baseArgs);
    expect(result.path).toBe("2-Literature/Нова книга.md");
    expect(existsSync(join(vault, result.path))).toBe(true);
  });

  it("renders key ideas as numbered list", () => {
    zkLiterature(db, baseArgs);
    const content = readFileSync(join(vault, "2-Literature/Нова книга.md"), "utf-8");
    expect(content).toContain("1. Ідея 1");
    expect(content).toContain("2. Ідея 2");
  });

  it("renders quotes with blockquote", () => {
    zkLiterature(db, { ...baseArgs, quotes: ["A quote"] });
    const content = readFileSync(join(vault, "2-Literature/Нова книга.md"), "utf-8");
    expect(content).toContain('> "A quote"');
  });

  it("renders connections as wikilinks", () => {
    zkLiterature(db, { ...baseArgs, connections: [{ target: "Знання як мережа", type: "Related" }] });
    const content = readFileSync(join(vault, "2-Literature/Нова книга.md"), "utf-8");
    expect(content).toContain("[[Знання як мережа]]");
  });

  it("returns permanentCandidates from key_ideas", () => {
    const result = zkLiterature(db, baseArgs);
    expect(result.permanentCandidates).toEqual(["Ідея 1", "Ідея 2"]);
  });
});
