import type { Collections } from './data/types.ts';
import { compileDb } from './data/runtime.ts';
import characters from '../data/characters.json' with { type: 'json' };
import dice from '../data/dice.json' with { type: 'json' };
import faces from '../data/faces.json' with { type: 'json' };
import items from '../data/items.json' with { type: 'json' };
import keywords from '../data/keywords.json' with { type: 'json' };
import relics from '../data/relics.json' with { type: 'json' };
import rooms from '../data/rooms.json' with { type: 'json' };

/** The design data, as committed in data/*.json. */
export const DATA = { keywords, faces, dice, characters, items, relics, rooms } as unknown as Collections;

const compiled = compileDb(DATA);
for (const issue of compiled.issues) console.warn(`[data] ${issue.where}: ${issue.message}`);
if (!compiled.characters.length) {
  throw new Error(`No playable character: ${compiled.issues.map(i => `${i.where}: ${i.message}`).join('; ') || 'data/characters.json is empty'}`);
}

export const DICE = compiled.dice;

/** Library image path of the data's blank face, used for exerted dice. */
export const BLANK_IMAGE = DATA.faces.find(f => f.id === 'blank')?.image || undefined;

/** Every face image the game can show, so they can be loaded before the first draw. */
export const FACE_IMAGE_PATHS: string[] = [...new Set([
  ...Object.values(compiled.dice).flatMap(d => Object.values(d.faces).map(f => f.image)),
  ...Object.values(compiled.items).flatMap(i => Object.values(i.edits).map(f => f?.image)),
  BLANK_IMAGE,
].filter((p): p is string => !!p))];
export const ITEMS = compiled.items;
export const CHARACTERS = compiled.characters;
export const DATA_ISSUES = compiled.issues;
