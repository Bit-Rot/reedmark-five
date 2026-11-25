import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { clone, filePath, parseAll, serialiseAll } from '../src/data/db.ts';
import { exportAll } from '../src/data/export.ts';
import { deleteEntity, renameId, usedBy } from '../src/data/graph.ts';
import { merge3, resolveConflict } from '../src/data/merge.ts';
import { COLLECTION_NAMES, emptyDb } from '../src/data/types.ts';
import type { Collections } from '../src/data/types.ts';
import { validate } from '../src/data/validate.ts';

function sample(): Collections {
  const db = emptyDb();
  db.keywords.push(
    { id: 'damage', valueKind: 'pips', ruleText: 'damage N', category: 'x', appliesTo: '', implemented: 'implemented', notes: '' },
    { id: 'weak', valueKind: 'x', ruleText: 'weak X', category: 'x', appliesTo: '', implemented: 'planned', notes: '' },
  );
  db.faces.push(
    { id: 'slash', targeting: 'singleEnemy', keywords: [{ keyword: 'damage' }], image: '', notes: '', status: 'active' },
    { id: 'hobble', targeting: 'singleEnemy', keywords: [{ keyword: 'damage' }, { keyword: 'weak', x: 1 }], image: '', notes: '', status: 'active' },
    { id: 'blank', targeting: 'none', keywords: [], image: '', notes: '', status: 'active' },
  );
  db.dice.push({
    id: 'die_a', name: 'A', tone: 'rust', notes: '',
    faces: [{ face: 'slash', pips: 2 }, { face: 'slash', pips: 2 }, { face: 'hobble', pips: 1 }, { face: 'blank' }, { face: 'blank' }, { face: 'blank' }],
  });
  db.characters.push({ id: 'hero', name: 'Hero', starterDice: ['die_a'], items: [], unlocks: [], notes: '' });
  db.items.push({
    id: 'sharpen', name: 'Sharpen', rarity: 'common', description: '', implemented: 'planned',
    effects: [{ target: ['left'], op: 'setFace', face: 'hobble' }, { target: 'all', op: 'addKeyword', keyword: 'weak', x: 2 }],
  });
  return db;
}

test('serialise and parse round-trip every collection', () => {
  const db = sample();
  const files = serialiseAll(db);
  assert.deepEqual(parseAll(files), db);
  assert.deepEqual(Object.keys(files), COLLECTION_NAMES.map(filePath));
});

test('rename rewrites every reference and refuses clashes', () => {
  const db = sample();
  const r = renameId(db, 'faces', 'hobble', 'trip');
  assert(r.ok);
  assert.equal(r.updated.length, 2);
  assert.equal(db.dice[0].faces[2].face, 'trip');
  assert.equal(db.items[0].effects[0].face, 'trip');
  assert.equal(validate(db).filter(i => i.severity === 'error').length, 0);
  assert.equal(renameId(db, 'faces', 'trip', 'slash').ok, false);
  assert.equal(renameId(db, 'faces', 'trip', 'bad id!').ok, false);
  const k = renameId(db, 'keywords', 'weak', 'feeble');
  assert(k.ok);
  assert.equal(db.faces[1].keywords[1].keyword, 'feeble');
  assert.equal(db.items[0].effects[1].keyword, 'feeble');
  assert.equal(renameId(db, 'dice', 'die_a', 'die_b').updated[0].owner.id, 'hero');
  assert.deepEqual(db.characters[0].starterDice, ['die_b']);
});

test('delete is blocked while something still references the entity', () => {
  const db = sample();
  assert.equal(usedBy(db, 'faces', 'slash').length, 2);
  const blocked = deleteEntity(db, 'faces', 'slash');
  assert.equal(blocked.ok, false);
  assert.equal(db.faces.length, 3);
  assert(deleteEntity(db, 'items', 'sharpen').ok);
  assert.equal(db.items.length, 0);
});

test('validation reports dangling references, missing X values, and wrong face counts', () => {
  const db = sample();
  assert.equal(validate(db).filter(i => i.severity === 'error').length, 0);
  db.dice[0].faces[0].face = 'missing';
  delete db.faces[1].keywords[1].x;
  db.dice.push({ id: 'short', name: '', tone: 'rust', faces: [{ face: 'slash' }], notes: '' });
  const msgs = validate(db).map(i => i.message);
  assert(msgs.some(m => m.includes('"missing"') && m.includes('does not exist')));
  assert(msgs.some(m => m.includes('needs an X value')));
  assert(msgs.some(m => m.includes('has 1 faces')));
});

test('merge3 combines edits to different entities and fields, and reports clashes', () => {
  const base = sample();
  const mine = clone(base);
  const theirs = clone(base);
  mine.faces[0].notes = 'my sword';
  theirs.faces[2].notes = 'their blank';
  mine.items[0].description = 'mine';
  theirs.items[0].rarity = 'rare';
  const ok = merge3(base, mine, theirs);
  assert.equal(ok.conflicts.length, 0);
  assert.equal(ok.merged.faces[0].notes, 'my sword');
  assert.equal(ok.merged.faces[2].notes, 'their blank');
  assert.equal(ok.merged.items[0].description, 'mine');
  assert.equal(ok.merged.items[0].rarity, 'rare');

  mine.faces[1].notes = 'mine';
  theirs.faces[1].notes = 'theirs';
  const clash = merge3(base, mine, theirs);
  assert.equal(clash.conflicts.length, 1);
  assert.deepEqual(clash.conflicts[0].fields, ['notes']);
  assert.equal(clash.merged.faces[1].notes, 'theirs');
  resolveConflict(clash.merged, clash.conflicts[0], 'mine');
  assert.equal(clash.merged.faces[1].notes, 'mine');
});

test('merge3 keeps new entities from both sides and honours deletions', () => {
  const base = sample();
  const mine = clone(base);
  const theirs = clone(base);
  mine.faces.push({ ...clone(base.faces[2]), id: 'mine_new' });
  theirs.faces.push({ ...clone(base.faces[2]), id: 'their_new' });
  deleteEntity(theirs, 'items', 'sharpen');
  const r = merge3(base, mine, theirs);
  assert.deepEqual(r.merged.faces.map(f => f.id).sort(), ['blank', 'hobble', 'mine_new', 'slash', 'their_new']);
  assert.equal(r.merged.items.length, 0);
});

test('doc export is deterministic and escapes table cells', () => {
  const db = sample();
  db.faces[0].notes = 'a | b';
  const a = exportAll(db);
  const b = exportAll(clone(db));
  assert.deepEqual(a, b);
  assert(a['docs/Dice Faces.md'].includes('a \\| b'));
  assert(a['docs/Dice.md'].includes('`slash` 2'));
});

test('committed data/*.json parses and the generated docs are in sync', { skip: !existsSync('data/faces.json') }, () => {
  const files: Record<string, string> = {};
  for (const n of COLLECTION_NAMES) if (existsSync(filePath(n))) files[filePath(n)] = readFileSync(filePath(n), 'utf8');
  const db = parseAll(files);
  assert(db.faces.length > 0 && db.keywords.length > 0 && db.dice.length > 0);
  for (const [path, text] of Object.entries(exportAll(db))) {
    assert.equal(readFileSync(path, 'utf8'), text, `${path} is out of date: run npm run docs`);
  }
});

test('every face image exists in the icon library and the library has about a hundred icons', { skip: !existsSync('data/faces.json') }, () => {
  const index = JSON.parse(readFileSync('public/face-art/library/index.json', 'utf8')) as { id: string; path: string; label: string; tags: string[] }[];
  assert(index.length >= 100, `library has ${index.length} icons`);
  assert.equal(new Set(index.map(i => i.id)).size, index.length, 'duplicate library ids');
  for (const i of index) {
    assert(existsSync(`public/${i.path}`), `${i.path} is listed in the library but missing`);
    assert(i.label && i.tags.length, `${i.id} needs a label and tags`);
  }
  const paths = new Set(index.map(i => i.path));
  const faces = JSON.parse(readFileSync('data/faces.json', 'utf8')) as { id: string; image: string }[];
  for (const f of faces) assert(paths.has(f.image), `face ${f.id} has image "${f.image}" which is not in the library`);
});
