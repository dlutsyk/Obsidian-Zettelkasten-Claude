/**
 * MCP server — tool + prompt registration.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZkDatabase } from "../db/index.js";
import { zkCapture } from "../tools/capture.js";
import { zkLiterature } from "../tools/literature.js";
import { zkPermanent } from "../tools/permanent.js";
import { zkFindById, zkListIds, zkEditNote, zkArchiveNote, zkDeleteNote } from "../tools/manage.js";
import { zkFindConnections, zkClusterDetect } from "../tools/search.js";
import { zkUnprocessed, zkOrphans, zkReview } from "../tools/analysis.js";
import { zkReindex, zkStatus } from "../tools/index-mgmt.js";
import { nextId } from "../luhmann.js";

export function createServer(vaultRoot: string): McpServer {
  const db = new ZkDatabase(vaultRoot);
  // Initial index on startup
  db.reindex();

  const server = new McpServer({
    name: "obsidian-zk",
    version: "0.1.0",
  });

  // === CORE CRUD TOOLS ===

  server.registerTool(
    "zk_capture",
    {
      description: "Create a fleeting note from a raw thought",
      inputSchema: {
        title: z.string().describe("Ukrainian title — short phrase"),
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
      },
    },
    async (args) => {
      let result: any;
      switch (args.action) {
        case "find":
          result = zkFindById(db, args.zk_id);
          break;
        case "edit":
          result = zkEditNote(db, args.zk_id, (args.updates ?? {}) as Record<string, string>);
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
      description: "Mark a fleeting note as processed",
      inputSchema: {
        note_path: z.string().describe("Relative path to the fleeting note"),
      },
    },
    async (args) => {
      const { updateFrontmatterField } = await import("../vault/writer.js");
      const { join } = await import("node:path");
      const fullPath = join(db.vaultRoot, args.note_path);
      updateFrontmatterField(fullPath, "status", "processed");
      db.reindex();
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, path: args.note_path }) }] };
    }
  );

  // === SEARCH & CONNECTIONS ===

  server.registerTool(
    "zk_find_connections",
    {
      description: "Find connection candidates for a note by tags + links + keywords",
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
      description: "Find notes needing processing (unprocessed/draft status)",
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
    "zk_list_ids",
    {
      description: "List all numbered permanent notes with Luhmann IDs",
      inputSchema: {},
    },
    async () => {
      db.reindex();
      const result = zkListIds(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
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
