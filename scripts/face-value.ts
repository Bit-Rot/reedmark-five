import { SLOTS } from '../src/model.ts';
import type { Face, Item, Part, Rarity, Slot } from '../src/model.ts';

export const STARTER_PIPS: Readonly<Record<Slot, number>> = {
  left: 4, center: 3, top: 2, bottom: 2, right: 1, far: 1,
};

const RARITY_BONUS: Record<Rarity, number> = { common: 0, uncommon: .10, rare: .20 };

/** Burn ticks at its current value and then loses a stack. Most targets last at most three useful ticks. */
function burnPips(stacks: number): number {
  const ticks = Math.min(3, stacks);
  return ticks * stacks - ticks * (ticks - 1) / 2;
}

/** Expected contribution in Damage or Block pips for an average planned row. */
export function estimateFaceValue(face: Face): number {
  const primary = face.parts[0]?.value ?? 0;
  const extraTargets = face.target === 'all' ? 1.5 : 1;
  function value(part: Part): number {
    const pips = part.value * (part.count ?? 1);
    switch (part.kind) {
      case 'hit': return pips * extraTargets;
      case 'guard': return pips;
      case 'heal': return pips * 1.4;
      case 'seep': return pips * 1.75 * extraTargets;
      case 'burn': return burnPips(pips) * .85 * extraTargets;
      case 'selfBurn': return burnPips(pips) * -.8;
      case 'selfDamage':
      case 'pain': return -pips;
      case 'weak': return pips * 2 * extraTargets;
      case 'vulnerable': return pips * 2 * extraTargets;
      case 'boost': return pips * .85;
      case 'ward': return pips * .8;
      case 'haste': return 3.5;
      case 'brace': return pips * 1.1;
      case 'neighborPair': return pips * .8;
      case 'bypass': return 1.5;
      case 'anchor': return pips * .85;
      case 'centered': return pips * .65;
      case 'flank': return pips * .65;
      case 'echo': return .65 * Math.max(0, 5 - primary);
      case 'fullHealth': return primary * .55 * extraTargets;
      case 'afterBurn': return pips * .4;
      case 'exert': return -2;
      case 'exhaust': return -1.5;
      case 'cantrip': return primary;
      case 'inspired': return primary * .35;
      case 'growth': return pips * .75;
      case 'burnDamage':
      case 'clearBurn': return 1;
      case 'burnDouble': return primary * .55;
      case 'burnPlays': return 1;
      case 'dieBlanks': return 1.75;
      case 'firstBurn': return pips * 1.1;
      case 'afterExhaust': return pips * .35;
      case 'kitBlanks': return Math.min(3.5, pips);
      case 'frenzyThreshold': return primary * .55;
      case 'frenzySpend': return pips * 1.5;
      case 'frenzyAll': return pips * 2.5;
      case 'pair': return primary * .4;
      case 'trio': return primary * .3;
      case 'petrified':
      case 'blank': return 0;
    }
  }
  return Math.max(0, face.parts.reduce((sum, part) => sum + value(part), (face.salvage ?? 0) * .35));
}

export function estimateImprint(item: Item) {
  const edits = SLOTS.flatMap(slot => {
    const face = item.edits[slot];
    return face ? [{ slot, starter: STARTER_PIPS[slot], estimate: estimateFaceValue(face) }] : [];
  });
  const ratio = 1.75 + Math.max(0, edits.length - 1) * .15 + RARITY_BONUS[item.rarity];
  const faces = edits.map(edit => ({ ...edit, target: edit.starter * ratio }));
  const starter = faces.reduce((sum, face) => sum + face.starter, 0);
  const estimate = faces.reduce((sum, face) => sum + face.estimate, 0);
  return { faces, ratio, estimate, budget: starter * ratio, gainPerRoll: (estimate - starter) / SLOTS.length };
}
