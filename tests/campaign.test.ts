import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { BOSS_IDS, CAMPAIGN_FIGHTS, ENCOUNTER_POOLS, EVENTS, nextEncounter, nextEvent } from '../src/campaign-content.ts';
import { BOSS_TURNS, CENTER, CHEST_TURNS, MOUNTAIN_COUNT, bossDue, createCampaign, distance, explorationDistance, frontier, neighbors, visibleTile } from '../src/campaign-map.ts';
import { ITEMS, RELICS } from '../src/content.ts';
import { advance, canTakeEventOffer, chooseOffer, commitRoll, currentRoom, endTurn, explore, isSave, newLinearRun, newRun, restoreSave, startBoss } from '../src/game.ts';
import type { State } from '../src/model.ts';

function finishCombat(state: State): void {
  if (state.phase !== 'battle') return;
  state.combat!.intents = [];
  for (const enemy of state.combat!.enemies) enemy.seep = enemy.hp;
  assert(commitRoll(state) && endTurn(state));
}

function skipRoom(state: State): void {
  finishCombat(state);
  if (state.phase === 'reward') assert(advance(state));
}

test('radius six varies its opening and service placement while keeping the board connected', () => {
  let sawAdjacentServices = false;
  let sawUnevenShops = false;
  let sawMountainDetour = false;
  const openingCounts = new Set<number>();
  for (let seed = 0; seed < 64; seed++) {
    const map = createCampaign(Math.imul(seed, 0x9e3779b1));
    const reachable = frontier(map);
    const paths = explorationDistance(map);
    const tiles = map.tiles.filter(tile => tile.id !== CENTER);
    assert.equal(tiles.length, 126);
    assert.equal(new Set(tiles.map(tile => tile.id)).size, 126);
    const count = (kind: string) => tiles.filter(tile => tile.kind === kind).length;
    assert.deepEqual(['normal', 'event', 'elite', 'camp', 'shop', 'mountain'].map(count), [54, 38, 12, 10, 6, MOUNTAIN_COUNT]);
    assert.equal(reachable.size, 6);
    const events = tiles.filter(tile => reachable.has(tile.id) && tile.kind === 'event').length;
    assert(events >= 2 && events <= 4);
    openingCounts.add(events);
    assert.equal(paths.size, map.tiles.length - MOUNTAIN_COUNT);
    const earlyServices = tiles.filter(tile => (paths.get(tile.id) ?? Infinity) <= 3);
    assert(earlyServices.filter(tile => tile.kind === 'camp').length >= 2);
    assert(earlyServices.some(tile => tile.kind === 'shop'));
    assert(earlyServices.some(tile => tile.kind === 'elite'));
    const shopsBySector = Array.from({ length: 6 }, (_, sector) =>
      tiles.filter(tile => tile.sector === sector && tile.kind === 'shop').length);
    sawUnevenShops ||= shopsBySector.includes(0) && shopsBySector.some(n => n >= 2);
    const services = new Set(tiles.filter(tile => ['shop', 'camp', 'elite'].includes(tile.kind)).map(tile => tile.id));
    for (const tile of tiles) {
      const shown = visibleTile(tile, reachable);
      if (!reachable.has(tile.id) && (tile.kind === 'normal' || tile.kind === 'event')) assert.equal(shown, 'unknown');
      if (tile.kind === 'mountain') {
        assert.equal(shown, 'mountain');
        assert(!reachable.has(tile.id) && !paths.has(tile.id));
      } else {
        sawMountainDetour ||= paths.get(tile.id)! > distance(tile);
      }
      if (services.has(tile.id)) sawAdjacentServices ||= neighbors(tile).some(neighbor => services.has(neighbor));
    }
  }
  assert.deepEqual([...openingCounts].sort(), [2, 3, 4]);
  assert(sawAdjacentServices && sawUnevenShops && sawMountainDetour);
});

test('a mountain stays impassable after exploring next to it and reloading', () => {
  const state = newRun('fixed', 31);
  const map = state.map!;
  const mountain = map.tiles.find(tile => tile.kind === 'mountain' && distance(tile) === 2);
  assert(mountain);
  const step = neighbors(mountain).find(id => frontier(map).has(id));
  assert(step && explore(state, step));
  skipRoom(state);
  const restored = restoreSave(JSON.parse(JSON.stringify(state)), 'fixed')!;
  assert(!frontier(restored.map!).has(mountain.id));
  assert(!explorationDistance(restored.map!).has(mountain.id));
  assert.equal(explore(restored, mountain.id), false);
  assert.equal(restored.map!.turn, 1);
});

test('a complete route uses 45 hexes, drops three waves, and fully heals after the first two bosses', () => {
  const state = newRun('fixed', 231, 'moth');
  const map = state.map!;
  assert.equal(state.phase, 'map');
  assert.equal(explore(state, CENTER), false);
  for (let turn = 1; turn <= 48; turn++) {
    assert.equal(map.turn, turn - 1);
    assert.equal(restoreSave(JSON.parse(JSON.stringify(state)), 'fixed')?.map?.turn, map.turn);
    if (CHEST_TURNS.some(t => t === turn)) {
      const drops = map.tiles.filter(tile => tile.chest !== undefined);
      assert.equal(drops.length, 3);
      assert.equal(new Set(drops.map(tile => tile.sector)).size, 3);
      const paths = explorationDistance(map);
      assert(drops.some(tile => paths.get(tile.id)! <= 5));
    }
    const reachable = frontier(map);
    const target = map.tiles.find(tile => reachable.has(tile.id))!;
    assert(target);
    if (BOSS_TURNS.some(t => t === turn)) {
      assert(bossDue(map));
      assert.equal(explore(state, target.id), false);
      const last = map.last;
      assert(startBoss(state));
      assert.equal(map.last, last);
      assert(map.tiles.every(tile => tile.chest === undefined));
      assert.equal(currentRoom(state).name, CAMPAIGN_FIGHTS[BOSS_IDS[turn / 16 - 1]].name);
      state.hp = 19;
      finishCombat(state);
      assert.equal(state.phase, turn === 48 ? 'victory' : 'reward');
      if (turn === 48) break;
      assert.equal(state.hp, state.maxHp);
      assert.equal(RELICS[state.bossSpoils!.relic!].rarity, 'rare');
      assert(state.relics?.includes(state.bossSpoils!.relic!));
      assert.equal(state.offers[0].kind, 'item');
      if (state.offers[0].kind === 'item') assert.equal(ITEMS[state.offers[0].id].rarity, 'rare');
      assert.equal(restoreSave(JSON.parse(JSON.stringify(state)), 'fixed')?.offers.length, 1);
      if (turn === 16) {
        assert(chooseOffer(state, 0, state.dice[0].id));
        assert(Object.keys(state.dice[0].imprints).length);
      } else assert(advance(state));
    } else {
      assert.equal(startBoss(state), false);
      assert(explore(state, target.id));
      assert.equal(explore(state, target.id), false);
      const room = currentRoom(state);
      finishCombat(state);
      if (room.type === 'battle') assert(state.offers.length > 0);
      for (const offer of state.offers) {
        if (offer.kind === 'relic') assert.notEqual(RELICS[offer.id].rarity, 'rare');
        if (offer.kind === 'item') assert.notEqual(ITEMS[offer.id].rarity, 'rare');
      }
      assert(advance(state));
      assert.equal(explore(state, target.id), false);
    }
  }
  assert.equal(map.tiles.filter(tile => tile.visited).length, 46);
  assert.equal(state.phase, 'victory');
  assert.equal(isSave(JSON.parse(JSON.stringify(state)), 'fixed'), true);
});

test('treasure stays put through reload and grants gold and an unowned relic once', () => {
  let state = newRun('fixed', 31);
  while (state.map!.turn < 4) {
    assert(explore(state, [...frontier(state.map!)][0]));
    skipRoom(state);
  }
  const beforeDrops = state.map!.tiles.filter(tile => tile.chest !== undefined).map(tile => tile.id);
  state = restoreSave(JSON.parse(JSON.stringify(state)), 'fixed')!;
  assert.deepEqual(state.map!.tiles.filter(tile => tile.chest !== undefined).map(tile => tile.id), beforeDrops);
  while (currentRoom(state).type !== 'treasure') {
    const map = state.map!;
    const currentFrontier = frontier(map);
    const costs = explorationDistance(map);
    const chest = map.tiles.filter(tile => tile.chest !== undefined).sort((a, b) => costs.get(a.id)! - costs.get(b.id)!)[0];
    const candidate = map.tiles.find(tile => currentFrontier.has(tile.id)
      && Math.max(Math.abs(tile.q - chest.q), Math.abs(tile.r - chest.r), Math.abs(tile.q + tile.r - chest.q - chest.r)) === costs.get(chest.id)! - 1);
    assert(candidate);
    const gold = state.gold;
    assert(explore(state, candidate.id));
    if (map.active?.kind !== 'treasure') { skipRoom(state); continue; }
    assert(map.active.gold >= 10 && map.active.gold <= 15);
    assert.equal(state.gold, gold + map.active.gold);
    assert(map.active.relic && state.relics?.includes(map.active.relic));
    const saved = restoreSave(JSON.parse(JSON.stringify(state)), 'fixed')!;
    assert.equal(saved.gold, state.gold);
    assert.deepEqual(saved.relics, state.relics);
    assert(advance(saved));
    assert.equal(explore(saved, candidate.id), false);
  }
});

test('a targeted event validates its cost and die before applying anything', () => {
  const state = newRun('fixed', 19);
  const map = state.map!;
  map.eventBag = ['mirror'];
  const open = map.tiles.find(tile => tile.kind === 'event' && frontier(map).has(tile.id))!;
  assert(explore(state, open.id));
  assert.equal(currentRoom(state).name, 'Broken Mirror');
  assert.equal(state.offers[0].kind, 'faceCopy');
  state.hp = 5;
  assert.equal(canTakeEventOffer(state, 0), false);
  state.hp = 20;
  const saved = JSON.stringify(state);
  assert.equal(chooseOffer(state, 0, 'missing'), false);
  assert.equal(JSON.stringify(state), saved);
  assert(state.dice.some(die => chooseOffer(state, 0, die.id)));
  assert.equal(state.hp, 15);
  assert.equal(state.phase, 'map');
  assert.equal(map.turn, 1);
  assert(state.dice.some(die => Object.keys(die.copies ?? {}).length === 1));
});

test('encounter and event bags have enough variety and use existing sprite assets', () => {
  const map = createCampaign(231);
  for (const [cycle, pool] of ENCOUNTER_POOLS.entries()) {
    assert.equal(pool.normal.length, 10);
    assert.equal(pool.elite.length, 3);
    const normals = pool.normal.map(() => nextEncounter(map, cycle, 'normal'));
    assert.equal(new Set(normals).size, 10);
    assert.notEqual(nextEncounter(map, cycle, 'normal'), normals.at(-1));
    const elites = pool.elite.map(() => nextEncounter(map, cycle, 'elite'));
    assert.equal(new Set(elites).size, 3);
  }
  const events = Object.keys(EVENTS).map(() => nextEvent(map));
  assert.equal(new Set(events).size, 15);
  assert.notEqual(nextEvent(map), events.at(-1));
  for (const fight of Object.values(CAMPAIGN_FIGHTS)) {
    assert.equal(fight.dice.length, 5);
    for (const enemy of fight.enemies) assert(existsSync('src/art/' + enemy.sprite + '.webp'));
  }
  assert.equal(restoreSave(newLinearRun('fixed', 231), 'fixed'), null);
  assert.equal(restoreSave(newRun('pool', 231), 'pool')?.phase, 'battle');
  assert.deepEqual(newRun('fixed', 231), newRun('fixed', 231));
});
