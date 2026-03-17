/**
 * Database connection + indexing.
 */
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema.js";
import { scanVault } from "../vault/scanner.js";
import { parseFrontmatter, getBody, getTags, getWikilinks } from "../vault/parser.js";
import type { Frontmatter } from "../vault/parser.js";

/** Heading texts per note type — source of truth for section detection. */
const SECTION_HEADINGS: Record<string, Record<string, { heading: string; emptyValues?: string[] }>> = {
  permanent: {
    has_claim:         { heading: "## Claim (Твердження)" },
    has_elaboration:   { heading: "## Elaboration (Розкриття)" },
    has_evidence:      { heading: "## Evidence & Support (Докази та підтримка)", emptyValues: ["-"] },
    has_counterpoints: { heading: "## Counterpoints & Limitations (Контраргументи та обмеження)", emptyValues: ["-"] },
  },
  fleeting: {
    has_thought: { heading: "## Thought (Думка)" },
  },
};

/**
 * Extract content between a heading and the next same-or-higher-level heading (or EOF).
 * Returns trimmed content, or null if heading not found.
 */
function sectionContent(body: string, heading: string): string | null {
  const idx = body.indexOf(heading);
  if (idx === -1) return null;
  const afterHeading = body.slice(idx + heading.length);
  // Match next ## heading (or end)
  const nextIdx = afterHeading.search(/\n##\s/);
  const raw = nextIdx === -1 ? afterHeading : afterHeading.slice(0, nextIdx);
  return raw.trim();
}

/**
 * Compute boolean flags for a note based on its type.
 * Checks both frontmatter fields and section content.
 */
function extractFlags(fm: Frontmatter, body: string, type: string | undefined): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  if (!type) return flags;

  // Frontmatter-derived flags (applicable to any type)
  if (fm.confidence) flags.has_confidence = true;
  if (fm.claim) flags.has_claim = true;

  // Section-derived flags
  const defs = SECTION_HEADINGS[type];
  if (!defs) return flags;

  for (const [flag, { heading, emptyValues }] of Object.entries(defs)) {
    if (flags[flag]) continue; // already true from frontmatter
    const content = sectionContent(body, heading);
    if (content === null || content.length === 0) {
      flags[flag] = false;
      continue;
    }
    // Check against known empty placeholders
    if (emptyValues?.includes(content)) {
      flags[flag] = false;
      continue;
    }
    flags[flag] = true;
  }

  return flags;
}

function extractSummary(fm: Frontmatter, body: string, type: string | undefined): string {
  if (type === "permanent" && fm.claim) {
    return String(fm.claim);
  }
  if (type === "literature") {
    const lines = body.split("\n");
    let para = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        if (para) return para.slice(0, 500);
        continue;
      }
      para += (para ? " " : "") + trimmed;
    }
    if (para) return para.slice(0, 500);
  }
  if (type === "fleeting") {
    const match = body.match(/##\s+Thought[^\n]*\n([\s\S]*?)(?=\n##|$)/);
    if (match) return match[1].trim().slice(0, 500);
  }
  return body.trim().slice(0, 500);
}

function luhmannProximity(idA: string | null, idB: string | null): number {
  if (!idA || !idB) return 0;
  const partsA = idA.match(/(\d+|[a-z]+)/g) ?? [];
  const partsB = idB.match(/(\d+|[a-z]+)/g) ?? [];
  let common = 0;
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    if (partsA[i] === partsB[i]) common++;
    else break;
  }
  if (common === 0) return 0;
  // Siblings: share all but last segment
  if (common >= Math.max(partsA.length, partsB.length) - 1) return 3;
  // Cousins: share at least one segment
  return 1;
}

export class ZkDatabase {
  db: Database.Database;
  vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot;
    const dbDir = join(vaultRoot, ".zk");
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, "zettelkasten.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CREATE_TABLES);

    // Migrate: add flags column if missing (v1 → v2)
    const cols = this.db.pragma("table_info(notes)") as { name: string }[];
    if (!cols.some((c) => c.name === "flags")) {
      this.db.exec("ALTER TABLE notes ADD COLUMN flags TEXT");
    }

    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("schema_version", String(SCHEMA_VERSION));
  }

  resolveWikilink(title: string): string | null {
    const row = this.db.prepare("SELECT path FROM notes WHERE title = ?").get(title) as { path: string } | undefined;
    return row?.path ?? null;
  }

  indexNote(relPath: string): void {
    const fullPath = join(this.vaultRoot, relPath);
    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      return;
    }

    const hash = createHash("md5").update(content).digest("hex");
    const fm = parseFrontmatter(fullPath);
    const body = getBody(fullPath);
    const title = basename(relPath, ".md");
    const folder = dirname(relPath).split("/")[0] || "";
    const tags = getTags(fm);
    const type = fm.type as string | undefined;
    const summary = extractSummary(fm, body, type);
    const flags = extractFlags(fm, body, type);

    this.db.prepare(`
      INSERT OR REPLACE INTO notes (path, title, zk_id, type, status, folder, tags, summary, created, modified, content_hash, flags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      relPath, title,
      (fm.zk_id as string) || null,
      type || null,
      (fm.status as string) || null,
      folder, JSON.stringify(tags), summary,
      (fm.date as string) || null,
      (fm.last_modified as string) || null,
      hash,
      JSON.stringify(flags)
    );

    // Rebuild links for this note
    this.db.prepare("DELETE FROM links WHERE source = ?").run(relPath);
    const insertLink = this.db.prepare("INSERT OR REPLACE INTO links (source, target, link_type) VALUES (?, ?, ?)");
    const wikilinks = getWikilinks(fullPath);
    for (const target of wikilinks) {
      const targetPath = this.resolveWikilink(target) ?? target;
      insertLink.run(relPath, targetPath, null);
    }

    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("last_index", new Date().toISOString());
  }

  removeNote(relPath: string): void {
    this.db.prepare("DELETE FROM notes WHERE path = ?").run(relPath);
    this.db.prepare("DELETE FROM links WHERE source = ?").run(relPath);
    this.db.prepare("DELETE FROM links WHERE target = ?").run(relPath);
  }

  reindex(): { added: number; updated: number; removed: number } {
    const notes = scanVault(this.vaultRoot);
    const currentPaths = new Set(notes.map((n) => n.relPath));
    let added = 0, updated = 0, removed = 0;

    // Remove deleted notes + their links
    const dbPaths = this.db.prepare("SELECT path FROM notes").all() as { path: string }[];
    const deleteNote = this.db.prepare("DELETE FROM notes WHERE path = ?");
    const deleteLinks = this.db.prepare("DELETE FROM links WHERE source = ?");
    for (const { path } of dbPaths.filter((r) => !currentPaths.has(r.path))) {
      deleteNote.run(path);
      deleteLinks.run(path);
      removed++;
    }

    // Pass 1: upsert all notes
    const getHash = this.db.prepare("SELECT content_hash FROM notes WHERE path = ?");
    const upsert = this.db.prepare(`
      INSERT OR REPLACE INTO notes (path, title, zk_id, type, status, folder, tags, summary, created, modified, content_hash, flags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const changedPaths = new Set<string>();

    const upsertTx = this.db.transaction(() => {
      for (const note of notes) {
        const fullPath = join(this.vaultRoot, note.relPath);
        let content: string;
        try {
          content = readFileSync(fullPath, "utf-8");
        } catch {
          continue;
        }

        const hash = createHash("md5").update(content).digest("hex");
        const existing = getHash.get(note.relPath) as { content_hash: string } | undefined;
        if (existing?.content_hash === hash) continue;

        changedPaths.add(note.relPath);
        const fm = parseFrontmatter(fullPath);
        const body = getBody(fullPath);
        const title = basename(note.relPath, ".md");
        const folder = dirname(note.relPath).split("/")[0] || "";
        const tags = getTags(fm);
        const type = fm.type as string | undefined;
        const summary = extractSummary(fm, body, type);
        const flags = extractFlags(fm, body, type);

        upsert.run(
          note.relPath, title,
          (fm.zk_id as string) || null,
          type || null,
          (fm.status as string) || null,
          folder, JSON.stringify(tags), summary,
          (fm.date as string) || null,
          (fm.last_modified as string) || null,
          hash,
          JSON.stringify(flags)
        );

        if (existing) updated++;
        else added++;
      }
    });
    upsertTx();

    // Pass 2: rebuild links for changed notes (all notes now in DB for resolution)
    const insertLink = this.db.prepare("INSERT OR REPLACE INTO links (source, target, link_type) VALUES (?, ?, ?)");
    const deleteSrcLinks = this.db.prepare("DELETE FROM links WHERE source = ?");

    const linkTx = this.db.transaction(() => {
      for (const relPath of changedPaths) {
        deleteSrcLinks.run(relPath);
        const fullPath = join(this.vaultRoot, relPath);
        const wikilinks = getWikilinks(fullPath);
        for (const target of wikilinks) {
          const targetPath = this.resolveWikilink(target) ?? target;
          insertLink.run(relPath, targetPath, null);
        }
      }
    });
    linkTx();

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
    let sql = `
      SELECT n.* FROM notes n
      LEFT JOIN links l ON l.target = n.path
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

  getLinksTo(path: string) {
    return this.db.prepare("SELECT * FROM links WHERE target = ?").all(path) as any[];
  }

  shareMoc(pathA: string, pathB: string): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) as c FROM links l1
      JOIN links l2 ON l1.source = l2.source
      JOIN notes n ON l1.source = n.path AND n.type = 'moc'
      WHERE l1.target = ? AND l2.target = ?
    `).get(pathA, pathB) as { c: number };
    return row.c > 0;
  }

  findConnections(notePath: string) {
    const note = this.getNoteByPath(notePath);
    if (!note) return [];
    const noteTags = JSON.parse(note.tags || "[]") as string[];
    const existingLinks = new Set(this.getLinksFrom(notePath).map((l: any) => l.target));

    const allNotes = this.db.prepare("SELECT * FROM notes WHERE path != ?").all(notePath) as any[];
    const candidates: { path: string; title: string; score: number; reasons: string[]; summary: string; type: string }[] = [];

    for (const other of allNotes) {
      if (existingLinks.has(other.path)) continue;
      let score = 0;
      const reasons: string[] = [];

      // Shared tags: 2pts each
      const otherTags = JSON.parse(other.tags || "[]") as string[];
      const shared = noteTags.filter((t) => otherTags.includes(t));
      score += shared.length * 2;
      reasons.push(...shared.map((t) => `tag:${t}`));

      // Keyword overlap: 6+ chars → +2, shorter → +1
      const noteWords = new Set((note.summary || "").toLowerCase().match(/[а-яієїґa-z]{4,}/g) ?? []);
      const otherWords = (other.summary || "").toLowerCase().match(/[а-яієїґa-z]{4,}/g) ?? [];
      for (const w of otherWords) {
        if (noteWords.has(w)) {
          score += w.length >= 6 ? 2 : 1;
          reasons.push(`kw:${w}`);
        }
      }

      // Luhmann proximity
      const proximity = luhmannProximity(note.zk_id, other.zk_id);
      if (proximity > 0) {
        score += proximity;
        reasons.push(proximity >= 3 ? "luhmann:sibling" : "luhmann:cousin");
      }

      // MOC boost: both notes referenced by same MOC
      if (score >= 1 && this.shareMoc(notePath, other.path)) {
        score += 2;
        reasons.push("shared-moc");
      }

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
