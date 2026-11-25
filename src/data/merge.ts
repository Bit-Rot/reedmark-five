import type { Collections, CollectionName, Entity } from './types.ts';
import { COLLECTION_NAMES } from './types.ts';
import { clone } from './db.ts';

export interface Conflict {
  collection: CollectionName;
  id: string;
  /** Top-level fields changed differently on both sides ('*' when one side deleted the entity). */
  fields: string[];
  base: Entity | undefined;
  mine: Entity | undefined;
  theirs: Entity | undefined;
}

export interface MergeResult {
  merged: Collections;
  conflicts: Conflict[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function mergeEntity(base: Entity | undefined, mine: Entity | undefined, theirs: Entity | undefined):
  { value: Entity | undefined; conflictFields: string[] } {
  if (same(mine, theirs)) return { value: mine, conflictFields: [] };
  if (same(mine, base)) return { value: theirs, conflictFields: [] };
  if (same(theirs, base)) return { value: mine, conflictFields: [] };
  if (!mine || !theirs || !base) return { value: theirs, conflictFields: ['*'] };
  const out: Record<string, unknown> = {};
  const conflictFields: string[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)]);
  for (const k of keys) {
    const b = (base as unknown as Record<string, unknown>)[k];
    const m = (mine as unknown as Record<string, unknown>)[k];
    const t = (theirs as unknown as Record<string, unknown>)[k];
    let v: unknown;
    if (same(m, t)) v = m;
    else if (same(m, b)) v = t;
    else if (same(t, b)) v = m;
    else { conflictFields.push(k); v = t; }
    if (v !== undefined) out[k] = v;
  }
  return { value: out as unknown as Entity, conflictFields };
}

/**
 * Three-way merge by entity ID. `base` is what the editor loaded, `mine` is the editor's state,
 * `theirs` is the remote's current state. Conflicting fields keep the remote value until resolved.
 */
export function merge3(base: Collections, mine: Collections, theirs: Collections): MergeResult {
  const merged = clone(theirs);
  const conflicts: Conflict[] = [];
  for (const name of COLLECTION_NAMES) {
    const byId = (list: Entity[]) => new Map(list.map(e => [e.id, e] as const));
    const b = byId(base[name] as Entity[]);
    const m = byId(mine[name] as Entity[]);
    const t = byId(theirs[name] as Entity[]);
    const ids = [...t.keys(), ...[...m.keys()].filter(id => !t.has(id))];
    const result: Entity[] = [];
    for (const id of ids) {
      const r = mergeEntity(b.get(id), m.get(id), t.get(id));
      if (r.conflictFields.length) {
        conflicts.push({ collection: name, id, fields: r.conflictFields, base: b.get(id), mine: m.get(id), theirs: t.get(id) });
      }
      if (r.value) result.push(clone(r.value));
    }
    (merged[name] as Entity[]) = result;
  }
  return { merged, conflicts };
}

/** Resolve a conflict by taking one side's whole entity. */
export function resolveConflict(db: Collections, c: Conflict, take: 'mine' | 'theirs'): void {
  const list = db[c.collection] as Entity[];
  const chosen = take === 'mine' ? c.mine : c.theirs;
  const i = list.findIndex(e => e.id === c.id);
  if (!chosen) { if (i >= 0) list.splice(i, 1); return; }
  if (i >= 0) list[i] = clone(chosen);
  else list.push(clone(chosen));
}
