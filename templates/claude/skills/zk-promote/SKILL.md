---
name: zk:promote
description: Convert fleeting or literature notes into permanent notes. Handles single, batch, and literature key-idea extraction.
---

# ZK Promote

Convert fleeting and literature notes into atomic permanent notes.

## Workflow: Single Fleeting Note

1. If user specifies a note, read it. If not, use `zk_unprocessed` MCP tool with type=fleeting.
2. Analyze: count atomic ideas, assess maturity (ready / needs-more-thought).
3. Present analysis — ask confirmation before creating.
4. For each confirmed idea, use `zk_permanent` MCP tool (set source_fleeting_path).
5. Use `zk_orphans` MCP tool to check for disconnected notes.

## Workflow: Literature Note

1. If user specifies a literature note, read it. If not, use `zk_unprocessed` with type=literature.
2. `zk_promote` tool on the literature note — extracts key_ideas automatically.
3. Present key ideas as permanent note candidates.
4. User picks which ideas to promote.
5. For each selected idea, use `zk_permanent` MCP tool (set source_literature_path).
6. The literature note is marked as processed by `zk_promote`.

## Workflow: Batch Mode

1. `zk_unprocessed` — lists all unprocessed notes (fleeting + literature), sorted by age
2. Show urgency badges: >7 days = warning, >14 days = critical
3. User selects which to process
4. Sequential promotion — each note gets full promote treatment
5. Summary when done

## Rules

- Never force promotion — some ideas aren't ready
- If 2+ ideas in one fleeting → 2+ permanent notes
- Each permanent must have typed connections
- All content in Ukrainian
- Always link permanent → source note in Origin section
