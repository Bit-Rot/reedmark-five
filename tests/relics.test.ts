import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionPreview, baseRerolls, advance, commitRoll, endTurn, faceFor, incoming, mainPips, newLinearRun as newRun, play, reroll, rollFace } from '../src/game.ts';
import type { Slot } from '../src/model.ts';

const foe = { kind: 'enemy', id: 'gnat-a' } as const;
const self = { kind: 'self' } as const;

function fight(relics: string[], slots: Slot[] = [], character = 'barbarian', seed = 231) {
  const state = newRun('fixed', seed, character);
  state.phase = 'reward';
  state.room = -1;
  state.relics = relics;
  assert(advance(state));
  const c = state.combat!;
  c.intents = [];
  c.enemies.forEach(enemy => { enemy.hp = enemy.maxHp = 100; });
  slots.forEach((slot, index) => { c.rolls[index].slot = slot; });
  return { state, c, pips: (index: number) => mainPips(rollFace(state, c.rolls[index])) };
}

test('position and play-order relics update rolled pips and resolve the same value as the preview', () => {
  const { state, c, pips } = fight(['flint-shim', 'reed-loom', 'iron-thread', 'counterweight-crown'],
    ['left', 'left', 'right', 'far', 'top']);
  assert(commitRoll(state));
  assert.equal(pips(0), 4);
  assert.equal(actionPreview(state, 'd0', foe)?.enemies[0].hp, 96);
  assert.equal(c.enemies[0].hp, 100);
  assert(play(state, 'd0', foe));
  assert.equal(pips(1), 5);
  assert(play(state, 'd1', foe));
  assert.equal(pips(2), 4);
  assert(play(state, 'd2', self));
  assert.equal(pips(3), 6);
  assert(play(state, 'd3', self));
  assert.equal(c.guard, 10);
  assert.equal(c.enemies[0].hp, 91);
});

test('manual play triggers Block, Ward, and the positional combo once', () => {
  const { state, c } = fight(['reed-shuttle', 'thread-spool', 'wax-balance', 'knotted-cord', 'sedge-laces', 'tide-knot', 'sixfold-bell'],
    ['left', 'top', 'bottom', 'far']);
  state.dice[0].imprints.left = 'chitin';
  assert(commitRoll(state));
  assert(play(state, 'd0', foe));
  assert.equal(c.guard, 2);
  assert(play(state, 'd1', foe));
  assert.equal(c.ward, 1);
  assert(play(state, 'd2', self));
  assert.equal(c.guard, 9);
  assert(play(state, 'd3', self));
  assert.equal(c.guard, 17);
  assert.equal(c.ward, 5);
  assert.deepEqual(c.enemies.map(enemy => enemy.hp), [92, 94]);
});

test('blank and matching commit effects use the original roll and allow a temporary Block face', () => {
  const { state, c, pips } = fight(['clay-weir', 'twin-rivets', 'blank-ferrule', 'hollow-prism', 'loop-weight'],
    ['left', 'left', 'left', 'top', 'right'], 'moth');
  assert.equal(pips(0), 3);
  assert.equal(rollFace(state, c.rolls[4]).target, 'none');
  assert(commitRoll(state));
  assert.equal(c.guard, 4);
  assert.equal(pips(0), 7);
  assert(play(state, 'd0', foe));
  assert.equal(pips(4), 5);
  assert(play(state, 'd4', self));
  assert.equal(c.guard, 9);
  assert.equal(pips(1), 3);
  assert.equal(faceFor(state.dice[4], 'right').target, 'none');
  assert(endTurn(state));
  assert.equal(c.relicTurn?.blankGuard, undefined);
});

test('turn and fight triggers apply Weak and Ward at the right time and grant every-third-turn bonuses', () => {
  const { state, c, pips } = fight(['cold-pebble', 'drowned-compass', 'keepers-bead', 'clay-flask', 'pocket-spring', 'floodgate-key']);
  assert(c.enemies.every(enemy => enemy.weak === 1));
  const attack = { owner: foe.id, move: 'hit', value: 6 } as const;
  c.intents = [attack];
  assert(commitRoll(state) && endTurn(state));
  assert.equal(state.hp, state.maxHp - 3);
  assert.equal(c.guard, baseRerolls('fixed') + 4);
  c.guard = 0;
  c.intents = [attack];
  assert.equal(incoming(c), 3);
  const middlePlayed = structuredClone(c);
  middlePlayed.relicTurn!.slots.push('center');
  assert.equal(incoming(middlePlayed), 6);
  assert(commitRoll(state) && endTurn(state));
  assert.equal(state.hp, state.maxHp - 6);
  assert.equal(c.guard, baseRerolls('fixed'));
  assert.equal(c.rerolls, baseRerolls('fixed') + 1);
  c.rolls[0].slot = 'left';
  assert(commitRoll(state));
  assert.equal(pips(0), 6);
});

test('matching pips give unused dice a boost after Silt Quill changes the next face', () => {
  const { state, c, pips } = fight(['silt-quill', 'twinwake-dial'], ['top', 'bottom', 'top', 'bottom']);
  assert(commitRoll(state));
  assert.equal(pips(0), 1);
  assert(play(state, 'd0', foe));
  assert.equal(pips(1), 2);
  assert(play(state, 'd1', foe));
  assert.equal(pips(2), 2);
  assert(play(state, 'd2', self));
  assert.deepEqual(c.rolls.map(roll => roll.boost), [0, 0, 0, 1, 1]);
});

test('breaking enemy Block grants relic effects once and the highest-HP target can differ from the aimed enemy', () => {
  const { state, c } = fight(['fen-tongs', 'silt-salt', 'tide-slate', 'mire-glass'], ['left', 'left', 'top', 'top', 'left']);
  c.enemies[0].guard = 2;
  assert(commitRoll(state));
  assert(play(state, 'd0', foe));
  assert.deepEqual(c.enemies.map(enemy => enemy.hp), [99, 98]);
  assert.equal(c.guard, 2);
  assert.equal(c.enemies[0].burn, 1);
  assert.equal(c.enemies[0].vulnerable, 1);
  c.enemies[0].guard = 1;
  assert(play(state, 'd1', foe));
  assert.equal(c.guard, 2);
  assert.equal(c.enemies[0].burn, 1);
  assert(play(state, 'd4', foe));
  assert.equal(c.guard, 4);
});

test('a blank reroll pays Block and Hinge Pin retries one landed blank for free', () => {
  for (let seed = 1; seed < 100; seed++) {
    const { state, c } = fight(['mud-wedge', 'hinge-pin'], ['left', 'left', 'left', 'left', 'right'], 'moth', seed);
    c.rolls.slice(0, 4).forEach(roll => { roll.held = true; });
    const baseline = structuredClone(state);
    baseline.relics = ['mud-wedge'];
    assert(reroll(baseline) && reroll(state));
    if (rollFace(baseline, baseline.combat!.rolls[4]).target !== 'none') continue;
    assert.equal(c.guard, 2);
    assert.equal(c.rerolls, baseRerolls('fixed') - 1);
    assert.notEqual(state.combatRng, baseline.combatRng);
    assert(c.relicTurn?.fired.includes('hingePin'));
    assert(reroll(state));
    assert.equal(c.guard, 2);
    return;
  }
  assert.fail('no seed rerolled the lantern to a blank');
});
