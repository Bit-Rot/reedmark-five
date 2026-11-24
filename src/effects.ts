import type { Face, Kind } from './model.ts';

export type EffectKey = Kind | 'salvage';

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
};

const artPaths = import.meta.glob('./art/faces/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const pictures = new Map<EffectKey, HTMLImageElement>();
export const effectUrl = (kind: EffectKey): string => artPaths[`./art/faces/${kind}.webp`] ?? '';
export const effectImage = (kind: EffectKey): HTMLImageElement | undefined => pictures.get(kind);

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
  if (face.salvage) {
    kinds.push('salvage');
    if (!kinds.includes('guard')) kinds.push('guard');
  }
  return kinds;
}
