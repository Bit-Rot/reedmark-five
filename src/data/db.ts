import type { Collections, CollectionName } from './types.ts';
import { COLLECTION_NAMES, emptyDb } from './types.ts';

export const DATA_DIR = 'data';

export function filePath(name: CollectionName): string {
  return `${DATA_DIR}/${name}.json`;
}

/** Stable, diff-friendly serialisation: 2-space JSON, trailing newline. */
export function serialise(list: unknown[]): string {
  return JSON.stringify(list, null, 2) + '\n';
}

export function serialiseAll(db: Collections): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of COLLECTION_NAMES) out[filePath(n)] = serialise(db[n]);
  return out;
}

/** Parse the contents of every data file (missing files become empty collections). */
export function parseAll(files: Partial<Record<string, string>>): Collections {
  const db = emptyDb();
  for (const n of COLLECTION_NAMES) {
    const text = files[filePath(n)];
    if (text === undefined || text.trim() === '') continue;
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error(`${filePath(n)} must contain a JSON array`);
    (db[n] as unknown[]) = parsed;
  }
  return db;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
