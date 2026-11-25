import { BLANK_IMAGE, CAMP_UPGRADES, CHARACTERS, DICE, ITEMS, RELICS, ROOMS } from './content.ts';
import { BOSS_IDS, CAMPAIGN_FIGHTS, EVENTS, nextEncounter, nextEvent } from './campaign-content.ts';
import { BOSS_TURNS, CENTER, RADIUS, TILE_TYPES, bossDue, createCampaign, cycleAt, distance, frontier, revealTreasureWave } from './campaign-map.ts';
import type { EventChoice } from './campaign-content.ts';
import { addKeywordToFace } from './data/runtime.ts';
import { SLOTS } from './model.ts';
import { afterRelicFace, claimTurnRelic, commitRelics, compassTarget, endRelicTurn, relicPips, relicsOnHpDamage, startRelicTurn } from './relics.ts';
import type { Combat, CopiedFace, Die, Encounter, Enemy, Face, FaceCopyOffer, Intent, Offer, Part, Rarity, Roll, Room, Slot, State, Target, Variant } from './model.ts';

/** What an exerted die or exhausted slot shows. */
export const BLANK_FACE: Face = { target: 'none', parts: [{ kind: 'blank', value: 0 }], ...(BLANK_IMAGE ? { image: BLANK_IMAGE } : {}) };
const BLANK = BLANK_FACE;
export const BASE_REROLLS = 3;
const SHOP_ROOM = ROOMS.findIndex(room => room.type === 'shop');
const encounterIndex = (room: number) => room > SHOP_ROOM ? room - 1 : room;
const DISCOVERIES = Object.keys(DICE).filter(id =>
  !CHARACTERS.some(hero => hero.starterRelic && hero.starterDice.includes(id))
  || CHARACTERS.some(hero => !hero.starterRelic && hero.starterDice.includes(id)));

export const starterRelicFor = (state: Pick<State, 'character'>) =>
  CHARACTERS.find(hero => hero.id === state.character)?.starterRelic;

function step(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function pick(state: State, length: number, stream: 'rng' | 'combatRng' = 'rng'): number {
  state[stream] = step(state[stream]);
  return Math.floor(state[stream] / 4294967296 * length);
}

function shuffled<T>(values: T[], state: State): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(state, i + 1, 'combatRng');
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const newDie = (template: string, index: number): Die => ({ id: `d${index}`, template, imprints: {} });

function initialState(variant: Variant, seed: number, character: string): State {
  const hero = CHARACTERS.find(c => c.id === character) ?? CHARACTERS[0];
  // Dice Pool starts with ten dice: the character's five, twice.
  const ids = variant === 'fixed' ? hero.starterDice : [...hero.starterDice, ...hero.starterDice];
  const state: State = {
    version: 5, character: hero.id, variant, seed: seed >>> 0, rng: (seed ^ 0x6bdc) >>> 0, combatRng: 0,
    room: 0, hp: 44, maxHp: 44, gold: 0, lastGold: 0, nextDie: ids.length, dice: ids.map(newDie), phase: 'battle',
    combat: null, offers: [],
  };
  return state;
}

export function newLinearRun(variant: Variant, seed: number, character = CHARACTERS[0].id): State {
  const state = initialState(variant, seed, character);
  enterRoom(state);
  return state;
}

export function newRun(variant: Variant, seed: number, character = CHARACTERS[0].id): State {
  if (variant === 'pool') return newLinearRun(variant, seed, character);
  const state = initialState(variant, seed, character);
  state.version = 6;
  state.map = createCampaign(state.seed);
  state.phase = 'map';
  return state;
}

export function currentRoom(state: State): Room {
  if (!state.map) return ROOMS[state.room];
  const active = state.map.active;
  if (!active) return { type: 'map', name: 'Reedmark' };
  if (active.kind === 'encounter') return CAMPAIGN_FIGHTS[active.id];
  if (active.kind === 'event') return { type: 'event', name: EVENTS[active.id].name };
  if (active.kind === 'shop') return { type: 'shop', name: 'Shop' };
  if (active.kind === 'camp') return { type: 'camp', name: 'Campfire' };
  return { type: 'treasure', name: 'Treasure' };
}

export function explore(state: State, id: string): boolean {
  const map = state.map;
  if (state.phase !== 'map' || !map || map.turn >= 48 || bossDue(map) || !frontier(map).has(id)) return false;
  const tile = map.tiles.find(tile => tile.id === id)!;
  tile.visited = true;
  map.last = id;
  map.turn++;
  if (tile.chest !== undefined) {
    const wave = tile.chest;
    delete tile.chest;
    const gold = 10 + pick(state, 6);
    const rarity = pick(state, 100) < [80, 70, 60][wave] ? 'common' : 'uncommon';
    const relic = randomRelic(state, rarity) ?? randomRelic(state, rarity === 'common' ? 'uncommon' : 'common');
    state.gold += gold;
    if (relic) (state.relics ??= []).push(relic);
    map.active = { kind: 'treasure', gold, ...(relic ? { relic } : {}) };
  } else if (tile.kind === 'normal' || tile.kind === 'elite') {
    map.active = { kind: 'encounter', id: nextEncounter(map, cycleAt(map.turn), tile.kind) };
  } else if (tile.kind === 'event') {
    map.eventVisits++;
    map.active = { kind: 'event', id: nextEvent(map), choiceIndexes: [] };
  } else {
    map.active = { kind: tile.kind };
  }
  enterRoom(state);
  return true;
}

export function startBoss(state: State): boolean {
  const map = state.map;
  if (state.phase !== 'map' || !map || !bossDue(map)) return false;
  map.turn++;
  map.eventVisits = 0;
  for (const tile of map.tiles) delete tile.chest;
  map.active = { kind: 'encounter', id: BOSS_IDS[cycleAt(map.turn)] };
  enterRoom(state);
  return true;
}

export function restoreSave(data: unknown, variant: Variant, allowLinearFixed = false): State | null {
  if (variant === 'fixed' && !allowLinearFixed && (!data || typeof data !== 'object' || !('version' in data) || data.version !== 6)) return null;
  if (data && typeof data === 'object' && 'version' in data && data.version === 4
    && 'room' in data && typeof data.room === 'number' && Number.isInteger(data.room)) {
    data = { ...data, version: 5, room: data.room >= SHOP_ROOM ? data.room + 1 : data.room };
  }
  if (!isSave(data, variant)) return null;
  const room = currentRoom(data);
  const bossReward = !!data.map && room.type === 'battle' && room.rank === 'boss';
  return !bossReward && data.phase === 'reward' && data.offers.some(isRareOffer) ? replaceRareOffers(data) : data;
}

export function isSave(data: unknown, variant: Variant): data is State {
  if (!data || typeof data !== 'object') return false;
  const save = data as State;
  try {
    const validRoute = save.version === 5
      ? !save.map && Number.isInteger(save.room) && !!ROOMS[save.room] && save.phase !== 'map'
      : save.version === 6 && save.variant === 'fixed' && validCampaignSave(save);
    return validRoute && Number.isInteger(save.gold) && save.gold >= 0 && Number.isInteger(save.lastGold) && save.variant === variant && CHARACTERS.some(c => c.id === save.character) && Number.isInteger(save.seed)
      && Number.isFinite(save.hp)
      && ['map', 'battle', 'reward', 'victory', 'defeat'].includes(save.phase)
      && (save.relics === undefined || (Array.isArray(save.relics) && new Set(save.relics).size === save.relics.length
        && save.relics.every(id => RELICS[id] && RELICS[id].rarity !== 'starter')))
      && Array.isArray(save.dice) && save.dice.length >= 5
      && new Set(save.dice.map(die => die.id)).size === save.dice.length
      && save.dice.every(die => DICE[die.template] && die.imprints
        && (!die.upgrades || Object.entries(die.upgrades).every(([slot, list]) => SLOTS.includes(slot as Slot) && Array.isArray(list)))
        && Object.entries(die.imprints).every(([slot, item]) => ITEMS[item]?.edits[slot as Slot])
        && Object.entries(die.copies ?? {}).every(([slot, face]) => SLOTS.includes(slot as Slot) && DICE[face.template]
          && SLOTS.includes(face.slot) && (!face.item || ITEMS[face.item]?.edits[face.slot])
          && (face.upgrades === undefined || Array.isArray(face.upgrades))))
      && Array.isArray(save.offers)
      && (save.phase !== 'battle' || (save.combat?.rolls.length === 5 && save.combat.intents.length === 5
        && save.combat.rolls.every(roll => save.dice.some(die => die.id === roll.dieId) && SLOTS.includes(roll.slot))));
  } catch {
    return false;
  }
}

function validCampaignSave(state: State): boolean {
  const map = state.map;
  if (!map || !Array.isArray(map.tiles) || map.tiles.length !== 127 || !Number.isInteger(map.turn) || map.turn < 0 || map.turn > 48
    || !map.tiles.some(tile => tile.id === map.last && tile.visited)
    || !map.tiles.some(tile => tile.id === CENTER && tile.visited)
    || new Set(map.tiles.map(tile => tile.id)).size !== 127
    || !map.tiles.every(tile => Number.isInteger(tile.q) && Number.isInteger(tile.r) && tile.id === tile.q + ',' + tile.r
      && distance(tile) <= RADIUS && TILE_TYPES.includes(tile.kind) && typeof tile.visited === 'boolean'
      && (tile.chest === undefined || (Number.isInteger(tile.chest) && tile.chest >= 0 && tile.chest < 3
        && !tile.visited && (tile.kind === 'normal' || tile.kind === 'event'))))
    || ![map.dropRng, map.encounterRng, map.eventRng, map.eventVisits, map.wave].every(Number.isInteger)
    || map.eventVisits < 0 || map.wave < 0 || map.wave > 3
    || !map.encounterBags || !Array.isArray(map.eventBag) || !Array.isArray(map.sectorDrops) || map.sectorDrops.length !== 6) return false;
  const explored = map.turn - BOSS_TURNS.filter(turn => turn <= map.turn).length + 1;
  if (map.tiles.filter(tile => tile.visited).length !== explored) return false;
  if (state.phase === 'map') return map.active === null && map.turn < 48;
  const active = map.active;
  if (!active) return false;
  if (state.phase !== 'reward' && active.kind !== 'encounter') return false;
  if (active.kind === 'encounter') return !!CAMPAIGN_FIGHTS[active.id];
  if (active.kind === 'event') return !!EVENTS[active.id] && Array.isArray(active.choiceIndexes);
  return active.kind === 'shop' || active.kind === 'camp' || active.kind === 'treasure';
}

function battleNumber(state: State): number {
  return state.map?.turn ?? encounterIndex(state.room) + 1;
}

function enterRoom(state: State): void {
  const room = currentRoom(state);
  state.offers = [];
  state.combat = null;
  if (room.type === 'battle') {
    const enemies: Enemy[] = room.enemies.map(enemy => ({ ...enemy, maxHp: enemy.hp, guard: 0, seep: 0, power: 0, vulnerable: 0, weak: 0 }));
    state.phase = 'battle';
    state.combatRng = step((state.seed ^ Math.imul(battleNumber(state), 0x90ad)) >>> 0);
    state.combat = {
      turn: 0, phase: 'roll', rerolls: BASE_REROLLS, enemies, intents: [], rolls: [], bag: [], guard: 0, ward: 0, exerted: {}, grown: {}, previous: null, events: [],
    };
    if (starterRelicFor(state)?.effect === 'frenzyOnDamage') state.combat.frenzy = 0;
    startTurn(state, room, state.combat);
    if (state.combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  } else {
    state.phase = 'reward';
    if (room.type === 'shop') {
      state.offers = shopStock(state);
    } else if (room.type === 'workshop' && state.variant === 'pool') {
      state.offers = [{ kind: 'transform', id: discovery(state) }, { kind: 'remove' }];
    } else if (room.type === 'event' && state.map?.active?.kind === 'event') {
      const active = state.map.active;
      for (const [index, choice] of EVENTS[active.id].choices.entries()) {
        const offer = prepareEventOffer(state, choice);
        if (!offer) continue;
        state.offers.push(offer);
        active.choiceIndexes.push(index);
      }
    } else if (room.type === 'camp') {
      state.offers = [{ kind: 'heal' }, { kind: 'upgrade', ...CAMP_UPGRADES[pick(state, CAMP_UPGRADES.length)] }];
    } else if (room.type === 'workshop') {
      state.offers = itemOffers(state, 3);
    }
  }
}

function drawDice(state: State, combat: Combat): string[] {
  if (state.variant === 'fixed') return state.dice.map(die => die.id);
  const selected: string[] = [];
  while (selected.length < 5) {
    if (!combat.bag.length) combat.bag = shuffled(state.dice.map(die => die.id), state);
    const index = combat.bag.findIndex(id => !selected.includes(id));
    if (index < 0) throw new Error('Bag cannot complete this draw');
    selected.push(combat.bag.splice(index, 1)[0]);
  }
  return selected;
}

function startTurn(state: State, room: Encounter, combat: Combat): void {
  combat.turn++;
  combat.previous = null;
  combat.phase = 'roll';
  combat.rerolls = BASE_REROLLS;
  combat.guard = combat.ward;
  combat.ward = 0;
  startRelicTurn(state, combat);
  const boss = combat.enemies[0];
  const dice = room.phaseTwo && boss.hp <= boss.maxHp / 2 ? room.phaseTwo : room.dice;
  let enemySeed = step((state.seed ^ Math.imul(battleNumber(state), 0x5bd1e995) ^ Math.imul(combat.turn, 0x3a005a03)) >>> 0);
  const survivor = combat.enemies.find(enemy => enemy.hp > 0)!;
  combat.intents = dice.map(die => {
    enemySeed = step(enemySeed);
    const owner = combat.enemies[die.owner];
    if (owner.hp <= 0) return { owner: survivor.id, move: 'wait', value: 0 };
    const [move, value] = die.faces[Math.floor(enemySeed / 4294967296 * 6)];
    return { owner: owner.id, move, value };
  });
  combat.rolls = drawDice(state, combat).map(dieId => ({
    dieId, slot: SLOTS[pick(state, 6, 'combatRng')], held: false, used: false, boost: 0, salvaged: false,
  }));
  fireCantrips(state, combat, combat.rolls);
}

function describe(face: Face): string {
  const names: Record<string, string> = { hit: 'damage', guard: 'block', seep: 'poison', vulnerable: 'vulnerable', weak: 'weak', burn: 'enemy Burn', selfBurn: 'self Burn', heal: 'healing' };
  return face.parts.filter(part => names[part.kind]).map(part => `${part.value} ${names[part.kind]}`).join(', ');
}

/** Cantrips fire when they land face-up: random target, the die stays usable and can still be rerolled. */
function fireCantrips(state: State, combat: Combat, rolls: Roll[]): void {
  combat.events = [];
  for (const roll of rolls) {
    const face = rollFace(state, roll);
    if (!face.parts.some(part => part.kind === 'cantrip')) continue;
    const parts = face.parts.filter(part => part.kind !== 'exert' && part.kind !== 'cantrip');
    let enemy: Enemy | undefined;
    if (face.target === 'enemy') {
      const alive = combat.enemies.filter(e => e.hp > 0);
      if (!alive.length) continue;
      enemy = alive[pick(state, alive.length, 'combatRng')];
    } else if (face.target === 'all') {
      if (combat.enemies.every(e => e.hp <= 0)) continue;
      applyToAll(state, roll, parts);
      combat.events.push(`Cantrip: ${describe(face)} on all enemies`);
      continue;
    } else if (face.target !== 'self') continue;
    applyParts(state, roll, parts, enemy, undefined);
    combat.events.push(`Cantrip: ${describe(face)}${enemy ? ` on ${enemy.name}` : ''}`);
  }
}

export function facesFor(die: Die, state?: State): Record<Slot, Face> {
  return Object.fromEntries(SLOTS.map(slot => [slot, state ? combatFaceFor(state, die, slot) : faceFor(die, slot)])) as Record<Slot, Face>;
}

function snapshotFace(die: Die, slot: Slot): CopiedFace {
  const source = die.copies?.[slot] ?? { template: die.template, slot, item: die.imprints[slot] };
  return { ...source, upgrades: [...(source.upgrades ?? []), ...(die.upgrades?.[slot] ?? [])] };
}

export function faceFor(die: Die, slot: Slot): Face {
  const copy = die.copies?.[slot];
  const sourceSlot = copy?.slot ?? slot;
  const item = copy ? copy.item : die.imprints[slot];
  let face = (item && ITEMS[item].edits[sourceSlot]) || DICE[copy?.template ?? die.template].faces[sourceSlot];
  for (const upgrade of copy?.upgrades ?? []) face = addKeywordToFace(face, upgrade.keyword, upgrade.x) ?? face;
  for (const upgrade of die.upgrades?.[slot] ?? []) face = addKeywordToFace(face, upgrade.keyword, upgrade.x) ?? face;
  return face;
}

const PIPS = ['hit', 'guard'];
const withPips = (face: Face, change: (value: number) => number): Face =>
  ({ ...face, parts: face.parts.map(part => (PIPS.includes(part.kind) ? { ...part, value: change(part.value) } : part)) });
/** The pips of a face: the value of its first damage or block part. */
export const mainPips = (face: Pick<Face, 'parts'>): number => face.parts.find(part => PIPS.includes(part.kind))?.value ?? 0;

export function rollFace(state: State, roll: Roll): Face {
  return combatFaceFor(state, state.dice.find(die => die.id === roll.dieId)!, roll.slot);
}

const slotKey = (dieId: string, slot: Slot): string => `${dieId}:${slot}`;

function countBlanks(die: Die, combat: Combat): number {
  return SLOTS.filter(slot =>
    combat.exhausted?.[slotKey(die.id, slot)] !== undefined || faceFor(die, slot).target === 'none').length;
}

function frenzyCost(part: Part, frenzy: number): number {
  if (part.kind === 'frenzyAll') return frenzy;
  return part.kind === 'frenzySpend' && frenzy >= part.value ? part.value : 0;
}

function synergyPips(state: State, combat: Combat, die: Die, face: Face, base: number): number {
  const burn = combat.burn ?? 0;
  const frenzy = combat.frenzy ?? 0;
  return face.parts.reduce((value, part) => {
    switch (part.kind) {
      case 'burnDamage': return value + burn;
      case 'burnDouble': return burn > 0 ? value * 2 : value;
      case 'afterExhaust': return Object.values(combat.exhausted ?? {}).includes(combat.turn) ? value + part.value : value;
      case 'dieBlanks': return value + countBlanks(die, combat);
      case 'kitBlanks': return value + Math.min(part.value, state.dice.reduce((sum, ownedDie) => sum + countBlanks(ownedDie, combat), 0));
      case 'frenzyThreshold': return frenzy >= part.value ? value + base : value;
      case 'frenzySpend': return value + 2 * frenzyCost(part, frenzy);
      case 'frenzyAll': return value + part.value * frenzyCost(part, frenzy);
      default: return value;
    }
  }, base);
}

/** The current face, including temporary blanks and the pips the player will get for using it. */
export function combatFaceFor(state: State, die: Die, slot: Slot): Face {
  const combat = state.combat;
  if (!combat) return faceFor(die, slot);
  const key = slotKey(die.id, slot);
  const blank = isExerted(state, die.id) || combat.exhausted?.[key] !== undefined;
  let face = blank ? BLANK : faceFor(die, slot);
  if (face.target === 'none' && combat.relicTurn?.blankGuard === key) {
    face = { target: 'self', parts: [{ kind: 'guard', value: 3 }], image: 'face-art/library/buckler.webp' };
  }
  const grown = combat.grown[key] ?? 0;
  if (grown) face = withPips(face, value => value + grown);
  // Inspired: doubled when the die played just before had more pips.
  if (combat.previous !== null && face.parts.some(part => part.kind === 'inspired') && combat.previous > mainPips(face)) {
    face = withPips(face, value => value * 2);
  }
  const main = face.parts.find(part => PIPS.includes(part.kind));
  if (!main) return face;
  const value = synergyPips(state, combat, die, face, main.value) + relicPips(state, slot);
  return value === main.value ? face : { ...face, parts: face.parts.map(part => part === main ? { ...part, value } : part) };
}

/** An exerted die shows blank faces until the end of the turn after the one it was used on. */
export function isExerted(state: State, dieId: string): boolean {
  return !!state.combat && state.combat.exerted[dieId] === state.combat.turn;
}

export function effectiveParts(face: Face, boost: number): readonly Part[] {
  if (!boost) return face.parts;
  const index = face.parts.findIndex(part => part.kind === 'hit' || part.kind === 'guard');
  if (index < 0) return face.parts;
  const part = face.parts[index];
  const result = [...face.parts];
  if (part.count && part.count > 1) {
    result.splice(index, 1, { ...part, value: part.value + boost, count: 1 }, { ...part, count: part.count - 1 });
  } else {
    result[index] = { ...part, value: part.value + boost };
  }
  return result;
}

export function setHold(state: State, dieId: string, held: boolean): boolean {
  const combat = state.combat;
  const roll = combat?.rolls.find(r => dieId === r.dieId);
  if (state.phase !== 'battle' || combat?.phase !== 'roll' || !roll || roll.held === held) return false;
  roll.held = held;
  return true;
}

export function reroll(state: State): boolean {
  const combat = state.combat;
  if (state.phase !== 'battle' || combat?.phase !== 'roll' || !combat.rerolls || combat.rolls.every(roll => roll.held)) return false;
  combat.rerolls--;
  if (combat.relicTurn) combat.relicTurn.rerollsUsed++;
  for (const roll of combat.rolls) {
    if (roll.held) continue;
    const previous = rollFace(state, roll);
    if (previous.target === 'none' && claimTurnRelic(state, 'mudWedge')) combat.guard += 2;
    const bonus = previous.salvage;
    if (bonus && !roll.salvaged) {
      roll.salvaged = true;
      combat.guard += bonus;
    }
    roll.slot = SLOTS[pick(state, 6, 'combatRng')];
    if (rollFace(state, roll).target === 'none' && claimTurnRelic(state, 'hingePin')) {
      roll.slot = SLOTS[pick(state, 6, 'combatRng')];
    }
  }
  fireCantrips(state, combat, combat.rolls.filter(roll => !roll.held));
  if (combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  return true;
}

export function commitRoll(state: State): boolean {
  const combat = state.combat;
  if (state.phase !== 'battle' || combat?.phase !== 'roll') return false;
  if (combat.relicTurn) commitRelics(state, combat.rolls.map(roll => ({ roll, face: rollFace(state, roll) })));
  combat.phase = 'play';
  for (const roll of combat.rolls) roll.held = true;
  return true;
}

export function canPlay(state: State, dieId: string, target: Target): boolean {
  const combat = state.combat;
  const roll = combat?.rolls.find(r => r.dieId === dieId);
  if (state.phase !== 'battle' || !combat || combat.phase !== 'play' || !roll || roll.used) return false;
  const face = rollFace(state, roll);
  if (face.target === 'none' || face.target !== target.kind) return false;
  if (target.kind === 'all') return combat.enemies.some(enemy => enemy.hp > 0);
  if (target.kind === 'enemy') return combat.enemies.some(enemy => enemy.id === target.id && enemy.hp > 0);
  if (target.kind === 'die') {
    return combat.rolls.some(other => other.dieId === target.id && other !== roll && !other.used
      && rollFace(state, other).parts.some(part => part.kind === 'hit' || part.kind === 'guard'));
  }
  return true;
}

function applyFace(state: State, roll: Roll, target: Target): void {
  const combat = state.combat!;
  const enemy = combat.enemies.find(e => target.kind === 'enemy' && e.id === target.id);
  const die = combat.rolls.find(r => target.kind === 'die' && r.dieId === target.id);
  const face = rollFace(state, roll);
  roll.used = true;
  const parts = effectiveParts(face, roll.boost);
  const guarded = combat.relicTurn ? combat.enemies.filter(enemy => enemy.guard > 0) : [];
  if (target.kind === 'all') applyToAll(state, roll, parts);
  else applyParts(state, roll, parts, enemy, die);
  const frenzy = combat.frenzy;
  if (frenzy) {
    const spender = parts.find(part => part.kind === 'frenzySpend' || part.kind === 'frenzyAll');
    if (spender) combat.frenzy = frenzy - frenzyCost(spender, frenzy);
  }
  if (parts.some(part => part.kind === 'exhaust')) {
    (combat.exhausted ??= {})[slotKey(roll.dieId, roll.slot)] = combat.turn;
  }
  const pips = mainPips({ parts });
  afterRelicFace(state, roll.slot, pips, parts, guarded);
  combat.previous = pips;
  const growth = face.parts.find(part => part.kind === 'growth');
  if (growth) {
    const key = slotKey(roll.dieId, roll.slot);
    combat.grown[key] = (combat.grown[key] ?? 0) + growth.value;
  }
}

const AIMED = ['hit', 'seep', 'vulnerable', 'weak', 'burn'];

/** An all-enemies face hits every living enemy; its self effects (block, exert...) apply once. */
function applyToAll(state: State, roll: Roll, parts: readonly Part[]): void {
  const aimed = parts.filter(part => AIMED.includes(part.kind));
  for (const enemy of state.combat!.enemies) {
    if (enemy.hp > 0) applyParts(state, roll, aimed, enemy, undefined);
  }
  applyParts(state, roll, parts.filter(part => !AIMED.includes(part.kind)), undefined, undefined);
}

function damageAfterBlock(target: { guard: number }, damage: number): number {
  const blocked = Math.min(target.guard, damage);
  target.guard -= blocked;
  return damage - blocked;
}

function applyParts(state: State, roll: Roll, parts: readonly Part[], enemy: Enemy | undefined, die: Roll | undefined): void {
  const combat = state.combat!;
  for (const part of parts) {
    if (part.kind === 'hit' && enemy) {
      // Vulnerable: +50% damage, rounded down.
      const damage = enemy.vulnerable > 0 ? Math.floor(part.value * 1.5) : part.value;
      for (let i = 0; i < (part.count ?? 1); i++) {
        enemy.hp = Math.max(0, enemy.hp - damageAfterBlock(enemy, damage));
      }
    } else if (part.kind === 'guard') {
      combat.guard += part.value;
    } else if (part.kind === 'heal') {
      state.hp = Math.min(state.maxHp, state.hp + part.value);
    } else if (part.kind === 'selfBurn') {
      combat.burn = (combat.burn ?? 0) + part.value;
    } else if (part.kind === 'burn' && enemy && enemy.hp > 0) {
      enemy.burn = (enemy.burn ?? 0) + part.value;
    } else if (part.kind === 'seep' && enemy && enemy.hp > 0) {
      enemy.seep += part.value;
    } else if (part.kind === 'vulnerable' && enemy && enemy.hp > 0) {
      enemy.vulnerable += part.value;
    } else if (part.kind === 'weak' && enemy && enemy.hp > 0) {
      enemy.weak += part.value;
    } else if (part.kind === 'exert') {
      combat.exerted[roll.dieId] = combat.turn + 1;
    } else if (part.kind === 'boost' && die) {
      die.boost += part.value;
    } else if (part.kind === 'ward') {
      combat.ward = Math.min(8, combat.ward + part.value);
    }
  }
}

export function actionPreview(state: State, dieId: string, target: Target): (Combat & { playerHp: number }) | null {
  if (!canPlay(state, dieId, target)) return null;
  const combat = structuredClone(state.combat!);
  const forecast = { ...state, combat };
  applyFace(forecast, combat.rolls.find(roll => roll.dieId === dieId)!, target);
  return Object.assign(combat, { playerHp: forecast.hp });
}

export function play(state: State, dieId: string, target: Target): boolean {
  if (!canPlay(state, dieId, target)) return false;
  const combat = state.combat!;
  applyFace(state, combat.rolls.find(roll => roll.dieId === dieId)!, target);
  if (combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  return true;
}

export function intentValues(combat: Combat): (Intent & { active: boolean })[] {
  const power = new Map(combat.enemies.map(enemy => [enemy.id, enemy.power]));
  const compass = compassTarget(combat);
  const weak = new Map(combat.enemies.map(enemy => [enemy.id, enemy.weak > 0 || enemy === compass]));
  return combat.intents.map(intent => {
    const active = combat.enemies.some(enemy => enemy.id === intent.owner && enemy.hp > 0);
    const livePower = power.get(intent.owner) ?? 0;
    if (active && intent.move === 'power') power.set(intent.owner, Math.min(2, livePower + intent.value));
    // Weak: -50% damage dealt, rounded down.
    const value = intent.move === 'hit' ? Math.floor((intent.value + livePower) * (weak.get(intent.owner) ? .5 : 1)) : intent.value;
    return { ...intent, value, active };
  });
}

export function incoming(combat: Combat): number {
  return intentValues(combat).reduce((total, intent) => total + (intent.active && intent.move === 'hit' ? intent.value : 0), 0);
}

function damagePlayer(state: State, combat: Combat, damage: number, firstHit: boolean): boolean {
  if (firstHit && damage > 0 && combat.frenzy !== undefined) combat.frenzy++;
  const hpDamage = damageAfterBlock(combat, damage);
  state.hp = Math.max(0, state.hp - hpDamage);
  relicsOnHpDamage(state, hpDamage);
  if (state.hp > 0) return false;
  state.phase = 'defeat';
  return true;
}

export function endTurn(state: State): boolean {
  const combat = state.combat;
  const room = currentRoom(state);
  if (state.phase !== 'battle' || combat?.phase !== 'play' || room.type !== 'battle') return false;
  endRelicTurn(state, combat);
  const burn = combat.burn ?? 0;
  if (burn > 0) {
    const lethal = damagePlayer(state, combat, burn, true);
    combat.burn = burn - 1;
    if (lethal) return true;
  }
  for (const enemy of combat.enemies) enemy.guard = 0;
  let hitByEnemy = false;
  for (const intent of intentValues(combat)) {
    if (!intent.active) continue;
    const enemy = combat.enemies.find(e => e.id === intent.owner)!;
    if (intent.move === 'hit') {
      if (damagePlayer(state, combat, intent.value, !hitByEnemy)) return true;
      hitByEnemy ||= intent.value > 0;
    } else if (intent.move === 'guard') {
      enemy.guard += intent.value;
    } else if (intent.move === 'power') {
      enemy.power = Math.min(2, enemy.power + intent.value);
    }
  }
  for (const enemy of combat.enemies) {
    if (enemy.hp > 0 && enemy.burn) {
      enemy.hp = Math.max(0, enemy.hp - damageAfterBlock(enemy, enemy.burn));
      enemy.burn--;
    }
    enemy.hp = Math.max(0, enemy.hp - enemy.seep);
    enemy.seep = Math.max(0, enemy.seep - 1);
    enemy.vulnerable = Math.max(0, enemy.vulnerable - 1);
    enemy.weak = Math.max(0, enemy.weak - 1);
  }
  if (combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  else {
    startTurn(state, room, combat);
    if (combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  }
  return true;
}

const heroItemIds = (state: State) => Object.keys(ITEMS).filter(id => ITEMS[id].rewardCharacter === state.character);
const ordinaryItems = (state: State) => heroItemIds(state).filter(id => ITEMS[id].rarity !== 'rare');
const ordinaryRelics = (state: State) => Object.keys(RELICS).filter(id => isMarketRarity(RELICS[id].rarity) && !state.relics?.includes(id));

function isRareOffer(offer: Offer): boolean {
  return (offer.kind === 'item' && ITEMS[offer.id]?.rarity === 'rare')
    || (offer.kind === 'relic' && RELICS[offer.id]?.rarity === 'rare');
}

function itemOffers(state: State, count: number, rich = false): Offer[] {
  const remaining = ordinaryItems(state);
  const offers: Offer[] = [];
  while (offers.length < count && remaining.length) {
    const chance = pick(state, 100);
    const rarity = chance < (rich ? 100 : 35) ? 'uncommon' : 'common';
    const matching = remaining.filter(id => ITEMS[id].rarity === rarity);
    const available = matching.length ? matching : remaining;
    const id = available[pick(state, available.length)];
    offers.push({ kind: 'item', id });
    remaining.splice(remaining.indexOf(id), 1);
  }
  return offers;
}

const SHOP_PRICES = {
  common: { relic: 36, item: 21 },
  uncommon: { relic: 51, item: 30 },
};

function isMarketRarity(rarity: Rarity | 'starter'): rarity is keyof typeof SHOP_PRICES {
  return rarity === 'common' || rarity === 'uncommon';
}

function priceFor(kind: 'item' | 'relic', id: string): number {
  const rarity = (kind === 'item' ? ITEMS[id] : RELICS[id]).rarity;
  return isMarketRarity(rarity) ? SHOP_PRICES[rarity][kind] : 0;
}

function drawStock(state: State, pool: string[], catalogue: Record<string, { rarity: string }>, rarity: string): string | undefined {
  const matching = pool.filter(id => catalogue[id].rarity === rarity);
  const available = matching.length ? matching : pool;
  if (!available.length) return undefined;
  const id = available[pick(state, available.length)];
  pool.splice(pool.indexOf(id), 1);
  return id;
}

/** Preserve a saved visit and replace only rare offers the player had not taken yet. */
function replaceRareOffers(saved: State): State {
  const state = { ...saved };
  const shopping = currentRoom(state).type === 'shop';
  const unlisted = (ids: string[], kind: 'item' | 'relic') =>
    ids.filter(id => !saved.offers.some(offer => offer.kind === kind && offer.id === id));
  const items = unlisted(ordinaryItems(state), 'item');
  const relics = unlisted(ordinaryRelics(state), 'relic');
  state.offers = saved.offers.flatMap(offer => {
    if (offer.kind === 'item' && isRareOffer(offer)) {
      const id = drawStock(state, items, ITEMS, shopping ? 'common' : 'uncommon');
      return id ? [{ kind: 'item', id, ...(shopping ? { price: priceFor('item', id) } : {}) }] : [];
    }
    if (offer.kind === 'relic' && isRareOffer(offer)) {
      const id = drawStock(state, relics, RELICS, 'common');
      return id ? [{ kind: 'relic', id, price: priceFor('relic', id) }] : [];
    }
    return [offer];
  });
  return state;
}
const COPY_TIERS: readonly (readonly Slot[])[] = [['left'], ['center'], ['top', 'bottom'], ['right', 'far']];

function canCopy(die: Die, from: Slot, to: Slot): boolean {
  if (from === to) return false;
  const source = faceFor(die, from);
  const target = faceFor(die, to);
  return source.target !== 'none'
    && (source.target !== target.target || source.salvage !== target.salvage
      || JSON.stringify(source.parts) !== JSON.stringify(target.parts));
}

function faceCopyStock(state: State): FaceCopyOffer | undefined {
  const pairs = COPY_TIERS.flatMap((sources, index) => [-2, -1, 1, 2].flatMap(jumps =>
    sources.flatMap(from => (COPY_TIERS[index + jumps] ?? []).map(to => ({ from, to, jumps })))),
  ).filter(({ from, to }) => state.dice.some(die => canCopy(die, from, to)));
  if (!pairs.length) return undefined;
  const direction = pick(state, 10) < 9 ? 1 : -1;
  const jumps = pick(state, 4) < 3 ? 1 : 2;
  const preferred = pairs.filter(pair => Math.sign(pair.jumps) === direction);
  const matching = preferred.filter(pair => Math.abs(pair.jumps) === jumps);
  const available = matching.length ? matching : preferred.length ? preferred : pairs;
  const { from, to } = available[pick(state, available.length)];
  return { kind: 'faceCopy', from, to, price: 23 };
}

function shopStock(state: State): Offer[] {
  const rarities = ['common', 'uncommon', 'common'];
  const relicPool = ordinaryRelics(state);
  const itemPool = ordinaryItems(state);
  const relics = rarities.flatMap(rarity => {
    const id = drawStock(state, relicPool, RELICS, rarity);
    return id ? [{ kind: 'relic' as const, id, price: priceFor('relic', id) }] : [];
  });
  const items = rarities.flatMap(rarity => {
    const id = drawStock(state, itemPool, ITEMS, rarity);
    return id ? [{ kind: 'item' as const, id, price: priceFor('item', id) }] : [];
  });
  const copy = faceCopyStock(state);
  return [...relics, ...items, ...(copy ? [copy] : [])];
}

function discovery(state: State, exclude = ''): string {
  const hero = CHARACTERS.find(c => c.id === state.character);
  const available = hero?.starterRelic ? new Set([...DISCOVERIES, ...hero.starterDice]) : DISCOVERIES;
  const choices = [...available].filter(id => id !== exclude);
  return choices[pick(state, choices.length)];
}

/** Gold ranges by encounter rank. */
export const GOLD_RANGE = { normal: [10, 20], elite: [25, 35], boss: [95, 105] } as const;

function awardGold(state: State, rank: Encounter['rank']): void {
  const [low, high] = GOLD_RANGE[rank];
  state.lastGold = low + pick(state, high - low + 1);
  state.gold += state.lastGold;
}

function finishFight(state: State): void {
  const room = currentRoom(state);
  if (room.type !== 'battle') return;
  awardGold(state, room.rank);
  if (room.rank === 'boss') {
    const rareItems = heroItemIds(state).filter(id => ITEMS[id].rarity === 'rare');
    const item = rareItems.length ? rareItems[pick(state, rareItems.length)] : undefined;
    const relic = randomRelic(state, 'rare');
    state.bossSpoils = { ...(item ? { item } : {}), ...(relic ? { relic } : {}) };
    if (state.map && state.map.turn < BOSS_TURNS[2]) {
      state.hp = state.maxHp;
      if (relic) (state.relics ??= []).push(relic);
      state.phase = 'reward';
      state.offers = item ? [{ kind: 'item', id: item }] : [];
    } else state.phase = 'victory';
    return;
  }
  state.phase = 'reward';
  const rich = room.rank === 'elite';
  if (state.variant === 'fixed') {
    state.offers = itemOffers(state, 3, rich);
  } else {
    const first = discovery(state);
    state.offers = [
      { kind: 'add', id: first },
      ...itemOffers(state, 1, rich),
      { kind: 'add', id: discovery(state, first) },
    ];
  }
}

export function offerTargets(state: State, offer: Offer): Die[] {
  if (offer.kind === 'item') return state.dice.filter(die => state.variant === 'fixed' || !die.item);
  if (offer.kind === 'faceCopy') return state.dice.filter(die => canCopy(die, offer.from, offer.to));
  if (offer.kind === 'remove') return state.dice.length > 5 ? state.dice : [];
  if (offer.kind === 'transform') return state.dice.filter(die => die.template !== offer.id);
  if (offer.kind === 'upgrade') return state.dice.filter(die => SLOTS.some(slot => previewUpgrade(die, slot, offer)));
  return [];
}

export interface UpgradeTarget { dieId: string; slot: Slot }

/** The face the upgrade would produce on that slot, or null when the keyword does not fit it. */
export function previewUpgrade(die: Die, slot: Slot, offer: Offer): Face | null {
  if (offer.kind !== 'upgrade') return null;
  return addKeywordToFace(faceFor(die, slot), offer.keyword, offer.x) ?? null;
}

export function upgradeTargets(state: State, offer: Offer): UpgradeTarget[] {
  return state.dice.flatMap(die => SLOTS.filter(slot => previewUpgrade(die, slot, offer)).map(slot => ({ dieId: die.id, slot })));
}

export function previewDie(state: State, offer: Offer, die: Die): Die | null {
  if (!offerTargets(state, offer).includes(die)) return null;
  if (offer.kind === 'transform') return { ...die, template: offer.id };
  if (offer.kind !== 'item' && offer.kind !== 'faceCopy') return null;
  const imprints = { ...die.imprints };
  const upgrades: NonNullable<Die['upgrades']> = { ...die.upgrades };
  const copies = { ...die.copies };
  if (offer.kind === 'faceCopy') {
    copies[offer.to] = snapshotFace(die, offer.from);
    delete imprints[offer.to];
    delete upgrades[offer.to];
    return { ...die, imprints, upgrades, copies };
  }
  for (const slot of SLOTS) {
    if (!ITEMS[offer.id].edits[slot]) continue;
    imprints[slot] = offer.id;
    delete upgrades[slot]; // a replaced face loses the upgrades it had
    delete copies[slot];
  }
  return { ...die, imprints, upgrades, ...(die.copies ? { copies } : {}), item: state.variant === 'pool' ? offer.id : undefined };
}

function randomRelic(state: State, rarity: Rarity): string | undefined {
  const ids = Object.keys(RELICS).filter(id => RELICS[id].rarity === rarity && !state.relics?.includes(id));
  return ids.length ? ids[pick(state, ids.length)] : undefined;
}

function prepareEventOffer(state: State, choice: EventChoice): Offer | undefined {
  const effect = choice.effect;
  switch (effect.kind) {
    case 'heal': return { kind: 'restore', amount: effect.amount };
    case 'gold': return { kind: 'gold', amount: effect.amount };
    case 'upgrade': return { kind: 'upgrade', ...CAMP_UPGRADES[pick(state, CAMP_UPGRADES.length)] };
    case 'copy': {
      const copy = faceCopyStock(state);
      return copy && { ...copy, price: 0 };
    }
    case 'item': {
      const ids = heroItemIds(state).filter(id => ITEMS[id].rarity === effect.rarity);
      return ids.length ? { kind: 'item', id: ids[pick(state, ids.length)] } : undefined;
    }
    case 'relic': {
      const id = randomRelic(state, effect.rarity);
      return id ? { kind: 'relic', id, price: 0 } : undefined;
    }
  }
}

export function eventChoiceFor(state: State, index: number): EventChoice | undefined {
  const active = state.map?.active;
  return active?.kind === 'event' ? EVENTS[active.id].choices[active.choiceIndexes[index]] : undefined;
}

export function canTakeEventOffer(state: State, index: number): boolean {
  const choice = eventChoiceFor(state, index);
  const offer = state.offers[index];
  if (!choice || !offer || (choice.gold ?? 0) > state.gold || (choice.hp ?? 0) >= state.hp) return false;
  if (offer.kind === 'item' || offer.kind === 'faceCopy' || offer.kind === 'upgrade') return offerTargets(state, offer).length > 0;
  return offer.kind !== 'relic' || !state.relics?.includes(offer.id);
}

export function chooseOffer(state: State, index: number, dieId?: string, slot?: Slot): boolean {
  if (state.phase !== 'reward') return false;
  const offer = state.offers[index];
  const room = currentRoom(state);
  const bossReward = !!state.map && room.type === 'battle' && room.rank === 'boss';
  if (!offer || (isRareOffer(offer) && !bossReward)) return false;
  if (room.type === 'shop') return buyOffer(state, index, offer, dieId);
  const event = eventChoiceFor(state, index);
  if (event && !canTakeEventOffer(state, index)) return false;
  if (!event && (offer.kind === 'gold' || offer.kind === 'restore' || offer.kind === 'relic' || offer.kind === 'faceCopy')) return false;
  if (!applyReward(state, offer, dieId, slot)) return false;
  if (event) {
    state.hp -= event.hp ?? 0;
    state.gold -= event.gold ?? 0;
  }
  return advance(state);
}

function applyReward(state: State, offer: Offer, dieId?: string, slot?: Slot): boolean {
  if (offer.kind === 'gold') {
    state.gold += offer.amount;
  } else if (offer.kind === 'restore') {
    state.hp = Math.min(state.maxHp, state.hp + offer.amount);
  } else if (offer.kind === 'relic') {
    (state.relics ??= []).push(offer.id);
  } else if (offer.kind === 'heal') {
    state.hp = Math.min(state.maxHp, state.hp + 10);
  } else if (offer.kind === 'add') {
    state.dice.push(newDie(offer.id, state.nextDie++));
  } else if (offer.kind === 'upgrade') {
    const die = state.dice.find(d => d.id === dieId);
    if (!die || !slot || !previewUpgrade(die, slot, offer)) return false;
    die.upgrades ??= {};
    (die.upgrades[slot] ??= []).push({ keyword: offer.keyword, ...(offer.x !== undefined ? { x: offer.x } : {}) });
  } else {
    const die = offerTargets(state, offer).find(die => die.id === dieId);
    if (!die) return false;
    const replace = state.dice.indexOf(die);
    if (offer.kind === 'remove') state.dice.splice(replace, 1);
    else state.dice[replace] = previewDie(state, offer, die)!;
  }
  return true;
}

function buyOffer(state: State, index: number, offer: Offer, dieId?: string): boolean {
  if (!('price' in offer) || offer.price === undefined || !Number.isInteger(offer.price)
    || offer.price <= 0 || offer.price > state.gold) return false;
  if (offer.kind === 'relic') {
    if (!RELICS[offer.id] || RELICS[offer.id].rarity === 'starter' || state.relics?.includes(offer.id)) return false;
    (state.relics ??= []).push(offer.id);
  } else {
    if (offer.kind === 'item' && ITEMS[offer.id]?.rewardCharacter !== state.character) return false;
    const dieIndex = state.dice.findIndex(die => die.id === dieId);
    if (dieIndex < 0) return false;
    const result = previewDie(state, offer, state.dice[dieIndex]);
    if (!result) return false;
    state.dice[dieIndex] = result;
  }
  state.gold -= offer.price;
  state.offers.splice(index, 1);
  return true;
}

export function advance(state: State): boolean {
  if (state.phase !== 'reward') return false;
  if (state.map) {
    state.phase = 'map';
    state.map.active = null;
    state.combat = null;
    state.lastGold = 0;
    state.offers = [];
    delete state.bossSpoils;
    revealTreasureWave(state.map);
    return true;
  }
  if (state.room + 1 >= ROOMS.length) return false;
  state.room++;
  state.lastGold = 0;
  enterRoom(state);
  return true;
}
