import { ZkDatabase } from "../db/index.js";

export function zkUnprocessed(db: ZkDatabase, args: { type?: string }) {
  db.reindex();
  const notes = db.getUnprocessed(args.type);
  const now = new Date();

  const grouped: Record<string, any[]> = {};
  for (const note of notes) {
    const folder = note.folder || "unknown";
    if (!grouped[folder]) grouped[folder] = [];

    let age_days = 0;
    if (note.created) {
      const created = new Date(note.created);
      age_days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }

    let urgency: "normal" | "warning" | "critical" = "normal";
    if (age_days > 14) urgency = "critical";
    else if (age_days > 7) urgency = "warning";

    grouped[folder].push({
      title: note.title,
      path: note.path,
      status: note.status,
      date: note.created,
      type: note.type,
      age_days,
      urgency,
    });
  }

  for (const folder of Object.keys(grouped)) {
    grouped[folder].sort((a: any, b: any) => b.age_days - a.age_days);
  }

  return grouped;
}

export function zkOrphans(db: ZkDatabase, args: { folder?: string }) {
  db.reindex();
  const orphans = db.getOrphans(args.folder);
  return orphans.map((n: any) => ({
    title: n.title,
    path: n.path,
    type: n.type,
    folder: n.folder,
  }));
}

export function zkReview(db: ZkDatabase) {
  db.reindex();

  const unprocessedFleeting = db.getUnprocessed("fleeting");
  const unprocessedLiterature = db.getUnprocessed("literature");
  const draftPermanent = db.db.prepare("SELECT * FROM notes WHERE type = 'permanent' AND status = 'draft'").all() as any[];
  const orphans = db.getOrphans("3-Permanent");
  const stats = db.getStats();

  return {
    unprocessedFleeting: unprocessedFleeting.map((n: any) => ({ title: n.title, date: n.created })),
    unprocessedLiterature: unprocessedLiterature.map((n: any) => ({ title: n.title, date: n.created })),
    draftPermanent: draftPermanent.map((n: any) => ({ title: n.title, zk_id: n.zk_id })),
    orphanPermanent: orphans.map((n: any) => ({ title: n.title, path: n.path })),
    stats,
  };
}
