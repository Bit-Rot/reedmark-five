import type { Collections, CollectionName, Entity } from './types.ts';
import { COLLECTION_NAMES } from './types.ts';
import { SCHEMA } from './schema.ts';

export interface RefLocation {
  /** The entity that holds the reference. */
  owner: { collection: CollectionName; id: string };
  /** The entity being pointed at. */
  target: { collection: CollectionName; id: string };
  /** Human-readable location, e.g. `faces[2].face`. */
  path: string;
  set(newId: string): void;
}

/** Visit every ID reference in the database. */
export function forEachRef(db: Collections, visit: (ref: RefLocation) => void): void {
  for (const k of db.faces) {
    k.keywords.forEach((u, i) => visit({
      owner: { collection: 'faces', id: k.id }, target: { collection: 'keywords', id: u.keyword },
      path: `keywords[${i}]`, set: id => { u.keyword = id; },
    }));
  }
  for (const d of db.dice) {
    d.faces.forEach((s, i) => visit({
      owner: { collection: 'dice', id: d.id }, target: { collection: 'faces', id: s.face },
      path: `faces[${i}]`, set: id => { s.face = id; },
    }));
  }
  for (const c of db.characters) {
    c.starterDice.forEach((id, i) => visit({
      owner: { collection: 'characters', id: c.id }, target: { collection: 'dice', id },
      path: `starterDice[${i}]`, set: v => { c.starterDice[i] = v; },
    }));
    if (c.starterRelic) {
      visit({
        owner: { collection: 'characters', id: c.id }, target: { collection: 'relics', id: c.starterRelic },
        path: 'starterRelic', set: id => { c.starterRelic = id; },
      });
    }
    c.items.forEach((id, i) => visit({
      owner: { collection: 'characters', id: c.id }, target: { collection: 'items', id },
      path: `items[${i}]`, set: v => { c.items[i] = v; },
    }));
  }
  for (const it of db.items) {
    if (it.rewardCharacter !== undefined) {
      visit({
        owner: { collection: 'items', id: it.id }, target: { collection: 'characters', id: it.rewardCharacter },
        path: 'rewardCharacter', set: id => { it.rewardCharacter = id; },
      });
    }
    it.effects.forEach((e, i) => {
      if (e.face !== undefined) {
        visit({
          owner: { collection: 'items', id: it.id }, target: { collection: 'faces', id: e.face },
          path: `effects[${i}].face`, set: id => { e.face = id; },
        });
      }
      if (e.keyword !== undefined) {
        visit({
          owner: { collection: 'items', id: it.id }, target: { collection: 'keywords', id: e.keyword },
          path: `effects[${i}].keyword`, set: id => { e.keyword = id; },
        });
      }
    });
  }
}

export function find(db: Collections, collection: CollectionName, id: string): Entity | undefined {
  return (db[collection] as Entity[]).find(e => e.id === id);
}

export interface UsedBy {
  owner: { collection: CollectionName; id: string };
  path: string;
}

export function usedBy(db: Collections, collection: CollectionName, id: string): UsedBy[] {
  const out: UsedBy[] = [];
  forEachRef(db, ref => {
    if (ref.target.collection === collection && ref.target.id === id) out.push({ owner: ref.owner, path: ref.path });
  });
  return out;
}

export interface RenameResult {
  ok: boolean;
  error?: string;
  /** References that were rewritten. */
  updated: UsedBy[];
}

/** Check that an ID is well-formed. IDs are used across files, so keep them simple. */
export function validId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id);
}

/** Rename an entity's ID and rewrite every reference to it. Mutates `db`. */
export function renameId(db: Collections, collection: CollectionName, oldId: string, newId: string): RenameResult {
  if (oldId === newId) return { ok: true, updated: [] };
  if (!validId(newId)) return { ok: false, error: `"${newId}" is not a valid ID (letters, digits, _ and -)`, updated: [] };
  const entity = find(db, collection, oldId);
  if (!entity) return { ok: false, error: `${collection} "${oldId}" does not exist`, updated: [] };
  if (find(db, collection, newId)) return { ok: false, error: `${collection} "${newId}" already exists`, updated: [] };
  const updated: UsedBy[] = [];
  forEachRef(db, ref => {
    if (ref.target.collection === collection && ref.target.id === oldId) {
      ref.set(newId);
      updated.push({ owner: ref.owner, path: ref.path });
    }
  });
  entity.id = newId;
  return { ok: true, updated };
}

export interface DeleteResult {
  ok: boolean;
  blockedBy: UsedBy[];
}

/** Delete an entity unless something still references it (set `force` to also clear dangling references' owners untouched). */
export function deleteEntity(db: Collections, collection: CollectionName, id: string, force = false): DeleteResult {
  const refs = usedBy(db, collection, id);
  if (refs.length && !force) return { ok: false, blockedBy: refs };
  const list = db[collection] as Entity[];
  const i = list.findIndex(e => e.id === id);
  if (i >= 0) list.splice(i, 1);
  return { ok: true, blockedBy: refs };
}

export function displayName(collection: CollectionName, e: Entity): string {
  const f = SCHEMA[collection].nameField;
  const name = f ? (e as unknown as Record<string, unknown>)[f] : undefined;
  return typeof name === 'string' && name ? `${name} (${e.id})` : e.id;
}

export function allEntityRefs(db: Collections): Map<string, UsedBy[]> {
  const m = new Map<string, UsedBy[]>();
  forEachRef(db, ref => {
    const k = `${ref.target.collection}:${ref.target.id}`;
    const list = m.get(k) ?? [];
    list.push({ owner: ref.owner, path: ref.path });
    m.set(k, list);
  });
  return m;
}

export { COLLECTION_NAMES };
