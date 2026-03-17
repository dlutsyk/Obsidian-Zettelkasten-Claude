/**
 * Vault file discovery — walks vault directories, yields note paths.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

// Skip non-note dirs (config, tooling) and meta files that aren't zettelkasten notes
const SKIP_DIRS = new Set(["Templates", ".obsidian", ".claude", ".zk", "node_modules", ".git"]);
const SKIP_FILES = new Set(["CLAUDE.md", "Home.md", "README.md"]);

export interface VaultNote {
  path: string;
  relPath: string;
}

export function scanVault(vaultRoot: string, folder?: string): VaultNote[] {
  const root = folder ? join(vaultRoot, folder) : vaultRoot;
  const notes: VaultNote[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(entry)) {
          walk(full);
        }
      } else if (extname(entry) === ".md" && !SKIP_FILES.has(entry)) {
        const rel = relative(vaultRoot, full);
        // Skip vault-root .md files — they're not ZK notes
        if (!rel.includes("/") && !rel.includes("\\")) continue;
        notes.push({
          path: full,
          relPath: rel,
        });
      }
    }
  }

  walk(root);
  return notes;
}
