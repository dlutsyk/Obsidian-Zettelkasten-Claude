/**
 * Database connection + indexing.
 */
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema.js";
import { scanVault } from "../vault/scanner.js";
import { parseFrontmatter, getBody, getTags, getWikilinks } from "../vault/parser.js";

export class ZkDatabase {
  db: Database.Database;
  vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot;
    const dbDir = join(vaultRoot, ".zk");
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, "zettelkasten.db");
    this.db = new Database(dbPath);
    // WAL mode: allows concurrent reads during writes, better for indexing while serving queries
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CREATE_TABLES);
    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("schema_version", String(SCHEMA_VERSION));
  }

  reindex(): { added: number; updated: number; removed: number } {
    const notes = scanVault(this.vaultRoot);
    const currentPaths = new Set(notes.map((n) => n.relPath));
    let added = 0, updated = 0, removed = 0;

    // Remove deleted notes
    const dbPaths = this.db.prepare("SELECT path FROM notes").all() as { path: string }[];
    const removePaths = dbPaths.filter((r) => !currentPaths.has(r.path));
    const deleteNote = this.db.prepare("DELETE FROM notes WHERE path = ?");
    const deleteLinks = this.db.prepare("DELETE FROM links WHERE source = ?");
    for (const { path } of removePaths) {
      deleteNote.run(path);
      deleteLinks.run(path);
      removed++;
    }

    // Upsert notes
    const getHash = this.db.prepare("SELECT content_hash FROM notes WHERE path = ?");
    const upsert = this.db.prepare(`
      INSERT OR REPLACE INTO notes (path, title, zk_id, type, status, folder, tags, summary, created, modified, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertLink = this.db.prepare("INSERT OR REPLACE INTO links (source, target, link_type) VALUES (?, ?, ?)");

    const transaction = this.db.transaction(() => {
      for (const note of notes) {
        const fullPath = join(this.vaultRoot, note.relPath);
        let content: string;
        try {
          content = readFileSync(fullPath, "utf-8");
        } catch {
          continue;
        }

        // Incremental indexing: skip files whose content hash hasn't changed
        const hash = createHash("md5").update(content).digest("hex");
        const existing = getHash.get(note.relPath) as { content_hash: string } | undefined;
        if (existing?.content_hash === hash) continue;

        const fm = parseFrontmatter(fullPath);
        const body = getBody(fullPath);
        const title = basename(note.relPath, ".md");
        const folder = dirname(note.relPath).split("/")[0] || "";
        const tags = getTags(fm);
        const summary = body.trim().slice(0, 200);

        upsert.run(
          note.relPath,
          title,
          (fm.zk_id as string) || null,
          (fm.type as string) || null,
          (fm.status as string) || null,
          folder,
          JSON.stringify(tags),
          summary,
          (fm.date as string) || null,
          (fm.last_modified as string) || null,
          hash
        );

        // Fully delete+reinsert links — simplest way to handle removed wikilinks
        deleteLinks.run(note.relPath);
        const wikilinks = getWikilinks(fullPath);
        for (const target of wikilinks) {
          insertLink.run(note.relPath, target, null);
        }

        if (existing) updated++;
        else added++;
      }
    });

    transaction();

    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("last_index", new Date().toISOString());
    return { added, updated, removed };
  }

  getNoteByPath(relPath: string) {
    return this.db.prepare("SELECT * FROM notes WHERE path = ?").get(relPath) as any;
  }

  getNoteById(zkId: string) {
    return this.db.prepare("SELECT * FROM notes WHERE zk_id = ?").get(zkId) as any;
  }

  getNotesByType(type: string) {
    return this.db.prepare("SELECT * FROM notes WHERE type = ?").all(type) as any[];
  }

  getNotesByStatus(status: string) {
    return this.db.prepare("SELECT * FROM notes WHERE status = ?").all(status) as any[];
  }

  getNotesByFolder(folder: string) {
    return this.db.prepare("SELECT * FROM notes WHERE folder = ?").all(folder) as any[];
  }

  listNotes(filters: { type?: string; status?: string; folder?: string }) {
    let sql = "SELECT * FROM notes WHERE 1=1";
    const params: string[] = [];
    if (filters.type) { sql += " AND type = ?"; params.push(filters.type); }
    if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
    if (filters.folder) { sql += " AND folder = ?"; params.push(filters.folder); }
    sql += " ORDER BY path";
    return this.db.prepare(sql).all(...params) as any[];
  }

  getAllZkIds(): Map<string, { path: string; title: string }> {
    const rows = this.db.prepare("SELECT zk_id, path, title FROM notes WHERE zk_id IS NOT NULL AND zk_id != ''").all() as any[];
    const map = new Map<string, { path: string; title: string }>();
    for (const r of rows) map.set(r.zk_id, { path: r.path, title: r.title });
    return map;
  }

  getUnprocessed(type?: string) {
    let sql = "SELECT * FROM notes WHERE status IN ('unprocessed', 'draft')";
    const params: string[] = [];
    if (type) { sql += " AND type = ?"; params.push(type); }
    sql += " ORDER BY folder, path";
    return this.db.prepare(sql).all(...params) as any[];
  }

  getOrphans(folder?: string) {
    // LEFT JOIN + NULL: notes where no link row matched = no incoming links
    let sql = `
      SELECT n.* FROM notes n
      LEFT JOIN links l ON l.target = n.title
      WHERE l.target IS NULL
    `;
    const params: string[] = [];
    if (folder) { sql += " AND n.folder = ?"; params.push(folder); }
    sql += " ORDER BY n.path";
    return this.db.prepare(sql).all(...params) as any[];
  }

  getLinksFrom(relPath: string) {
    return this.db.prepare("SELECT * FROM links WHERE source = ?").all(relPath) as any[];
  }

  getLinksTo(title: string) {
    return this.db.prepare("SELECT * FROM links WHERE target = ?").all(title) as any[];
  }

  findConnections(notePath: string) {
    const note = this.getNoteByPath(notePath);
    if (!note) return [];
    const noteTags = JSON.parse(note.tags || "[]") as string[];
    const noteTitle = note.title;
    const existingLinks = new Set(this.getLinksFrom(notePath).map((l: any) => l.target));

    const allNotes = this.db.prepare("SELECT * FROM notes WHERE path != ?").all(notePath) as any[];
    const candidates: { path: string; title: string; score: number; reasons: string[]; summary: string; type: string }[] = [];

    for (const other of allNotes) {
      if (existingLinks.has(other.title)) continue;
      let score = 0;
      const reasons: string[] = [];

      // Scoring: shared tags worth 2pts each, keyword overlap 1pt each.
      const otherTags = JSON.parse(other.tags || "[]") as string[];
      const shared = noteTags.filter((t) => otherTags.includes(t));
      score += shared.length * 2;
      reasons.push(...shared.map((t) => `tag:${t}`));

      // 4-char minimum filters stopwords; Ukrainian+Latin regex covers both languages
      const noteWords = new Set((note.summary || "").toLowerCase().match(/[а-яієїґa-z]{4,}/g) ?? []);
      const otherWords = (other.summary || "").toLowerCase().match(/[а-яієїґa-z]{4,}/g) ?? [];
      const kwMatches = otherWords.filter((w: string) => noteWords.has(w)).length;
      score += kwMatches;

      // Threshold ≥2 filters noise (single keyword match alone not enough)
      if (score >= 2) {
        candidates.push({ path: other.path, title: other.title, score, reasons, summary: other.summary || "", type: other.type || "" });
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 15);
  }

  getStats() {
    const total = (this.db.prepare("SELECT COUNT(*) as c FROM notes").get() as any).c;
    const byType = this.db.prepare("SELECT type, COUNT(*) as c FROM notes GROUP BY type").all() as any[];
    const byStatus = this.db.prepare("SELECT status, COUNT(*) as c FROM notes GROUP BY status").all() as any[];
    const linkCount = (this.db.prepare("SELECT COUNT(*) as c FROM links").get() as any).c;
    const lastIndex = (this.db.prepare("SELECT value FROM meta WHERE key = 'last_index'").get() as any)?.value;
    return { total, byType, byStatus, linkCount, lastIndex };
  }

  close() {
    this.db.close();
  }
}
