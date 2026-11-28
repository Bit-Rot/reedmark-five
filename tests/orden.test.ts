import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS, DICE, ITEMS } from '../src/content.ts';
import { STARTER_PIPS, estimateFaceValue, estimateImprint } from '../scripts/face-value.ts';
import { actionPreview, canPlay, commitRoll, endTurn, isHasted, newLinearRun, placeDie, play, reroll, restoreSave, rollFace, setHold, unplaceDie } from '../src/game.ts';
import { applyDirectHazard, faceHazard } from '../src/hazards.ts';
import { SLOTS } from '../src/model.ts';
import type { Combat } from '../src/model.ts';

function battle() {
  const state = newLinearRun('fixed', 231, 'orden');
  const combat = state.combat!;
  for (const enemy of combat.enemies) {
    enemy.hp = enemy.maxHp = 80;
    enemy.guard = 0;
  }
  combat.intents = combat.intents.map(intent => ({ ...intent, move: 'wait', value: 0 }));
  for (const roll of combat.rolls) roll.slot = 'left';
  return { state, combat };
}

const self = { kind: 'self' } as const;
const enemy = (combat: Combat, index = 0) => ({ kind: 'enemy', id: combat.enemies[index].id } as const);

test('placement can move, swap, and release until Reroll or Commit locks it', () => {
  const { state, combat } = battle();
  assert.equal(placeDie(state, 'd0', -1), false);
  assert.equal(placeDie(state, 'd0', 5), false);
  assert(placeDie(state, 'd0', 4));
  assert(placeDie(state, 'd1', 4)); // A loose die displaces a seated one.
  assert.equal(combat.rolls[0].held, false);
  assert(placeDie(state, 'd0', 0));
  assert(placeDie(state, 'd0', 4)); // Moving a seated die swaps the two.
  assert.equal(combat.formation![0]?.dieId, 'd1');
  assert(setHold(state, 'd1', false));
  assert.equal(combat.formation![0], null);
  const held = rollFace(state, combat.rolls[0]);
  assert.equal(combat.rerolls, 2);
  assert(reroll(state));
  assert.equal(combat.formation![4]?.locked, true);
  assert.equal(placeDie(state, 'd0', 2), false);
  assert.equal(unplaceDie(state, 'd0'), false);
  assert.equal(setHold(state, 'd0', false), false);
  assert.equal(placeDie(state, 'd1', 4), false);
  assert(placeDie(state, 'd1', 2));
  assert.equal(placeDie(state, 'd1', 4), false);
  assert(unplaceDie(state, 'd1'));
  assert(placeDie(state, 'd1', 1));
  assert(reroll(state));
  assert.equal(combat.formation![1]?.locked, true);
  assert.equal(unplaceDie(state, 'd1'), false);
  assert.equal(reroll(state), false);
  assert.equal(combat.phase, 'roll');
  assert(placeDie(state, 'd2', 3));
  assert(unplaceDie(state, 'd2'));
  assert.deepEqual(rollFace(state, combat.rolls[0]), held);
  const resumed = restoreSave(structuredClone(state), 'fixed', true)!;
  assert.deepEqual(resumed.combat?.formation, combat.formation);
  assert.equal(unplaceDie(resumed, 'd0'), false);
  assert.equal(endTurn(state), false);
  assert.equal(play(state, 'd0', enemy(combat, 1)), false);
  assert(commitRoll(state));
  assert.equal(combat.formation![4]?.dieId, 'd0');
  assert(combat.formation!.every(slot => slot !== null));
  assert.equal(placeDie(state, 'd0', 2), false);
  assert.equal(unplaceDie(state, 'd0'), false);
  assert(restoreSave(structuredClone(state), 'fixed', true));
  assert(play(state, 'd0', enemy(combat, 1)));
  assert.equal(combat.enemies[0].hp, 80);
  assert.equal(combat.enemies[1].hp, 76);
});

test('Haste arms the immediate right-hand die when used and counts only one Growth play', () => {
  const { state, combat } = battle();
  combat.rolls[4].slot = 'bottom';
  state.dice[4].imprints.bottom = 'march-whistle';
  combat.rolls[1].slot = 'right';
  state.dice[1].imprints.right = 'march-whistle';
  state.dice[1].upgrades = { right: [{ keyword: 'growth', x: 1 }] };
  placeDie(state, 'd4', 0);
  placeDie(state, 'd1', 1);
  placeDie(state, 'd0', 2);
  assert(commitRoll(state));
  assert.equal(isHasted(state, 'd1'), false);
  assert(play(state, 'd4', self));
  assert.equal(isHasted(state, 'd1'), true);
  assert.equal(isHasted(state, 'd0'), false);
  assert.equal(rollFace(state, combat.rolls[1]).parts[0].value, 2); // Pair with the Damage face to its right.
  const before = structuredClone(state);
  assert.equal(actionPreview(state, 'd1', enemy(combat, 1))?.enemies[1].hp, 76);
  assert.deepEqual(state, before);
  assert(play(state, 'd1', enemy(combat, 1)));
  assert.equal(combat.enemies[1].hp, 76);
  assert.equal(combat.grown['d1:right'], 1);
  assert(endTurn(state));
  assert(combat.formation!.every(slot => slot === null));
  assert.equal(combat.rerolls, 2);
});

test('Brace affects both neighbors and Block uses the common pool regardless of enemy attack order', () => {
  const { state, combat } = battle();
  combat.intents[1] = { owner: combat.enemies[0].id, move: 'hit', value: 16 };
  combat.rolls[2].slot = 'far';
  combat.rolls[3].slot = 'far';
  state.dice[2].imprints.far = 'watch-plate';
  state.dice[3].imprints.far = 'watch-plate';
  combat.rolls[4].slot = 'bottom'; // Plain Block
  placeDie(state, 'd2', 0);
  placeDie(state, 'd3', 2);
  placeDie(state, 'd4', 1);
  assert(commitRoll(state));
  assert.equal(rollFace(state, combat.rolls[4]).parts[0].value, 4);
  assert(play(state, 'd4', self));
  assert.equal(combat.guard, 4);
  assert(endTurn(state));
  assert.equal(state.hp, 32);
});

test('Anchor, Center, and Flank reward their own positions', () => {
  const { state, combat } = battle();
  combat.rolls[4].slot = 'top'; // Starter Anchor
  combat.rolls[1].slot = 'right';
  state.dice[1].imprints.right = 'wedge-blade'; // Flank
  combat.rolls[3].slot = 'top';
  state.dice[3].imprints.top = 'watch-plate'; // Bypass
  combat.rolls[2].slot = 'bottom';
  state.dice[2].imprints.bottom = 'lit-signal'; // Center
  combat.intents[2] = { owner: combat.enemies[0].id, move: 'hit', value: 4 };
  placeDie(state, 'd4', 0);
  placeDie(state, 'd1', 1);
  placeDie(state, 'd3', 2);
  placeDie(state, 'd2', 4); // Outside center.
  assert(commitRoll(state));
  const amount = (index: number) => rollFace(state, combat.rolls[index]).parts[0].value;
  assert.deepEqual([4, 1, 3, 2].map(amount), [3, 4, 2, 2]);
});

test('Bypass ignores sealing, drain, traps, and use-triggered curses while Pain still applies', () => {
  const { state, combat } = battle();
  const roll = combat.rolls[3];
  roll.slot = 'top';
  state.dice[3].imprints.top = 'watch-plate';
  const owner = combat.enemies[0].id;
  combat.intents = ([
    ['lock', 0], ['drain', 1], ['trap', 3], ['petrifyOnUse', 0], ['corruptOnUse', 2],
  ] as const).map(([kind, value]) => ({ owner, move: 'wait', value: 0, hazard: { kind, value, position: 1 } }));
  applyDirectHazard(combat, { kind: 'pain', value: 2, dieId: 'd3', faces: [] });
  assert(placeDie(state, 'd3', 1));
  assert(commitRoll(state));
  assert.equal(rollFace(state, roll).parts[0].value, 2);
  assert(rollFace(state, roll).parts.some(part => part.kind === 'bypass' && part.active));
  assert(canPlay(state, 'd3', self));
  const forecast = actionPreview(state, 'd3', self);
  assert.equal(forecast?.playerHp, 42);
  assert(play(state, 'd3', self));
  assert.equal(state.hp, 42);
  assert.equal(combat.guard, 2);
  assert.equal(faceHazard(combat, 'd3', 'top'), undefined);
});

test('playing a cursed slot can petrify its face even when the play kills the source', () => {
  const { state, combat } = battle();
  combat.enemies[0].hp = 1;
  combat.intents[0] = { owner: combat.enemies[0].id, move: 'wait', value: 0, hazard: { kind: 'petrifyOnUse', value: 0, position: 0 } };
  assert(placeDie(state, 'd0', 0));
  assert(commitRoll(state));
  assert(canPlay(state, 'd0', enemy(combat)));
  assert(play(state, 'd0', enemy(combat)));
  assert.equal(combat.enemies[0].hp, 0);
  assert.equal(faceHazard(combat, 'd0', 'left')?.kind, 'petrified');
});

test('a lethal corrupted cantrip stops later cantrips and preserves defeat', () => {
  const { state, combat } = battle();
  state.hp = 1;
  applyDirectHazard(combat, { kind: 'corruptDice', dieId: 'd0', value: 2, faces: [...SLOTS] });
  applyDirectHazard(combat, { kind: 'corruptDice', dieId: 'd1', value: 2, faces: [...SLOTS] });
  assert(reroll(state));
  assert.equal(state.hp, 0);
  assert.equal(state.phase, 'defeat');
  assert.deepEqual(combat.events, ['Corrupted cantrip: 2 self damage']);
});

test('Orden has the same item rarity distribution as Moth', () => {
  for (const [rarity, count] of [['common', 7], ['uncommon', 8], ['rare', 5]] as const) {
    assert.equal(Object.values(ITEMS).filter(item => item.rewardCharacter === 'orden' && item.rarity === rarity).length, count);
  }
});

test('Orden starts with the pip curve on every die and a single Anchor face', () => {
  const dice = CHARACTERS.find(hero => hero.id === 'orden')!.starterDice;
  const modifiers: string[][] = [];
  for (const template of dice) {
    const faces = DICE[template].faces;
    for (const slot of SLOTS) {
      const face = faces[slot];
      if (template === 'die_orden_signal' && slot === 'top') {
        assert.equal(face.parts[0].value, 1);
        assert(Math.abs(estimateFaceValue(face) - STARTER_PIPS[slot]) <= .75, template + ' ' + slot);
      } else assert.equal(face.parts[0].value, STARTER_PIPS[slot], template + ' ' + slot);
    }
    modifiers.push(SLOTS.flatMap(slot => faces[slot].parts.slice(1).map(part => part.kind)));
  }
  assert.deepEqual(modifiers, [[], [], [], [], ['anchor']]);
});

test('an old Orden save keeps its committed row and spent rerolls under the two-roll limit', () => {
  const { state, combat } = battle();
  placeDie(state, 'd0', 3);
  delete combat.baseRerolls;
  combat.rerolls = 2; // One of the old three rerolls was spent.
  const migrated = restoreSave(structuredClone(state), 'fixed', true)!;
  assert.deepEqual(migrated.combat?.formation, combat.formation);
  assert.equal(migrated.combat?.rerolls, 1);
  assert.equal(restoreSave(structuredClone(migrated), 'fixed', true)?.combat?.rerolls, 1);
});

test('Orden imprints stay close to the face budgets and favor wider coverage', () => {
  const gains: number[][] = [[], [], []];
  for (const item of Object.values(ITEMS).filter(item => item.rewardCharacter === 'orden')) {
    const report = estimateImprint(item);
    assert(Math.abs(report.estimate - report.budget) <= 1, item.name);
    for (const face of report.faces) assert(Math.abs(face.estimate - face.target) <= 1.25, item.name + ' ' + face.slot);
    gains[report.faces.length - 1].push(report.gainPerRoll);
  }
  assert(Math.min(...gains[1]) > Math.max(...gains[0]));
  assert(Math.min(...gains[2]) > Math.max(...gains[1]));
});
