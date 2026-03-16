/**
 * Note creation and editing — writes files to vault.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Frontmatter } from "./parser.js";

function serializeFrontmatter(fm: Frontmatter): string {
  const lines: string[] = ["---"];
  for (const [key, val] of Object.entries(fm)) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) {
          lines.push(`  - ${item}`);
        }
      }
    } else {
      // Quote values that contain special chars
      const needsQuote = /[:#\[\]{}|>&*!%@`]/.test(val) || val === "";
      lines.push(`${key}: ${needsQuote ? `"${val}"` : val}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

export function createNote(vaultRoot: string, folder: string, title: string, fm: Frontmatter, body: string): string {
  const dir = join(vaultRoot, folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${title}.md`);
  const content = serializeFrontmatter(fm) + "\n" + body;
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function updateFrontmatterField(filePath: string, key: string, value: string): void {
  const text = readFileSync(filePath, "utf-8");
  if (!text.startsWith("---")) return;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return;

  const fmSection = text.slice(0, end + 4);
  const body = text.slice(end + 4);

  // Simple regex replacement for single-value fields
  const re = new RegExp(`^${key}:.*$`, "m");
  let newFm: string;
  if (re.test(fmSection)) {
    newFm = fmSection.replace(re, `${key}: ${value}`);
  } else {
    // Insert before closing ---
    newFm = fmSection.slice(0, end) + `\n${key}: ${value}` + fmSection.slice(end);
  }
  writeFileSync(filePath, newFm + body, "utf-8");
}

export function moveNote(filePath: string, destFolder: string, vaultRoot: string): string {
  const fileName = filePath.split("/").pop()!;
  const destDir = join(vaultRoot, destFolder);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  const destPath = join(destDir, fileName);
  renameSync(filePath, destPath);
  return destPath;
}

export function deleteNote(filePath: string): void {
  unlinkSync(filePath);
}
