import type { Collections, CollectionName } from './types.ts';
import { COLLECTION_NAMES, SLOT_NAMES } from './types.ts';
import { find, forEachRef, validId } from './graph.ts';
import { compileDb } from './runtime.ts';

export interface Issue {
  severity: 'error' | 'warning';
  collection: CollectionName;
  id: string;
  message: string;
}

/** Check cross-references and basic constraints. Returns issues; never mutates `db`. */
export function validate(db: Collections): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Issue['severity'], collection: CollectionName, id: string, message: string) =>
    issues.push({ severity, collection, id, message });

  for (const name of COLLECTION_NAMES) {
    const seen = new Set<string>();
    for (const e of db[name]) {
      if (!validId(e.id)) add('error', name, e.id, `ID "${e.id}" is not valid (letters, digits, _ and -)`);
      if (seen.has(e.id)) add('error', name, e.id, 'duplicate ID');
      seen.add(e.id);
    }
  }

  forEachRef(db, ref => {
    if (!find(db, ref.target.collection, ref.target.id)) {
      add('error', ref.owner.collection, ref.owner.id,
        `${ref.path} refers to ${ref.target.collection.replace(/s$/, '')} "${ref.target.id}", which does not exist`);
    }
  });

  for (const f of db.faces) {
    if (f.status === 'inactive') continue;
    for (const u of f.keywords) {
      const kw = find(db, 'keywords', u.keyword) as Collections['keywords'][number] | undefined;
      if (!kw) continue;
      if (kw.valueKind === 'x' && u.x === undefined) add('error', 'faces', f.id, `keyword "${u.keyword}" needs an X value`);
      if (kw.valueKind !== 'x' && u.x !== undefined) {
        add('warning', 'faces', f.id, `keyword "${u.keyword}" does not take an X value but has x=${u.x} (it is defined as "${kw.valueKind}")`);
      }
      if (kw.implemented === 'planned') add('warning', 'faces', f.id, `keyword "${u.keyword}" is not implemented in the game yet`);
    }
  }

  for (const d of db.dice) {
    if (d.faces.length !== SLOT_NAMES.length) add('error', 'dice', d.id, `has ${d.faces.length} faces, expected ${SLOT_NAMES.length}`);
    d.faces.forEach((s, i) => {
      const face = find(db, 'faces', s.face) as Collections['faces'][number] | undefined;
      if (face && face.status === 'inactive') add('warning', 'dice', d.id, `${SLOT_NAMES[i] ?? `slot ${i + 1}`} uses inactive face "${s.face}"`);
    });
  }

  for (const c of db.characters) {
    if (c.starterDice.length !== 5) add('warning', 'characters', c.id, `has ${c.starterDice.length} starter dice (expected 5)`);
  }

  for (const it of db.items) {
    it.effects.forEach((e, i) => {
      if (e.op === 'setFace' && !e.face) add('error', 'items', it.id, `effects[${i}] setFace needs a face`);
      if (e.op === 'addKeyword' && !e.keyword) add('error', 'items', it.id, `effects[${i}] addKeyword needs a keyword`);
      if (e.op === 'pipDelta' && e.delta === undefined) add('error', 'items', it.id, `effects[${i}] pipDelta needs a delta`);
      if (e.op === 'setPips' && e.pips === undefined) add('error', 'items', it.id, `effects[${i}] setPips needs pips`);
      if (e.target !== 'all' && e.target.length === 0) add('error', 'items', it.id, `effects[${i}] has no target slots`);
    });
  }

  // Things that keep a die, item or character out of the game.
  const kinds: Record<string, CollectionName> = { die: 'dice', item: 'items', character: 'characters', relic: 'relics' };
  for (const issue of compileDb(db).issues) {
    const m = /^(die|item|character|relic) (\S+)/.exec(issue.where);
    if (m) add('warning', kinds[m[1]], m[2], `not usable in the game: ${issue.where.slice(m[0].length).trim() ? issue.where.slice(m[0].length).trim() + ': ' : ''}${issue.message}`);
  }

  return issues;
}
