/**
 * MCP server — tool + prompt registration.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZkDatabase } from "../db/index.js";
import { zkCapture } from "../tools/capture.js";
import { zkLiterature } from "../tools/literature.js";
import { zkPermanent } from "../tools/permanent.js";
import { zkFindById, zkTree, zkEditNote, zkArchiveNote, zkDeleteNote, zkFinalize } from "../tools/manage.js";
import { zkFindConnections, zkClusterDetect } from "../tools/search.js";
import { zkUnprocessed, zkOrphans, zkReview } from "../tools/analysis.js";
import { zkReindex, zkStatus } from "../tools/index-mgmt.js";
import { zkMoc } from "../tools/moc.js";
import { zkProject } from "../tools/project.js";
import { zkBacklinks } from "../tools/backlinks.js";
import { nextId } from "../luhmann.js";

export function createServer(vaultRoot: string): McpServer {
  const db = new ZkDatabase(vaultRoot);
  // Initial index on startup
  db.reindex();

  const server = new McpServer({
    name: "obsidian-zk",
    version: "0.2.0",
  });

  // === CORE CRUD TOOLS ===

  server.registerTool(
    "zk_capture",
    {
      description: "Create a fleeting note from a raw thought",
      inputSchema: {
        title: z.string().min(1).describe("Ukrainian title — short phrase"),
        thought: z.string().describe("The raw thought or observation"),
        context: z.string().optional().describe("What triggered this thought"),
        tags: z.array(z.string()).optional().describe("Tags beyond 'fleeting'"),
      },
    },
    async (args) => {
      const result = zkCapture(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_literature",
    {
      description: "Create a literature note from a source (book, article, video, podcast)",
      inputSchema: {
        title: z.string().describe("Ukrainian title for the note"),
        source_type: z.string().describe("книга|стаття|відео|подкаст"),
        source_title: z.string().describe("Original source title"),
        source_author: z.string().describe("Author name"),
        source_url: z.string().optional(),
        source_year: z.string().optional(),
        summary: z.string().describe("2-3 sentence summary in Ukrainian"),
        reading_notes: z.array(z.union([
          z.string(),
          z.object({ chapter: z.string(), notes: z.array(z.string()) }),
        ])).optional().describe("Raw reading notes — strings or {chapter, notes[]} for books"),
        key_ideas: z.array(z.string()).describe("Key ideas from the source"),
        quotes: z.array(z.string()).optional(),
        interpretation: z.string().optional(),
        takeaways: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        connections: z.array(z.object({ target: z.string(), type: z.string() })).optional(),
      },
    },
    async (args) => {
      const result = zkLiterature(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_permanent",
    {
      description: "Create an atomic permanent note with Luhmann ID",
      inputSchema: {
        title: z.string().describe("Ukrainian phrase that IS the idea"),
        claim: z.string().describe("One-sentence atomic claim"),
        elaboration: z.string().describe("Explanation of the idea"),
        evidence: z.array(z.string()).optional(),
        counterpoints: z.array(z.string()).optional(),
        origin: z.string().optional().describe("Source reference (wikilink to fleeting/literature note)"),
        confidence: z.enum(["low", "medium", "high"]),
        parent_id: z.string().optional().describe("Parent Luhmann ID to branch from"),
        tags: z.array(z.string()).optional(),
        connections: z.array(z.object({ target: z.string(), type: z.string() })).optional(),
        source_fleeting_path: z.string().optional().describe("Path of source fleeting note to mark as processed"),
        source_literature_path: z.string().optional().describe("Path of source literature note to mark as processed"),
      },
    },
    async (args) => {
      const result = zkPermanent(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_manage",
    {
      description: "Edit/archive/delete a note by Luhmann ID",
      inputSchema: {
        zk_id: z.string().describe("Luhmann ZK ID"),
        action: z.enum(["find", "edit", "archive", "delete"]),
        updates: z.record(z.string(), z.string()).optional().describe("Frontmatter fields to update (for edit action)"),
        sections: z.record(z.string(), z.string()).optional().describe("Body sections to update (for edit action) — key is section header, value is new content"),
      },
    },
    async (args) => {
      let result: any;
      switch (args.action) {
        case "find":
          result = zkFindById(db, args.zk_id);
          break;
        case "edit":
          result = zkEditNote(db, args.zk_id, (args.updates ?? {}) as Record<string, string>, (args.sections as Record<string, string>) ?? undefined);
          break;
        case "archive":
          result = zkArchiveNote(db, args.zk_id);
          break;
        case "delete":
          result = zkDeleteNote(db, args.zk_id);
          break;
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_promote",
    {
      description: "Mark a fleeting or literature note as processed, returns key_ideas for literature notes",
      inputSchema: {
        note_path: z.string().describe("Relative path to the note"),
      },
    },
    async (args) => {
      const { updateFrontmatterField } = await import("../vault/writer.js");
      const { parseFrontmatter, getBody } = await import("../vault/parser.js");
      const { join } = await import("node:path");
      const { existsSync } = await import("node:fs");
      const fullPath = join(db.vaultRoot, args.note_path);

      if (!existsSync(fullPath)) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${args.note_path}` }) }] };
      }

      try {
        const fm = parseFrontmatter(fullPath);
        const body = getBody(fullPath);

        let key_ideas: string[] = [];
        if (fm.type === "literature") {
          const match = body.match(/##\s+Key Ideas[^\n]*\n([\s\S]*?)(?=\n##|$)/);
          if (match) {
            key_ideas = match[1].split("\n")
              .map((l) => l.replace(/^\d+\.\s*/, "").trim())
              .filter((l) => l.length > 0);
          }
        }

        updateFrontmatterField(fullPath, "status", "processed");
        db.indexNote(args.note_path);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              path: args.note_path,
              type: fm.type,
              key_ideas: key_ideas.length > 0 ? key_ideas : undefined,
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Failed to promote: ${err.message}` }) }] };
      }
    }
  );

  // === NEW: MOC TOOL ===

  server.registerTool(
    "zk_moc",
    {
      description: "Create a Map of Content note — auto-pulls notes by tag cluster",
      inputSchema: {
        topic: z.string().describe("MOC topic title in Ukrainian"),
        tags: z.array(z.string()).optional().describe("Tags to auto-pull matching notes"),
        note_paths: z.array(z.string()).optional().describe("Explicit note paths to include"),
      },
    },
    async (args) => {
      const result = zkMoc(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === NEW: PROJECT TOOL ===

  server.registerTool(
    "zk_project",
    {
      description: "Create a project note with objectives, tasks, and related notes",
      inputSchema: {
        title: z.string().describe("Project title in Ukrainian"),
        objective: z.string().describe("Project objective/goal"),
        tasks: z.array(z.string()).optional().describe("Task items"),
        related_notes: z.array(z.string()).optional().describe("Titles of related notes (wikilinks)"),
        priority: z.string().optional().describe("low|medium|high"),
        deadline: z.string().optional().describe("Deadline date YYYY-MM-DD"),
      },
    },
    async (args) => {
      const result = zkProject(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === NEW: BACKLINKS TOOL ===

  server.registerTool(
    "zk_backlinks",
    {
      description: "Get incoming and outgoing links for a note",
      inputSchema: {
        note_path: z.string().optional().describe("Relative path to the note"),
        note_title: z.string().optional().describe("Note title"),
        zk_id: z.string().optional().describe("Luhmann ZK ID"),
      },
    },
    async (args) => {
      const result = zkBacklinks(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === NEW: FINALIZE TOOL ===

  server.registerTool(
    "zk_finalize",
    {
      description: "Quality-check a permanent note and finalize if all checks pass",
      inputSchema: {
        zk_id: z.string().describe("Luhmann ZK ID of the note to finalize"),
      },
    },
    async (args) => {
      const result = zkFinalize(db, args.zk_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === SEARCH & CONNECTIONS ===

  server.registerTool(
    "zk_find_connections",
    {
      description: "Find connection candidates for a note by tags + keywords + Luhmann proximity + MOC overlap",
      inputSchema: {
        note_path: z.string().optional().describe("Relative path to the note"),
        note_title: z.string().optional().describe("Note title (alternative to path)"),
      },
    },
    async (args) => {
      const result = zkFindConnections(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_cluster_detect",
    {
      description: "Find emerging themes — groups of notes sharing tags without a MOC",
      inputSchema: {},
    },
    async () => {
      const result = zkClusterDetect(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === VAULT ANALYSIS ===

  server.registerTool(
    "zk_list",
    {
      description: "List/filter notes by type, status, or folder",
      inputSchema: {
        type: z.string().optional(),
        status: z.string().optional(),
        folder: z.string().optional(),
      },
    },
    async (args) => {
      db.reindex();
      const notes = db.listNotes(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(notes, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_unprocessed",
    {
      description: "Find notes needing processing — includes age and urgency (>7d warning, >14d critical)",
      inputSchema: {
        type: z.string().optional().describe("Filter by type: fleeting, literature, permanent"),
      },
    },
    async (args) => {
      const result = zkUnprocessed(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_orphans",
    {
      description: "Find notes with no incoming links",
      inputSchema: {
        folder: z.string().optional().describe("Filter by folder, e.g. '3-Permanent'"),
      },
    },
    async (args) => {
      const result = zkOrphans(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_next_id",
    {
      description: "Generate next available Luhmann ID",
      inputSchema: {
        parent_id: z.string().optional().describe("Parent ID to branch from"),
      },
    },
    async (args) => {
      db.reindex();
      const ids = db.getAllZkIds();
      const id = nextId(new Set(ids.keys()), args.parent_id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ next_id: id }) }] };
    }
  );

  server.registerTool(
    "zk_find_by_id",
    {
      description: "Resolve Luhmann ID to file path",
      inputSchema: {
        zk_id: z.string(),
      },
    },
    async (args) => {
      const result = zkFindById(db, args.zk_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    "zk_tree",
    {
      description: "Visualize the Luhmann knowledge tree — full tree, subtree from root_id, or context around context_id",
      inputSchema: {
        root_id: z.string().optional().describe("Show subtree from this ID"),
        context_id: z.string().optional().describe("Show ancestors, siblings, children of this note"),
        depth: z.number().optional().describe("Max depth (default 5)"),
      },
    },
    async (args) => {
      db.reindex();
      const result = zkTree(db, args);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.registerTool(
    "zk_review",
    {
      description: "Full vault health report — unprocessed, orphans, stats",
      inputSchema: {},
    },
    async () => {
      const result = zkReview(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === INDEX MANAGEMENT ===

  server.registerTool(
    "zk_reindex",
    {
      description: "Full vault re-scan and DB update",
      inputSchema: {},
    },
    async () => {
      const result = zkReindex(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "zk_status",
    {
      description: "DB stats and last index time",
      inputSchema: {},
    },
    async () => {
      const result = zkStatus(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
