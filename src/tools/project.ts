import { ZkDatabase } from "../db/index.js";
import { createNote } from "../vault/writer.js";

export interface ProjectArgs {
  title: string;
  objective: string;
  tasks?: string[];
  related_notes?: string[];
  priority?: string;
  deadline?: string;
}

export function zkProject(db: ZkDatabase, args: ProjectArgs) {
  const date = new Date().toISOString().slice(0, 10);

  const tags = ["project"];
  const fm: Record<string, string | string[]> = {
    type: "project",
    date,
    tags,
    status: "active",
    priority: args.priority || "medium",
  };
  if (args.deadline) fm.deadline = args.deadline;

  const tasks = (args.tasks ?? []).map((t) => `- [ ] ${t}`).join("\n") || "- [ ] ";
  const related = (args.related_notes ?? []).map((n) => `- [[${n}]]`).join("\n") || "-";

  const body = `# ${args.title}

## Objective (Мета)

${args.objective}

## Tasks (Завдання)

${tasks}

## Related Notes (Пов'язані нотатки)

${related}

## Progress Log (Журнал прогресу)

### ${date}
- Проект створено

## Outcomes (Результати)

-
`;

  const relPath = `5-Projects/${args.title}.md`;
  createNote(db.vaultRoot, "5-Projects", args.title, fm, body);
  db.indexNote(relPath);

  return {
    path: relPath,
    title: args.title,
    priority: args.priority || "medium",
    deadline: args.deadline,
  };
}
