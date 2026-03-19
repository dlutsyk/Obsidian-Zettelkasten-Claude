/**
 * Update existing installation — sync templates, skills, agents, CLAUDE.md, run migrations.
 */
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { createInterface } from "node:readline";
import { getTemplatesDir, readConfig } from "./utils.js";
import { ZkDatabase } from "../db/index.js";

export interface SyncEntry {
  label: string;
  srcContent: string;
  destPath: string;
}

export interface FileChange {
  file: string;
  action: "add" | "update";
}

/** Diff a list of sync entries against what's on disk. */
export function diffEntries(entries: SyncEntry[]): FileChange[] {
  const changes: FileChange[] = [];
  for (const { label, srcContent, destPath } of entries) {
    if (!existsSync(destPath)) {
      changes.push({ file: label, action: "add" });
    } else if (readFileSync(destPath, "utf-8") !== srcContent) {
      changes.push({ file: label, action: "update" });
    }
  }
  return changes;
}

/** Write all entries to disk. */
export function applyEntries(entries: SyncEntry[]) {
  for (const { srcContent, destPath } of entries) {
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, srcContent, "utf-8");
  }
}

/** Build the full list of syncable entries. */
export function buildSyncEntries(templatesDir: string, vault: string, language: string, installSkills: boolean): SyncEntry[] {
  const entries: SyncEntry[] = [];

  // Note templates
  const tplSrc = join(templatesDir, "vault-folders", "Templates");
  if (existsSync(tplSrc)) {
    for (const name of readdirSync(tplSrc)) {
      const srcPath = join(tplSrc, name);
      if (!statSync(srcPath).isFile()) continue;
      entries.push({
        label: `Templates/${name}`,
        srcContent: readFileSync(srcPath, "utf-8"),
        destPath: join(vault, "Templates", name),
      });
    }
  }

  if (installSkills) {
    // Skills
    const skillsSrc = join(templatesDir, "claude", "skills");
    if (existsSync(skillsSrc)) {
      for (const skill of readdirSync(skillsSrc, { withFileTypes: true })) {
        if (!skill.isDirectory()) continue;
        const srcPath = join(skillsSrc, skill.name, "SKILL.md");
        if (!existsSync(srcPath)) continue;
        entries.push({
          label: `.claude/skills/${skill.name}/SKILL.md`,
          srcContent: readFileSync(srcPath, "utf-8"),
          destPath: join(vault, ".claude", "skills", skill.name, "SKILL.md"),
        });
      }
    }

    // Agents
    const agentsSrc = join(templatesDir, "claude", "agents");
    if (existsSync(agentsSrc)) {
      for (const name of readdirSync(agentsSrc)) {
        const srcPath = join(agentsSrc, name);
        if (!statSync(srcPath).isFile()) continue;
        entries.push({
          label: `.claude/agents/${name}`,
          srcContent: readFileSync(srcPath, "utf-8"),
          destPath: join(vault, ".claude", "agents", name),
        });
      }
    }
  }

  // CLAUDE.md
  const claudeTpl = join(templatesDir, "CLAUDE.md.template");
  if (existsSync(claudeTpl)) {
    entries.push({
      label: "CLAUDE.md",
      srcContent: readFileSync(claudeTpl, "utf-8").replace(/\{\{language\}\}/g, language),
      destPath: join(vault, "CLAUDE.md"),
    });
  }

  return entries;
}

async function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export interface UpdateOptions {
  skipPrompt?: boolean;
  yes?: boolean;
}

export async function update(vaultPath: string, options: UpdateOptions = {}) {
  const vault = resolve(vaultPath);
  const templatesDir = getTemplatesDir();
  const config = readConfig(vault);
  const language = config?.language ?? "uk";
  const installSkills = config?.installSkills ?? true;

  console.log(`\nUpdating OZC at: ${vault}\n`);

  // Collect phase
  const entries = buildSyncEntries(templatesDir, vault, language, installSkills);
  const changes = diffEntries(entries);

  // Report + prompt phase
  if (changes.length > 0) {
    console.log("  Files to sync:");
    for (const c of changes) {
      console.log(`    ${c.action === "add" ? "+" : "~"} ${c.file}`);
    }
    console.log();

    const shouldApply = options.skipPrompt || options.yes || !process.stdin.isTTY ||
      await promptConfirm("  Proceed?");

    if (shouldApply) {
      // Only apply entries that changed
      const changedLabels = new Set(changes.map((c) => c.file));
      applyEntries(entries.filter((e) => changedLabels.has(e.label)));
      console.log(`  Synced ${changes.length} file(s)`);
    } else {
      console.log("  Skipped.");
      return;
    }
  } else {
    console.log("  All files up to date");
  }

  // DB migrations
  const db = new ZkDatabase(vault);
  const result = db.reindex();
  console.log(`  DB: +${result.added} added, ~${result.updated} updated, -${result.removed} removed`);
  db.close();

  console.log("\n✅ Update complete.\n");
}
