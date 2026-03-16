# obsidian-zk — Obsidian Zettelkasten MCP Server

MCP server for AI-assisted Zettelkasten in Obsidian. Luhmann numbering, typed connections, SQLite metadata cache.

Works with [Claude Code](https://claude.ai/code) — exposes tools and prompts via [Model Context Protocol](https://modelcontextprotocol.io/).

## What it does

- **CRUD** for fleeting, literature, and permanent notes with proper frontmatter
- **Luhmann numbering** — auto-generates `zk_id` with alternating numbers/letters (`1 → 1a → 1a1 → 1a1a`)
- **Connection search** — finds related notes by shared tags, keywords, link proximity
- **Vault analysis** — unprocessed notes, orphans, emerging theme clusters
- **MCP prompts** — guided workflows as slash commands (`/zk:capture`, `/zk:promote`, etc.)
- **SQLite index** — fast metadata queries without scanning files every time

No embeddings — Claude judges semantic relevance directly in context.

## Quick start

### 1. Install

```bash
npx obsidian-zk init
```

Interactive wizard:
- Detects or asks for vault path
- Creates folder structure (`1-Fleeting/`, `2-Literature/`, `3-Permanent/`, etc.)
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

| Command | What it does |
|---------|-------------|
| `/zk:capture` | Quick fleeting note from a thought |
| `/zk:literature` | Literature note from pasted source |
| `/zk:permanent` | Atomic permanent note with auto Luhmann ID |
| `/zk:promote` | Convert fleeting → permanent |
| `/zk:manage` | Edit/archive/delete by Luhmann number |
| `/zk:review` | Vault health report |
| `/zk:daily` | Morning briefing |
| `/zk:connect` | Find and create connections for a note |
| `/zk:reflect` | Deep reflection on vault themes |

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
                   ├── Tools (zk_capture, zk_permanent, zk_find_connections, ...)
                   └── Prompts (/zk:capture, /zk:promote, /zk:review, ...)
```

### Architecture

| Component | Choice |
|-----------|--------|
| MCP SDK | `@modelcontextprotocol/sdk` (stdio transport) |
| Database | `better-sqlite3` — single `.zk/zettelkasten.db` file |
| Semantic search | Claude itself — no embeddings infra needed |
| Vault I/O | Node.js `fs` — direct file read/write |

### MCP Tools

**CRUD:**
- `zk_capture` — create fleeting note
- `zk_literature` — create literature note
- `zk_permanent` — create permanent note with Luhmann ID
- `zk_manage` — edit/archive/delete by ID
- `zk_promote` — mark fleeting as processed

**Search & connections:**
- `zk_find_connections` — candidates by tags + links + keywords
- `zk_cluster_detect` — emerging themes without MOCs

**Analysis:**
- `zk_list` — filter notes by type/status/folder
- `zk_unprocessed` — notes needing processing
- `zk_orphans` — notes with no incoming links
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

Incremental indexing — compares `content_hash`, only updates changed files.

## Zettelkasten method

### Note types

| Folder | Type | Atomic? | Lifecycle |
|--------|------|---------|-----------|
| `1-Fleeting/` | Raw thoughts | No | unprocessed → processed |
| `2-Literature/` | Source summaries | Partial | unprocessed → processed |
| `3-Permanent/` | One idea per note | **Yes** | draft → finalized |
| `4-MOC/` | Topic indexes | No | — |
| `5-Projects/` | Active goals | No | active → completed |

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

### Workflow

```
Thought → /zk:capture → Fleeting note
Source  → /zk:literature → Literature note
                ↓
         /zk:promote (or /zk:permanent)
                ↓
         Permanent note (auto zk_id) ←→ connections
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
│   └── writer.ts         # Note creation/editing
├── db/
│   ├── schema.ts         # SQLite schema
│   └── index.ts          # DB connection + indexing
├── tools/                # MCP tool implementations
└── luhmann.ts            # ID generation + sorting
templates/                # Copied to user vault on init
├── claude/skills/        # 9 SKILL.md files
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
