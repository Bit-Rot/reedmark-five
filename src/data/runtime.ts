/**
 * Compiles the design data (data/*.json) into the game's own content types.
 * Pure functions over a `Collections`, so they run in the editor, tests and the game alike.
 */
import type { DieDefinition, Face as GameFace, Item as GameItem, Part, Slot, TargetKind } from '../model.ts';
import { SLOTS } from '../model.ts';
import type { Collections, Die, Face, Item, Keyword, SlotName, Targeting } from './types.ts';
import { SLOT_NAMES } from './types.ts';

/** Keywords the game engine can execute. Anything else on a face is reported by `compileDb`. */
export const IMPLEMENTED_KEYWORDS = ['damage', 'block', 'selfShield', 'poison', 'vulnerable', 'weak', 'exert', 'cantrip', 'growth', 'inspired', 'cleave'] as const;
export const TARGETINGS_SUPPORTED: readonly Targeting[] = ['none', 'self', 'singleEnemy', 'allEnemies'];
/** Item operations the game can execute. */
export const ITEM_OPS_SUPPORTED = ['setFace'] as const;

/** Data slot names to the game's slot names. */
export const SLOT_TO_GAME: Record<SlotName, Slot> = {
  left: 'left', middle: 'center', top: 'top', bottom: 'bottom', right: 'right', rightmost: 'far',
};

const TARGET_TO_GAME: Record<Targeting, TargetKind | undefined> = {
  none: 'none', self: 'self', singleEnemy: 'enemy', allEnemies: 'all',
};

export interface Diagnostic { where: string; message: string }

/**
 * Add one keyword to an already compiled face (used by camp upgrades and by `compileFace`).
 * Returns undefined when the keyword makes no sense on that face (a blank, an unaimed face for weak, ...).
 */
export function addKeywordToFace(face: GameFace, keyword: string, x?: number): GameFace | undefined {
  if (face.parts.some(part => part.kind === 'blank')) return undefined;
  const parts = [...face.parts];
  const hit = parts.find(part => part.kind === 'hit');
  const hasPips = parts.some(part => part.kind === 'hit' || part.kind === 'guard');
  const aimed = face.target === 'enemy' || face.target === 'all';
  const bump = (kind: Part['kind'], value: number) => {
    const at = parts.findIndex(part => part.kind === kind);
    if (at >= 0) parts[at] = { ...parts[at], value: parts[at].value + value };
    else parts.push({ kind, value });
  };
  switch (keyword) {
    case 'cantrip':
      if (face.target === 'none' || parts.some(part => part.kind === 'cantrip')) return undefined;
      parts.push({ kind: 'cantrip', value: 0 });
      break;
    case 'selfShield':
      if (!hit) return undefined;
      bump('guard', hit.value);
      break;
    case 'weak':
    case 'vulnerable':
      if (!aimed) return undefined;
      bump(keyword, x ?? 1);
      break;
    case 'growth':
      if (!hasPips) return undefined;
      bump('growth', x ?? 1);
      break;
    case 'inspired':
      if (!hasPips || parts.some(part => part.kind === 'inspired')) return undefined;
      parts.push({ kind: 'inspired', value: 0 });
      break;
    case 'cleave':
      if (face.target !== 'enemy') return undefined;
      return { ...face, parts, target: 'all' };
    default:
      return undefined;
  }
  return { ...face, parts };
}

/** Build a game face from a data face and the pips it carries on a die. */
export function compileFace(face: Face, pips: number | undefined, issues: Diagnostic[] = []): GameFace {
  const where = `face ${face.id}`;
  const uses = new Map(face.keywords.map(u => [u.keyword, u] as const));
  for (const u of face.keywords) {
    if (!(IMPLEMENTED_KEYWORDS as readonly string[]).includes(u.keyword)) issues.push({ where, message: `keyword "${u.keyword}" is not implemented in the game` });
  }
  const target = TARGET_TO_GAME[face.targeting];
  if (!target) issues.push({ where, message: `targeting "${face.targeting}" is not supported by the game yet` });
  const n = pips ?? 0;
  const needsPips = uses.has('damage') || uses.has('block') || uses.has('selfShield');
  if (needsPips && pips === undefined) issues.push({ where, message: 'needs pips on the die slot that uses it' });
  const xOf = (id: string): number => {
    const x = uses.get(id)?.x;
    if (x === undefined) issues.push({ where, message: `keyword "${id}" needs an X value` });
    return x ?? 0;
  };
  const parts: Part[] = [];
  if (uses.has('damage')) parts.push({ kind: 'hit', value: n });
  if (uses.has('block')) parts.push({ kind: 'guard', value: n });
  if (uses.has('selfShield')) parts.push({ kind: 'guard', value: n });
  if (uses.has('poison')) parts.push({ kind: 'seep', value: xOf('poison') });
  if (uses.has('vulnerable')) parts.push({ kind: 'vulnerable', value: xOf('vulnerable') });
  if (uses.has('weak')) parts.push({ kind: 'weak', value: xOf('weak') });
  if (uses.has('exert')) parts.push({ kind: 'exert', value: 0 });
  if (uses.has('cantrip')) parts.push({ kind: 'cantrip', value: 0 });
  // A face with nothing to do (no effect keywords) is a blank and cannot be played.
  if (!parts.some(p => p.kind !== 'exert' && p.kind !== 'cantrip')) {
    return { id: face.id, target: 'none', parts: [{ kind: 'blank', value: 0 }], ...(face.image ? { image: face.image } : {}) };
  }
  // Merge two guard parts (block + selfShield) so a face shows one Block value.
  const merged: Part[] = [];
  for (const p of parts) {
    const same = p.kind === 'guard' ? merged.find(m => m.kind === 'guard') : undefined;
    if (same) merged[merged.indexOf(same)] = { ...same, value: same.value + p.value };
    else merged.push(p);
  }
  const defaultTarget: TargetKind = merged.some(p => p.kind === 'hit' || p.kind === 'seep' || p.kind === 'vulnerable' || p.kind === 'weak') ? 'enemy' : 'self';
  let result: GameFace = { id: face.id, target: target && target !== 'none' ? target : defaultTarget, parts: merged, ...(face.image ? { image: face.image } : {}) };
  for (const keyword of ['growth', 'inspired', 'cleave']) {
    if (!uses.has(keyword)) continue;
    const next = addKeywordToFace(result, keyword, keyword === 'growth' ? xOf('growth') : undefined);
    if (next) result = next;
    else issues.push({ where, message: `keyword "${keyword}" does not fit this face` });
  }
  return result;
}

const titleCase = (id: string) => id.replace(/^die_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function compileDie(db: Collections, die: Die, issues: Diagnostic[] = []): DieDefinition {
  const faces = {} as Record<Slot, GameFace>;
  SLOT_NAMES.forEach((name, i) => {
    const slot = die.faces[i];
    const face = db.faces.find(f => f.id === slot?.face);
    if (!face) {
      issues.push({ where: `die ${die.id}`, message: `${name} uses missing face "${slot?.face ?? ''}"` });
      faces[SLOT_TO_GAME[name]] = { target: 'none', parts: [{ kind: 'blank', value: 0 }] };
      return;
    }
    const local: Diagnostic[] = [];
    faces[SLOT_TO_GAME[name]] = compileFace(face, slot.pips, local);
    for (const d of local) issues.push({ where: `die ${die.id} ${name}`, message: `${d.where}: ${d.message}` });
  });
  return { name: die.name || titleCase(die.id), tone: die.tone, faces };
}

/** Edits an item makes, keyed by game slot; undefined if the item uses operations the game cannot run. */
export function compileItem(db: Collections, item: Item, issues: Diagnostic[] = []): GameItem | undefined {
  const edits: Partial<Record<Slot, GameFace>> = {};
  for (const e of item.effects) {
    if (!(ITEM_OPS_SUPPORTED as readonly string[]).includes(e.op)) {
      issues.push({ where: `item ${item.id}`, message: `operation "${e.op}" is not supported by the game yet` });
      return undefined;
    }
    const face = db.faces.find(f => f.id === e.face);
    if (!face) {
      issues.push({ where: `item ${item.id}`, message: `uses missing face "${e.face ?? ''}"` });
      return undefined;
    }
    const slots = e.target === 'all' ? [...SLOT_NAMES] : e.target;
    const local: Diagnostic[] = [];
    const compiled = compileFace(face, e.pips, local);
    for (const d of local) issues.push({ where: `item ${item.id}`, message: `${d.where}: ${d.message}` });
    for (const s of slots) edits[SLOT_TO_GAME[s]] = compiled;
  }
  if (!Object.keys(edits).length) {
    issues.push({ where: `item ${item.id}`, message: 'has no effects' });
    return undefined;
  }
  return { name: item.name, rarity: item.rarity, edits };
}

export interface CompiledContent {
  dice: Record<string, DieDefinition>;
  items: Record<string, GameItem>;
  characters: { id: string; name: string; starterDice: string[] }[];
  /** Everything that stopped something from being usable. */
  issues: Diagnostic[];
}

/** Dice, items and characters with problems are left out (and listed in `issues`) rather than breaking the game. */
export function compileDb(db: Collections): CompiledContent {
  const issues: Diagnostic[] = [];
  const dice: Record<string, DieDefinition> = {};
  for (const d of db.dice) {
    const local: Diagnostic[] = [];
    const compiled = compileDie(db, d, local);
    issues.push(...local);
    if (!local.length) dice[d.id] = compiled;
  }
  const items: Record<string, GameItem> = {};
  for (const it of db.items) {
    const local: Diagnostic[] = [];
    const compiled = compileItem(db, it, local);
    issues.push(...local);
    if (compiled && !local.length) items[it.id] = compiled;
  }
  const characters: CompiledContent['characters'] = [];
  for (const c of db.characters) {
    const missing = c.starterDice.filter(id => !dice[id]);
    for (const id of missing) issues.push({ where: `character ${c.id}`, message: `starter die "${id}" is missing or has problems` });
    if (!missing.length && c.starterDice.length) characters.push({ id: c.id, name: c.name, starterDice: c.starterDice });
  }
  return { dice, items, characters, issues };
}

export function keywordIsImplemented(k: Keyword): boolean {
  return (IMPLEMENTED_KEYWORDS as readonly string[]).includes(k.id);
}

export { SLOTS };
