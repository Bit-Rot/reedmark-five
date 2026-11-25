import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, RELICS, ROOMS } from '../src/content.ts';
import { advance, chooseOffer, faceFor, isSave, newLinearRun as newRun, offerTargets, previewDie, restoreSave } from '../src/game.ts';
import type { Slot, Variant } from '../src/model.ts';

const shopRoom = ROOMS.findIndex(room => room.type === 'shop');
const tier: Record<Slot, number> = { left: 0, center: 1, top: 2, bottom: 2, right: 3, far: 3 };
function enterShop(seed: number, character = 'barbarian', variant: Variant = 'fixed') {
  const state = newRun(variant, seed, character);
  state.phase = 'reward';
  state.room = shopRoom - 1;
  state.gold = 120;
  assert(advance(state));
  return state;
}

test('late shop stocks three distinct relics, three hero items, and one directional copy', () => {
  assert.equal(ROOMS[shopRoom - 1].type, 'camp');
  assert.equal(ROOMS[shopRoom + 1].name, 'Mire Brood');
  assert.deepEqual(['common', 'uncommon', 'rare', 'starter'].map(rarity =>
    Object.values(RELICS).filter(relic => relic.rarity === rarity).length), [15, 10, 5, 1]);
  let single = 0;
  let downward = 0;
  for (let i = 0; i < 240; i++) {
    const character = ['barbarian', 'thief', 'moth'][i % 3];
    const state = enterShop(Math.imul(i + 1, 0x9e3779b1) >>> 0, character, i % 2 ? 'pool' : 'fixed');
    assert.equal(state.offers.length, 7);
    const items = state.offers.flatMap(offer => offer.kind === 'item' ? [offer.id] : []);
    const relics = state.offers.flatMap(offer => offer.kind === 'relic' ? [offer.id] : []);
    assert.equal(new Set(items).size, 3);
    assert(items.every(id => ITEMS[id].rewardCharacter === character && ITEMS[id].rarity !== 'rare'));
    assert.equal(new Set(relics).size, 3);
    assert.deepEqual(relics.map(id => RELICS[id].rarity), ['common', 'uncommon', 'common']);
    const copy = state.offers.find(offer => offer.kind === 'faceCopy')!;
    assert(copy);
    assert(offerTargets(state, copy).length);
    const jumps = tier[copy.to] - tier[copy.from];
    assert(Math.abs(jumps) === 1 || Math.abs(jumps) === 2);
    if (Math.abs(jumps) === 1) single++;
    if (jumps > 0) downward++;
  }
  assert(downward > 195 && downward < 232, `expected about 216 downward copies, got ${downward}`);
  assert(single > 155 && single < 205, `expected about 180 one-tier copies, got ${single}`);
});

test('buying is atomic, inventory and remaining stock survive reload, and shoppers choose when to leave', () => {
  const state = enterShop(117);
  state.gold = 35;
  const relic = state.offers[0];
  assert.equal(relic.kind, 'relic');
  const before = JSON.stringify(state);
  assert.equal(chooseOffer(state, 0), false);
  assert.equal(JSON.stringify(state), before);
  state.gold = 60;
  assert(chooseOffer(state, 0));
  assert.equal(state.room, shopRoom);
  assert.equal(state.gold, 24);
  assert.deepEqual(state.relics, [relic.id]);
  assert.equal(state.offers.length, 6);
  assert.deepEqual(restoreSave(JSON.parse(JSON.stringify(state)), 'fixed', true), state);
  assert(advance(state));
  assert.equal(state.phase, 'battle');
  assert.equal(state.gold, 24);
  assert.deepEqual(state.relics, [relic.id]);
  assert(state.combat?.relicTurn);
});

test('copy snapshots the source imprint and camp upgrades and replaces only the destination', () => {
  const state = enterShop(231);
  const die = state.dice[0];
  die.imprints = { left: 'chitin', center: 'nick' };
  die.upgrades = { left: [{ keyword: 'weak', x: 1 }], center: [{ keyword: 'growth', x: 1 }] };
  const copy = { kind: 'faceCopy' as const, from: 'left' as const, to: 'center' as const, price: 23 };
  state.offers = [copy];
  const source = faceFor(die, 'left');
  const preview = previewDie(state, copy, die)!;
  assert.deepEqual(faceFor(preview, 'center'), source);
  assert.equal(die.imprints.center, 'nick');
  assert.equal(chooseOffer(state, 0, 'unknown'), false);
  assert(chooseOffer(state, 0, die.id));
  assert.equal(state.gold, 97);
  const after = state.dice[0];
  assert.equal(after.imprints.center, undefined);
  assert.equal(after.upgrades?.center, undefined);
  assert.deepEqual(faceFor(after, 'left'), source);
  assert.deepEqual(faceFor(after, 'center'), source);
  delete after.imprints.left;
  assert.notDeepEqual(faceFor(after, 'left'), source);
  assert.deepEqual(faceFor(after, 'center'), source);
  assert(isSave(JSON.parse(JSON.stringify(state)), 'fixed'));
  const overwritten = previewDie(state, { kind: 'item', id: 'nick' }, after)!;
  assert.equal(overwritten.copies?.center, undefined);
  assert.equal(faceFor(overwritten, 'center').id, ITEMS.nick.edits.center?.id);
});

test('saves from before the shop was added resume in the same camp, encounter or workshop', () => {
  const before = newRun('fixed', 91, 'moth');
  before.phase = 'reward';
  before.room = shopRoom - 1;
  const camp = restoreSave({ ...before, version: 4 }, 'fixed', true)!;
  assert.equal(ROOMS[camp.room].type, 'camp');
  assert(advance(before) && advance(before));
  const brood = restoreSave({ ...before, version: 4, room: before.room - 1 }, 'fixed', true)!;
  assert.equal(ROOMS[brood.room].name, 'Mire Brood');
  assert.equal(brood.combat?.enemies[0].name, 'Mire Brood');
  assert.equal(brood.version, 5);
  const workshop = restoreSave({ ...brood, version: 4, phase: 'reward', combat: null }, 'fixed', true)!;
  assert.equal(ROOMS[workshop.room].type, 'workshop');
});

test('loading an older shop visit replaces only pending rare offers', () => {
  const old = enterShop(117);
  old.offers[0] = { kind: 'relic', id: 'sixfold-bell', price: 68 };
  old.offers[3] = { kind: 'item', id: 'burr', price: 40 };
  old.relics = ['hollow-prism'];
  old.dice[0].imprints.left = 'burr';
  assert.equal(chooseOffer(old, 0), false);
  assert.equal(chooseOffer(old, 3, 'd0'), false);
  const restored = restoreSave(JSON.parse(JSON.stringify(old)), 'fixed', true)!;
  assert.deepEqual(restored.relics, old.relics);
  assert.equal(restored.dice[0].imprints.left, 'burr');
  assert.equal(restored.gold, old.gold);
  assert.equal(restored.offers.length, 7);
  assert.deepEqual(restored.offers[1], old.offers[1]);
  assert.deepEqual(restored.offers[6], old.offers[6]);
  assert.equal(restored.offers[0].kind, 'relic');
  assert.equal(RELICS[restored.offers[0].id].rarity, 'common');
  assert.equal(restored.offers[3].kind, 'item');
  assert.equal(ITEMS[restored.offers[3].id].rarity, 'common');
});
