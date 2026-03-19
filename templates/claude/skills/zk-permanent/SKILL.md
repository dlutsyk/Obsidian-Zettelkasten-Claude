---
name: zk:permanent
description: Create an atomic permanent note expressing one idea with typed connections. Use when the user wants to formulate a permanent idea, create an evergreen note, crystallize a thought, or write an atomic note.
---

# ZK Permanent

Create an atomic permanent note — one idea, one note, with typed connections.

## Workflow

1. Get the idea from user (or read a referenced source note)
2. Formulate as a single atomic claim. If 2+ ideas emerge — inform user, create separate notes.
3. Generate title: a Ukrainian phrase that IS the idea
4. Use `zk_next_id` MCP tool (with parent_id if extending existing note)
5. Use `zk_find_connections` MCP tool to find candidates
6. Auto-classify connections: Підтримує, Суперечить, Розширює, Пов'язано
7. Build draft and present for review
8. After user confirms, use `zk_permanent` MCP tool
9. If from fleeting note, set source_fleeting_path to mark it processed

## Rules

- All note content in Ukrainian
- ONE idea per note — split if multiple emerge
- Title IS the idea (descriptive phrase, not generic label)
- Must have at least one typed connection
- `permanent` auto-added. Inherit relevant tags from source note. Refine. Check `zk_status` first
- Confidence: `low` = untested, `medium` = some evidence, `high` = well-supported
- Always link back to origin note in Походження section
- Status starts as `draft`
