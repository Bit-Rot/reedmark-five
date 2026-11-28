import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMP_UPGRADES, ROOMS } from '../src/content.ts';
import { addKeywordToFace, compileFace } from '../src/data/runtime.ts';
import type { Face as DataFace } from '../src/data/types.ts';
import { advance, canPlay, chooseOffer, commitRoll, endTurn, faceFor, mainPips, newLinearRun as newRun, play, previewUpgrade, reroll, rollFace, upgradeTargets } from '../src/game.ts';
import type { Face as GameFace, Offer, State } from '../src/model.ts';

type UpgradeOffer = Extract<Offer, { kind: 'upgrade' }>;
const SLOT_LIST = ['left', 'center', 'right', 'far', 'top', 'bottom'] as const;
const enemyTarget = (s: State, i = 0) => ({ kind: 'enemy', id: s.combat!.enemies[i].id }) as const;
const spread = (i: number) => Math.imul(i, 0x9e3779b1) >>> 0;

/** A run standing at the camp (room 6), reached through the game's own room advance. */
function campState(seed = 231, character = 'barbarian'): State {
  const s = newRun('fixed', seed, character);
  s.room = 4; // the room before the camp
  s.phase = 'reward';
  s.combat = null;
  assert(advance(s));
  assert.equal(ROOMS[s.room].type, 'camp');
  return s;
}

const upgradeOffer = (s: State): UpgradeOffer => s.offers.find(o => o.kind === 'upgrade') as UpgradeOffer;

const slash: GameFace = { target: 'enemy', parts: [{ kind: 'hit', value: 3 }] };
const block: GameFace = { target: 'self', parts: [{ kind: 'guard', value: 2 }] };
const blank: GameFace = { target: 'none', parts: [{ kind: 'blank', value: 0 }] };

test('the camp offers a heal and a face upgrade drawn from the pool, not an item', () => {
  const seen = new Set<string>();
  for (let i = 1; i <= 100; i++) {
    const s = campState(spread(i));
    assert.deepEqual(s.offers.map(o => o.kind), ['heal', 'upgrade']);
    const o = upgradeOffer(s);
    assert(CAMP_UPGRADES.some(u => u.keyword === o.keyword && u.x === o.x), JSON.stringify(o));
    seen.add(o.keyword);
  }
  assert.deepEqual([...seen].sort(), ['cantrip', 'cleave', 'growth', 'inspired', 'selfShield', 'vulnerable', 'weak']);
  assert.deepEqual(CAMP_UPGRADES, [
    { keyword: 'cantrip' }, { keyword: 'selfShield' }, { keyword: 'inspired' }, { keyword: 'growth', x: 1 },
    { keyword: 'weak', x: 1 }, { keyword: 'vulnerable', x: 1 }, { keyword: 'cleave' },
  ]);
});

test('each upgrade keyword only fits faces it makes sense on, and builds the right face', () => {
  assert.deepEqual(addKeywordToFace(slash, 'cantrip')!.parts.at(-1), { kind: 'cantrip', value: 0 });
  assert.equal(addKeywordToFace(blank, 'cantrip'), undefined);
  assert.equal(addKeywordToFace(addKeywordToFace(slash, 'cantrip')!, 'cantrip'), undefined);
  assert.deepEqual(addKeywordToFace(slash, 'selfShield')!.parts, [{ kind: 'hit', value: 3 }, { kind: 'guard', value: 3 }]);
  assert.equal(addKeywordToFace(block, 'selfShield'), undefined);
  assert.deepEqual(addKeywordToFace(slash, 'weak', 1)!.parts.at(-1), { kind: 'weak', value: 1 });
  assert.deepEqual(addKeywordToFace(addKeywordToFace(slash, 'vulnerable', 1)!, 'vulnerable', 1)!.parts.at(-1), { kind: 'vulnerable', value: 2 });
  assert.equal(addKeywordToFace(block, 'weak', 1), undefined);
  assert.equal(addKeywordToFace(block, 'vulnerable', 1), undefined);
  assert.deepEqual(addKeywordToFace(slash, 'growth', 1)!.parts.at(-1), { kind: 'growth', value: 1 });
  assert.deepEqual(addKeywordToFace(block, 'growth', 1)!.parts.at(-1), { kind: 'growth', value: 1 });
  assert.deepEqual(addKeywordToFace(slash, 'inspired')!.parts.at(-1), { kind: 'inspired', value: 0 });
  assert.equal(addKeywordToFace(blank, 'inspired'), undefined);
  assert.equal(addKeywordToFace(slash, 'cleave')!.target, 'all');
  assert.equal(addKeywordToFace(block, 'cleave'), undefined);
  assert.equal(addKeywordToFace(addKeywordToFace(slash, 'cleave')!, 'cleave'), undefined);
  assert.equal(addKeywordToFace(slash, 'poison'), undefined);
  assert.deepEqual(slash.parts, [{ kind: 'hit', value: 3 }], 'the original face must not change');
});

test('choosing an upgrade puts the keyword on that one face only and advances', () => {
  const s = campState();
  const offer = upgradeOffer(s);
  const index = s.offers.indexOf(offer);
  const targets = upgradeTargets(s, offer);
  assert(targets.length > 0);
  const t = targets[0];
  const before = faceFor(s.dice.find(d => d.id === t.dieId)!, t.slot);
  assert.equal(chooseOffer(s, index, t.dieId, t.slot), true);
  const die = s.dice.find(d => d.id === t.dieId)!;
  assert.deepEqual(die.upgrades?.[t.slot]?.map(u => u.keyword), [offer.keyword]);
  assert.notDeepEqual(faceFor(die, t.slot), before);
  for (const other of s.dice) for (const slot of SLOT_LIST) {
    if (other.id === die.id && slot === t.slot) continue;
    assert.equal(other.upgrades?.[slot], undefined);
  }
});

test('an upgrade cannot be placed on a face it does not fit, and nothing happens', () => {
  const s = campState();
  s.offers = [{ kind: 'upgrade', keyword: 'weak', x: 1 }];
  const shield = s.dice.find(d => d.template === 'die_shield')!; // all block faces: weak does not fit
  assert.equal(previewUpgrade(shield, 'left', s.offers[0]), null);
  const snapshot = structuredClone(s);
  assert.equal(chooseOffer(s, 0, shield.id, 'left'), false);
  assert.deepEqual(s, snapshot);
  assert(!upgradeTargets(s, s.offers[0]).some(t => t.dieId === shield.id));
  assert.equal(chooseOffer(s, 0, shield.id), false);
});

test('cleave makes a face hit every enemy without a target; weak and vulnerable apply to each', () => {
  const s = newRun('fixed', 231);
  s.dice[0].upgrades = { left: [{ keyword: 'cleave' }, { keyword: 'weak', x: 1 }, { keyword: 'vulnerable', x: 1 }] };
  assert.equal(faceFor(s.dice[0], 'left').target, 'all');
  const c = s.combat!;
  c.rolls[0].slot = 'left';
  assert(commitRoll(s));
  const hp = c.enemies.map(e => e.hp);
  assert.equal(canPlay(s, 'd0', enemyTarget(s)), false);
  assert(play(s, 'd0', { kind: 'all' }));
  assert.deepEqual(c.enemies.map(e => e.hp), hp.map(h => h - 4));
  assert(c.enemies.every(e => e.weak === 1 && e.vulnerable === 1));
});

test('selfShield adds block when played, and a cantrip upgrade fires by itself when rolled', () => {
  const s = newRun('fixed', 231);
  s.dice[0].upgrades = { left: [{ keyword: 'selfShield' }] };
  const c = s.combat!;
  c.rolls[0].slot = 'left';
  assert(commitRoll(s));
  const guard = c.guard;
  const hp = c.enemies[0].hp;
  assert(play(s, 'd0', enemyTarget(s)));
  assert.equal(c.guard, guard + 4);
  assert.equal(c.enemies[0].hp, hp - 4);

  let fired = 0;
  for (let i = 1; i <= 200 && !fired; i++) {
    const fresh = newRun('fixed', spread(i));
    fresh.dice[0].upgrades = Object.fromEntries(SLOT_LIST.map(slot => [slot, [{ keyword: 'cantrip' }]]));
    assert(reroll(fresh));
    if (fresh.combat!.events.some(e => e.includes('Cantrip'))) fired++;
  }
  assert(fired >= 1, 'an upgraded face should fire as a cantrip when rolled');
});

test('growth adds pips to that face for the rest of the fight, each time it is played', () => {
  const s = newRun('fixed', 231);
  s.dice[0].upgrades = { left: [{ keyword: 'growth', x: 1 }] };
  s.dice[1].upgrades = { left: [{ keyword: 'growth', x: 2 }] };
  const c = s.combat!;
  c.enemies.forEach(e => { e.hp = e.maxHp = 500; });
  s.hp = 1000;
  c.rolls[0].slot = 'left';
  assert(commitRoll(s));
  assert.equal(mainPips(rollFace(s, c.rolls[0])), 4);
  assert(play(s, 'd0', enemyTarget(s)));
  assert.equal(c.grown['d0:left'], 1);
  assert(endTurn(s));
  const c2 = s.combat!;
  c2.rolls[0].slot = 'left';
  assert(commitRoll(s));
  assert.equal(mainPips(rollFace(s, c2.rolls[0])), 5, 'shows the grown value');
  const before = c2.enemies[0].hp;
  assert(play(s, 'd0', enemyTarget(s)));
  assert.equal(before - c2.enemies[0].hp, 5);
  assert.equal(c2.grown['d0:left'], 2);
  assert.equal(c2.grown['d1:left'], undefined, 'growth is per face');
  assert.deepEqual(newRun('fixed', 231).combat!.grown, {}, 'a new fight starts clean');
});

test('inspired doubles a face when the die played just before had more pips', () => {
  const s = newRun('fixed', 231);
  s.dice[1].upgrades = { top: [{ keyword: 'inspired' }] }; // a 2-pip sword face
  const c = s.combat!;
  c.enemies.forEach(e => { e.hp = e.maxHp = 500; });
  c.rolls[0].slot = 'left'; // 4 pips
  c.rolls[1].slot = 'top'; // 2 pips, inspired
  assert(commitRoll(s));
  assert.equal(mainPips(rollFace(s, c.rolls[1])), 2, 'nothing played yet, so no bonus');
  assert(play(s, 'd0', enemyTarget(s)));
  assert.equal(c.previous, 4);
  assert.equal(mainPips(rollFace(s, c.rolls[1])), 4, 'previous die had more pips: doubled');
  const hp = c.enemies[0].hp;
  assert(play(s, 'd1', enemyTarget(s)));
  assert.equal(hp - c.enemies[0].hp, 4);

  const t = newRun('fixed', 231);
  t.dice[1].upgrades = { top: [{ keyword: 'inspired' }] };
  const d = t.combat!;
  d.enemies.forEach(e => { e.hp = e.maxHp = 500; });
  d.rolls[1].slot = 'top';
  d.rolls[0].slot = 'bottom'; // 2 pips: equal
  assert(commitRoll(t));
  assert(play(t, 'd0', enemyTarget(t)));
  assert.equal(mainPips(rollFace(t, d.rolls[1])), 2);
  t.hp = 1000;
  assert(endTurn(t));
  assert.equal(t.combat!.previous, null, 'the memory resets every turn');
});

test('imprinting an item over an upgraded face removes that face\'s upgrades only', () => {
  const s = newRun('fixed', 231);
  s.dice[0].upgrades = { left: [{ keyword: 'growth', x: 1 }], top: [{ keyword: 'inspired' }] };
  s.phase = 'reward';
  s.offers = [{ kind: 'item', id: 'chitin' }]; // replaces the left face
  assert(chooseOffer(s, 0, 'd0'));
  assert.equal(s.dice[0].upgrades?.left, undefined);
  assert.deepEqual(s.dice[0].upgrades?.top?.map(u => u.keyword), ['inspired']);
});

test('data faces can use growth, inspired and cleave, and compile them like the upgrades do', () => {
  const f = (keywords: DataFace['keywords'], targeting: DataFace['targeting'] = 'singleEnemy'): DataFace =>
    ({ id: 't', targeting, keywords, image: '', notes: '', status: 'active' });
  const issues: { where: string; message: string }[] = [];
  const out = compileFace(f([{ keyword: 'damage' }, { keyword: 'growth', x: 2 }, { keyword: 'inspired' }, { keyword: 'cleave' }]), 3, issues);
  assert.deepEqual(issues, []);
  assert.equal(out.target, 'all');
  assert.deepEqual(out.parts, [{ kind: 'hit', value: 3 }, { kind: 'growth', value: 2 }, { kind: 'inspired', value: 0 }]);
  const bad: { where: string; message: string }[] = [];
  compileFace(f([{ keyword: 'block' }, { keyword: 'cleave' }], 'self'), 2, bad);
  assert(bad.some(i => i.message.includes('cleave')));
});
