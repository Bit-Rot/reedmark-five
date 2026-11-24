import { DICE } from '../src/content.ts';
import { actionPreview, advance, canPlay, chooseOffer, commitRoll, effectiveParts, endTurn, facesFor, incoming,
  offerTargets, play, previewDie, reroll, rollFace, setHold } from '../src/game.ts';
import type { Face, State, Target } from '../src/model.ts';

function weight(face: Face): number {
  return face.parts.reduce((sum, part) => sum + part.value * (part.count ?? 1)
    * (part.kind === 'hit' ? 1 : part.kind === 'guard' ? .90 : part.kind === 'seep' ? 1.4 : part.kind === 'ward' ? .8 : .96),
  (face.salvage ?? 0) * .35);
}
const strength = (faces: Face[]) => faces.reduce((sum, face) => sum + weight(face), 0) / faces.length;


export type Command =
  | { action: 'reroll' | 'commit' | 'end' | 'skip' }
  | { action: 'hold'; id: string }
  | { action: 'play'; id: string; target: Target }
  | { action: 'take'; index: number; id?: string };

export function takeReward(s: State, commands?: Command[]): void {
  const choices = [];
  for (const [index, offer] of s.offers.entries()) {
    if (offer.kind === 'heal') {
      choices.push({ score: Math.min(10, s.maxHp - s.hp) * .24, index, id: undefined });
    } else if (offer.kind === 'add') {
      choices.push({ score: strength(Object.values(DICE[offer.id].faces)) - 3.5 - Math.max(0,s.dice.length - 10) * .5, index, id: undefined });
    } else for (const die of offerTargets(s, offer)) {
      const before = strength(Object.values(facesFor(die)));
      const after = previewDie(s, offer, die);
      choices.push({ score: after ? strength(Object.values(facesFor(after))) - before : 4.9 - before, index, id: die.id });
    }
  }
  const best = choices.sort((a, b) => b.score - a.score)[0];
  if (best?.score > .12) {
    chooseOffer(s, best.index, best.id);
    commands?.push({ action: 'take', index: best.index, id: best.id });
  } else {
    advance(s);
    commands?.push({ action: 'skip' });
  }
}

export function act(s: State, commands?: Command[]): void {
  const c = s.combat!;
  for (let attempt = 0; attempt < 2; attempt++) {
    const target = incoming(c);
    let guardKept = c.guard;
    const options = c.rolls.map(roll => {
      const face = rollFace(s, roll);
      const guard = face.parts.find(part => part.kind === 'guard')?.value ?? 0;
      return { roll, face, guard };
    }).sort((a, b) => b.guard - a.guard);
    for (const { roll, face, guard } of options) {
      const salvage = !!face.salvage && !roll.salvaged;
      const direct = face.parts.find(part => part.kind === 'hit');
      const damage = direct ? direct.value * (direct.count ?? 1) : 0;
      const keep = (guard > 0 && guardKept < target && !salvage)
        || damage >= 4 || weight(face) >= 4.5 && !salvage || attempt === 1 && damage >= 3;
      if (keep) guardKept += guard;
      if (setHold(s, roll.dieId, keep)) commands?.push({ action: 'hold', id: roll.dieId });
    }
    if (reroll(s)) commands?.push({ action: 'reroll' });
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
    const options = c.enemies.filter(e => e.hp > 0).map(enemy => {
      const next = actionPreview(s, roll.dieId, { kind: 'enemy', id: enemy.id })!;
      const after = next.enemies.find(e => e.id === enemy.id)!;
      const score = enemy.hp - after.hp + .52 * (enemy.guard - after.guard) + (after.seep - enemy.seep) * 1.45
        + (after.hp === 0 ? 4 + (incoming(c) - incoming(next)) : 0);
      return { enemy, score };
    }).sort((a, b) => b.score - a.score);
    if (options[0]) {
      const aim = { kind: 'enemy', id: options[0].enemy.id } as const;
      play(s, roll.dieId, aim);
      commands?.push({ action: 'play', id: roll.dieId, target: aim });
    }
  }
  if (s.phase !== 'battle') return;
  for (const roll of c.rolls) {
    const aim = { kind: 'self' } as const;
    if (play(s, roll.dieId, aim)) commands?.push({ action: 'play', id: roll.dieId, target: aim });
  }
  endTurn(s);
  commands?.push({ action: 'end' });
}
