import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS } from '../src/content.ts';
import { actionPreview, advance, combatFaceFor, commitRoll, endTurn, isSave, mainPips, newLinearRun as newRun, play, reroll, rollFace, starterRelicFor } from '../src/game.ts';
import type { Slot } from '../src/model.ts';

const self = { kind: 'self' } as const;
const enemy = { kind: 'enemy', id: 'gnat-a' } as const;
const all = { kind: 'all' } as const;

function mothFight(slots: Slot[]) {
  const state = newRun('fixed', 231, 'moth');
  const combat = state.combat!;
  combat.enemies.forEach(foe => { foe.hp = foe.maxHp = 50; });
  combat.intents = [];
  slots.forEach((slot, index) => { combat.rolls[index].slot = slot; });
  assert(commitRoll(state));
  return { state, combat };
}

test('Moth starts with Lampheart, two signature blanks, and exactly 20 character rewards', () => {
  const { state } = mothFight([]);
  assert.equal(starterRelicFor(state)?.name, 'Lampheart');
  assert.equal(state.combat!.frenzy, 0);
  const lantern = state.dice[4];
  assert.equal(combatFaceFor(state, lantern, 'right').target, 'none');
  assert.equal(combatFaceFor(state, lantern, 'far').target, 'none');
  const pool = Object.values(ITEMS).filter(item => item.rewardCharacter === 'moth');
  assert.deepEqual(['common', 'uncommon', 'rare'].map(rarity => pool.filter(item => item.rarity === rarity).length), [7, 8, 5]);
});

test('Burn ticks on each side, spends Block, and grants Frenzy through fully blocked damage', () => {
  const { state, combat } = mothFight(['left', 'far', 'left', 'left', 'left']);
  state.dice[1].imprints.far = 'cinder-needle';
  const foe = combat.enemies[0];
  foe.burn = 1;
  combat.intents = [
    { owner: foe.id, move: 'hit', value: 2 },
    { owner: foe.id, move: 'hit', value: 2 },
    { owner: foe.id, move: 'guard', value: 1 },
  ];
  assert.equal(mainPips(rollFace(state, combat.rolls[4])), 3);
  assert(play(state, 'd2', self));
  assert(play(state, 'd3', self));
  assert.equal(combat.burn, 2);
  assert.equal(combat.frenzy, 0);
  assert.equal(mainPips(rollFace(state, combat.rolls[4])), 6);
  assert(play(state, 'd4', enemy));
  assert(play(state, 'd1', enemy));
  assert.equal(foe.hp, 44);
  assert.equal(foe.burn, 2);

  assert(endTurn(state));
  assert.equal(state.hp, state.maxHp);
  assert.equal(combat.burn, 1);
  assert.equal(combat.frenzy, 2);
  assert.equal(foe.burn, 1);
  assert.equal(foe.hp, 43);
  assert.equal(foe.guard, 0);

  foe.weak = 1;
  foe.seep = 1;
  combat.intents = [{ owner: foe.id, move: 'hit', value: 1 }];
  combat.guard = 1;
  assert(commitRoll(state));
  assert(endTurn(state));
  assert.equal(state.hp, state.maxHp);
  assert.equal(combat.burn, 0);
  assert.equal(combat.frenzy, 3);
  assert.equal(foe.hp, 41);
});

test('Exhaust powers this-turn and blank-count faces, persists through a save, and resets next fight', () => {
  const { state, combat } = mothFight(['top', 'far', 'center', 'right', 'top']);
  state.dice[0].imprints = { top: 'shed-silk', bottom: 'hollow-pin' };
  state.dice[1].imprints.far = 'hush-bell';
  state.dice[2].imprints.center = 'empty-lantern';
  state.dice[4].imprints.right = 'smolderglass';
  const pips = (die: number, slot: Slot) => mainPips(combatFaceFor(state, state.dice[die], slot));

  assert.equal(pips(0, 'bottom'), 2);
  assert.equal(pips(1, 'far'), 1);
  assert.equal(pips(2, 'center'), 3);
  assert(play(state, 'd0', self));
  assert(play(state, 'd4', enemy));
  assert.equal(combatFaceFor(state, state.dice[0], 'top').target, 'none');
  assert.equal(pips(0, 'bottom'), 3);
  assert.equal(pips(1, 'far'), 4);
  assert.equal(pips(2, 'center'), 5);
  assert(endTurn(state));
  assert.equal(pips(1, 'far'), 1);
  assert.equal(pips(2, 'center'), 5);
  combat.exerted.d3 = combat.turn;
  assert.equal(pips(2, 'center'), 5);
  assert(isSave(JSON.parse(JSON.stringify(state)), 'fixed'));

  state.phase = 'reward';
  combat.frenzy = 4;
  assert(advance(state));
  assert.equal(state.combat!.frenzy, 0);
  assert.equal(pips(0, 'top'), 5);
  assert.equal(pips(2, 'center'), 3);
});

test('Frenzy thresholds react to spending, and a cleaved Backdraft spends one shared total', () => {
  const { state, combat } = mothFight(['far', 'top', 'left', 'center', 'bottom']);
  state.dice[0].imprints.far = 'ember-guard';
  state.dice[1].imprints.top = 'rattle-comb';
  state.dice[2].imprints.left = 'backdraft';
  state.dice[2].upgrades = { left: [{ keyword: 'cleave' }] };

  combat.frenzy = 0;
  assert.equal(mainPips(rollFace(state, combat.rolls[0])), 1);
  combat.frenzy = 3;
  assert.equal(mainPips(rollFace(state, combat.rolls[1])), 6);
  const forecast = actionPreview(state, 'd0', enemy)!;
  assert.equal(forecast.frenzy, 2);
  assert.equal(forecast.enemies[0].hp, 47);
  assert.equal(combat.frenzy, 3);
  assert(play(state, 'd0', enemy));
  assert.equal(combat.frenzy, 2);
  assert.equal(mainPips(rollFace(state, combat.rolls[1])), 3);
  assert(play(state, 'd2', all));
  assert.equal(combat.frenzy, 0);
  assert.deepEqual(combat.enemies.map(foe => foe.hp), [40, 43]);
});

test('Nectar Flask grants Block once per fight and previews without restoring HP', () => {
  const { state, combat } = mothFight(['right']);
  state.hp -= 2;
  state.dice[0].imprints.right = 'nectar-flask';
  const forecast = actionPreview(state, 'd0', self)!;
  assert.equal(forecast.playerHp, state.hp);
  assert.equal(forecast.guard, 4);
  assert.equal(forecast.exhausted?.['d0:right'], combat.turn);
  assert.equal(state.hp, state.maxHp - 2);
  assert.equal(combat.guard, 0);
  assert.equal(combat.exhausted, undefined);
  assert(play(state, 'd0', self));
  assert.equal(state.hp, state.maxHp - 2);
  assert.equal(combat.guard, 4);
  assert(endTurn(state));
  combat.rolls[0].slot = 'right';
  assert(commitRoll(state));
  assert.equal(play(state, 'd0', self), false);
});

test('Burn sequencing counts earlier manual applications, including Self Burn, and resets each turn', () => {
  const { state, combat } = mothFight(['far', 'right', 'top', 'center', 'center']);
  state.dice[0].imprints.far = 'cinder-needle';
  state.dice[1].imprints.right = 'flashwing';
  state.dice[2].imprints.top = 'wick-wrap';
  state.dice[3].imprints.center = 'molt-plate';
  state.dice[4].imprints.center = 'hush-bell';
  const pips = (index: number) => mainPips(rollFace(state, combat.rolls[index]));

  assert.equal(rollFace(state, combat.rolls[0]).parts[0].value, 2);
  assert.equal(pips(1), 1);
  assert.equal(pips(3), 5);
  const forecast = actionPreview(state, 'd0', enemy)!;
  assert.equal(forecast.enemies[0].burn, 2);
  assert.equal(forecast.sequence?.burnPlays, 1);
  assert.equal(combat.sequence?.burnPlays ?? 0, 0);
  assert(play(state, 'd0', enemy));
  assert.equal(pips(3), 7);
  assert(play(state, 'd2', self));
  assert.equal(combat.burn, 1);
  assert.equal(combat.sequence?.burnPlays, 2);
  assert.equal(pips(1), 3);
  assert.equal(pips(4), 7);
  assert(play(state, 'd4', self));
  assert.equal(pips(3), 5);
  assert.equal(combat.sequence?.burnPlays, 2);
  assert(endTurn(state));
  assert.equal(combat.sequence, undefined);
});

test('Burn from a Cantrip leaves the manual first-Burn bonus available', () => {
  const state = newRun('fixed', 231, 'moth');
  const combat = state.combat!;
  state.dice[0].imprints.far = 'cinder-needle';
  state.dice[0].upgrades = { far: [{ keyword: 'cantrip' }] };
  combat.rolls.forEach(roll => { roll.held = roll.dieId !== 'd0'; });
  state.combatRng = 750;
  assert(reroll(state));
  assert.equal(combat.rolls[0].slot, 'far');
  const burn = () => combat.enemies.reduce((total, foe) => total + (foe.burn ?? 0), 0);
  assert.equal(burn(), 1);
  assert.equal(combat.sequence?.burnPlays ?? 0, 0);
  assert.equal(rollFace(state, combat.rolls[0]).parts[0].value, 2);
  assert(commitRoll(state));
  assert(play(state, 'd0', enemy));
  assert.equal(burn(), 3);
  assert.equal(combat.sequence?.burnPlays, 1);
});

test('a wide Burn counts once and a lethal hit that skips Burn breaks adjacency', () => {
  const { state, combat } = mothFight(['far', 'center', 'top']);
  state.dice[0].imprints.far = 'cinder-veil';
  state.dice[1].imprints.center = 'soot-stitch';
  state.dice[2].imprints.top = 'cinder-clamp';
  assert(play(state, 'd0', all));
  assert.deepEqual(combat.enemies.map(foe => foe.burn), [2, 2]);
  assert.equal(combat.sequence?.burnPlays, 1);
  assert.equal(rollFace(state, combat.rolls[2]).parts[0].value, 2);
  combat.enemies[0].hp = 2;
  assert(play(state, 'd1', enemy));
  assert.equal(combat.sequence?.burnPlays, 1);
  assert.equal(combat.sequence?.lastBurn, false);
});

test('Pair and Trio share unmultiplied history with Echo, and full HP is checked per target', () => {
  const { state, combat } = mothFight(['right', 'right', 'right', 'bottom', 'left']);
  state.dice[1].imprints.right = 'reed-splint';
  state.dice[2].imprints.right = 'rattle-comb';
  state.dice[3].imprints.bottom = 'kiln-latch';
  state.dice[4].imprints.left = 'scorch-husk';
  const ready = (index: number, kind: string) => !!rollFace(state, combat.rolls[index]).parts.find(part => part.kind === kind)?.active;
  assert.equal(ready(1, 'pair'), false);
  assert.equal(mainPips(rollFace(state, combat.rolls[3])), 2);
  assert(play(state, 'd0', enemy));
  assert.equal(ready(1, 'pair'), true);
  assert.equal(ready(2, 'trio'), false);
  assert(play(state, 'd1', enemy));
  assert.equal(combat.enemies[0].hp, 47);
  assert.deepEqual(combat.sequence?.pips, [1, 1]);
  assert.equal(ready(2, 'trio'), true);
  assert(play(state, 'd2', enemy));
  assert.equal(combat.enemies[0].hp, 44);
  assert.equal(mainPips(rollFace(state, combat.rolls[3])), 1);

  const fresh = { kind: 'enemy', id: 'gnat-b' } as const;
  const foe = combat.enemies[1];
  foe.guard = 2;
  foe.burn = 2;
  assert.equal(actionPreview(state, 'd4', enemy)?.enemies[0].hp, 40);
  assert.equal(actionPreview(state, 'd4', fresh)?.enemies[1].hp, 44);
  assert(play(state, 'd4', fresh));
  assert.equal(foe.hp, 44);
  assert.equal(mainPips(rollFace(state, combat.rolls[3])), 4);
  assert(play(state, 'd3', self));
  assert.equal(combat.guard, 4);
});

test('the Self Burn finisher previews the cash-out and removes it from later faces', () => {
  const { state, combat } = mothFight(['far', 'center']);
  state.dice[0].imprints.far = 'smolderglass';
  state.dice[1].imprints.center = 'flashwing';
  combat.burn = 3;
  assert.equal(mainPips(rollFace(state, combat.rolls[1])), 8);
  const forecast = actionPreview(state, 'd0', enemy)!;
  assert.equal(forecast.enemies[0].hp, 46);
  assert.equal(forecast.burn, 0);
  assert.equal(combat.burn, 3);
  assert(play(state, 'd1', enemy));
  assert(play(state, 'd0', enemy));
  assert.equal(combat.enemies[0].hp, 38);
  assert.equal(combat.burn, 0);
  assert.equal(mainPips(rollFace(state, combat.rolls[1])), 5);
});
