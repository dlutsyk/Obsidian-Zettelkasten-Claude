---
name: zk:literature
description: Create a literature note from a source (book, article, video, podcast). User pastes the content. Use when the user wants to process a source, create notes from reading, summarize an article or book.
---

# ZK Literature

Create a literature note from user-pasted source content.

## Workflow

1. Collect source metadata from user:
   - **Required:** title, author, source_type (книга|стаття|відео|подкаст)
   - **Optional:** URL, year
2. Generate a descriptive Ukrainian title (or use source title)
3. Analyze the pasted content — identify key ideas, quotes, actionable takeaways
4. Use `zk_find_connections` MCP tool to find related notes
5. Auto-classify each connection: Підтримує, Суперечить, Розширює, Пов'язано
6. Build draft and present for review — explain each connection choice
7. After user confirms, use `zk_literature` MCP tool to create

## Output

After creating the note, present:
- Suggested permanent note candidates (atomic ideas worth extracting from key ideas)

## Rules

- All note content in Ukrainian
- NEVER copy-paste from source — always rephrase
- source_type must be Ukrainian: книга, стаття, відео, подкаст
- `literature` tag always first
- Status: `unprocessed` until user extracts permanent notes
