import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const VAULT_FOLDERS = ["1-Fleeting", "2-Literature", "3-Permanent", "4-MOC", "5-Projects", "Archive"];

export function createTempVault(): string {
  const root = mkdtempSync(join(tmpdir(), "zk-test-"));
  for (const f of VAULT_FOLDERS) mkdirSync(join(root, f));
  return root;
}

export function writeFixture(vaultRoot: string, relPath: string, content: string): string {
  const full = join(vaultRoot, relPath);
  const dir = full.substring(0, full.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(full, content, "utf-8");
  return full;
}

export function cleanupVault(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export const FLEETING_NOTE = `---
type: fleeting
date: 2025-01-10
time: "14:30"
tags:
  - fleeting
  - epistemology
status: unprocessed
---

# Знання як процес

## Thought (Думка)

Знання — це не статичний об'єкт, а процес постійного оновлення.

## Context (Контекст)

Прочитав статтю про епістемологію.

## Potential Connections (Можливі зв'язки)

-

## Next Steps (Наступні кроки)

- [ ] Розвинути в permanent note
`;

export const PERMANENT_NOTE = `---
type: permanent
zk_id: "1a"
date: 2025-01-12
last_modified: 2025-01-12
tags:
  - permanent
  - epistemology
status: draft
confidence: high
claim: "Знання є мережею зв'язків, а не набором ізольованих фактів"
aliases: []
---

# Знання є мережею зв'язків

## Claim (Твердження)

Знання є мережею зв'язків, а не набором ізольованих фактів

## Elaboration (Розкриття)

Кожен факт набуває значення лише у контексті інших фактів.

## Evidence & Support (Докази та підтримка)

- Дослідження нейронних мереж мозку
- Теорія графів знань

## Counterpoints & Limitations (Контраргументи та обмеження)

- Деякі базові факти є самодостатніми

## Origin (Походження)

- Source (Джерело): [[Знання як процес]]

## Connections (Зв'язки)

- **Supports (Підтримує):** [[Контекст визначає значення]]

## References (Посилання)

-
`;

export const PERMANENT_NOTE_2 = `---
type: permanent
zk_id: "1"
date: 2025-01-11
last_modified: 2025-01-11
tags:
  - permanent
  - epistemology
status: finalized
confidence: high
claim: "Знання як мережа"
aliases: []
---

# Знання як мережа

## Claim (Твердження)

Знання як мережа

## Elaboration (Розкриття)

Основна ідея.

## Evidence & Support (Докази та підтримка)

- Факт 1

## Counterpoints & Limitations (Контраргументи та обмеження)

-

## Connections (Зв'язки)

- **Related (Пов'язано):** [[Знання є мережею зв'язків]]
`;

export const PERMANENT_NOTE_3 = `---
type: permanent
zk_id: "1a1"
date: 2025-01-13
last_modified: 2025-01-13
tags:
  - permanent
  - context
status: draft
confidence: medium
claim: "Контекст визначає значення інформації"
aliases: []
---

# Контекст визначає значення

## Claim (Твердження)

Контекст визначає значення інформації

## Elaboration (Розкриття)

Без контексту факт втрачає значення.

## Evidence & Support (Докази та підтримка)

- Лінгвістичні дослідження

## Counterpoints & Limitations (Контраргументи та обмеження)

- Математичні аксіоми контекстно-незалежні

## Connections (Зв'язки)

- **Extends (Розширює):** [[Знання є мережею зв'язків]]
`;

export const LITERATURE_NOTE = `---
type: literature
date: 2025-01-09
tags:
  - literature
  - epistemology
status: unprocessed
source_type: книга
source_title: "How We Learn"
source_author: "Stanislas Dehaene"
aliases: []
---

# Як ми навчаємося

## Summary (Резюме)

Книга про механізми навчання мозку.

## Key Ideas (Ключові ідеї)

1. Увага є воротами до навчання
2. Активне тестування покращує запам'ятовування
3. Сон консолідує пам'ять

## Quotes & Highlights (Цитати та виділення)

> "Attention is the gateway to learning"

## My Interpretation (Моя інтерпретація)

Навчання — активний процес.

## Connections (Зв'язки)

- **Related (Пов'язано):** [[Знання як процес]]
`;

export const MOC_NOTE = `---
type: moc
date: 2025-01-15
tags:
  - MOC
  - epistemology
status: draft
---

# Епістемологія

## Core Notes (Основні нотатки)

- [[Знання як мережа]]
- [[Знання є мережею зв'язків]]

## Supporting Literature (Підтримуюча література)

- [[Як ми навчаємося]]

## Related (Пов'язане)

-
`;

export const NO_FRONTMATTER_NOTE = `# Just a note

Some content without frontmatter.
`;

export const EMPTY_SECTIONS_NOTE = `---
type: permanent
zk_id: "2"
date: 2025-01-14
tags:
  - permanent
status: draft
confidence: low
claim: "Тест"
---

# Тестова нотатка

## Claim (Твердження)

Тест

## Elaboration (Розкриття)

## Evidence & Support (Докази та підтримка)

-

## Counterpoints & Limitations (Контраргументи та обмеження)

-
`;
