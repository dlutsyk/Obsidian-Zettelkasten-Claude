---
name: zk:review
description: Review vault health — unprocessed notes, orphans, connections, listing. Use for vault status, weekly review, or finding what needs processing.
---

# ZK Review

Vault analysis and health checks.

## Operations

- **Unprocessed:** `zk_unprocessed` MCP tool. Suggest `/zk:promote` for fleeting.
- **Orphans:** `zk_orphans` MCP tool. Suggest connections.
- **Connections:** `zk_find_connections` MCP tool.
- **List:** `zk_list` MCP tool with filters.
- **Full review:** `zk_review` MCP tool for complete report.

## Rules

- All output in Ukrainian
- Suggest specific next actions
- Read-only — don't modify notes
