---
name: zk:manage
description: Manage notes by Luhmann ZK number — edit, delete, archive, or list. Use when the user references a note by number/ID.
---

# ZK Manage

Manage permanent notes by Luhmann ZK ID.

## Operations

### View knowledge tree
Use `zk_tree` MCP tool. No args = full tree. `root_id` = subtree. `context_id` = ancestors/siblings/children around a note.

### Edit note by ID
Use `zk_manage` MCP tool with action=find, then action=edit.

### Archive note by ID
Confirm first. Use `zk_manage` MCP tool with action=archive.

### Delete note by ID
Always confirm. Use `zk_manage` MCP tool with action=delete. If incoming links exist, suggest archive.

## Rules

- Always confirm before archive/delete
- Warn about broken links
- If ID not found, show available IDs
- All content in Ukrainian
