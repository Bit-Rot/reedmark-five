import { FLAG_KINDS, matchMultiplier } from './model.ts';
import type { Face, Kind, Part } from './model.ts';

export type EffectKey = Kind | 'salvage' | 'cleave' | 'frenzy';

export const EFFECTS: Record<EffectKey, { name: string; color: string; symbol: string; description: string }> = {
  hit: {
    name: 'Damage', color: '#a94736', symbol: '✦',
    description: 'Reduces the target’s HP. Block absorbs damage first. A multiplier shows how many times the face hits.',
  },
  guard: {
    name: 'Block', color: '#356b9a', symbol: '⬟',
    description: 'Absorbs incoming damage this turn. Unused Block clears at the start of your next turn.',
  },
  seep: {
    name: 'Poison', color: '#426a37', symbol: '◈',
    description: 'After enemies act, the target loses HP equal to its Poison. Poison bypasses Block and then decreases by 1.',
  },
  burn: {
    name: 'Burn', color: '#a85529', symbol: '♨',
    description: 'At the end of the burning side’s turn, it takes damage equal to its Burn, then loses one stack. Block absorbs Burn damage.',
  },
  selfBurn: {
    name: 'Self Burn', color: '#a85529', symbol: '♨',
    description: 'Apply Burn to yourself. Your Burn ticks before enemies act, then loses one stack.',
  },
  petrified: {
    name: 'Petrified', color: '#696e82', symbol: '◼',
    description: 'This face is blank for the rest of the fight.',
  },
  selfDamage: {
    name: 'Self damage', color: '#664361', symbol: '✷',
    description: 'This corrupted face damages you whenever you roll it.',
  },
  pain: {
    name: 'Pain', color: '#914f70', symbol: '✢',
    description: 'Take this much damage whenever you play this die.',
  },
  heal: {
    name: 'Heal', color: '#426a37', symbol: '♥',
    description: 'Recover HP up to your maximum.',
  },
  exhaust: {
    name: 'Exhaust', color: '#806345', symbol: '◌',
    description: 'After you play this face, its slot becomes blank for the rest of the fight.',
  },
  burnDamage: {
    name: 'Damage per Burn', color: '#a85529', symbol: '♨',
    description: 'Deal 1 extra damage for each Burn on you.',
  },
  burnDouble: {
    name: 'Double while burning', color: '#a85529', symbol: '×2',
    description: 'Deal double damage while you have any Burn.',
  },
  burnPlays: {
    name: 'Burn plays', color: '#a85529', symbol: '+♨',
    description: 'Add 1 pip for each earlier die you played that applied Burn this turn. Self Burn counts.',
  },
  afterBurn: {
    name: 'After Burn', color: '#9a5435', symbol: '↪',
    description: 'Add X pips if the die you just played this turn applied Burn. Self Burn counts.',
  },
  firstBurn: {
    name: 'First Burn', color: '#9a5435', symbol: '1ˢᵗ',
    description: 'Apply X more Burn if this is your first Burn play this turn.',
  },
  echo: {
    name: 'Echo', color: '#356b75', symbol: '≈',
    description: 'Use the previous die’s primary pips this turn, before Pair, Trio, or target modifiers. Use this face’s own pips if played first.',
  },
  fullHealth: {
    name: 'Full-HP strike', color: '#9d5840', symbol: '✷',
    description: 'Double this face’s damage against a target at full HP when it is hit.',
  },
  pair: {
    name: 'Pair', color: '#655d82', symbol: 'Ⅱ',
    description: 'Double this face’s damage or Block if the previous die had the same primary pips this turn. Use pips before match multipliers.',
  },
  trio: {
    name: 'Trio', color: '#655d82', symbol: 'Ⅲ',
    description: 'Triple this face’s damage or Block if the previous two dice both had the same primary pips this turn. Use pips before match multipliers.',
  },
  clearBurn: {
    name: 'Clear Self Burn', color: '#a85529', symbol: '♨',
    description: 'Deal 1 extra damage per Burn on you, then clear all your Burn.',
  },
  haste: {
    name: 'Haste', color: '#91601e', symbol: '>>',
    description: 'Play this first. The unspent die immediately to the right resolves twice when you play it.',
  },
  brace: {
    name: 'Brace', color: '#356b9a', symbol: '<>',
    description: 'Give each adjacent die +X to its Block. Brace works on either side, and two Braces can support the same die.',
  },
  neighborPair: {
    name: 'Pair', color: '#655d82', symbol: '=',
    description: 'Gain +X to your main effect if either neighbor has the same primary effect type. This bonus applies once.',
  },
  anchor: {
    name: 'Anchor', color: '#806345', symbol: '⊣',
    description: 'Gain +X to your main effect in slot 1 or 5.',
  },
  centered: {
    name: 'Center', color: '#806345', symbol: '⊙',
    description: 'Gain +X to your main effect in slot 3.',
  },
  flank: {
    name: 'Flank', color: '#655d82', symbol: '⋈',
    description: 'Gain +X to your main effect when your two neighbors are a Damage die and a Block die.',
  },
  bypass: {
    name: 'Bypass', color: '#356b9a', symbol: '⤴',
    description: 'Ignore all hazards in this slot when you play this face.',
  },
  afterExhaust: {
    name: 'After Exhaust', color: '#806345', symbol: '◌',
    description: 'Add X to the damage or Block shown if you have already exhausted a face this turn.',
  },
  dieBlanks: {
    name: 'Blanks on this die', color: '#655d82', symbol: '□',
    description: 'Add 1 damage or Block for each blank on this die, including exhausted slots.',
  },
  kitBlanks: {
    name: 'Blanks across your dice', color: '#655d82', symbol: '▦',
    description: 'Add 1 damage or Block per blank across your dice, including exhausted slots, up to +X.',
  },
  frenzy: {
    name: 'Frenzy', color: '#91601e', symbol: 'ϟ',
    description: 'Lampheart grants 1 Frenzy the first time you would take damage on each side’s turn.',
  },
  frenzyThreshold: {
    name: 'Frenzy threshold', color: '#91601e', symbol: 'ϟ',
    description: 'Double this face’s damage or Block pips at X or more Frenzy.',
  },
  frenzySpend: {
    name: 'Spend Frenzy', color: '#91601e', symbol: 'ϟ',
    description: 'Spend X Frenzy if available and add 2 damage or Block per stack spent.',
  },
  frenzyAll: {
    name: 'Spend all Frenzy', color: '#91601e', symbol: 'ϟ',
    description: 'Spend all Frenzy and add X damage or Block per stack spent.',
  },
  boost: {
    name: 'Tune', color: '#28766b', symbol: '✚',
    description: 'Increases another unspent die’s first Damage or Block value this turn. With multiple hits, it only boosts the first hit.',
  },
  ward: {
    name: 'Ward', color: '#694e99', symbol: '◒',
    description: 'Turns into Block at the start of your next turn. You can store up to 8 Ward.',
  },
  salvage: {
    name: 'Salvage', color: '#91601e', symbol: '↻',
    description: 'Reroll this face to gain the listed Block, once per die each turn.',
  },
  vulnerable: {
    name: 'Vulnerable', color: '#b0562e', symbol: '⚠',
    description: 'The target takes 50% more damage (rounded down) while it has stacks. It loses 1 stack at the end of each enemy turn.',
  },
  weak: {
    name: 'Weak', color: '#7d6a8f', symbol: '▾',
    description: 'The target deals 50% less damage (rounded down) while it has stacks. It loses 1 stack at the end of each enemy turn.',
  },
  exert: {
    name: 'Exert', color: '#8a6d3b', symbol: '⌛',
    description: 'After this face is used, every face on this die is blank until the end of next turn.',
  },
  cantrip: {
    name: 'Cantrip', color: '#a2427d', symbol: '✺',
    description: 'Fires by itself when it lands face up, at a random target. The die can still be rerolled and played.',
  },
  blank: {
    name: 'Blank', color: '#555d69', symbol: '·',
    description: 'Does nothing and cannot be played.',
  },
  growth: {
    name: 'Growth', color: '#4f8a3a', symbol: '↗',
    description: 'After this face is played, its pips increase by the listed amount for the rest of the fight.',
  },
  inspired: {
    name: 'Inspired', color: '#b08a2a', symbol: '✧',
    description: 'Doubles this face’s pips if the die played just before it had more pips.',
  },
  cleave: {
    name: 'Cleave', color: '#a2552e', symbol: '≋',
    description: 'Hits every enemy instead of one, and is played without choosing a target.',
  },
};

/** Library art for effects that have no hand-made icon of their own. */
const EFFECT_ART: Partial<Record<EffectKey, string>> = {
  burn: 'face-art/library/flame.webp',
  selfBurn: 'face-art/library/shield_flame.webp',
  heal: 'face-art/library/cross_plus.webp',
  exhaust: 'face-art/library/arrow_down.webp',
  burnDamage: 'face-art/library/flame.webp',
  fullHealth: 'face-art/library/stinger.webp',
  clearBurn: 'face-art/library/bomb_spark.webp',
  afterExhaust: 'face-art/library/arrow_up.webp',
  dieBlanks: 'face-art/library/blank.webp',
  kitBlanks: 'face-art/library/dice.webp',
  frenzy: 'face-art/library/lightning.webp',
  frenzyThreshold: 'face-art/library/lightning.webp',
  frenzySpend: 'face-art/library/claw.webp',
  frenzyAll: 'face-art/library/bomb_spark.webp',
  vulnerable: 'face-art/library/cracked_shield.webp',
  weak: 'face-art/library/sad_face.webp',
  exert: 'face-art/library/hourglass.webp',
  cantrip: 'face-art/library/sparkle.webp',
  growth: 'face-art/library/leaf.webp',
  inspired: 'face-art/library/star.webp',
  cleave: 'face-art/library/axe.webp',
  blank: 'face-art/library/blank.webp',
};

const artPaths = import.meta.glob('./art/faces/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const pictures = new Map<EffectKey, HTMLImageElement>();
export const effectUrl = (kind: EffectKey): string => artPaths[`./art/faces/${kind}.webp`] ?? (EFFECT_ART[kind] ? faceImageUrl(EFFECT_ART[kind]!) : '');
export const effectImage = (kind: EffectKey): HTMLImageElement | undefined => pictures.get(kind);

const facePictures = new Map<string, HTMLImageElement>();
/** URL of a face image path (relative to the site root) as seen from the page. */
export const faceImageUrl = (path: string): string => new URL(path, document.baseURI).href;
export const faceImage = (path: string | undefined): HTMLImageElement | undefined => (path ? facePictures.get(path) : undefined);

/** Preload face images so they can be drawn onto the dice immediately. */
export async function loadFaceImages(paths: readonly string[]): Promise<void> {
  await Promise.all(paths.map(async path => {
    const img = new Image();
    img.src = faceImageUrl(path);
    try {
      await img.decode();
      facePictures.set(path, img);
    } catch {
      // The effect icon still identifies the face if its image can't load.
    }
  }));
}

export async function loadEffectImages(): Promise<void> {
  await Promise.all((Object.keys(EFFECTS) as EffectKey[]).map(async kind => {
    const url = effectUrl(kind);
    if (!url) return;
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
      pictures.set(kind, img);
    } catch {
      // The fallback glyph still identifies the effect if an image can't load.
    }
  }));
}

/** Conditions use a small icon on the die. Their thresholds and costs are in the tooltip. */
export function showsEffectAmount(kind: EffectKey): boolean {
  return !FLAG_KINDS.includes(kind as Kind)
    && !['cleave', 'afterExhaust', 'afterBurn', 'firstBurn', 'kitBlanks', 'frenzyThreshold', 'frenzySpend', 'frenzyAll'].includes(kind);
}

export function modifierAmount(part: Part): string {
  const multiplier = matchMultiplier(part);
  return multiplier > 1 ? '×' + multiplier : '';
}

export function effectDescription(kind: EffectKey, part?: Part): string {
  const description = EFFECTS[kind].description;
  return part ? description.replaceAll('X', String(part.value)) : description;
}

export function faceEffects(face: Face): EffectKey[] {
  const kinds: EffectKey[] = [...new Set(face.parts.map(part => part.kind))];
  if (face.target === 'all') kinds.push('cleave');
  if (face.salvage) {
    kinds.push('salvage');
    if (!kinds.includes('guard')) kinds.push('guard');
  }
  return kinds;
}
