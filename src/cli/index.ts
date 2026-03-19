#!/usr/bin/env node
/**
 * CLI entry: init, update, serve subcommands.
 */
import { resolve } from "node:path";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "init": {
      const { runWizard } = await import("../init/wizard.js");
      const { scaffold } = await import("../init/scaffold.js");
      const vaultFlag = args.indexOf("--vault");
      const defaultVault = vaultFlag >= 0 ? args[vaultFlag + 1] : process.cwd();
      const answers = await runWizard(defaultVault);
      await scaffold(answers);
      break;
    }

    case "update": {
      const { update } = await import("../init/updater.js");
      const vaultFlag = args.indexOf("--vault");
      const vaultPath = vaultFlag >= 0 ? args[vaultFlag + 1] : ".";
      const yesFlag = args.includes("--yes");
      await update(vaultPath, { yes: yesFlag });
      break;
    }

    case "serve": {
      const { startServer } = await import("../server/index.js");
      const vaultFlag = args.indexOf("--vault");
      const vaultPath = vaultFlag >= 0 ? args[vaultFlag + 1] : ".";
      await startServer(resolve(vaultPath));
      break;
    }

    default:
      console.log(`obsidian-zk — Obsidian Zettelkasten MCP Server

Usage:
  obsidian-zk init              Interactive setup wizard
  obsidian-zk update            Sync templates & run migrations
  obsidian-zk serve --vault .   Start MCP server (called by Claude Code)

Options:
  --vault PATH          Vault path (default: current directory)
`);
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
