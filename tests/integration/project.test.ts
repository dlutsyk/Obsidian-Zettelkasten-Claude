import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { zkProject } from "../../src/tools/project.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkProject", () => {
  it("creates project note", () => {
    const result = zkProject(db, { title: "Мій проект", objective: "Мета проекту" });
    expect(result.path).toBe("5-Projects/Мій проект.md");
    expect(existsSync(join(vault, result.path))).toBe(true);
  });

  it("includes tasks as checkboxes", () => {
    zkProject(db, { title: "Завдання", objective: "Мета", tasks: ["Зробити A", "Зробити B"] });
    const content = readFileSync(join(vault, "5-Projects/Завдання.md"), "utf-8");
    expect(content).toContain("- [ ] Зробити A");
    expect(content).toContain("- [ ] Зробити B");
  });

  it("includes related notes as wikilinks", () => {
    zkProject(db, { title: "Links", objective: "x", related_notes: ["Знання як мережа"] });
    const content = readFileSync(join(vault, "5-Projects/Links.md"), "utf-8");
    expect(content).toContain("[[Знання як мережа]]");
  });

  it("sets priority and deadline", () => {
    const result = zkProject(db, { title: "Deadline", objective: "x", priority: "high", deadline: "2025-12-31" });
    expect(result.priority).toBe("high");
    expect(result.deadline).toBe("2025-12-31");
  });

  it("defaults priority to medium", () => {
    const result = zkProject(db, { title: "Default", objective: "x" });
    expect(result.priority).toBe("medium");
  });
});
