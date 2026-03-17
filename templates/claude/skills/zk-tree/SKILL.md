---
name: zk:tree
description: Visualize the Luhmann knowledge tree — full tree, subtree, or context around a note. Use when user wants to see the tree, navigate branches, or understand hierarchy.
---

# ZK Tree

Visualize the Luhmann ID hierarchy.

## Operations

- **Full tree:** `zk_tree` MCP tool, no args
- **Subtree:** `zk_tree { root_id: "1a" }` — branch from given ID
- **Context:** `zk_tree { context_id: "1a1" }` — ancestors, siblings, children around a note
- **Depth limit:** add `depth` param (default 5)

## Rules

- All output in Ukrainian
- After showing tree, suggest `zk_find_by_id` to read specific notes
- Read-only — don't modify notes
