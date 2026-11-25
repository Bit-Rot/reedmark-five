import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS, DATA, DATA_ISSUES, DICE, ITEMS } from '../src/content.ts';
import { IMPLEMENTED_KEYWORDS, compileDb, compileFace } from '../src/data/runtime.ts';
import { validate } from '../src/data/validate.ts';
import { canPlay, commitRoll, endTurn, incoming, isExerted, newRun, play, rollFace } from '../src/game.ts';
import type { Face as DataFace } from '../src/data/types.ts';

const enemyTarget = (s: ReturnType<typeof newRun>, i = 0) => ({ kind: 'enemy', id: s.combat!.enemies[i].id }) as const;

test('every character is playable and all active data compiles without problems', () => {
  assert.deepEqual(CHARACTERS.map(c => c.id).sort(), ['barbarian', 'thief']);
  assert.deepEqual(DATA_ISSUES, []);
  assert.deepEqual(validate(DATA).filter(i => i.severity === 'error'), []);
  for (const c of CHARACTERS) assert.equal(c.starterDice.length, 5);
  assert(Object.keys(ITEMS).length >= 16);
});

test('the keywords the engine runs are exactly the ones flagged implemented in the data', () => {
  const flagged = DATA.keywords.filter(k => k.implemented === 'implemented').map(k => k.id).sort();
  assert.deepEqual(flagged, [...IMPLEMENTED_KEYWORDS].sort());
});

test('faces compile from keywords, pips and X values', () => {
  const face = (id: string) => DATA.faces.find(f => f.id === id) as DataFace;
  assert.deepEqual(compileFace(face('dmg'), 3).parts, [{ kind: 'hit', value: 3 }]);
  assert.deepEqual(compileFace(face('block'), 2), { id: 'block', target: 'self', parts: [{ kind: 'guard', value: 2 }] });
  assert.deepEqual(compileFace(face('dmgBlock'), 2).parts, [{ kind: 'hit', value: 2 }, { kind: 'guard', value: 2 }]);
  assert.deepEqual(compileFace(face('dmgVulnerable'), 2).parts, [{ kind: 'hit', value: 2 }, { kind: 'vulnerable', value: 1 }, { kind: 'exert', value: 0 }]);
  assert.deepEqual(compileFace(face('poison'), 1).parts, [{ kind: 'hit', value: 1 }, { kind: 'seep', value: 1 }]);
  assert.equal(compileFace(face('blank'), undefined).target, 'none');
  const issues: { where: string; message: string }[] = [];
  compileFace(face('dmg'), undefined, issues);
  assert(issues.some(i => i.message.includes('pips')));
});

test('dice, items and characters with problems are left out instead of breaking the game', () => {
  const db = structuredClone(DATA);
  db.faces.push({ id: 'lasso', targeting: 'allEnemies', keywords: [{ keyword: 'damage' }, { keyword: 'taunt' }], image: '', notes: '', status: 'active' });
  db.dice.push({ id: 'die_lasso', name: '', tone: 'rust', notes: '', faces: db.dice[0].faces.map(f => ({ ...f, face: 'lasso', pips: 1 })) });
  db.items.push({ id: 'odd', name: 'Odd', rarity: 'common', description: '', implemented: 'planned', effects: [{ target: 'all', op: 'pipDelta', delta: 1 }] });
  db.characters.push({ id: 'broken', name: 'Broken', starterDice: ['die_lasso'], items: [], unlocks: [], notes: '' });
  const out = compileDb(db);
  assert(!out.dice.die_lasso && !out.items.odd);
  assert(!out.characters.some(c => c.id === 'broken'));
  assert(out.issues.some(i => i.message.includes('"taunt" is not implemented')));
  assert(out.issues.some(i => i.message.includes('allEnemies')));
  assert(out.issues.some(i => i.message.includes('pipDelta')));
});

test('each character starts with its own five dice, and saves remember the character', () => {
  const b = newRun('fixed', 231, 'barbarian');
  const t = newRun('fixed', 231, 'thief');
  assert.deepEqual(b.dice.map(d => d.template), ['die_sword', 'die_sword', 'die_shield', 'die_shield', 'die_hammer']);
  assert.deepEqual(t.dice.map(d => d.template), ['die_dagger', 'die_dagger', 'die_dodge', 'die_dodge', 'die_kris']);
  assert.equal(t.character, 'thief');
  assert.equal(newRun('pool', 231, 'thief').dice.length, 10);
  assert(Object.values(DICE).every(d => d.name));
});

test('damage and block faces use the pips on the die slot; slash_block does both', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  c.rolls[0].slot = 'left';
  c.rolls[4].slot = 'top';
  assert(commitRoll(s));
  const enemy = c.enemies[0];
  const hp = enemy.hp;
  assert(play(s, 'd0', enemyTarget(s)));
  assert.equal(enemy.hp, hp - 3);
  const guard = c.guard;
  assert(play(s, 'd4', enemyTarget(s)));
  assert.equal(enemy.hp, hp - 4);
  assert.equal(c.guard, guard + 1);
});

test('blank faces cannot be played', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  c.rolls[4].slot = 'right';
  assert(commitRoll(s));
  assert.equal(rollFace(s, c.rolls[4]).target, 'none');
  assert.equal(canPlay(s, 'd4', { kind: 'self' }), false);
  assert.equal(canPlay(s, 'd4', enemyTarget(s)), false);
});

test('vulnerable adds 50% damage (rounded down) and loses a stack after each enemy turn', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  const enemy = c.enemies[0];
  enemy.hp = enemy.maxHp = 100;
  c.rolls[4].slot = 'left';
  c.rolls[0].slot = 'left';
  assert(commitRoll(s));
  assert(play(s, 'd4', enemyTarget(s)));
  assert.equal(enemy.hp, 98);
  assert.equal(enemy.vulnerable, 1);
  assert(play(s, 'd0', enemyTarget(s)));
  assert.equal(enemy.hp, 98 - Math.floor(3 * 1.5));
  s.hp = 1000;
  assert(endTurn(s));
  assert.equal(enemy.vulnerable, 0);
});

test('weak halves what an enemy deals (rounded down) and loses a stack after each enemy turn', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  const enemy = c.enemies[0];
  c.intents = [{ owner: enemy.id, move: 'hit', value: 5 }];
  assert.equal(incoming(c), 5);
  enemy.weak = 2;
  assert.equal(incoming(c), 2);
  assert(commitRoll(s));
  s.hp = 1000;
  assert(endTurn(s));
  assert.equal(s.hp, 998);
  assert.equal(enemy.weak, 1);
});

test('poison stacks tick for their value, ignore block, and lose a stack each turn', () => {
  const s = newRun('fixed', 231, 'thief');
  const c = s.combat!;
  const enemy = c.enemies[0];
  const hp = enemy.hp;
  enemy.guard = 50;
  enemy.seep = 3;
  assert(commitRoll(s));
  s.hp = 1000;
  assert(endTurn(s));
  assert.equal(enemy.hp, hp - 3);
  assert.equal(enemy.seep, 2);
});

test('applying poison from a face adds X stacks regardless of pips', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  s.dice[0].imprints.right = 'moss';
  c.rolls[0].slot = 'right';
  assert(commitRoll(s));
  const enemy = c.enemies[0];
  const hp = enemy.hp;
  assert(play(s, 'd0', enemyTarget(s)));
  assert.equal(enemy.hp, hp - 2);
  assert.equal(enemy.seep, 1);
});

test('exert blanks every face on the die until the end of next turn', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  s.hp = 1000;
  c.enemies.forEach(e => { e.hp = e.maxHp = 500; });
  c.rolls[4].slot = 'left';
  assert(commitRoll(s));
  assert(play(s, 'd4', enemyTarget(s)));
  assert.equal(isExerted(s, 'd4'), false);
  assert(endTurn(s));
  assert.equal(isExerted(s, 'd4'), true);
  assert.equal(rollFace(s, s.combat!.rolls.find(r => r.dieId === 'd4')!).target, 'none');
  assert.equal(isExerted(s, 'd0'), false);
  assert(commitRoll(s));
  assert(endTurn(s));
  assert.equal(isExerted(s, 'd4'), false);
});

test('cantrips fire by themselves when they land, at a random enemy, without using the die', () => {
  let found = 0;
  for (let seed = 1; seed <= 300 && found < 3; seed++) {
    const s = newRun('fixed', seed, 'thief');
    const c = s.combat!;
    if (!c.events.some(e => e.includes('damage'))) continue;
    found++;
    const total = c.enemies.reduce((n, e) => n + e.maxHp - e.hp, 0);
    assert.equal(total, c.events.filter(e => e.includes('1 damage')).length);
    assert(c.rolls.every(r => !r.used));
  }
  assert(found >= 1, 'no seed produced a cantrip');
});

test('a block cantrip gives block as soon as it lands', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const s = newRun('fixed', seed, 'thief');
    const c = s.combat!;
    const dashes = c.rolls.filter(r => s.dice.find(d => d.id === r.dieId)!.template === 'die_dodge' && r.slot !== 'right' && r.slot !== 'far');
    if (!dashes.length) continue;
    assert(c.guard >= dashes.length);
    return;
  }
  assert.fail('no seed rolled a dash');
});
