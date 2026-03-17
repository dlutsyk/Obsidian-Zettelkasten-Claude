import { ZkDatabase } from "../db/index.js";

export function zkBacklinks(db: ZkDatabase, args: { note_path?: string; note_title?: string; zk_id?: string }) {
  let notePath: string | undefined;
  let noteTitle: string | undefined;

  if (args.zk_id) {
    const note = db.getNoteById(args.zk_id);
    if (!note) return { error: `Note with ID ${args.zk_id} not found` };
    notePath = note.path;
    noteTitle = note.title;
  } else if (args.note_path) {
    const note = db.getNoteByPath(args.note_path);
    if (!note) return { error: `Note at ${args.note_path} not found` };
    notePath = note.path;
    noteTitle = note.title;
  } else if (args.note_title) {
    const rows = db.db.prepare("SELECT path, title FROM notes WHERE title = ?").all(args.note_title) as any[];
    if (rows.length === 0) return { error: `Note "${args.note_title}" not found` };
    notePath = rows[0].path;
    noteTitle = rows[0].title;
  } else {
    return { error: "Provide note_path, note_title, or zk_id" };
  }

  const outgoing = db.getLinksFrom(notePath!);
  const incoming = db.getLinksTo(notePath!);

  const enrichLink = (l: any, field: string) => {
    const note = db.getNoteByPath(l[field]);
    return {
      path: l[field],
      title: note?.title ?? l[field],
      type: note?.type ?? "unknown",
      link_type: l.link_type,
    };
  };

  return {
    note: { path: notePath, title: noteTitle },
    incoming: incoming.map((l: any) => enrichLink(l, "source")),
    outgoing: outgoing.map((l: any) => enrichLink(l, "target")),
  };
}
