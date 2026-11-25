import { RELICS } from './content.ts';
import type { Combat, Enemy, Face, Part, Roll, Slot, State } from './model.ts';
import type { RelicEffect } from './relic-data.ts';

function owns(state: State, effect: RelicEffect): boolean {
  return state.relics?.some(id => RELICS[id]?.effect === effect) ?? false;
}

export function claimTurnRelic(state: State, effect: RelicEffect): boolean {
  const turn = state.combat?.relicTurn;
  if (!turn || turn.fired.includes(effect) || !owns(state, effect)) return false;
  turn.fired.push(effect);
  return true;
}

function gainWard(combat: Combat, value: number): void {
  combat.ward = Math.min(8, combat.ward + value);
}

function healthiest(combat: Combat): Enemy | undefined {
  return combat.enemies.reduce<Enemy | undefined>((best, enemy) =>
    enemy.hp > (best?.hp ?? 0) ? enemy : best, undefined);
}

function hitHealthiest(combat: Combat, value: number): void {
  const enemy = healthiest(combat);
  if (!enemy) return;
  const blocked = Math.min(value, enemy.guard);
  enemy.guard -= blocked;
  enemy.hp = Math.max(0, enemy.hp - value + blocked);
}

export function startRelicTurn(state: State, combat: Combat): void {
  if (!state.relics?.length) return;
  combat.relicTurn = { slots: [], fired: [], rerollsUsed: 0, pipped: 0 };
  if (combat.turn === 1 && owns(state, 'coldPebble')) {
    for (const enemy of combat.enemies) enemy.weak++;
  }
  if (combat.turn % 3 === 0 && owns(state, 'pocketSpring')) combat.rerolls++;
  if (combat.turn % 2 === 0 && owns(state, 'drownedCompass')) combat.relicTurn.drownedCompass = true;
}

export function commitRelics(state: State, faces: readonly { roll: Roll; face: Face }[]): void {
  const combat = state.combat!;
  const turn = combat.relicTurn;
  if (!turn) return;
  const blanks = faces.filter(entry => entry.face.target === 'none');
  if (blanks.length) {
    turn.committedBlank = true;
    if (owns(state, 'clayWeir')) combat.guard += 2;
    if (owns(state, 'blankFerrule')) {
      const { dieId, slot } = blanks[0].roll;
      turn.blankGuard = dieId + ':' + slot;
    }
  }
  const playable = faces.filter(entry => entry.face.target !== 'none').map(entry => entry.roll.slot);
  if (new Set(playable).size < playable.length && owns(state, 'twinRivets')) combat.guard += 2;
}

export function relicPips(state: State, slot: Slot): number {
  const combat = state.combat!;
  const turn = combat.relicTurn;
  if (!turn || combat.phase !== 'play') return 0;
  const played = turn.slots.length;
  const seen = turn.slots.includes(slot);
  let bonus = turn.nextPip ? 1 : 0;
  if (slot === 'left' && !seen && owns(state, 'flintShim')) bonus++;
  if (seen && !turn.fired.includes('reedLoom') && owns(state, 'reedLoom')) bonus += 2;
  if (played === 0 && turn.rerollsUsed === 0 && owns(state, 'loopWeight')) bonus += 2;
  if (played === 3 && owns(state, 'ironThread')) bonus += 2;
  if ((slot === 'right' || slot === 'far') && !seen && owns(state, 'counterweightCrown')) bonus += 3;
  if (played < 3 && combat.turn % 3 === 0 && owns(state, 'floodgateKey')) bonus += 3;
  if (turn.committedBlank && turn.pipped < 2 && owns(state, 'hollowPrism')) bonus += 2;
  return bonus;
}

export function afterRelicFace(state: State, slot: Slot, pips: number, parts: readonly Part[], previouslyGuarded: readonly Enemy[]): void {
  const combat = state.combat!;
  const turn = combat.relicTurn;
  if (!turn) return;

  if (pips > 0) {
    if (turn.slots.includes(slot)) claimTurnRelic(state, 'reedLoom');
    turn.pipped++;
    if (turn.nextPip) turn.nextPip = false;
    if (pips === 1 && claimTurnRelic(state, 'siltQuill')) turn.nextPip = true;
    if (combat.previous === pips && claimTurnRelic(state, 'twinwakeDial')) {
      for (const roll of combat.rolls) if (!roll.used) roll.boost++;
    }
  }

  turn.slots.push(slot);
  if (turn.slots.length === 3 && owns(state, 'reedShuttle')) combat.guard += 2;
  if ((slot === 'right' || slot === 'far') && claimTurnRelic(state, 'threadSpool')) combat.guard++;
  if (slot === 'top' && claimTurnRelic(state, 'sedgeLaces')) gainWard(combat, 1);
  if (pips >= 5 && claimTurnRelic(state, 'knottedCord')) combat.guard += 2;
  if (turn.slots.includes('top') && turn.slots.includes('bottom') && claimTurnRelic(state, 'waxBalance')) combat.guard += 3;
  if (turn.slots.includes('left') && turn.slots.includes('far') && claimTurnRelic(state, 'tideKnot')) gainWard(combat, 4);

  if (parts.some(part => part.kind === 'burn' || part.kind === 'seep' || part.kind === 'weak' || part.kind === 'vulnerable')
    && claimTurnRelic(state, 'siltSalt')) combat.guard += 2;

  const broken = previouslyGuarded.filter(enemy => enemy.guard === 0);
  if (broken.length && claimTurnRelic(state, 'fenTongs')) combat.guard += 2;
  const survivor = broken.find(enemy => enemy.hp > 0);
  if (survivor && claimTurnRelic(state, 'tideSlate')) {
    survivor.burn = (survivor.burn ?? 0) + 1;
    survivor.vulnerable++;
  }
  if (turn.slots.length === 1 && pips >= 3 && owns(state, 'mireGlass')) hitHealthiest(combat, 2);
  if (new Set(turn.slots).size >= 4 && claimTurnRelic(state, 'sixfoldBell')) {
    combat.guard += 6;
    hitHealthiest(combat, 6);
  }
}

export function relicsOnHpDamage(state: State, damage: number): void {
  const combat = state.combat!;
  if (damage > 0 && !combat.relicWardOnDamage && owns(state, 'clayFlask')) {
    combat.relicWardOnDamage = true;
    gainWard(combat, 4);
  }
}

/** End-turn Weak depends on the current play order, so show it in the enemy forecast too. */
export function compassTarget(combat: Combat): Enemy | undefined {
  const turn = combat.relicTurn;
  if (turn?.drownedCompass && !turn.slots.includes('center')) return healthiest(combat);
}

export function endRelicTurn(state: State, combat: Combat): void {
  const turn = combat.relicTurn;
  if (!turn) return;
  if (owns(state, 'keepersBead')) gainWard(combat, combat.rerolls);
  const enemy = compassTarget(combat);
  if (enemy) enemy.weak++;
}
