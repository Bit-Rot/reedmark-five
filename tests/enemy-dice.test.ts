import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLinearRun } from '../src/game.ts';
import { dieForIntent, rollEnemyIntents } from '../src/enemy-roll.ts';
import { intentHazards, slotHazards } from '../src/hazards.ts';
import type { Encounter, IntentFace } from '../src/model.ts';

test('one enemy can roll a scratch with distinct hazards in two slots', () => {
  const state = newLinearRun('fixed', 231);
  const combat = state.combat!;
  const scratch: IntentFace = ['hit', 2, { kind: 'trap', value: 1, slots: 2 }];
  const room: Encounter = {
    type: 'battle', name: 'Scratch', rank: 'normal', enemies: combat.enemies,
    dice: combat.enemies.map((_, owner) => ({ owner, faces: [scratch, scratch, scratch, scratch, scratch, scratch] })),
  };
  combat.enemies[1].hp = 0;
  combat.intents = rollEnemyIntents(room, combat, state.dice.map(die => die.id), state.seed, 1, true);
  assert.equal(combat.intents.length, 1);
  assert.equal(combat.intents[0].move, 'hit');
  assert.equal(combat.intents[0].value, 2);
  const targets = intentHazards(combat.intents[0]);
  assert.equal(targets.length, 2);
  assert('position' in targets[0] && 'position' in targets[1]);
  assert.notEqual(targets[0].position, targets[1].position);
  assert.equal(slotHazards(combat, targets[0].position).length, 1);
});

test('the next roll in a resumed encounter includes the original roster only', () => {
  const state = newLinearRun('fixed', 231);
  const combat = state.combat!;
  const enemy = combat.enemies[0];
  combat.enemies = [enemy];
  const room: Encounter = {
    type: 'battle', name: 'Escort', rank: 'normal', enemies: [enemy, { ...enemy, id: 'new-escort' }],
    dice: [0, 1].map(owner => ({ owner, faces: Array.from({ length: 6 }, () => ['hit', 2] as const) })),
  };
  const result = rollEnemyIntents(room, combat, state.dice.map(die => die.id), state.seed, 1, true);
  assert.deepEqual(result.map(intent => intent.owner), [enemy.id]);
});

test('intent inspection follows the rolled die when the boss crosses a health threshold', () => {
  const state = newLinearRun('fixed', 231);
  const combat = state.combat!;
  const enemy = combat.enemies[0];
  combat.enemies = [enemy];
  const room: Encounter = {
    type: 'battle', name: 'Boss', rank: 'boss', enemies: [enemy],
    dice: [{ owner: 0, faces: Array.from({ length: 6 }, () => ['hit', 2] as const) }],
    phaseTwo: [{ owner: 0, faces: Array.from({ length: 6 }, () => ['hit', 4] as const) }],
  };
  const roll = () => rollEnemyIntents(room, combat, state.dice.map(die => die.id), state.seed, 1, true);
  combat.intents = roll();
  enemy.hp = 1;
  const firstRoll = combat.intents[0].dieRoll!;
  const firstDie = dieForIntent(room, combat, 0, true);
  assert.equal(firstDie, room.dice[0]);
  assert.equal(firstDie.faces[firstRoll.face][1], combat.intents[0].value);

  combat.intents = roll();
  assert.equal(dieForIntent(room, combat, 0, true), room.phaseTwo![0]);
  delete combat.intents[0].dieRoll;
  assert.equal(dieForIntent(room, combat, 0, true), room.phaseTwo![0]);
});
