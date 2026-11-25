import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clone, filePath, parseAll, serialiseAll } from '../src/data/db.ts';
import { GitHubClient, repoFromLocation } from '../src/data/github.ts';
import { FakeGitHub } from './helpers/fake-github.ts';
import { loadSnapshot, save } from '../src/data/sync.ts';
import { resolveConflict } from '../src/data/merge.ts';
import { emptyDb } from '../src/data/types.ts';
import type { Collections } from '../src/data/types.ts';

function sampleDb(): Collections {
  const db = emptyDb();
  db.keywords.push({ id: 'damage', valueKind: 'pips', ruleText: 'damage N', category: 'c', appliesTo: '', implemented: 'planned', notes: '' });
  db.faces.push(
    { id: 'slash', targeting: 'singleEnemy', keywords: [{ keyword: 'damage' }], image: '', notes: 'sword', status: 'active' },
    { id: 'blank', targeting: 'none', keywords: [], image: '', notes: '', status: 'active' },
  );
  return db;
}

function setup() {
  const fake = new FakeGitHub(serialiseAll(sampleDb()));
  const client = new GitHubClient({ owner: 'o', repo: 'r', branch: 'main' }, 'token', fake.fetch);
  return { fake, client };
}

test('loadSnapshot reads every data file at the head commit', async () => {
  const { client } = setup();
  const snap = await loadSnapshot(client);
  assert.deepEqual(snap.db, sampleDb());
});

test('save writes data, regenerated docs and images in one commit', async () => {
  const { fake, client } = setup();
  const base = await loadSnapshot(client);
  const db = clone(base.db);
  db.faces[0].notes = 'big sword';
  const r = await save(client, base, db, [{ path: 'public/face-art/slash.webp', base64: 'AAAA' }], 'Edit faces');
  assert.equal(r.status, 'saved');
  assert.equal(fake.commits.get(fake.head)!.message, 'Edit faces');
  assert.equal(fake.commits.get(fake.head)!.parents.length, 1);
  assert(fake.file('data/faces.json')!.includes('big sword'));
  assert(fake.file('docs/Dice Faces.md')!.includes('big sword'));
  assert.equal(fake.file('data/keywords.json'), serialiseAll(sampleDb())['data/keywords.json']);
  const imgSha = fake.trees.get(fake.commits.get(fake.head)!.tree)!.get('public/face-art/slash.webp')!;
  assert.deepEqual(fake.blobs.get(imgSha), { content: 'AAAA', encoding: 'base64' });
  assert.equal(fake.calls.filter(c => c === 'PATCH /git/refs/heads/main').length, 1);
});

test('save with no changes does not create a commit', async () => {
  const { fake, client } = setup();
  const base = await loadSnapshot(client);
  const before = fake.head;
  const r = await save(client, base, clone(base.db), [], 'noop');
  assert.equal(r.status, 'nochange');
  assert.equal(fake.head, before);
});

test('save merges with edits pushed elsewhere to different entities', async () => {
  const { fake, client } = setup();
  const base = await loadSnapshot(client);
  const theirs = clone(base.db);
  theirs.faces[1].notes = 'edited on another device';
  fake.push(serialiseAll(theirs));
  const mine = clone(base.db);
  mine.faces[0].notes = 'my sword';
  const r = await save(client, base, mine, [], 'merge');
  assert.equal(r.status, 'saved');
  const final = parseAll({ [filePath('faces')]: fake.file('data/faces.json')! });
  assert.equal(final.faces[0].notes, 'my sword');
  assert.equal(final.faces[1].notes, 'edited on another device');
});

test('save reports clashes without writing, and resolving them lets the retry succeed', async () => {
  const { fake, client } = setup();
  const base = await loadSnapshot(client);
  const theirs = clone(base.db);
  theirs.faces[0].notes = 'theirs';
  fake.push(serialiseAll(theirs));
  const pushed = fake.head;
  const mine = clone(base.db);
  mine.faces[0].notes = 'mine';
  const r = await save(client, base, mine, [], 'clash');
  assert.equal(r.status, 'conflict');
  assert.equal(fake.head, pushed);
  if (r.status !== 'conflict') return;
  assert.equal(r.conflicts.length, 1);
  resolveConflict(r.merged, r.conflicts[0], 'mine');
  const r2 = await save(client, r.theirs, r.merged, [], 'resolved');
  assert.equal(r2.status, 'saved');
  assert(fake.file('data/faces.json')!.includes('"mine"'));
});

test('save retries when the branch moves between reading the head and updating the ref', async () => {
  const { fake, client } = setup();
  const base = await loadSnapshot(client);
  const mine = clone(base.db);
  mine.faces[0].notes = 'mine';
  const theirs = clone(base.db);
  theirs.faces[1].notes = 'race';
  fake.beforeRefUpdate = () => fake.push(serialiseAll(theirs));
  const r = await save(client, base, mine, [], 'racy');
  assert.equal(r.status, 'saved');
  const final = parseAll({ [filePath('faces')]: fake.file('data/faces.json')! });
  assert.equal(final.faces[0].notes, 'mine');
  assert.equal(final.faces[1].notes, 'race');
});

test('repoFromLocation reads owner and repo from a Pages URL', () => {
  const fallback = { owner: 'Bit-Rot', repo: 'reedmark-five', branch: 'main' };
  assert.deepEqual(repoFromLocation({ hostname: 'someone.github.io', pathname: '/their-repo/editor/' }, fallback),
    { owner: 'someone', repo: 'their-repo', branch: 'main' });
  assert.deepEqual(repoFromLocation({ hostname: 'localhost', pathname: '/editor/' }, fallback), fallback);
});
