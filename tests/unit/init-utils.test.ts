import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { copyDirRecursive, writeConfig, readConfig, type ZkConfig } from "../../src/init/utils.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "zk-init-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("copyDirRecursive", () => {
  it("copies files and subdirectories", () => {
    const src = join(tmp, "src");
    mkdirSync(join(src, "sub"), { recursive: true });
    writeFileSync(join(src, "a.md"), "aaa");
    writeFileSync(join(src, "sub", "b.md"), "bbb");

    const dest = join(tmp, "dest");
    copyDirRecursive(src, dest);

    expect(readFileSync(join(dest, "a.md"), "utf-8")).toBe("aaa");
    expect(readFileSync(join(dest, "sub", "b.md"), "utf-8")).toBe("bbb");
  });

  it("no-ops if src does not exist", () => {
    copyDirRecursive(join(tmp, "nope"), join(tmp, "dest"));
    expect(existsSync(join(tmp, "dest"))).toBe(false);
  });
});

describe("config persistence", () => {
  it("writeConfig + readConfig roundtrip", () => {
    const vault = join(tmp, "vault");
    mkdirSync(join(vault, ".zk"), { recursive: true });
    const config: ZkConfig = { language: "en", installSkills: false };
    writeConfig(vault, config);
    expect(readConfig(vault)).toEqual(config);
  });

  it("readConfig returns null if missing", () => {
    expect(readConfig(join(tmp, "nope"))).toBeNull();
  });

  it("readConfig returns null if corrupt", () => {
    const vault = join(tmp, "vault");
    mkdirSync(join(vault, ".zk"), { recursive: true });
    writeFileSync(join(vault, ".zk", "config.json"), "not json");
    expect(readConfig(vault)).toBeNull();
  });
});
