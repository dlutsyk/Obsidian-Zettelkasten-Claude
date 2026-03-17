import { describe, it, expect, afterEach } from "vitest";
import { createServer } from "../../src/server/server.js";
import { createTempVault, cleanupVault, writeFixture, PERMANENT_NOTE_2 } from "../helpers/vault.js";

let vault: string;
afterEach(() => { cleanupVault(vault); });

describe("createServer", () => {
  it("creates server without throwing", () => {
    vault = createTempVault();
    writeFixture(vault, "3-Permanent/test.md", PERMANENT_NOTE_2);
    const server = createServer(vault);
    expect(server).toBeDefined();
  });
});
