---
name: zk:connect
description: Find and create connections for a specific note.
---

# ZK Connect

Build connections for a specific note.

## Workflow

1. Resolve note by title or ID (`zk_find_by_id`)
2. `zk_find_connections` to get candidates
3. Read both notes for context
4. Classify: Підтримує, Суперечить, Розширює, Пов'язано
5. Present proposed connections with reasoning
6. After confirmation, update the note

## Rules

- All reasoning in Ukrainian
- Explain WHY each connection matters
- Quality over quantity
