import { bossDue, distance, frontier, visibleTile } from '../src/campaign-map.ts';
import type { VisibleTile } from '../src/campaign-map.ts';
import { DICE, RELICS } from '../src/content.ts';
import { actionPreview, advance, canPlay, canTakeEventOffer, chooseOffer, commitRoll, currentRoom, effectiveParts, endTurn, eventChoiceFor, explore, faceFor, facesFor, incoming,
  offerTargets, placeDie, play, previewDie, previewUpgrade, reroll, rollFace, setHold, startBoss, upgradeTargets, usesFormation } from '../src/game.ts';
import { playHazardDamage, slotLocked } from '../src/hazards.ts';
import { estimateFaceValue } from './face-value.ts';
import type { Face, Roll, Slot, State, Target } from '../src/model.ts';

function weight(face: Face): number {
  return face.parts.reduce((sum, part) => sum + part.value * (part.count ?? 1)
    * (part.kind === 'hit' ? 1 : part.kind === 'guard' ? .90 : part.kind === 'seep' ? 1.4 : part.kind === 'ward' ? .8 : .96),
  (face.salvage ?? 0) * .35);
}
const strength = (faces: Face[], score: (face: Face) => number) =>
  faces.reduce((sum, face) => sum + score(face), 0) / faces.length;


export type Command =
  | { action: 'reroll' | 'commit' | 'end' | 'skip' | 'boss' }
  | { action: 'explore'; id: string }
  | { action: 'hold'; id: string }
  | { action: 'place'; id: string; position: number }
  | { action: 'play'; id: string; target: Target }
  | { action: 'take'; index: number; id?: string; slot?: Slot };

export const MAP_POLICIES = ['cautious', 'elite', 'treasure'] as const;
export type MapPolicy = (typeof MAP_POLICIES)[number];

export function takeMapTurn(state: State, policy: MapPolicy, commands?: Command[]): boolean {
  const map = state.map;
  if (state.phase !== 'map' || !map) return false;
  if (bossDue(map)) {
    if (!startBoss(state)) return false;
    commands?.push({ action: 'boss' });
    return true;
  }
  const reachable = frontier(map);
  const known = map.tiles.map(tile => ({ tile, kind: visibleTile(tile, reachable) }));
  const hp = state.hp / state.maxHp;
  const values: Record<VisibleTile, number> = {
    normal: hp > .6 ? 6 : 3.5,
    camp: hp < .74 ? 10 : 4,
    shop: state.gold >= 50 ? 6.4 : 3,
    event: hp > .5 ? 6 : 7,
    elite: hp > .7 ? 5.5 : 1,
    treasure: 8, mountain: 0, unknown: 0, cleared: 0,
  };
  const eventsThisCycle = map.eventVisits;
  values.event += eventsThisCycle < 4 ? .7 : -.9;
  if (policy === 'elite' && hp > .61) values.elite = 13;
  if (policy === 'treasure') values.treasure = 14;
  const position = map.tiles.find(tile => tile.id === map.last)!;
  const options = known.filter(({ tile }) => reachable.has(tile.id)).map(({ tile, kind }) => {
    const nearbyInterest = known.reduce((best, other) => {
      if (other.kind === 'unknown' || other.kind === 'cleared' || other.kind === 'mountain' || reachable.has(other.tile.id)) return best;
      const d = distance(tile, other.tile);
      if (d > 5) return best;
      return Math.max(best, (values[other.kind] - 4) / (1 + d * .8));
    }, 0);
    const tie = Math.abs((Math.imul(state.seed + map.turn + 1, 1013904223) ^ Math.imul(tile.q, 73856093) ^ Math.imul(tile.r, 19349663)) % 997) / 9970;
    return { id: tile.id, score: values[kind] + nearbyInterest - distance(tile, position) * .03 + tie };
  }).sort((a, b) => b.score - a.score);
  if (!options.length || !explore(state, options[0].id)) return false;
  commands?.push({ action: 'explore', id: options[0].id });
  return true;
}

export function takeReward(s: State, commands?: Command[]): void {
  const choices: { score: number; index: number; id: string | undefined; slot?: Slot }[] = [];
  const room = currentRoom(s);
  const shopping = room.type === 'shop';
  const ordered = usesFormation(s);
  const scoreFace = ordered ? estimateFaceValue : weight;
  for (const [index, offer] of s.offers.entries()) {
    const event = eventChoiceFor(s, index);
    const before = choices.length;
    if (event && !canTakeEventOffer(s, index)) continue;
    if (shopping && 'price' in offer && (offer.price ?? Infinity) > s.gold) continue;
    if (offer.kind === 'relic') {
      const rarity = RELICS[offer.id].rarity;
      choices.push({ score: rarity === 'rare' ? 1.25 : rarity === 'uncommon' ? .9 : .55, index, id: undefined });
    } else if (offer.kind === 'gold') {
      choices.push({ score: offer.amount * .07, index, id: undefined });
    } else if (offer.kind === 'restore') {
      choices.push({ score: Math.min(offer.amount, s.maxHp - s.hp) * .25, index, id: undefined });
    } else if (offer.kind === 'heal') {
      choices.push({ score: Math.min(10, s.maxHp - s.hp) * .24, index, id: undefined });
    } else if (offer.kind === 'upgrade') {
      const bonus: Record<string, number> = { cleave: 1.2, cantrip: 1, inspired: .4, growth: .6 };
      for (const { dieId, slot } of upgradeTargets(s, offer)) {
        const die = s.dice.find(d => d.id === dieId)!;
        const gain = scoreFace(previewUpgrade(die, slot, offer)!) - scoreFace(faceFor(die, slot))
          + (ordered ? 0 : bonus[offer.keyword] ?? 0);
        choices.push({ score: gain, index, id: dieId, slot });
      }
    } else if (offer.kind === 'add') {
      choices.push({ score: strength(Object.values(DICE[offer.id].faces), scoreFace) - 3.5 - Math.max(0,s.dice.length - 10) * .5, index, id: undefined });
    } else for (const die of offerTargets(s, offer)) {
      const before = strength(Object.values(facesFor(die)), scoreFace);
      const after = previewDie(s, offer, die);
      const bonus = room.type === 'battle' && room.rank === 'boss' ? .8 : 0;
      choices.push({ score: (after ? strength(Object.values(facesFor(after)), scoreFace) - before : 4.9 - before) + bonus, index, id: die.id });
    }
    if (event) {
      const cost = (event.gold ?? 0) * .045 + (event.hp ?? 0) * (s.hp < 16 ? .23 : .11);
      for (const option of choices.slice(before)) option.score -= cost;
    }
  }
  const best = choices.sort((a, b) => b.score - a.score)[0];
  if (best?.score > .12 && chooseOffer(s, best.index, best.id, best.slot)) {
    commands?.push({ action: 'take', index: best.index, id: best.id, slot: best.slot });
  } else {
    advance(s);
    commands?.push({ action: 'skip' });
  }
}

/** Play the row in position order so neighboring Haste and sequence effects can pay off. */
function playFormation(state: State, commands?: Command[]): void {
  const combat = state.combat!;
  for (const [index, placement] of combat.formation!.entries()) {
    if (state.phase !== 'battle') return;
    if (!placement) continue;
    const roll = combat.rolls.find(candidate => candidate.dieId === placement.dieId)!;
    const face = rollFace(state, roll);
    if (face.target === 'none' || slotLocked(combat, index, face)
      || playHazardDamage(combat, index, roll.dieId, face) >= state.hp + combat.guard) continue;
    let target: Target;
    if (face.target === 'enemy') {
      const enemy = combat.enemies.find(enemy => enemy.hp > 0)!;
      target = { kind: 'enemy', id: enemy.id };
    } else if (face.target === 'die') {
      const other = combat.rolls.find(candidate => canPlay(state, roll.dieId, { kind: 'die', id: candidate.dieId }));
      if (!other) continue;
      target = { kind: 'die', id: other.dieId };
    } else {
      target = { kind: face.target };
    }
    if (play(state, roll.dieId, target)) commands?.push({ action: 'play', id: roll.dieId, target });
  }
}

function bestFormation(state: State): { id: string; position: number }[] {
  const combat = state.combat!;
  const scratch: State = { ...state, combat: structuredClone(combat) };
  const positions = combat.formation!.flatMap((slot, index) => slot ? [] : [index]);
  let best: ReturnType<typeof bestFormation> = [];
  let bestScore = -Infinity;
  const plan: typeof best = [];
  function fill(remaining: Roll[]): void {
    if (!remaining.length) {
      const next = { ...scratch, combat: structuredClone(scratch.combat!), relics: scratch.relics?.slice() };
      commitRoll(next);
      playFormation(next);
      const progress = next.combat.enemies.reduce((sum, enemy, index) => {
        const before = combat.enemies[index];
        return sum + before.hp - enemy.hp + .45 * (before.guard - enemy.guard)
          + 1.25 * (enemy.burn ?? 0) * Number(enemy.hp > 0) + (before.hp > 0 && enemy.hp === 0 ? 4 : 0);
      }, 0);
      const damage = next.phase === 'battle'
        ? Math.max(0, incoming(next.combat) + (next.combat.burn ?? 0) - next.combat.guard)
        : 0;
      const score = progress + next.hp - state.hp - damage * (state.hp < 15 ? 4 : 2.7);
      if (score > bestScore) {
        bestScore = score;
        best = [...plan];
      }
      return;
    }
    const position = positions[plan.length];
    for (const roll of remaining) {
      const id = roll.dieId;
      placeDie(scratch, id, position);
      plan.push({ id, position });
      fill(remaining.filter(other => other !== roll));
      plan.pop();
      scratch.combat!.formation![position] = null;
      roll.held = false;
    }
  }
  fill(scratch.combat!.rolls.filter(roll => !roll.held));
  return best;
}

function actWithFormation(state: State, commands?: Command[]): void {
  const combat = state.combat!;
  const place = ({ id, position }: { id: string; position: number }) => {
    if (placeDie(state, id, position)) commands?.push({ action: 'place', id, position });
  };
  let plan = bestFormation(state);
  while (combat.rerolls && plan.length) {
    const min = combat.rerolls === 1 ? 3 : 4;
    let defense = incoming(combat) - combat.guard;
    for (const entry of plan) {
      const roll = combat.rolls.find(candidate => candidate.dieId === entry.id)!;
      const face = rollFace(state, roll);
      if (slotLocked(combat, entry.position, face)) continue;
      const block = face.parts.find(part => part.kind === 'guard')?.value ?? 0;
      if (estimateFaceValue(face) >= min && (!block || defense > 0)) {
        place(entry);
        defense -= block;
      }
    }
    if (!reroll(state)) break;
    commands?.push({ action: 'reroll' });
    if (state.phase !== 'battle') return;
    plan = bestFormation(state);
  }
  plan.forEach(place);
  if (commitRoll(state)) commands?.push({ action: 'commit' });
  playFormation(state, commands);
  if (endTurn(state)) commands?.push({ action: 'end' });
}

export function act(s: State, commands?: Command[]): void {
  if (usesFormation(s)) {
    actWithFormation(s, commands);
    return;
  }
  const c = s.combat!;
  const attempts = c.rerolls;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const target = incoming(c);
    let guardKept = c.guard;
    const options = c.rolls.map(roll => {
      const face = rollFace(s, roll);
      const guard = face.parts.find(part => part.kind === 'guard')?.value ?? 0;
      return { roll, face, guard };
    }).sort((a, b) => b.guard - a.guard);
    const decisions = options.map(({ roll, face, guard }) => {
      const salvage = !!face.salvage && !roll.salvaged;
      const direct = face.parts.find(part => part.kind === 'hit');
      const damage = direct ? direct.value * (direct.count ?? 1) : 0;
      const keep = (guard > 0 && guardKept < target && !salvage)
        || damage >= 4 || weight(face) >= 4.5 && !salvage || attempt === attempts - 1 && damage >= 3;
      if (keep) guardKept += guard;
      return { roll, keep };
    });
    // Release changed holds before the next reroll.
    for (const { roll, keep } of decisions.filter(d => !d.keep)) {
      if (setHold(s, roll.dieId, false)) commands?.push({ action: 'hold', id: roll.dieId });
    }
    for (const { roll, keep } of decisions.filter(d => d.keep)) {
      if (setHold(s, roll.dieId, keep)) commands?.push({ action: 'hold', id: roll.dieId });
    }
    if (reroll(s)) commands?.push({ action: 'reroll' });
    if (s.phase !== 'battle') return;
  }
  commitRoll(s);
  commands?.push({ action: 'commit' });
  for (const roll of c.rolls) {
    if (rollFace(s, roll).target !== 'die') continue;
    const available = c.rolls.filter(other => canPlay(s, roll.dieId, { kind: 'die', id: other.dieId }));
    const target = available.find(other => rollFace(s, other).target === 'enemy') ?? available.find(other => rollFace(s, other).target === 'self') ?? available[0];
    if (target) {
      const aim = { kind: 'die', id: target.dieId } as const;
      play(s, roll.dieId, aim);
      commands?.push({ action: 'play', id: roll.dieId, target: aim });
    }
  }
  const attacks = c.rolls.filter(roll => !roll.used && rollFace(s, roll).target === 'enemy')
    .sort((a, b) => {
      const power = (r: typeof a) => effectiveParts(rollFace(s, r), r.boost).filter(p => p.kind === 'hit').reduce((sum,p) => sum+p.value*(p.count ?? 1), 0);
      return power(b) - power(a);
    });
  for (const roll of attacks) {
    if (s.phase !== 'battle') return;
    const options = c.enemies.filter(e => e.hp > 0).flatMap(enemy => {
      const next = actionPreview(s, roll.dieId, { kind: 'enemy', id: enemy.id });
      if (!next || next.playerHp <= 0) return [];
      const after = next.enemies.find(e => e.id === enemy.id)!;
      const score = enemy.hp - after.hp + .52 * (enemy.guard - after.guard) + (after.seep - enemy.seep) * 1.45
        + (after.hp === 0 ? 4 + (incoming(c) - incoming(next)) : 0);
      return [{ enemy, score: score - 2 * (s.hp - next.playerHp) }];
    }).sort((a, b) => b.score - a.score);
    if (options[0]) {
      const aim = { kind: 'enemy', id: options[0].enemy.id } as const;
      play(s, roll.dieId, aim);
      commands?.push({ action: 'play', id: roll.dieId, target: aim });
    }
  }
  if (s.phase !== 'battle') return;
  for (const roll of c.rolls) {
    const wide = { kind: 'all' } as const;
    if (!roll.used && rollFace(s, roll).target === 'all' && (actionPreview(s, roll.dieId, wide)?.playerHp ?? 0) > 0 && play(s, roll.dieId, wide)) commands?.push({ action: 'play', id: roll.dieId, target: wide });
    if (s.phase !== 'battle') return;
  }
  for (const roll of c.rolls) {
    const aim = { kind: 'self' } as const;
    if ((actionPreview(s, roll.dieId, aim)?.playerHp ?? 0) > 0 && play(s, roll.dieId, aim)) commands?.push({ action: 'play', id: roll.dieId, target: aim });
  }
  endTurn(s);
  commands?.push({ action: 'end' });
}
