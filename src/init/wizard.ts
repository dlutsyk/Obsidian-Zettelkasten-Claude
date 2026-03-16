/**
 * Interactive setup wizard.
 */
import { createInterface } from "node:readline";

export interface WizardAnswers {
  vaultPath: string;
  language: "uk" | "en";
  installSkills: boolean;
}

async function ask(rl: ReturnType<typeof createInterface>, question: string, defaultVal?: string): Promise<string> {
  return new Promise((resolve) => {
    const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultVal || "");
    });
  });
}

export async function runWizard(detectedVaultPath?: string): Promise<WizardAnswers> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("\n🔧 obsidian-zk — Obsidian Zettelkasten MCP Server Setup\n");

    const vaultPath = await ask(rl, "Vault path", detectedVaultPath || ".");
    const langInput = await ask(rl, "Language (uk/en)", "uk");
    const language = langInput === "en" ? "en" : "uk";
    const skillsInput = await ask(rl, "Install skills/agents into .claude/? (y/n)", "y");
    const installSkills = skillsInput.toLowerCase() !== "n";

    return { vaultPath, language, installSkills };
  } finally {
    rl.close();
  }
}
