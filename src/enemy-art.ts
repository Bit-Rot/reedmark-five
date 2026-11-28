import { intentHazards } from './hazards.ts';
import type { EnemyHazard, HazardSpec, Intent } from './model.ts';

const keys = ['hit', 'guard', 'power', 'trap', 'lock', 'drain', 'stone', 'rot', 'wait'] as const;
export type EnemyArt = typeof keys[number];

const paths = import.meta.glob('./art/enemy/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const art = new Map<EnemyArt, HTMLImageElement>();

export const enemyArtUrl = (key: EnemyArt): string => paths[`./art/enemy/${key}.webp`] ?? '';
export const enemyArtImage = (key: EnemyArt): HTMLImageElement | undefined => art.get(key);

export function hazardArt(hazard: EnemyHazard | HazardSpec): EnemyArt {
  switch (hazard.kind) {
    case 'trap':
    case 'lock':
    case 'drain': return hazard.kind;
    case 'petrifyOnUse':
    case 'petrifyDice': return 'stone';
    case 'corruptOnUse':
    case 'corruptDice':
    case 'pain': return 'rot';
  }
}

export function intentArt(intent: Intent): EnemyArt {
  const first = intentHazards(intent)[0];
  return intent.move === 'wait' && first ? hazardArt(first) : intent.move;
}

export async function loadEnemyArt(): Promise<void> {
  await Promise.all(keys.map(async key => {
    const url = enemyArtUrl(key);
    if (!url) return;
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      art.set(key, image);
    } catch {
      // The intent retains its text and fallback icon.
    }
  }));
}
