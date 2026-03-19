import { ZkDatabase } from "../db/index.js";

export function zkReindex(db: ZkDatabase) {
  const result = db.reindex();
  return {
    ...result,
    message: `Indexed: +${result.added} added, ~${result.updated} updated, -${result.removed} removed`,
  };
}

export function zkStatus(db: ZkDatabase) {
  const stats = db.getStats();
  return { ...stats, tags: db.getAllTags() };
}
