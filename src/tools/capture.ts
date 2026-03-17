import { ZkDatabase } from "../db/index.js";
import { createNote } from "../vault/writer.js";

export function zkCapture(db: ZkDatabase, args: { title: string; thought: string; context?: string; tags?: string[] }) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);

  const tags = ["fleeting", ...(args.tags ?? [])];
  const fm = {
    type: "fleeting",
    date,
    time,
    tags,
    status: "unprocessed",
  };

  const body = `# ${args.title}

## Thought (Думка)

${args.thought}

## Context (Контекст)

${args.context || ""}

## Potential Connections (Можливі зв'язки)

-

## Next Steps (Наступні кроки)

- [ ] Розвинути в permanent note (постійну нотатку)
- [ ] Зв'язати з відповідними literature notes (нотатками джерел)
- [ ] Архівувати або видалити
`;

  const relPath = `1-Fleeting/${args.title}.md`;
  createNote(db.vaultRoot, "1-Fleeting", args.title, fm, body);
  db.indexNote(relPath);

  const connections = db.findConnections(relPath);

  return {
    path: relPath,
    title: args.title,
    connections: connections.slice(0, 5).map((c) => ({ title: c.title, score: c.score, reasons: c.reasons })),
  };
}
