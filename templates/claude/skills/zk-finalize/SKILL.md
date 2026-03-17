---
name: zk:finalize
description: Quality-check and finalize permanent notes — verify connections, claim, evidence, confidence.
---

# ZK Finalize

Finalize permanent notes after quality checks.

## Workflow

1. If user specifies a note, use it. Otherwise, list draft permanent notes via `zk_list` with status=draft.
2. `zk_finalize` tool — run quality checks
3. If checks fail, show which ones and suggest fixes:
   - Missing connections → `zk_find_connections`, then `zk_manage` to add
   - Missing claim → help user articulate, then `zk_manage` action=edit with sections
   - Missing evidence → help user add evidence via sections edit
   - Missing confidence → `zk_manage` action=edit to set confidence
4. After fixes, re-run `zk_finalize`
5. Confirm finalization

## Rules

- All reasoning in Ukrainian
- Don't force finalization — some notes need more time
- Quality > speed
