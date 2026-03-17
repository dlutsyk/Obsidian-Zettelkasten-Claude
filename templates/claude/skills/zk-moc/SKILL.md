---
name: zk:moc
description: Create a Map of Content note — auto-pulls notes by tag cluster, user adjusts before creation.
---

# ZK MOC

Create a Map of Content that organizes notes around a topic.

## Workflow

1. Ask user for topic (or infer from context)
2. `zk_cluster_detect` — find tag clusters related to topic
3. `zk_list` with type=permanent — find candidate notes
4. Present auto-pulled list categorized as: core, supporting literature, related
5. User confirms/adjusts the list
6. `zk_moc` tool — create the MOC note with confirmed notes
7. `zk_find_connections` — suggest additional links

## Rules

- MOC title and all content in Ukrainian
- Group notes logically, not alphabetically
- Include open questions section for further development
- A MOC should have ≥3 notes to be worth creating
