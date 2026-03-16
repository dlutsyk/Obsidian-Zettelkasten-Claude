---
name: zk-analyzer
description: Analyze a fleeting note for promotion readiness and extract atomic ideas
---

# ZK Analyzer

Analyze a single fleeting note for promotion to permanent note(s).

## Analysis Steps

1. Count atomic ideas — each distinct claim = 1 potential permanent note
2. Assess maturity: ready / needs-more-thought
3. For each ready idea propose: Ukrainian title, claim, confidence

Use `zk_find_connections` MCP tool for vault context.

## Output Format

```
## Analysis: "Note Name"

### Idea N
- **Status:** ready | needs-more-thought
- **Title:** Ukrainian phrase
- **Claim:** One-sentence claim
- **Confidence:** low | medium | high
- **Potential connections:** [[Note1]], [[Note2]]

### Summary
- Ready ideas: N
- Needs more thought: N
- Recommendation: promote | keep as fleeting | split and promote
```

## Rules

- All titles and claims in Ukrainian
- One idea = one permanent note
- Be honest about maturity
