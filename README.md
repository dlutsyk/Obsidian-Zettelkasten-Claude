# obsidian-zk — Obsidian Zettelkasten MCP Server

MCP server for AI-assisted Zettelkasten in Obsidian. Luhmann numbering, typed connections, SQLite metadata cache.

Works with [Claude Code](https://claude.ai/code) — exposes tools and prompts via [Model Context Protocol](https://modelcontextprotocol.io/).

## What it does

- **CRUD** for fleeting, literature, permanent, MOC, and project notes with proper frontmatter
- **Luhmann numbering** — auto-generates `zk_id` with alternating numbers/letters (`1 → 1a → 1a1 → 1a1a`)
- **Connection scoring** — finds related notes by shared tags, keywords, Luhmann proximity, MOC overlap
- **Backlinks** — incoming/outgoing link tracking with path-based resolution
- **Vault analysis** — unprocessed notes with age warnings, orphans, emerging theme clusters
- **Quality pipeline** — promote fleeting/literature → permanent, finalize with quality checks
- **MCP skills** — guided workflows as slash commands (`/zk:capture`, `/zk:promote`, `/zk:moc`, etc.)
- **SQLite index** — incremental indexing with single-note updates, path-based link storage

No embeddings — Claude judges semantic relevance directly in context.

## Quick start

### 1. Install

```bash
npx obsidian-zk init
```

Interactive wizard:

- Detects or asks for vault path
- Creates folder structure (`1-Fleeting/`, `2-Literature/`, `3-Permanent/`, `4-MOC/`, `5-Projects/`)
- Copies note templates, skills, and agents into `.claude/`
- Creates `CLAUDE.md` with project instructions
- Sets up SQLite database in `.zk/`
- Configures MCP server in `.mcp.json`

### 2. Use

Open vault directory in Claude Code:

```bash
cd your-vault
claude
```

The MCP server starts automatically. Use prompts:


| Command          | What it does                                         |
| ---------------- | ---------------------------------------------------- |
| `/zk:capture`    | Quick fleeting note from a thought                   |
| `/zk:literature` | Literature note from pasted source                   |
| `/zk:permanent`  | Atomic permanent note with auto Luhmann ID           |
| `/zk:promote`    | Convert fleeting/literature → permanent (single/batch) |
| `/zk:manage`     | Edit/archive/delete by Luhmann number                |
| `/zk:moc`        | Create Map of Content — auto-pulls notes by tag      |
| `/zk:project`    | Create project note with tasks and deadlines         |
| `/zk:finalize`   | Quality-check and finalize permanent notes           |
| `/zk:review`     | Vault health report                                  |
| `/zk:daily`      | Morning briefing with age warnings                   |
| `/zk:connect`    | Find and create connections for a note               |
| `/zk:reflect`    | Deep reflection on vault themes                      |


### 3. Update

After upgrading the package:

```bash
npx obsidian-zk update
```

Syncs skills/agents, runs DB migrations.

## How it works

```
Claude Code ←→ MCP Server (obsidian-zk serve) ←→ SQLite DB + Vault files
                   │
                   ├── Tools (zk_capture, zk_permanent, zk_moc, zk_backlinks, ...)
                   └── Skills (/zk:capture, /zk:promote, /zk:finalize, ...)
```

### Architecture


| Component       | Choice                                               |
| --------------- | ---------------------------------------------------- |
| MCP SDK         | `@modelcontextprotocol/sdk` (stdio transport)        |
| Database        | `better-sqlite3` — single `.zk/zettelkasten.db` file |
| Semantic search | Claude itself — no embeddings infra needed           |
| Vault I/O       | Node.js `fs` — direct file read/write                |


### MCP Tools

**CRUD:**

- `zk_capture` — create fleeting note
- `zk_literature` — create literature note
- `zk_permanent` — create permanent note with Luhmann ID
- `zk_manage` — edit frontmatter + body sections, archive, delete by ID
- `zk_promote` — mark fleeting/literature as processed, extract key ideas
- `zk_moc` — create Map of Content, auto-pull notes by tags
- `zk_project` — create project note with tasks/deadlines

**Search & connections:**

- `zk_find_connections` — candidates scored by tags, keywords, Luhmann proximity, MOC overlap
- `zk_backlinks` — incoming/outgoing links for a note (by path, title, or ID)
- `zk_cluster_detect` — emerging themes without MOCs

**Analysis:**

- `zk_list` — filter notes by type/status/folder
- `zk_unprocessed` — notes needing processing with age and urgency tiers
- `zk_orphans` — notes with no incoming links
- `zk_finalize` — quality-check permanent notes (connections, claim, evidence, confidence)
- `zk_next_id` — next Luhmann ID
- `zk_find_by_id` — resolve ID → path
- `zk_list_ids` — all numbered notes
- `zk_review` — full vault health report

**Index:**

- `zk_reindex` — full vault re-scan
- `zk_status` — DB stats

### Database schema

```sql
CREATE TABLE notes (
  path TEXT PRIMARY KEY,
  title TEXT, zk_id TEXT, type TEXT, status TEXT,
  folder TEXT, tags TEXT, summary TEXT,
  created TEXT, modified TEXT, content_hash TEXT
);

CREATE TABLE links (
  source TEXT, target TEXT, link_type TEXT,
  PRIMARY KEY (source, target)
);
```

Links use **path-based resolution** — wikilink titles resolved to file paths during indexing. Incremental indexing via `content_hash`; single-note `indexNote()` for CRUD ops, full `reindex()` for vault scans.

## Zettelkasten method

### Note types


| Folder          | Type              | Atomic? | Lifecycle               |
| --------------- | ----------------- | ------- | ----------------------- |
| `1-Fleeting/`   | Raw thoughts      | No      | unprocessed → processed |
| `2-Literature/` | Source summaries  | Partial | unprocessed → processed |
| `3-Permanent/`  | One idea per note | **Yes** | draft → finalized       |
| `4-MOC/`        | Topic indexes     | No      | draft → active          |
| `5-Projects/`   | Active goals      | No      | active → completed      |


### Luhmann numbering

```
1, 2, 3          — independent threads
1a, 1b            — branches from 1
1a1, 1a2          — sub-branches from 1a
```

### Connection types

- **Підтримує** (Supports) — reinforces another idea
- **Суперечить** (Contradicts) — challenges another idea
- **Розширює** (Extends) — builds upon another idea
- **Пов'язано** (Related) — topically connected

### Connection scoring

Notes are scored for connection relevance using multiple signals:
- Shared tags: +2 per tag
- Keyword overlap: +1 (4+ chars), +2 (6+ chars)
- Luhmann proximity: +3 (siblings), +1 (cousins)
- Shared MOC: +2
- Threshold: score ≥ 2 to appear as candidate

### Workflow

```
Thought → /zk:capture → Fleeting note
Source  → /zk:literature → Literature note
                ↓
         /zk:promote (fleeting or literature)
                ↓
         Permanent note (auto zk_id) ←→ connections
                ↓
         /zk:finalize (quality check)
                ↓
         MOC (when 3+ related notes cluster)
```

## Development

```bash
git clone https://github.com/user/obsidian-zk.git
cd obsidian-zk
npm install
npm run build       # compile TypeScript
npm run dev         # watch mode
```

Test locally:

```bash
# Start server against a test vault
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  | node dist/cli/index.js serve --vault /path/to/vault

# Or configure in Claude Code
claude mcp add obsidian-zk -- node /path/to/obsidian-zk/dist/cli/index.js serve --vault .
```

### Project structure

```
src/
├── cli/index.ts          # CLI: init, update, serve
├── init/
│   ├── wizard.ts         # Interactive setup
│   ├── scaffold.ts       # Copy templates, create folders
│   └── updater.ts        # Sync templates, run migrations
├── server/
│   ├── index.ts          # Stdio transport entry
│   └── server.ts         # Tool + prompt registration
├── vault/
│   ├── parser.ts         # Frontmatter, wikilinks, body
│   ├── scanner.ts        # File discovery
│   └── writer.ts         # Note creation/editing + section updates
├── db/
│   ├── schema.ts         # SQLite schema + migrations
│   └── index.ts          # DB connection, indexing, connection scoring
├── tools/                # MCP tool implementations
│   ├── capture.ts        # Fleeting notes
│   ├── literature.ts     # Literature notes
│   ├── permanent.ts      # Permanent notes (from fleeting or literature)
│   ├── manage.ts         # Edit/archive/delete/finalize
│   ├── moc.ts            # Map of Content creation
│   ├── project.ts        # Project notes
│   ├── backlinks.ts      # Incoming/outgoing link queries
│   ├── search.ts         # Connection search + cluster detection
│   ├── analysis.ts       # Unprocessed, orphans, review
│   └── index-mgmt.ts     # Reindex, status
└── luhmann.ts            # ID generation + sorting
templates/                # Copied to user vault on init
├── claude/skills/        # 12 SKILL.md files
├── claude/agents/        # zk-analyzer agent
├── vault-folders/        # Default folder structure + note templates
└── CLAUDE.md.template    # Project instructions
```

## Requirements

- Node.js ≥ 18
- [Claude Code](https://claude.ai/code)
- [Obsidian](https://obsidian.md/) (for viewing/editing notes)

## License

MIT
