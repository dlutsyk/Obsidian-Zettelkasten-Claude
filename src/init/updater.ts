/**
 * Update existing installation — sync templates, run migrations.
 */
import { existsSync, readFileSync, readdirSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ZkDatabase } from "../db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getTemplatesDir(): string {
  let dir = resolve(__dirname, "../../templates");
  if (!existsSync(dir)) dir = resolve(__dirname, "../../../templates");
  return dir;
}

export function update(vaultPath: string) {
  const vault = resolve(vaultPath);
  const templatesDir = getTemplatesDir();

  console.log(`\nUpdating OZC at: ${vault}\n`);

  // 1. Sync skills
  const skillsSrc = join(templatesDir, "claude", "skills");
  const skillsDest = join(vault, ".claude", "skills");
  if (existsSync(skillsSrc)) {
    let updated = 0;
    for (const skill of readdirSync(skillsSrc, { withFileTypes: true })) {
      if (!skill.isDirectory()) continue;
      const srcSkill = join(skillsSrc, skill.name, "SKILL.md");
      const destSkill = join(skillsDest, skill.name, "SKILL.md");
      if (!existsSync(srcSkill)) continue;

      const srcContent = readFileSync(srcSkill, "utf-8");
      if (existsSync(destSkill)) {
        const destContent = readFileSync(destSkill, "utf-8");
        if (srcContent !== destContent) {
          mkdirSync(dirname(destSkill), { recursive: true });
          copyFileSync(srcSkill, destSkill);
          console.log(`  Updated: ${skill.name}`);
          updated++;
        }
      } else {
        mkdirSync(dirname(destSkill), { recursive: true });
        copyFileSync(srcSkill, destSkill);
        console.log(`  Added: ${skill.name}`);
        updated++;
      }
    }
    if (updated === 0) console.log("  Skills up to date");
  }

  // 2. Sync agents
  const agentsSrc = join(templatesDir, "claude", "agents");
  const agentsDest = join(vault, ".claude", "agents");
  if (existsSync(agentsSrc)) {
    for (const file of readdirSync(agentsSrc)) {
      const srcFile = join(agentsSrc, file);
      const destFile = join(agentsDest, file);
      if (!statSync(srcFile).isFile()) continue;
      const srcContent = readFileSync(srcFile, "utf-8");
      if (!existsSync(destFile) || readFileSync(destFile, "utf-8") !== srcContent) {
        mkdirSync(agentsDest, { recursive: true });
        copyFileSync(srcFile, destFile);
        console.log(`  Updated agent: ${file}`);
      }
    }
  }

  // 3. Run DB migrations
  const db = new ZkDatabase(vault);
  const result = db.reindex();
  console.log(`  DB: +${result.added} added, ~${result.updated} updated, -${result.removed} removed`);
  db.close();

  console.log("\n✅ Update complete.\n");
}
