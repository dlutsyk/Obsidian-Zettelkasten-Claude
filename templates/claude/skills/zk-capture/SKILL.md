---
name: zk:capture
description: Capture a quick thought as a fleeting note in the Zettelkasten vault. Use when the user wants to jot down an idea, capture a thought, save a fleeting observation, or create a quick note.
---

# ZK Capture

Create a fleeting note from a raw thought or observation.

## Workflow

1. Get the thought from the user (or use what they provided)
2. Generate a descriptive Ukrainian title (short phrase, not a sentence)
3. Pick tags beyond `fleeting` (Ukrainian or English for tech domains)
4. Use `zk_find_connections` MCP tool to find potential connections
5. Use `zk_capture` MCP tool to create the note
6. Report: created path, connection candidates

## Rules

- All note content in Ukrainian
- Title: descriptive Ukrainian phrase
- One thought per note
- Check `zk_status` for existing tags. 2-3 content tags. Reuse existing
- Remind user: fleeting notes expire in 1-2 weeks, use `/zk:promote` to convert
