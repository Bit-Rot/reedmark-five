import { BLANK_IMAGE, CAMP_UPGRADES, CHARACTERS, DICE, ITEMS, ROOMS } from './content.ts';
import { addKeywordToFace } from './data/runtime.ts';
import { SLOTS } from './model.ts';
import type { Combat, Die, Encounter, Enemy, Face, Intent, Offer, Part, Roll, Slot, State, Target, Variant } from './model.ts';

/** What an exerted die or exhausted slot shows. */
export const BLANK_FACE: Face = { target: 'none', parts: [{ kind: 'blank', value: 0 }], ...(BLANK_IMAGE ? { image: BLANK_IMAGE } : {}) };
const BLANK = BLANK_FACE;
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

export function newRun(variant: Variant, seed: number, character = CHARACTERS[0].id): State {
  const hero = CHARACTERS.find(c => c.id === character) ?? CHARACTERS[0];
  // Dice Pool starts with ten dice: the character's five, twice.
  const ids = variant === 'fixed' ? hero.starterDice : [...hero.starterDice, ...hero.starterDice];
  const state: State = {
    version: 4, character: hero.id, variant, seed: seed >>> 0, rng: (seed ^ 0x6bdc) >>> 0, combatRng: 0,
    room: 0, hp: 44, maxHp: 44, gold: 0, lastGold: 0, nextDie: ids.length, dice: ids.map(newDie), phase: 'battle',
    combat: null, offers: [],
  };
  enterRoom(state);
  return state;
}

export function isSave(data: unknown, variant: Variant): data is State {
  if (!data || typeof data !== 'object') return false;
  const save = data as State;
  try {
    return save.version === 4 && Number.isInteger(save.gold) && save.gold >= 0 && Number.isInteger(save.lastGold) && save.variant === variant && CHARACTERS.some(c => c.id === save.character) && Number.isInteger(save.seed)
      && Number.isInteger(save.room) && !!ROOMS[save.room] && Number.isFinite(save.hp)
      && ['battle', 'reward', 'victory', 'defeat'].includes(save.phase)
      && Array.isArray(save.dice) && save.dice.length >= 5
      && new Set(save.dice.map(die => die.id)).size === save.dice.length
      && save.dice.every(die => DICE[die.template] && die.imprints
        && (!die.upgrades || Object.entries(die.upgrades).every(([slot, list]) => SLOTS.includes(slot as Slot) && Array.isArray(list)))
        && Object.entries(die.imprints).every(([slot, item]) => ITEMS[item]?.edits[slot as Slot]))
      && Array.isArray(save.offers)
      && (save.phase !== 'battle' || (save.combat?.rolls.length === 5 && save.combat.intents.length === 5
        && save.combat.rolls.every(roll => save.dice.some(die => die.id === roll.dieId) && SLOTS.includes(roll.slot))));
  } catch {
    return false;
  }
}

function enterRoom(state: State): void {
  const room = ROOMS[state.room];
  state.offers = [];
  state.combat = null;
  if (room.type === 'battle') {
    const enemies: Enemy[] = room.enemies.map(enemy => ({ ...enemy, maxHp: enemy.hp, guard: 0, seep: 0, power: 0, vulnerable: 0, weak: 0 }));
    state.phase = 'battle';
    state.combatRng = step((state.seed ^ Math.imul(state.room + 1, 0x90ad)) >>> 0);
    state.combat = {
      turn: 0, phase: 'roll', rerolls: 2, enemies, intents: [], rolls: [], bag: [], guard: 0, ward: 0, exerted: {}, grown: {}, previous: null, events: [],
    };
    if (starterRelicFor(state)?.effect === 'frenzyOnDamage') state.combat.frenzy = 0;
    startTurn(state, room, state.combat);
    if (state.combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  } else {
    state.phase = 'reward';
    if (room.type === 'workshop' && state.variant === 'pool') {
      state.offers = [{ kind: 'transform', id: discovery(state) }, { kind: 'remove' }];
    } else if (room.type === 'camp') {
      state.offers = [{ kind: 'heal' }, { kind: 'upgrade', ...CAMP_UPGRADES[pick(state, CAMP_UPGRADES.length)] }];
    } else {
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
  combat.rerolls = 2;
  combat.guard = combat.ward;
  combat.ward = 0;
  const boss = combat.enemies[0];
  const dice = room.phaseTwo && boss.hp <= boss.maxHp / 2 ? room.phaseTwo : room.dice;
  let enemySeed = step((state.seed ^ Math.imul(state.room + 1, 0x5bd1e995) ^ Math.imul(combat.turn, 0x3a005a03)) >>> 0);
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

export function faceFor(die: Die, slot: Slot): Face {
  const item = die.imprints[slot];
  let face = (item && ITEMS[item].edits[slot]) || DICE[die.template].faces[slot];
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
  if (isExerted(state, die.id) || combat.exhausted?.[key] !== undefined) return BLANK;
  let face = faceFor(die, slot);
  const grown = combat.grown[key] ?? 0;
  if (grown) face = withPips(face, value => value + grown);
  // Inspired: doubled when the die played just before had more pips.
  if (combat.previous !== null && face.parts.some(part => part.kind === 'inspired') && combat.previous > mainPips(face)) {
    face = withPips(face, value => value * 2);
  }
  const main = face.parts.find(part => PIPS.includes(part.kind));
  if (!main) return face;
  const value = synergyPips(state, combat, die, face, main.value);
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
  for (const roll of combat.rolls) {
    if (roll.held) continue;
    const bonus = rollFace(state, roll).salvage;
    if (bonus && !roll.salvaged) {
      roll.salvaged = true;
      combat.guard += bonus;
    }
    roll.slot = SLOTS[pick(state, 6, 'combatRng')];
  }
  fireCantrips(state, combat, combat.rolls.filter(roll => !roll.held));
  if (combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  return true;
}

export function commitRoll(state: State): boolean {
  const combat = state.combat;
  if (state.phase !== 'battle' || combat?.phase !== 'roll') return false;
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
  combat.previous = mainPips({ parts });
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
  const weak = new Map(combat.enemies.map(enemy => [enemy.id, enemy.weak > 0]));
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
  state.hp = Math.max(0, state.hp - damageAfterBlock(combat, damage));
  if (state.hp > 0) return false;
  state.phase = 'defeat';
  return true;
}

export function endTurn(state: State): boolean {
  const combat = state.combat;
  const room = ROOMS[state.room];
  if (state.phase !== 'battle' || combat?.phase !== 'play' || room.type !== 'battle') return false;
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

function itemOffers(state: State, count: number, rich = false): Offer[] {
  const remaining = Object.keys(ITEMS).filter(id => ITEMS[id].rewardCharacter === state.character);
  const offers: Offer[] = [];
  while (offers.length < count && remaining.length) {
    const chance = pick(state, 100);
    const rarity = chance < (rich ? 30 : 8) ? 'rare' : chance < (rich ? 100 : 35) ? 'uncommon' : 'common';
    const matching = remaining.filter(id => ITEMS[id].rarity === rarity);
    const available = matching.length ? matching : remaining;
    const id = available[pick(state, available.length)];
    offers.push({ kind: 'item', id });
    remaining.splice(remaining.indexOf(id), 1);
  }
  return offers;
}

function discovery(state: State, exclude = ''): string {
  const hero = CHARACTERS.find(c => c.id === state.character);
  const available = hero?.starterRelic ? new Set([...DISCOVERIES, ...hero.starterDice]) : DISCOVERIES;
  const choices = [...available].filter(id => id !== exclude);
  return choices[pick(state, choices.length)];
}

/** Gold for winning a fight, as in Slay the Spire: normal 10-20, elite 25-35, boss 95-105. */
export const GOLD_RANGE = { normal: [10, 20], elite: [25, 35], boss: [95, 105] } as const;

function awardGold(state: State, rank: Encounter['rank']): void {
  const [low, high] = GOLD_RANGE[rank];
  state.lastGold = low + pick(state, high - low + 1);
  state.gold += state.lastGold;
}

function finishFight(state: State): void {
  const room = ROOMS[state.room];
  if (room.type !== 'battle') return;
  awardGold(state, room.rank);
  if (room.rank === 'boss') {
    state.phase = 'victory';
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
  if (offer.kind !== 'item') return null;
  const imprints = { ...die.imprints };
  const upgrades: NonNullable<Die['upgrades']> = { ...die.upgrades };
  for (const slot of SLOTS) {
    if (!ITEMS[offer.id].edits[slot]) continue;
    imprints[slot] = offer.id;
    delete upgrades[slot]; // a replaced face loses the upgrades it had
  }
  return { ...die, imprints, upgrades, item: state.variant === 'pool' ? offer.id : undefined };
}

export function chooseOffer(state: State, index: number, dieId?: string, slot?: Slot): boolean {
  if (state.phase !== 'reward') return false;
  const offer = state.offers[index];
  if (!offer) return false;
  if (offer.kind === 'heal') {
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
  return advance(state);
}

export function advance(state: State): boolean {
  if (state.phase !== 'reward' || state.room + 1 >= ROOMS.length) return false;
  state.room++;
  state.lastGold = 0;
  enterRoom(state);
  return true;
}
