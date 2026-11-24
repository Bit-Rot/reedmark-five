import { DICE, DISCOVERIES, ITEMS, ROOMS, STARTERS } from './content.ts';
import { SLOTS } from './model.ts';
import type { Combat, Die, Encounter, Enemy, Face, Intent, Offer, Part, Roll, Slot, State, Target, Variant } from './model.ts';

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

export function newRun(variant: Variant, seed: number): State {
  const ids = variant === 'fixed' ? STARTERS.slice(0, 5) : STARTERS;
  const state: State = {
    version: 1, variant, seed: seed >>> 0, rng: (seed ^ 0x6bdc) >>> 0, combatRng: 0,
    room: 0, hp: 44, maxHp: 44, nextDie: ids.length, dice: ids.map(newDie), phase: 'battle',
    combat: null, offers: [],
  };
  enterRoom(state);
  return state;
}

export function isSave(data: unknown, variant: Variant): data is State {
  if (!data || typeof data !== 'object') return false;
  const save = data as State;
  try {
    return save.version === 1 && save.variant === variant && Number.isInteger(save.seed)
      && Number.isInteger(save.room) && !!ROOMS[save.room] && Number.isFinite(save.hp)
      && ['battle', 'reward', 'victory', 'defeat'].includes(save.phase)
      && Array.isArray(save.dice) && save.dice.length >= 5
      && new Set(save.dice.map(die => die.id)).size === save.dice.length
      && save.dice.every(die => DICE[die.template] && die.imprints
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
    const enemies: Enemy[] = room.enemies.map(enemy => ({ ...enemy, maxHp: enemy.hp, guard: 0, seep: 0, power: 0 }));
    state.phase = 'battle';
    state.combatRng = step((state.seed ^ Math.imul(state.room + 1, 0x90ad)) >>> 0);
    state.combat = {
      turn: 0, phase: 'roll', rerolls: 2, enemies, intents: [], rolls: [], bag: [], guard: 0, ward: 0,
    };
    startTurn(state, room, state.combat);
  } else {
    state.phase = 'reward';
    if (room.type === 'workshop' && state.variant === 'pool') {
      state.offers = [{ kind: 'transform', id: discovery(state) }, { kind: 'remove' }];
    } else if (room.type === 'camp') {
      state.offers = [{ kind: 'heal' }, { kind: 'item', id: itemChoices(state, 1, true)[0] }];
    } else {
      state.offers = itemChoices(state, 3).map(id => ({ kind: 'item', id }));
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
}

export function facesFor(die: Die): Record<Slot, Face> {
  return Object.fromEntries(SLOTS.map(slot => [slot, faceFor(die, slot)])) as Record<Slot, Face>;
}

export function faceFor(die: Die, slot: Slot): Face {
  const item = die.imprints[slot];
  return (item && ITEMS[item].edits[slot]) || DICE[die.template].faces[slot];
}

export function rollFace(state: State, roll: Roll): Face {
  return faceFor(state.dice.find(die => die.id === roll.dieId)!, roll.slot);
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
  if (rollFace(state, roll).target !== target.kind) return false;
  if (target.kind === 'enemy') return combat.enemies.some(enemy => enemy.id === target.id && enemy.hp > 0);
  if (target.kind === 'die') {
    return combat.rolls.some(other => other.dieId === target.id && other !== roll && !other.used
      && rollFace(state, other).parts.some(part => part.kind === 'hit' || part.kind === 'guard'));
  }
  return true;
}

function applyFace(state: State, combat: Combat, roll: Roll, target: Target): void {
  const enemy = combat.enemies.find(e => target.kind === 'enemy' && e.id === target.id);
  const die = combat.rolls.find(r => target.kind === 'die' && r.dieId === target.id);
  roll.used = true;
  for (const part of effectiveParts(rollFace(state, roll), roll.boost)) {
    if (part.kind === 'hit' && enemy) {
      for (let i = 0; i < (part.count ?? 1); i++) {
        const blocked = Math.min(part.value, enemy.guard);
        enemy.guard -= blocked;
        enemy.hp = Math.max(0, enemy.hp - part.value + blocked);
      }
    } else if (part.kind === 'guard') {
      combat.guard += part.value;
    } else if (part.kind === 'seep' && enemy && enemy.hp > 0) {
      enemy.seep += part.value;
    } else if (part.kind === 'boost' && die) {
      die.boost += part.value;
    } else if (part.kind === 'ward') {
      combat.ward = Math.min(8, combat.ward + part.value);
    }
  }
}

export function actionPreview(state: State, dieId: string, target: Target): Combat | null {
  if (!canPlay(state, dieId, target)) return null;
  const combat = structuredClone(state.combat!);
  applyFace(state, combat, combat.rolls.find(roll => roll.dieId === dieId)!, target);
  return combat;
}

export function play(state: State, dieId: string, target: Target): boolean {
  if (!canPlay(state, dieId, target)) return false;
  const combat = state.combat!;
  applyFace(state, combat, combat.rolls.find(roll => roll.dieId === dieId)!, target);
  if (combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  return true;
}

export function intentValues(combat: Combat): (Intent & { active: boolean })[] {
  const power = new Map(combat.enemies.map(enemy => [enemy.id, enemy.power]));
  return combat.intents.map(intent => {
    const active = combat.enemies.some(enemy => enemy.id === intent.owner && enemy.hp > 0);
    const livePower = power.get(intent.owner) ?? 0;
    if (active && intent.move === 'power') power.set(intent.owner, Math.min(2, livePower + intent.value));
    const value = intent.move === 'hit' ? intent.value + livePower : intent.value;
    return { ...intent, value, active };
  });
}

export function incoming(combat: Combat): number {
  return intentValues(combat).reduce((total, intent) => total + (intent.active && intent.move === 'hit' ? intent.value : 0), 0);
}

export function endTurn(state: State): boolean {
  const combat = state.combat;
  const room = ROOMS[state.room];
  if (state.phase !== 'battle' || combat?.phase !== 'play' || room.type !== 'battle') return false;
  for (const enemy of combat.enemies) enemy.guard = 0;
  for (const intent of intentValues(combat)) {
    if (!intent.active) continue;
    const enemy = combat.enemies.find(e => e.id === intent.owner)!;
    if (intent.move === 'hit') {
      const blocked = Math.min(combat.guard, intent.value);
      combat.guard -= blocked;
      state.hp = Math.max(0, state.hp - intent.value + blocked);
      if (state.hp === 0) {
        state.phase = 'defeat';
        return true;
      }
    } else if (intent.move === 'guard') {
      enemy.guard += intent.value;
    } else if (intent.move === 'power') {
      enemy.power = Math.min(2, enemy.power + intent.value);
    }
  }
  for (const enemy of combat.enemies) {
    enemy.hp = Math.max(0, enemy.hp - enemy.seep);
    enemy.seep = Math.max(0, enemy.seep - 1);
  }
  if (combat.enemies.every(enemy => enemy.hp <= 0)) finishFight(state);
  else startTurn(state, room, combat);
  return true;
}

function itemChoices(state: State, count: number, rich = false): string[] {
  const choices: string[] = [];
  for (let i = 0; i < count; i++) {
    const chance = pick(state, 100);
    const rarity = chance < (rich ? 30 : 8) ? 'rare' : chance < (rich ? 100 : 35) ? 'uncommon' : 'common';
    const available = Object.keys(ITEMS).filter(id => ITEMS[id].rarity === rarity && !choices.includes(id));
    choices.push(available[pick(state, available.length)]);
  }
  return choices;
}

function discovery(state: State, exclude = ''): string {
  const choices = DISCOVERIES.filter(id => id !== exclude);
  return choices[pick(state, choices.length)];
}

function finishFight(state: State): void {
  const room = ROOMS[state.room];
  if (room.type !== 'battle') return;
  if (room.rank === 'boss') {
    state.phase = 'victory';
    return;
  }
  state.phase = 'reward';
  state.offers = state.variant === 'fixed'
    ? itemChoices(state, 3, room.rank === 'elite').map(id => ({ kind: 'item', id }))
    : [
      { kind: 'add', id: discovery(state) },
      { kind: 'item', id: itemChoices(state, 1, room.rank === 'elite')[0] },
      { kind: 'add', id: '' },
    ];
  if (state.variant === 'pool') {
    const first = state.offers[0];
    state.offers[2] = { kind: 'add', id: discovery(state, first.kind === 'add' ? first.id : '') };
  }
}

export function offerTargets(state: State, offer: Offer): Die[] {
  if (offer.kind === 'item') return state.dice.filter(die => state.variant === 'fixed' || !die.item);
  if (offer.kind === 'remove') return state.dice.length > 5 ? state.dice : [];
  if (offer.kind === 'transform') return state.dice.filter(die => die.template !== offer.id);
  return [];
}

export function previewDie(state: State, offer: Offer, die: Die): Die | null {
  if (!offerTargets(state, offer).includes(die)) return null;
  if (offer.kind === 'transform') return { ...die, template: offer.id };
  if (offer.kind !== 'item') return null;
  const imprints = { ...die.imprints };
  for (const slot of SLOTS) if (ITEMS[offer.id].edits[slot]) imprints[slot] = offer.id;
  return { ...die, imprints, item: state.variant === 'pool' ? offer.id : undefined };
}

export function chooseOffer(state: State, index: number, dieId?: string): boolean {
  if (state.phase !== 'reward') return false;
  const offer = state.offers[index];
  if (!offer) return false;
  if (offer.kind === 'heal') {
    state.hp = Math.min(state.maxHp, state.hp + 10);
  } else if (offer.kind === 'add') {
    state.dice.push(newDie(offer.id, state.nextDie++));
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
  enterRoom(state);
  return true;
}
