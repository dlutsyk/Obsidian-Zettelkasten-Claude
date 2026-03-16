import { ZkDatabase } from "../db/index.js";

export function zkFindConnections(db: ZkDatabase, args: { note_path?: string; note_title?: string }) {
  let notePath = args.note_path;

  if (!notePath && args.note_title) {
    const rows = db.db.prepare("SELECT path FROM notes WHERE title = ?").all(args.note_title) as { path: string }[];
    if (rows.length > 0) notePath = rows[0].path;
  }

  if (!notePath) return { error: "Note not found", candidates: [] };

  db.reindex();
  const candidates = db.findConnections(notePath);

  return {
    candidates: candidates.map((c) => ({
      title: c.title,
      path: c.path,
      type: c.type,
      score: c.score,
      reasons: c.reasons,
      summary: c.summary,
    })),
  };
}

export function zkClusterDetect(db: ZkDatabase) {
  // Find groups of notes sharing tags but not yet connected via MOC
  const notes = db.db.prepare("SELECT * FROM notes WHERE type = 'permanent'").all() as any[];
  const tagGroups = new Map<string, string[]>();

  for (const note of notes) {
    const tags = JSON.parse(note.tags || "[]") as string[];
    for (const tag of tags) {
      if (!tagGroups.has(tag)) tagGroups.set(tag, []);
      tagGroups.get(tag)!.push(note.title);
    }
  }

  // Find clusters of 3+ notes sharing a tag, not covered by MOC
  const mocs = db.db.prepare("SELECT title FROM notes WHERE type = 'moc'").all() as { title: string }[];
  const mocTitles = new Set(mocs.map((m) => m.title.toLowerCase()));

  const clusters: { tag: string; notes: string[]; hasMoc: boolean }[] = [];
  for (const [tag, titles] of tagGroups) {
    if (titles.length >= 3) {
      clusters.push({
        tag,
        notes: titles,
        hasMoc: mocTitles.has(tag.toLowerCase()),
      });
    }
  }

  return clusters.sort((a, b) => b.notes.length - a.notes.length);
}
