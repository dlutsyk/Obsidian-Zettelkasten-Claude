# CLAUDE.md

## Project

OZC — Obsidian Zettelkasten MCP Server. TypeScript npm package using `@modelcontextprotocol/sdk` + `better-sqlite3`.

## Commands

```bash
npm run build    # compile TypeScript
npm run dev      # watch mode
```

## Architecture

```
src/cli/          → CLI entry (init, update, serve)
src/server/       → MCP server (tool + prompt registration, stdio transport)
src/vault/        → parser, scanner, writer (frontmatter, wikilinks, file I/O)
src/db/           → SQLite schema + indexing
src/tools/        → MCP tool implementations
src/luhmann.ts    → Luhmann ID generation + sorting
templates/        → Copied to user vault on `ozc init`
```

MCP tools registered in `src/server/server.ts`. Each tool calls functions from `src/tools/`.

## Key patterns

- Vault parsing: `parseFrontmatter()` in `src/vault/parser.ts` — manual YAML parser (no deps)
- DB: `ZkDatabase` class in `src/db/index.ts` — wraps better-sqlite3, handles indexing
- Incremental index: compare `content_hash` (MD5), only update changed files
- Luhmann IDs: alternating numbers/letters, `nextId()` in `src/luhmann.ts`
- Note templates in `templates/vault-folders/Templates/`
- Skills in `templates/claude/skills/` — installed by `ozc init`

## Note language

All note content, section headers, connection types in Ukrainian. Code and docs in English.
