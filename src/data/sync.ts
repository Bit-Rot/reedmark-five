import type { Collections } from './types.ts';
import { COLLECTION_NAMES } from './types.ts';
import { filePath, parseAll, serialise } from './db.ts';
import type { FileWrite, GitHubClient, Head } from './github.ts';
import { GitHubError } from './github.ts';
import { exportAll } from './export.ts';
import type { Conflict } from './merge.ts';
import { merge3 } from './merge.ts';

export interface Snapshot extends Head { db: Collections }

export async function loadSnapshot(client: GitHubClient, head?: Head): Promise<Snapshot> {
  const h = head ?? (await client.getHead());
  const files: Record<string, string> = {};
  await Promise.all(COLLECTION_NAMES.map(async n => {
    const text = await client.readText(filePath(n), h.commit);
    if (text !== undefined) files[filePath(n)] = text;
  }));
  return { ...h, db: parseAll(files) };
}

export interface PendingImage {
  /** Path under the repo, e.g. `public/face-art/slash.webp`. */
  path: string;
  base64: string;
}

export type SaveResult =
  | { status: 'saved'; snapshot: Snapshot }
  | { status: 'nochange'; snapshot: Snapshot }
  /** The branch moved and some of your edits clash with edits already pushed. Resolve `conflicts` in `merged`, then save again with `theirs` as the base. */
  | { status: 'conflict'; theirs: Snapshot; merged: Collections; conflicts: Conflict[] };

/**
 * Save `db` as a single commit. `base` is the snapshot the editor loaded (or last saved).
 * If the branch has moved, the edits are merged per entity first.
 */
export async function save(
  client: GitHubClient, base: Snapshot, db: Collections, images: PendingImage[], message: string,
): Promise<SaveResult> {
  let attempt = 0;
  for (;;) {
    const head = await client.getHead();
    let theirs: Snapshot = base;
    let next = db;
    if (head.commit !== base.commit) {
      theirs = await loadSnapshot(client, head);
      const m = merge3(base.db, db, theirs.db);
      if (m.conflicts.length) return { status: 'conflict', theirs, merged: m.merged, conflicts: m.conflicts };
      next = m.merged;
    }
    const writes: FileWrite[] = [];
    for (const n of COLLECTION_NAMES) {
      const text = serialise(next[n]);
      if (text !== serialise(theirs.db[n])) writes.push({ path: filePath(n), content: text, encoding: 'utf-8' });
    }
    if (!writes.length && !images.length) return { status: 'nochange', snapshot: { ...head, db: next } };
    for (const [path, text] of Object.entries(exportAll(next))) writes.push({ path, content: text, encoding: 'utf-8' });
    for (const img of images) writes.push({ path: img.path, content: img.base64, encoding: 'base64' });
    try {
      const done = await client.commitFiles(head, writes, message);
      return { status: 'saved', snapshot: { ...done, db: next } };
    } catch (e) {
      // The branch moved between reading the head and updating the ref: retry with a fresh merge.
      if (e instanceof GitHubError && e.isStale && attempt++ < 2) continue;
      throw e;
    }
  }
}
