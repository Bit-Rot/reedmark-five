import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DATA, ITEMS, ROOMS } from '../src/content.ts';
import { actionPreview, advance, canPlay, chooseOffer, commitRoll, endTurn, faceFor, incoming, newRun, offerTargets, play, reroll, setHold } from '../src/game.ts';

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
  s.offers = [{ kind: 'transform', id: 'die_dagger' }];
  assert(chooseOffer(s, 0, 'd0'));
  assert.equal(s.dice[0].template, 'die_dagger');
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

test('battle and Workshop item rewards draw only from the selected character’s pool', () => {
  for (const character of ['barbarian', 'thief']) {
    const pool = DATA.items.filter(item => item.rewardCharacter === character);
    assert(pool.length >= 3);
    assert.deepEqual(new Set(pool.map(item => item.rarity)), new Set(['common', 'uncommon', 'rare']));
    const eligible = new Set(pool.map(item => item.id));
    for (const variant of ['fixed', 'pool'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const [index, room] of ROOMS.entries()) {
          if (room.type === 'camp' || (room.type === 'battle' && room.rank === 'boss')) continue;
          const state = newRun(variant, seed, character);
          state.room = index - 1;
          state.phase = 'reward';
          assert(advance(state));
          if (state.combat) {
            state.combat.intents = [];
            for (const enemy of state.combat.enemies) enemy.seep = enemy.hp;
            assert(commitRoll(state));
            assert(endTurn(state));
          }
          assert.equal(state.phase, 'reward');
          const ids = state.offers.flatMap(offer => offer.kind === 'item' ? [offer.id] : []);
          assert.equal(ids.length, variant === 'fixed' ? 3 : room.type === 'workshop' ? 0 : 1);
          assert.equal(new Set(ids).size, ids.length);
          assert(ids.every(id => eligible.has(id)), `${character} received ${ids.join(', ')}`);
        }
      }
    }
  }
});
