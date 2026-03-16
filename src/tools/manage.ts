import { ZkDatabase } from "../db/index.js";
import { updateFrontmatterField, moveNote, deleteNote } from "../vault/writer.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareLuhmannIds } from "../luhmann.js";

export function zkFindById(db: ZkDatabase, zkId: string) {
  const note = db.getNoteById(zkId);
  if (!note) return { found: false, error: `Note with ID ${zkId} not found` };
  return { found: true, path: note.path, title: note.title };
}

export function zkListIds(db: ZkDatabase) {
  const rows = db.db.prepare(
    "SELECT zk_id, title, status, path FROM notes WHERE zk_id IS NOT NULL AND zk_id != '' ORDER BY zk_id"
  ).all() as { zk_id: string; title: string; status: string; path: string }[];

  rows.sort((a, b) => compareLuhmannIds(a.zk_id, b.zk_id));

  return rows.map((r) => ({
    zk_id: r.zk_id,
    title: r.title,
    status: r.status,
    path: r.path,
  }));
}

export function zkEditNote(db: ZkDatabase, zkId: string, updates: Record<string, string>) {
  const note = db.getNoteById(zkId);
  if (!note) return { error: `Note with ID ${zkId} not found` };

  const fullPath = join(db.vaultRoot, note.path);
  for (const [key, value] of Object.entries(updates)) {
    updateFrontmatterField(fullPath, key, value);
  }
  updateFrontmatterField(fullPath, "last_modified", new Date().toISOString().slice(0, 10));

  db.reindex();
  return { success: true, path: note.path };
}

export function zkArchiveNote(db: ZkDatabase, zkId: string) {
  const note = db.getNoteById(zkId);
  if (!note) return { error: `Note with ID ${zkId} not found` };

  const fullPath = join(db.vaultRoot, note.path);

  // Check incoming links
  const incomingLinks = db.getLinksTo(note.title);
  const newPath = moveNote(fullPath, "Archive", db.vaultRoot);

  db.reindex();
  return {
    success: true,
    oldPath: note.path,
    newPath,
    brokenLinks: incomingLinks.map((l: any) => l.source),
  };
}

export function zkDeleteNote(db: ZkDatabase, zkId: string) {
  const note = db.getNoteById(zkId);
  if (!note) return { error: `Note with ID ${zkId} not found` };

  const fullPath = join(db.vaultRoot, note.path);
  const incomingLinks = db.getLinksTo(note.title);

  if (incomingLinks.length > 0) {
    return {
      error: "Note has incoming links — consider archiving instead",
      incomingLinks: incomingLinks.map((l: any) => l.source),
      hint: "Use zk_archive to archive instead of delete",
    };
  }

  deleteNote(fullPath);
  db.reindex();
  return { success: true, deletedPath: note.path };
}
