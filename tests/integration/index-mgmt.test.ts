import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { zkReindex, zkStatus } from "../../src/tools/index-mgmt.js";
import { createTempVault, cleanupVault } from "../helpers/vault.js";
import { seedAndIndex } from "../helpers/db.js";
import { ZkDatabase } from "../../src/db/index.js";

let vault: string;
let db: ZkDatabase;
beforeEach(() => { vault = createTempVault(); db = seedAndIndex(vault); });
afterEach(() => { db.close(); cleanupVault(vault); });

describe("zkReindex", () => {
  it("returns reindex stats with message", () => {
    const result = zkReindex(db);
    expect(result.message).toBeDefined();
    expect(typeof result.added).toBe("number");
    expect(typeof result.updated).toBe("number");
    expect(typeof result.removed).toBe("number");
  });
});

describe("zkStatus", () => {
  it("returns DB stats", () => {
    const result = zkStatus(db);
    expect(result.total).toBeGreaterThan(0);
    expect(result.byType).toBeDefined();
    expect(result.byStatus).toBeDefined();
    expect(result.linkCount).toBeGreaterThanOrEqual(0);
    expect(result.lastIndex).toBeDefined();
  });
});
