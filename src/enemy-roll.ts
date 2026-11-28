import { planHazards } from './hazards.ts';
import type { Combat, Encounter, Intent, IntentDie } from './model.ts';

const step = (seed: number): number => (Math.imul(seed, 1664525) + 1013904223) >>> 0;

function diceForTurn(room: Encounter, combat: Combat): readonly IntentDie[] {
  const boss = combat.enemies[0];
  return room.phaseTwo && boss.hp <= boss.maxHp / 2 ? room.phaseTwo : room.dice;
}

function ownerOf(room: Encounter, combat: Combat, die: IntentDie, campaign: boolean) {
  // Resumed encounters keep the combatants they already had. Newly authored escorts join new fights.
  if (!campaign) return combat.enemies[die.owner];
  const id = room.enemies[die.owner]?.id;
  return combat.enemies.find(enemy => enemy.id === id);
}

export function dieForIntent(room: Encounter, combat: Combat, index: number, campaign: boolean): IntentDie | undefined {
  const intent = combat.intents[index];
  if (!intent) return;
  const roll = intent.dieRoll;
  const recorded = roll && (roll.phaseTwo ? room.phaseTwo : room.dice)?.[roll.die];
  if (recorded && ownerOf(room, combat, recorded, campaign)?.id === intent.owner) return recorded;

  // Older saves did not record which die rolled the intent. Match the dice to that enemy's intents in order.
  const ordinal = combat.intents.slice(0, index).filter(other => other.owner === intent.owner).length;
  return diceForTurn(room, combat).filter(die => ownerOf(room, combat, die, campaign)?.id === intent.owner)[ordinal];
}

export function rollEnemyIntents(room: Encounter, combat: Combat, dieIds: readonly string[], seed: number,
  battle: number, campaign: boolean): Intent[] {
  const dice = diceForTurn(room, combat);
  const phaseTwo = dice === room.phaseTwo;
  let enemySeed = step((seed ^ Math.imul(battle, 0x5bd1e995) ^ Math.imul(combat.turn, 0x3a005a03)) >>> 0);
  let hazardSeed = step(enemySeed ^ 0xa531de97);
  const pick = (length: number) => {
    hazardSeed = step(hazardSeed);
    return Math.floor(hazardSeed / 4294967296 * length);
  };
  const intents: Intent[] = [];
  for (const [index, die] of dice.entries()) {
    enemySeed = step(enemySeed);
    const owner = ownerOf(room, combat, die, campaign);
    if (!owner || owner.hp <= 0) continue;
    const face = Math.floor(enemySeed / 4294967296 * 6);
    const [move, value, spec] = die.faces[face];
    const hazards = campaign && spec ? planHazards(spec, dieIds, pick, combat) : [];
    intents.push({ owner: owner.id, move, value, dieRoll: { die: index, face, phaseTwo }, ...(hazards.length ? { hazards } : {}) });
  }
  return intents;
}

export function validEnemyIntents(combat: Combat): boolean {
  return Array.isArray(combat.intents) && combat.intents.length <= Math.max(5, combat.enemies.length)
    && combat.intents.every(intent => combat.enemies.some(enemy => enemy.id === intent.owner));
}
