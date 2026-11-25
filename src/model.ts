export const SLOTS = ['left', 'center', 'right', 'far', 'top', 'bottom'] as const;
export type Slot = typeof SLOTS[number];
export type Variant = 'fixed' | 'pool';
export type Kind = 'hit' | 'guard' | 'seep' | 'boost' | 'ward' | 'vulnerable' | 'weak' | 'exert' | 'cantrip' | 'blank';
/** Kinds that carry no number (they are either present or not). */
export const FLAG_KINDS: readonly Kind[] = ['exert', 'cantrip', 'blank'];
export type TargetKind = 'enemy' | 'self' | 'die' | 'none';
export type Target = { kind: TargetKind; id?: string };

export interface Part {
  kind: Kind;
  value: number;
  count?: number;
}

export interface Face {
  target: TargetKind;
  parts: readonly Part[];
  salvage?: number;
  /** ID of the data face this was built from. */
  id?: string;
  /** Library image path (e.g. `face-art/library/sword.webp`) that the face is drawn with; effect icons are the fallback. */
  image?: string;
}
export interface DieDefinition {
  name: string;
  tone: string;
  faces: Record<Slot, Face>;
}
export interface Item {
  name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  edits: Partial<Record<Slot, Face>>;
}
export interface Die {
  id: string;
  template: string;
  imprints: Partial<Record<Slot, string>>;
  item?: string;
}
export interface Roll {
  dieId: string;
  slot: Slot;
  held: boolean;
  used: boolean;
  boost: number;
  salvaged: boolean;
}
export type Move = 'hit' | 'guard' | 'power' | 'wait';
export interface Intent {
  owner: string;
  move: Move;
  value: number;
}
export interface EnemyDefinition {
  id: string;
  name: string;
  sprite: string;
  hp: number;
}
export interface Enemy extends EnemyDefinition {
  maxHp: number;
  guard: number;
  seep: number;
  power: number;
  /** Stacks: +50% damage taken while above 0, lose 1 at the end of the enemy turn. */
  vulnerable: number;
  /** Stacks: -50% damage dealt while above 0, lose 1 at the end of the enemy turn. */
  weak: number;
}
export type IntentFace = readonly [Move, number];
export interface IntentDie {
  owner: number;
  faces: readonly IntentFace[];
}
export interface Encounter {
  type: 'battle';
  name: string;
  enemies: readonly EnemyDefinition[];
  dice: readonly IntentDie[];
  phaseTwo?: readonly IntentDie[];
  rank: 'normal' | 'elite' | 'boss';
}
export type Room = Encounter | { type: 'workshop' | 'camp'; name: string };
export interface Combat {
  turn: number;
  phase: 'roll' | 'play';
  rerolls: number;
  enemies: Enemy[];
  intents: Intent[];
  rolls: Roll[];
  bag: string[];
  guard: number;
  ward: number;
  /** Die ID -> the turn number during which all of that die's faces are blank. */
  exerted: Record<string, number>;
  /** What happened on the last roll that the player did not click (cantrips). */
  events: string[];
}
export type Offer =
  | { kind: 'item' | 'add' | 'transform'; id: string }
  | { kind: 'remove' | 'heal' };
export interface State {
  version: 2;
  variant: Variant;
  character: string;
  seed: number;
  rng: number;
  combatRng: number;
  room: number;
  hp: number;
  maxHp: number;
  nextDie: number;
  dice: Die[];
  phase: 'battle' | 'reward' | 'victory' | 'defeat';
  combat: Combat | null;
  offers: Offer[];
}
