import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS } from '../src/content.ts';
import { actionPreview, canPlay, chooseOffer, commitRoll, endTurn, faceFor, incoming, newRun, offerTargets, play, reroll, setHold } from '../src/game.ts';

test('fixed rolls five, holds through two rerolls, and commits once', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  assert.equal(s.dice.length, 5);
  assert.equal(c.intents.length, 5);
  const first = c.rolls[0];
  const slot = first.slot;
  assert(setHold(s, first.dieId, true));
  assert(reroll(s));
  assert(reroll(s));
  assert.equal(first.slot, slot);
  assert.equal(reroll(s), false);
  assert(commitRoll(s));
  assert(c.rolls.every(roll => roll.held));
  assert.equal(setHold(s, first.dieId, false), false);
  assert.equal(commitRoll(s), false);
});

test('salvage pays once per die per turn', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  c.rolls.forEach(roll => { roll.held = roll.dieId !== 'd3'; });
  const support = c.rolls.find(roll => roll.dieId === 'd3')!;
  support.slot = 'right';
  assert(reroll(s));
  assert.equal(c.guard, 2);
  support.slot = 'right';
  assert(reroll(s));
  assert.equal(c.guard, 2);
});

test('invalid targets preserve state and killing an enemy cancels its intents', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  c.rolls[0].slot = 'left';
  c.enemies[0].hp = 1;
  c.intents[0] = { owner: c.enemies[0].id, move: 'hit', value: 4 };
  assert(commitRoll(s));
  const snapshot = structuredClone(s);
  assert.equal(play(s, 'd0', { kind: 'self' }), false);
  assert.deepEqual(s, snapshot);
  const target = { kind: 'enemy', id: c.enemies[0].id } as const;
  const preview = actionPreview(s, 'd0', target)!;
  assert(incoming(preview) < incoming(c));
  assert.equal(c.enemies[0].hp, 1);
  assert(play(s, 'd0', target));
  assert.equal(c.enemies[0].hp, 0);
  assert.equal(incoming(c), incoming(preview));
  assert.equal(canPlay(s, 'd0', { kind: 'enemy', id: c.enemies[1].id }), false);
});

test('support changes the next rolled attack without multiplying across a flurry', () => {
  const s = newRun('fixed', 231);
  const c = s.combat!;
  c.rolls[0].slot = 'left';
  c.rolls[3].slot = 'left';
  assert(commitRoll(s));
  assert(play(s, 'd3', { kind: 'die', id: 'd0' }));
  assert.equal(c.rolls[0].boost, 2);
  assert.equal(c.guard, 3);
  assert(play(s, 'd0', { kind: 'enemy', id: c.enemies[0].id }));
  assert.equal(c.enemies[0].hp, 2);
});

test('fixed imprints overwrite only overlapping faces', () => {
  const s = newRun('fixed', 231);
  s.phase = 'reward';
  s.offers = [{ kind: 'item', id: 'sea' }];
  assert(chooseOffer(s, 0, 'd0'));
  s.phase = 'reward';
  s.offers = [{ kind: 'item', id: 'clove' }];
  assert(chooseOffer(s, 0, 'd0'));
  const die = s.dice[0];
  assert.equal(s.dice.length, 5);
  assert.equal(faceFor(die, 'top'), ITEMS.sea.edits.top);
  assert.equal(faceFor(die, 'bottom'), ITEMS.clove.edits.bottom);
  assert.equal(die.item, undefined);
});

test('pool imprints are single-use and persist through transformation', () => {
  const s = newRun('pool', 231);
  s.phase = 'reward';
  s.offers = [{ kind: 'item', id: 'sea' }];
  assert(chooseOffer(s, 0, 'd0'));
  s.phase = 'reward';
  const item = { kind: 'item', id: 'clove' } as const;
  s.offers = [item];
  assert(!offerTargets(s, item).some(die => die.id === 'd0'));
  assert.equal(chooseOffer(s, 0, 'd0'), false);
  s.offers = [{ kind: 'transform', id: 'knurl' }];
  assert(chooseOffer(s, 0, 'd0'));
  assert.equal(s.dice[0].template, 'knurl');
  assert.equal(s.dice[0].item, 'sea');
  assert.equal(faceFor(s.dice[0], 'bottom'), ITEMS.sea.edits.bottom);
});

test('pool consumes all ten before a refill and draws unique dice after an odd-sized pool edit', () => {
  const s = newRun('pool', 462);
  s.hp = 1000;
  assert.equal(s.dice.length, 10);
  const first = new Set(s.combat!.rolls.map(roll => roll.dieId));
  commitRoll(s);
  endTurn(s);
  assert(s.combat!.rolls.every(roll => !first.has(roll.dieId)));
  assert.equal(s.combat!.bag.length, 0);
  s.phase = 'reward';
  s.offers = [{ kind: 'remove' }];
  assert(chooseOffer(s, 0, 'd1'));
  assert.equal(s.dice.length, 9);
  for (let i = 0; i < 10; i++) {
    const ids = s.combat!.rolls.map(roll => roll.dieId);
    assert.equal(new Set(ids).size, 5);
    assert(!ids.includes('d1'));
    commitRoll(s);
    endTurn(s);
  }
});

test('matched seeds share enemy dice across variants and valid saves round-trip', () => {
  const a = newRun('fixed', 44);
  const b = newRun('pool', 44);
  assert.deepEqual(a.combat!.intents, b.combat!.intents);
  assert.deepEqual(newRun('fixed', 44), a);
  assert.deepEqual(JSON.parse(JSON.stringify(b)), b);
});
