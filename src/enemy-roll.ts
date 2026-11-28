import { planHazards } from './hazards.ts';
import type { Combat, Encounter, Intent } from './model.ts';

const step = (seed: number): number => (Math.imul(seed, 1664525) + 1013904223) >>> 0;

export function rollEnemyIntents(room: Encounter, combat: Combat, dieIds: readonly string[], seed: number,
  battle: number, campaign: boolean): Intent[] {
  const boss = combat.enemies[0];
  const dice = room.phaseTwo && boss.hp <= boss.maxHp / 2 ? room.phaseTwo : room.dice;
  let enemySeed = step((seed ^ Math.imul(battle, 0x5bd1e995) ^ Math.imul(combat.turn, 0x3a005a03)) >>> 0);
  let hazardSeed = step(enemySeed ^ 0xa531de97);
  const pick = (length: number) => {
    hazardSeed = step(hazardSeed);
    return Math.floor(hazardSeed / 4294967296 * length);
  };
  const intents: Intent[] = [];
  for (const die of dice) {
    enemySeed = step(enemySeed);
    // Resumed encounters keep the combatants they already had. Newly authored escorts join new fights.
    const id = room.enemies[die.owner]?.id;
    const owner = campaign ? combat.enemies.find(enemy => enemy.id === id) : combat.enemies[die.owner];
    if (!owner || owner.hp <= 0) continue;
    const [move, value, spec] = die.faces[Math.floor(enemySeed / 4294967296 * 6)];
    const hazards = campaign && spec ? planHazards(spec, dieIds, pick, combat) : [];
    intents.push({ owner: owner.id, move, value, ...(hazards.length ? { hazards } : {}) });
  }
  return intents;
}

export function validEnemyIntents(combat: Combat): boolean {
  return Array.isArray(combat.intents) && combat.intents.length <= Math.max(5, combat.enemies.length)
    && combat.intents.every(intent => combat.enemies.some(enemy => enemy.id === intent.owner));
}
