import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { zkPermanent } from "../../src/tools/permanent.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkPermanent", () => {
  const baseArgs = {
    title: "Нова ідея",
    claim: "Тестове твердження",
    elaboration: "Розкриття ідеї",
    confidence: "medium" as const,
  };

  it("creates permanent note with Luhmann ID", () => {
    const result = zkPermanent(db, baseArgs);
    expect(result.path).toBe("3-Permanent/Нова ідея.md");
    expect(result.zk_id).toBeDefined();
    expect(existsSync(join(vault, result.path))).toBe(true);
  });

  it("assigns next available ID", () => {
    const result = zkPermanent(db, baseArgs);
    // IDs 1, 1a, 1a1 exist; next top-level should be 2 or branch
    expect(result.zk_id).toBeTruthy();
  });

  it("branches from parent_id", () => {
    const result = zkPermanent(db, { ...baseArgs, parent_id: "1a" });
    expect(result.zk_id).toBe("1a2"); // 1a1 exists
  });

  it("marks source fleeting as processed", () => {
    const fleetingPath = "1-Fleeting/Знання як процес.md";
    zkPermanent(db, { ...baseArgs, source_fleeting_path: fleetingPath });
    const note = db.getNoteByPath(fleetingPath);
    expect(note.status).toBe("processed");
  });

  it("includes evidence and counterpoints", () => {
    zkPermanent(db, { ...baseArgs, evidence: ["Факт 1"], counterpoints: ["Контр 1"] });
    const content = readFileSync(join(vault, "3-Permanent/Нова ідея.md"), "utf-8");
    expect(content).toContain("- Факт 1");
    expect(content).toContain("- Контр 1");
  });
});
