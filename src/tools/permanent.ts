import { ZkDatabase } from "../db/index.js";
import { createNote, updateFrontmatterField } from "../vault/writer.js";
import { nextId } from "../luhmann.js";
import { join } from "node:path";

export interface PermanentArgs {
  title: string;
  claim: string;
  elaboration: string;
  evidence?: string[];
  counterpoints?: string[];
  origin?: string;
  confidence: "low" | "medium" | "high";
  parent_id?: string;
  tags?: string[];
  connections?: { target: string; type: string }[];
  source_fleeting_path?: string;
  source_literature_path?: string;
}

export function zkPermanent(db: ZkDatabase, args: PermanentArgs) {
  const date = new Date().toISOString().slice(0, 10);
  const existingIds = db.getAllZkIds();
  const zkId = nextId(new Set(existingIds.keys()), args.parent_id);

  const tags = ["permanent", ...(args.tags ?? [])];
  const fm: Record<string, string | string[]> = {
    type: "permanent",
    zk_id: zkId,
    date,
    last_modified: date,
    tags,
    status: "draft",
    confidence: args.confidence,
    claim: args.claim,
    aliases: [],
  };

  const evidence = (args.evidence ?? []).map((e) => `- ${e}`).join("\n");
  const counterpoints = (args.counterpoints ?? []).map((c) => `- ${c}`).join("\n");
  const connLines = (args.connections ?? []).map((c) => {
    const t = c.target.replace(/^\[\[|\]\]$/g, "");
    return `- **${c.type}:** [[${t}]]`;
  }).join("\n");

  const body = `# ${args.title}

## Claim (Твердження)

${args.claim}

## Elaboration (Розкриття)

${args.elaboration}

## Evidence & Support (Докази та підтримка)

${evidence || "-"}

## Counterpoints & Limitations (Контраргументи та обмеження)

${counterpoints || "-"}

## Origin (Походження)

- Source (Джерело): ${args.origin || ""}

## Connections (Зв'язки)

${connLines || `- **Supports (Підтримує):**
- **Contradicts (Суперечить):**
- **Extends (Розширює):**
- **Related (Пов'язано):**`}

## References (Посилання)

-
`;

  const relPath = `3-Permanent/${args.title}.md`;
  createNote(db.vaultRoot, "3-Permanent", args.title, fm, body);

  // Mark source fleeting as processed
  if (args.source_fleeting_path) {
    try {
      updateFrontmatterField(join(db.vaultRoot, args.source_fleeting_path), "status", "processed");
      db.indexNote(args.source_fleeting_path);
    } catch {
      // Source may not exist
    }
  }

  // Mark source literature as processed
  if (args.source_literature_path) {
    try {
      updateFrontmatterField(join(db.vaultRoot, args.source_literature_path), "status", "processed");
      db.indexNote(args.source_literature_path);
    } catch {
      // Source may not exist
    }
  }

  db.indexNote(relPath);

  return {
    path: relPath,
    title: args.title,
    zk_id: zkId,
    confidence: args.confidence,
  };
}
