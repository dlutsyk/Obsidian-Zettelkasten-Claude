import { ZkDatabase } from "../db/index.js";
import { updateFrontmatterField, updateSection, moveNote, deleteNote } from "../vault/writer.js";
import { join } from "node:path";
import { compareLuhmannIds, buildTree, renderTree, getContext, getParentId } from "../luhmann.js";
import { CONFIG } from "../config.js";

export function zkFindById(db: ZkDatabase, zkId: string) {
  const note = db.getNoteById(zkId);
  if (!note) return { found: false, error: `Note with ID ${zkId} not found` };
  return { found: true, path: note.path, title: note.title };
}

export function zkTree(db: ZkDatabase, opts: { root_id?: string; context_id?: string; depth?: number }) {
  const rows = db.db.prepare(
    "SELECT zk_id, title, status, path FROM notes WHERE zk_id IS NOT NULL AND zk_id != '' ORDER BY zk_id"
  ).all() as { zk_id: string; title: string; status: string; path: string }[];
  rows.sort((a, b) => compareLuhmannIds(a.zk_id, b.zk_id));

  const depth = opts.depth ?? CONFIG.DEFAULT_TREE_DEPTH;
  const hints = `\n→ zk_find_by_id { id: "X" } to read a note\n→ zk_tree { context_id: "X" } to explore around a note`;

  if (opts.context_id) {
    const ctx = getContext(rows, opts.context_id);
    const self = rows.find((r) => r.zk_id === opts.context_id);
    let out = `Context for [${opts.context_id}]`;
    if (self) out += ` ${self.title}`;
    out += "\n\n";
    if (ctx.ancestors.length) {
      out += "Ancestors:\n" + ctx.ancestors.map((a) => `  [${a.zk_id}] ${a.title}`).join("\n") + "\n\n";
    }
    if (ctx.siblings.length) {
      out += "Siblings:\n" + ctx.siblings.map((s) => `  [${s.zk_id}] ${s.title}`).join("\n") + "\n\n";
    }
    if (ctx.children.length) {
      // Include all descendants, not just direct children
      const descendants = rows.filter((r) => {
        let cur: string | null = r.zk_id;
        while ((cur = getParentId(cur)) !== null) {
          if (cur === opts.context_id) return true;
        }
        return false;
      });
      const childTree = buildTree(descendants);
      out += "Children:\n" + renderTree(childTree, depth) + "\n";
    }
    return out + hints;
  }

  let source = rows;
  if (opts.root_id) {
    source = rows.filter((r) => {
      let cur: string | null = r.zk_id;
      while (cur) {
        if (cur === opts.root_id) return true;
        cur = getParentId(cur);
      }
      return false;
    });
  }

  const tree = buildTree(source);
  const ascii = renderTree(tree, depth);
  return (ascii || "(empty tree)") + hints;
}

export function zkEditNote(db: ZkDatabase, zkId: string, updates: Record<string, string>, sections?: Record<string, string>) {
  const note = db.getNoteById(zkId);
  if (!note) return { error: `Note with ID ${zkId} not found` };

  const fullPath = join(db.vaultRoot, note.path);
  for (const [key, value] of Object.entries(updates)) {
    updateFrontmatterField(fullPath, key, value);
  }
  if (sections) {
    for (const [header, content] of Object.entries(sections)) {
      updateSection(fullPath, header, content);
    }
  }
  updateFrontmatterField(fullPath, "last_modified", new Date().toISOString().slice(0, 10));

  db.indexNote(note.path);
  return { success: true, path: note.path };
}

export function zkArchiveNote(db: ZkDatabase, zkId: string) {
  const note = db.getNoteById(zkId);
  if (!note) return { error: `Note with ID ${zkId} not found` };

  const fullPath = join(db.vaultRoot, note.path);
  const incomingLinks = db.getLinksTo(note.path);
  const newPath = moveNote(fullPath, "Archive", db.vaultRoot);

  db.removeNote(note.path);
  db.indexNote(`Archive/${note.path.split("/").pop()}`);
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
  const incomingLinks = db.getLinksTo(note.path);

  if (incomingLinks.length > 0) {
    return {
      error: "Note has incoming links — consider archiving instead",
      incomingLinks: incomingLinks.map((l: any) => l.source),
      hint: "Use zk_archive to archive instead of delete",
    };
  }

  deleteNote(fullPath);
  db.removeNote(note.path);
  return { success: true, deletedPath: note.path };
}

export function zkFinalize(db: ZkDatabase, zkId: string) {
  const note = db.getNoteById(zkId);
  if (!note) return { error: `Note with ID ${zkId} not found` };

  // Re-index to get fresh flags before checking
  db.indexNote(note.path);
  const fresh = db.getNoteById(zkId);
  const flags = JSON.parse(fresh.flags || "{}") as Record<string, boolean>;
  const links = db.getLinksFrom(note.path);

  const checks = {
    has_connections: links.length > 0,
    has_claim: !!flags.has_claim,
    has_evidence: !!flags.has_evidence,
    has_confidence: !!flags.has_confidence,
  };

  const allPassed = Object.values(checks).every(Boolean);

  if (allPassed) {
    const fullPath = join(db.vaultRoot, note.path);
    updateFrontmatterField(fullPath, "status", "finalized");
    updateFrontmatterField(fullPath, "last_modified", new Date().toISOString().slice(0, 10));
    db.indexNote(note.path);
  }

  return {
    zk_id: zkId,
    path: note.path,
    checks,
    finalized: allPassed,
  };
}
