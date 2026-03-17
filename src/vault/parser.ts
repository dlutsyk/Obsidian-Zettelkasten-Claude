/**
 * Vault note parser — frontmatter, wikilinks, body extraction.
 * Port of zk_vault.py.
 */
import { readFileSync } from "node:fs";

export interface Frontmatter {
  [key: string]: string | string[];
}

export interface ParsedNote {
  frontmatter: Frontmatter;
  body: string;
  raw: string;
}

const TYPE_TAGS = new Set(["fleeting", "permanent", "literature", "MOC", "project"]);

export function parseFrontmatter(filePath: string): Frontmatter {
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return {};
  }
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};

  const fmText = text.slice(4, end);
  const fm: Frontmatter = {};
  // State machine for multi-line YAML arrays: currentKey tracks which field
  // we're parsing, currentList accumulates "- item" lines until the next key.
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of fmText.split("\n")) {
    if (/^\w[\w_]*:/.test(line)) {
      if (currentKey && currentList !== null) {
        fm[currentKey] = currentList;
      }
      const colonIdx = line.indexOf(":");
      const k = line.slice(0, colonIdx);
      let v = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      currentKey = k;
      if (v === "" || v === "[]") {
        currentList = [];
      } else {
        fm[k] = v;
        currentList = null;
      }
    } else if (currentList !== null && line.trim().startsWith("- ")) {
      currentList.push(line.trim().slice(2).trim().replace(/^["']|["']$/g, ""));
    }
  }
  if (currentKey && currentList !== null) {
    fm[currentKey] = currentList;
  }
  return fm;
}

export function getBody(filePath: string): string {
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text;
  return text.slice(end + 4);
}

export function getTags(fm: Frontmatter): string[] {
  let tags = fm.tags ?? [];
  if (typeof tags === "string") tags = [tags];
  return tags.filter((t) => !TYPE_TAGS.has(t));
}

export function getWikilinks(filePath: string): Set<string> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return new Set();
  }
  const matches = text.matchAll(/\[\[([^\]]+)\]\]/g);
  const links = new Set<string>();
  for (const m of matches) {
    // Strip alias: [[title|alias]] → title
    links.add(m[1].split("|")[0]);
  }
  return links;
}

export function parseNote(filePath: string): ParsedNote {
  const raw = readFileSync(filePath, "utf-8");
  return {
    frontmatter: parseFrontmatter(filePath),
    body: getBody(filePath),
    raw,
  };
}
