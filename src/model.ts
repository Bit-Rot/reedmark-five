export const SLOTS = ['left', 'center', 'right', 'far', 'top', 'bottom'] as const;
export type Slot = typeof SLOTS[number];
export type Variant = 'fixed' | 'pool';
export type Kind = 'hit' | 'guard' | 'seep' | 'boost' | 'ward';
export type TargetKind = 'enemy' | 'self' | 'die';
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
}
export type Offer =
  | { kind: 'item' | 'add' | 'transform'; id: string }
  | { kind: 'remove' | 'heal' };
export interface State {
  version: 1;
  variant: Variant;
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
