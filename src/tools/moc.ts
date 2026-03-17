import { ZkDatabase } from "../db/index.js";
import { createNote } from "../vault/writer.js";

export function zkMoc(db: ZkDatabase, args: { topic: string; tags?: string[]; note_paths?: string[] }) {
  const date = new Date().toISOString().slice(0, 10);

  // Auto-query notes matching tags
  let notes: any[] = [];
  if (args.tags?.length) {
    const allNotes = db.db.prepare("SELECT * FROM notes WHERE type IN ('permanent', 'literature')").all() as any[];
    notes = allNotes.filter((n) => {
      const noteTags = JSON.parse(n.tags || "[]") as string[];
      return args.tags!.some((t) => noteTags.includes(t));
    });
  }

  // Add explicitly specified notes
  if (args.note_paths?.length) {
    for (const p of args.note_paths) {
      const note = db.getNoteByPath(p);
      if (note && !notes.find((n: any) => n.path === note.path)) notes.push(note);
    }
  }

  // Categorize
  const permanent = notes.filter((n) => n.type === "permanent");
  const literature = notes.filter((n) => n.type === "literature");
  const other = notes.filter((n) => n.type !== "permanent" && n.type !== "literature");

  const tags = ["MOC", ...(args.tags ?? [])];
  const fm: Record<string, string | string[]> = { type: "moc", date, tags, status: "draft" };

  const permLinks = permanent.map((n) => `- [[${n.title}]]`).join("\n") || "-";
  const litLinks = literature.map((n) => `- [[${n.title}]]`).join("\n") || "-";
  const otherLinks = other.map((n) => `- [[${n.title}]]`).join("\n") || "-";

  const body = `# ${args.topic}

## Core Notes (Основні нотатки)

${permLinks}

## Supporting Literature (Підтримуюча література)

${litLinks}

## Related (Пов'язане)

${otherLinks}

## Open Questions (Відкриті питання)

-

## Development (Розвиток теми)

-
`;

  const relPath = `4-MOC/${args.topic}.md`;
  createNote(db.vaultRoot, "4-MOC", args.topic, fm, body);
  db.indexNote(relPath);

  return {
    path: relPath,
    title: args.topic,
    included: notes.map((n) => ({ title: n.title, type: n.type, path: n.path })),
  };
}
