import { ZkDatabase } from "../db/index.js";
import { createNote } from "../vault/writer.js";

export interface LiteratureArgs {
  title: string;
  source_type: string;
  source_title: string;
  source_author: string;
  source_url?: string;
  source_year?: string;
  summary: string;
  key_ideas: string[];
  quotes?: string[];
  interpretation?: string;
  takeaways?: string[];
  tags?: string[];
  connections?: { target: string; type: string }[];
}

export function zkLiterature(db: ZkDatabase, args: LiteratureArgs) {
  const date = new Date().toISOString().slice(0, 10);

  const tags = ["literature", ...(args.tags ?? [])];
  const fm: Record<string, string | string[]> = {
    type: "literature",
    date,
    tags,
    status: "unprocessed",
    source_type: args.source_type,
    source_title: args.source_title,
    source_author: args.source_author,
  };
  if (args.source_url) fm.source_url = args.source_url;
  if (args.source_year) fm.source_year = args.source_year;
  fm.aliases = [];

  const keyIdeas = args.key_ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n");
  const quotes = (args.quotes ?? []).map((q) => `> "${q}"`).join("\n\n");
  const takeaways = (args.takeaways ?? []).map((t) => `- [ ] ${t}`).join("\n");
  const connLines = (args.connections ?? []).map((c) => `- **${c.type}:** [[${c.target}]]`).join("\n");

  const body = `# ${args.title}

## Summary (Резюме)

${args.summary}

## Key Ideas (Ключові ідеї)

${keyIdeas}

## Quotes & Highlights (Цитати та виділення)

${quotes || "> "}

## My Interpretation (Моя інтерпретація)

${args.interpretation || ""}

## Actionable Takeaways (Що спробувати на практиці)

${takeaways || "- [ ] "}

## Questions Raised (Питання, що виникли)

-

## Connections (Зв'язки)

${connLines || "- "}
`;

  const relPath = `2-Literature/${args.title}.md`;
  createNote(db.vaultRoot, "2-Literature", args.title, fm, body);
  db.indexNote(relPath);

  const candidates = db.findConnections(relPath);

  return {
    path: relPath,
    title: args.title,
    permanentCandidates: args.key_ideas,
    connections: candidates.slice(0, 5).map((c) => ({ title: c.title, score: c.score, reasons: c.reasons })),
  };
}
