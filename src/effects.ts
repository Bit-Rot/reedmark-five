import type { Face, Kind } from './model.ts';

export type EffectKey = Kind | 'salvage' | 'cleave';

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

export function faceEffects(face: Face): EffectKey[] {
  const kinds: EffectKey[] = [...new Set(face.parts.map(part => part.kind))];
  if (face.target === 'all') kinds.push('cleave');
  if (face.salvage) {
    kinds.push('salvage');
    if (!kinds.includes('guard')) kinds.push('guard');
  }
  return kinds;
}
