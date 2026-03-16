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

  server.tool(
    "zk_capture",
    "Create a fleeting note from a raw thought",
    {
      title: z.string().describe("Ukrainian title — short phrase"),
      thought: z.string().describe("The raw thought or observation"),
      context: z.string().optional().describe("What triggered this thought"),
      tags: z.array(z.string()).optional().describe("Tags beyond 'fleeting'"),
    },
    async (args) => {
      const result = zkCapture(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_literature",
    "Create a literature note from a source (book, article, video, podcast)",
    {
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
    async (args) => {
      const result = zkLiterature(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_permanent",
    "Create an atomic permanent note with Luhmann ID",
    {
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
    async (args) => {
      const result = zkPermanent(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_manage",
    "Edit/archive/delete a note by Luhmann ID",
    {
      zk_id: z.string().describe("Luhmann ZK ID"),
      action: z.enum(["find", "edit", "archive", "delete"]),
      updates: z.record(z.string(), z.string()).optional().describe("Frontmatter fields to update (for edit action)"),
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

  server.tool(
    "zk_promote",
    "Mark a fleeting note as processed",
    {
      note_path: z.string().describe("Relative path to the fleeting note"),
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

  server.tool(
    "zk_find_connections",
    "Find connection candidates for a note by tags + links + keywords",
    {
      note_path: z.string().optional().describe("Relative path to the note"),
      note_title: z.string().optional().describe("Note title (alternative to path)"),
    },
    async (args) => {
      const result = zkFindConnections(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_cluster_detect",
    "Find emerging themes — groups of notes sharing tags without a MOC",
    {},
    async () => {
      const result = zkClusterDetect(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === VAULT ANALYSIS ===

  server.tool(
    "zk_list",
    "List/filter notes by type, status, or folder",
    {
      type: z.string().optional(),
      status: z.string().optional(),
      folder: z.string().optional(),
    },
    async (args) => {
      db.reindex();
      const notes = db.listNotes(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(notes, null, 2) }] };
    }
  );

  server.tool(
    "zk_unprocessed",
    "Find notes needing processing (unprocessed/draft status)",
    {
      type: z.string().optional().describe("Filter by type: fleeting, literature, permanent"),
    },
    async (args) => {
      const result = zkUnprocessed(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_orphans",
    "Find notes with no incoming links",
    {
      folder: z.string().optional().describe("Filter by folder, e.g. '3-Permanent'"),
    },
    async (args) => {
      const result = zkOrphans(db, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_next_id",
    "Generate next available Luhmann ID",
    {
      parent_id: z.string().optional().describe("Parent ID to branch from"),
    },
    async (args) => {
      db.reindex();
      const ids = db.getAllZkIds();
      const id = nextId(new Set(ids.keys()), args.parent_id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ next_id: id }) }] };
    }
  );

  server.tool(
    "zk_find_by_id",
    "Resolve Luhmann ID to file path",
    {
      zk_id: z.string(),
    },
    async (args) => {
      const result = zkFindById(db, args.zk_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "zk_list_ids",
    "List all numbered permanent notes with Luhmann IDs",
    {},
    async () => {
      db.reindex();
      const result = zkListIds(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_review",
    "Full vault health report — unprocessed, orphans, stats",
    {},
    async () => {
      const result = zkReview(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === INDEX MANAGEMENT ===

  server.tool(
    "zk_reindex",
    "Full vault re-scan and DB update",
    {},
    async () => {
      const result = zkReindex(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zk_status",
    "DB stats and last index time",
    {},
    async () => {
      const result = zkStatus(db);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // === MCP PROMPTS ===

  server.prompt(
    "zk-capture",
    "Capture a quick thought as a fleeting note",
    { thought: z.string().optional().describe("The thought to capture") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Capture this as a fleeting note in my Zettelkasten vault.

${args.thought ? `Thought: ${args.thought}` : "Ask me for the thought to capture."}

## Instructions
1. Generate a descriptive Ukrainian title (short phrase, not a sentence)
2. Pick tags beyond \`fleeting\` (Ukrainian or English for tech domains)
3. Use the \`zk_find_connections\` tool to find potential connections
4. Use the \`zk_capture\` tool to create the note
5. Report: created path, connection candidates
6. Remind: fleeting notes expire in 1-2 weeks, use /zk:promote to convert

## Rules
- All note content in Ukrainian
- One thought per note
- \`fleeting\` tag always first`,
        },
      }],
    })
  );

  server.prompt(
    "zk-literature",
    "Create a literature note from a source",
    { content: z.string().optional().describe("Pasted source content") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create a literature note from this source.

${args.content ? `Source content:\n${args.content}` : "Please paste the source content."}

## Instructions
1. Ask for: title, author, source_type (книга|стаття|відео|подкаст), URL (optional), year (optional)
2. Analyze content — identify key ideas, quotes, actionable takeaways
3. Use \`zk_find_connections\` to find related notes
4. Auto-classify connections: Підтримує, Суперечить, Розширює, Пов'язано
5. Present draft for review — explain each connection
6. After confirmation, use \`zk_literature\` tool to create
7. Suggest permanent note candidates (atomic ideas worth extracting)

## Rules
- All content in Ukrainian, NEVER copy-paste — always rephrase
- source_type: книга, стаття, відео, подкаст
- \`literature\` tag always first
- Status: unprocessed until permanent notes extracted`,
        },
      }],
    })
  );

  server.prompt(
    "zk-permanent",
    "Create an atomic permanent note with connections",
    { idea: z.string().optional().describe("The idea to formulate") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create a permanent note — one atomic idea.

${args.idea ? `Idea: ${args.idea}` : "What idea should I formulate?"}

## Instructions
1. Formulate as a single atomic claim. If 2+ ideas — inform me, create separate notes.
2. Title: Ukrainian phrase that IS the idea (e.g., "Дешевий допамін знижує здатність до зусиль")
3. Use \`zk_next_id\` to get Luhmann ID. Use \`--parent\` if extending existing note.
4. Use \`zk_find_connections\` to find candidates
5. Auto-classify: Підтримує, Суперечить, Розширює, Пов'язано
6. Present draft for review — explain connections
7. After confirmation, use \`zk_permanent\` tool
8. If from fleeting note, mark source as processed

## Rules
- ONE idea per note — split if multiple
- Title IS the idea
- Must have typed connections
- Confidence: low=untested, medium=some evidence, high=well-supported
- Status: draft
- All content in Ukrainian`,
        },
      }],
    })
  );

  server.prompt(
    "zk-promote",
    "Convert fleeting notes to permanent",
    { note: z.string().optional().describe("Fleeting note name to promote") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Promote fleeting note(s) to permanent.

${args.note ? `Note: ${args.note}` : "Use `zk_unprocessed` with type=fleeting to list candidates."}

## Instructions
1. If no note specified, list candidates with \`zk_unprocessed\`
2. Read the fleeting note content
3. Analyze: count atomic ideas, assess maturity (ready / needs-more-thought)
4. For each ready idea propose: title (Ukrainian claim), confidence, connections
5. Present analysis — ask confirmation before creating
6. For each confirmed idea, use \`zk_permanent\` tool (set source_fleeting_path)
7. Check orphans with \`zk_orphans\`

## Rules
- Never force promotion — some ideas aren't ready
- If 2+ ideas in one fleeting → 2+ permanent notes
- Each permanent must have typed connections
- All content in Ukrainian
- Always link permanent → source fleeting in Origin section`,
        },
      }],
    })
  );

  server.prompt(
    "zk-manage",
    "Edit/delete/archive notes by Luhmann number",
    { command: z.string().optional().describe("e.g., 'edit 3a', 'archive 7', 'list ids'") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Manage notes by Luhmann ID.

${args.command ? `Command: ${args.command}` : "What would you like to do? (list ids / edit ID / archive ID / delete ID)"}

## Instructions
- **list ids**: Use \`zk_list_ids\` tool
- **edit ID**: Use \`zk_manage\` with action=find, then action=edit
- **archive ID**: Use \`zk_manage\` with action=archive. Confirm first, warn about broken links.
- **delete ID**: Use \`zk_manage\` with action=delete. Always confirm. If incoming links exist, suggest archive.

## Rules
- Always confirm before archive/delete
- On edit, last_modified is auto-updated
- If ID not found, show available IDs
- All content in Ukrainian`,
        },
      }],
    })
  );

  server.prompt(
    "zk-review",
    "Vault health — unprocessed, orphans, stats",
    {},
    () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Run a vault health review.

## Instructions
Use \`zk_review\` for the full report. Present:
1. Unprocessed fleeting notes → suggest /zk:promote
2. Unprocessed literature notes → suggest extracting permanent notes
3. Draft permanent notes → suggest finalizing
4. Orphan permanent notes → suggest connections
5. Overall stats

## Rules
- All summaries in Ukrainian
- Suggest specific next actions
- Read-only — don't modify notes`,
        },
      }],
    })
  );

  server.prompt(
    "zk-daily",
    "Morning briefing — what needs attention today",
    {},
    () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Ранковий брифінг мого Zettelkasten.

## Instructions
1. Use \`zk_unprocessed\` — show fleeting notes older than 3 days
2. Use \`zk_orphans\` for folder=3-Permanent — highlight disconnected ideas
3. Use \`zk_cluster_detect\` — show emerging themes without MOCs
4. Use \`zk_status\` — vault stats

Present as a concise Ukrainian-language briefing with specific action suggestions.`,
        },
      }],
    })
  );

  server.prompt(
    "zk-connect",
    "Find and create connections for a specific note",
    { note: z.string().optional().describe("Note title or ID") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Build connections for a note.

${args.note ? `Note: ${args.note}` : "Which note should I find connections for?"}

## Instructions
1. Resolve note (by title or \`zk_find_by_id\`)
2. Use \`zk_find_connections\` — get candidates
3. For each candidate with score ≥ 3, read both notes
4. Classify: Підтримує, Суперечить, Розширює, Пов'язано
5. Present proposed connections with reasoning
6. After confirmation, update the note's Connections section

## Rules
- All reasoning in Ukrainian
- Explain WHY each connection matters
- Don't force connections — quality over quantity`,
        },
      }],
    })
  );

  server.prompt(
    "zk-reflect",
    "Deep reflection on vault themes and gaps",
    {},
    () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Глибока рефлексія по Zettelkasten.

## Instructions
1. Use \`zk_list\` with type=permanent — get all permanent notes
2. Use \`zk_cluster_detect\` — find theme clusters
3. Use \`zk_orphans\` — find disconnected ideas
4. Analyze:
   - Which themes are growing? Which are stagnant?
   - What contradictions exist between notes?
   - What gaps in thinking do the orphans reveal?
   - What MOCs should be created?
5. Present reflection in Ukrainian — thoughtful, not mechanical
6. Suggest 3 specific next actions`,
        },
      }],
    })
  );

  return server;
}
