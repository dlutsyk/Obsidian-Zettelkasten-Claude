---
name: zk:promote
description: Convert fleeting notes into permanent notes. Use when the user wants to promote, convert, or process fleeting notes.
---

# ZK Promote

Convert fleeting notes into atomic permanent notes. Handles single or batch.

## Workflow: Single Note

1. If user specifies a note, read it. If not, use `zk_unprocessed` MCP tool with type=fleeting.
2. Analyze: count atomic ideas, assess maturity (ready / needs-more-thought).
3. Present analysis — ask confirmation before creating.
4. For each confirmed idea, use `zk_permanent` MCP tool (set source_fleeting_path).
5. Use `zk_orphans` MCP tool to check for disconnected notes.

## Workflow: Batch Mode

1. Use `zk_unprocessed` MCP tool with type=fleeting
2. Process each sequentially
3. Summary when done

## Rules

- Never force promotion — some ideas aren't ready
- If 2+ ideas in one fleeting → 2+ permanent notes
- Each permanent must have typed connections
- All content in Ukrainian
- Always link permanent → source fleeting in Origin section
