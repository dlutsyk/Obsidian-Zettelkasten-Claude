/**
 * Shared utilities for init/update flows.
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getTemplatesDir(): string {
  let dir = resolve(__dirname, "../../templates");
  if (!existsSync(dir)) dir = resolve(__dirname, "../../../templates");
  return dir;
}

export function copyDirRecursive(src: string, dest: string) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export interface ZkConfig {
  language: "uk" | "en";
  installSkills: boolean;
}

export function readConfig(vault: string): ZkConfig | null {
  const configPath = join(vault, ".zk", "config.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeConfig(vault: string, config: ZkConfig) {
  const zkDir = join(vault, ".zk");
  mkdirSync(zkDir, { recursive: true });
  writeFileSync(join(zkDir, "config.json"), JSON.stringify(config, null, 2) + "\n", "utf-8");
}
