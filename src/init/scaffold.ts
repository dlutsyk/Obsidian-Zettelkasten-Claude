/**
 * Scaffold vault — create folder structure, config, .gitignore, .mcp.json, then sync via update.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { WizardAnswers } from "./wizard.js";
import { writeConfig } from "./utils.js";
import { update } from "./updater.js";

export async function scaffold(answers: WizardAnswers) {
  const vault = resolve(answers.vaultPath);

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

  // 2. Create .zk/ + save config
  const zkDir = join(vault, ".zk");
  if (!existsSync(zkDir)) {
    mkdirSync(zkDir, { recursive: true });
    console.log("  Created .zk/ (database directory)");
  }
  writeConfig(vault, { language: answers.language, installSkills: answers.installSkills });
  console.log("  Saved config");

  // 3. Update .gitignore
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

  // 4. Configure MCP server in .mcp.json
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

  // 5. Sync templates, skills, agents, CLAUDE.md, DB via update
  await update(vault, { skipPrompt: true });

  console.log("✅ Done! Run `/zk:capture` in Claude Code to start.\n");
}
