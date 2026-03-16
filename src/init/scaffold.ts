/**
 * Scaffold vault — copy templates, create folders, configure MCP.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WizardAnswers } from "./wizard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getTemplatesDir(): string {
  // In dist: dist/init/scaffold.js → ../../templates
  // In src: src/init/scaffold.ts → ../../templates
  let dir = resolve(__dirname, "../../templates");
  if (!existsSync(dir)) {
    dir = resolve(__dirname, "../../../templates");
  }
  return dir;
}

function copyDirRecursive(src: string, dest: string) {
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

export function scaffold(answers: WizardAnswers) {
  const vault = resolve(answers.vaultPath);
  const templatesDir = getTemplatesDir();

  console.log(`\nScaffolding vault at: ${vault}\n`);

  // 1. Create vault folders
  const folders = ["1-Fleeting", "2-Literature", "3-Permanent", "4-MOC", "5-Projects", "Archive", "Templates", "Attachments"];
  for (const f of folders) {
    const dir = join(vault, f);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`  Created: ${f}/`);
    }
  }

  // 2. Copy note templates
  const noteTemplatesDir = join(templatesDir, "vault-folders", "Templates");
  if (existsSync(noteTemplatesDir)) {
    const destTemplates = join(vault, "Templates");
    copyDirRecursive(noteTemplatesDir, destTemplates);
    console.log("  Copied note templates");
  }

  // 3. Copy skills + agents
  if (answers.installSkills) {
    const skillsSrc = join(templatesDir, "claude", "skills");
    const agentsSrc = join(templatesDir, "claude", "agents");
    const claudeDir = join(vault, ".claude");

    if (existsSync(skillsSrc)) {
      copyDirRecursive(skillsSrc, join(claudeDir, "skills"));
      console.log("  Installed skills");
    }
    if (existsSync(agentsSrc)) {
      copyDirRecursive(agentsSrc, join(claudeDir, "agents"));
      console.log("  Installed agents");
    }
  }

  // 4. Create/update CLAUDE.md
  const claudeMdTemplate = join(templatesDir, "CLAUDE.md.template");
  const claudeMdDest = join(vault, "CLAUDE.md");
  if (existsSync(claudeMdTemplate)) {
    let content = readFileSync(claudeMdTemplate, "utf-8");
    content = content.replace(/\{\{language\}\}/g, answers.language);
    if (!existsSync(claudeMdDest)) {
      writeFileSync(claudeMdDest, content, "utf-8");
      console.log("  Created CLAUDE.md");
    } else {
      console.log("  CLAUDE.md exists — skipping (run 'obsidian-zk update' to sync)");
    }
  }

  // 5. Create .zk/ directory
  const zkDir = join(vault, ".zk");
  if (!existsSync(zkDir)) {
    mkdirSync(zkDir, { recursive: true });
    console.log("  Created .zk/ (database directory)");
  }

  // 6. Update .gitignore
  const gitignorePath = join(vault, ".gitignore");
  const gitignoreEntries = [".zk/"];
  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, "utf-8");
    const toAdd = gitignoreEntries.filter((e) => !existing.includes(e));
    if (toAdd.length > 0) {
      writeFileSync(gitignorePath, existing.trimEnd() + "\n" + toAdd.join("\n") + "\n", "utf-8");
      console.log("  Updated .gitignore");
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntries.join("\n") + "\n", "utf-8");
    console.log("  Created .gitignore");
  }

  // 7. Configure MCP server in .mcp.json
  const mcpPath = join(vault, ".mcp.json");
  let mcpConfig: any = {};
  if (existsSync(mcpPath)) {
    try {
      mcpConfig = JSON.parse(readFileSync(mcpPath, "utf-8"));
    } catch {
      // Start fresh
    }
  }
  if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
  mcpConfig.mcpServers["obsidian-zk"] = {
    command: "npx",
    args: ["obsidian-zk", "serve", "--vault", "."],
  };
  writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");
  console.log("  Configured MCP server in .mcp.json");

  console.log("\n✅ Done! Run `/zk:capture` in Claude Code to start.\n");
}
