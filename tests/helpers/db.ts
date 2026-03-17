import { ZkDatabase } from "../../src/db/index.js";
import { createTempVault, writeFixture, FLEETING_NOTE, PERMANENT_NOTE, PERMANENT_NOTE_2, PERMANENT_NOTE_3, LITERATURE_NOTE, MOC_NOTE } from "./vault.js";

export function createTestDb(vaultRoot: string): ZkDatabase {
  return new ZkDatabase(vaultRoot);
}

export function seedVault(vaultRoot: string): void {
  writeFixture(vaultRoot, "1-Fleeting/Знання як процес.md", FLEETING_NOTE);
  writeFixture(vaultRoot, "2-Literature/Як ми навчаємося.md", LITERATURE_NOTE);
  writeFixture(vaultRoot, "3-Permanent/Знання як мережа.md", PERMANENT_NOTE_2);
  writeFixture(vaultRoot, "3-Permanent/Знання є мережею зв'язків.md", PERMANENT_NOTE);
  writeFixture(vaultRoot, "3-Permanent/Контекст визначає значення.md", PERMANENT_NOTE_3);
  writeFixture(vaultRoot, "4-MOC/Епістемологія.md", MOC_NOTE);
}

export function seedAndIndex(vaultRoot: string): ZkDatabase {
  seedVault(vaultRoot);
  const db = createTestDb(vaultRoot);
  db.reindex();
  return db;
}
