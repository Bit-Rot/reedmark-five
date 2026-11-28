import type { CampaignMap } from './campaign-map.ts';
import type { RelicEffect } from './relic-data.ts';

export const SLOTS = ['left', 'center', 'right', 'far', 'top', 'bottom'] as const;
export type Slot = typeof SLOTS[number];
export type Variant = 'fixed' | 'pool';
export const FORMATION_SIZE = 5;
export const SEQUENCE_KEYWORDS = ['burnPlays', 'afterBurn', 'firstBurn', 'echo', 'fullHealth', 'pair', 'trio', 'clearBurn'] as const;
export type SequenceKeyword = typeof SEQUENCE_KEYWORDS[number];
export type Kind = 'hit' | 'guard' | 'seep' | 'boost' | 'ward' | 'vulnerable' | 'weak' | 'exert' | 'cantrip' | 'blank' | 'growth' | 'inspired'
  | 'burn' | 'selfBurn' | 'heal' | 'exhaust' | 'burnDamage' | 'burnDouble' | 'afterExhaust'
  | 'dieBlanks' | 'kitBlanks' | 'frenzyThreshold' | 'frenzySpend' | 'frenzyAll' | 'petrified' | 'selfDamage' | 'pain' | SequenceKeyword;
/** Kinds that carry no number (they are either present or not). */
export const FLAG_KINDS: readonly Kind[] = ['exert', 'cantrip', 'blank', 'petrified', 'inspired', 'exhaust', 'burnDamage', 'burnDouble', 'dieBlanks', ...SEQUENCE_KEYWORDS.filter(kind => kind !== 'afterBurn' && kind !== 'firstBurn')];
export type TargetKind = 'enemy' | 'self' | 'die' | 'none' | 'all';
export type Target = { kind: TargetKind; id?: string };

export interface Part {
  kind: Kind;
  value: number;
  count?: number;
  /** Combat-only display state for a ready sequencing effect. */
  active?: boolean;
}

export function matchMultiplier(part: Part): number {
  if (!part.active) return 1;
  if (part.kind === 'pair') return 2;
  return part.kind === 'trio' ? 3 : 1;
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
export type Rarity = 'common' | 'uncommon' | 'rare';
export interface Relic {
  name: string;
  description: string;
  effect: RelicEffect;
  rarity: Rarity | 'starter';
  image?: string;
}
export interface DieDefinition {
  name: string;
  tone: string;
  faces: Record<Slot, Face>;
}
export interface Item {
  name: string;
  rewardCharacter?: string;
  rarity: Rarity;
  edits: Partial<Record<Slot, Face>>;
}
/** A keyword added to one face of a die (a camp upgrade). */
export interface Upgrade {
  keyword: string;
  x?: number;
}
export interface CopiedFace {
  template: string;
  slot: Slot;
  item?: string;
  upgrades?: Upgrade[];
}
export interface Die {
  id: string;
  template: string;
  imprints: Partial<Record<Slot, string>>;
  /** Keywords added to individual faces; an imprint replaces the face and clears that face's upgrades. */
  upgrades?: Partial<Record<Slot, Upgrade[]>>;
  item?: string;
  copies?: Partial<Record<Slot, CopiedFace>>;
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
export type SlotHazardKind = 'trap' | 'lock' | 'drain' | 'petrifyOnUse' | 'corruptOnUse';
export type DieHazardKind = 'petrifyDice' | 'corruptDice' | 'pain';

export type HazardSpec =
  | { kind: SlotHazardKind; value: number; targeting?: 'center' | 'edge'; slots?: number }
  | { kind: DieHazardKind; value: number; count?: number };

export type SlotHazard = { kind: SlotHazardKind; value: number; position: number };
export type DieHazard = { kind: DieHazardKind; value: number; dieId: string; faces: Slot[] };
export type EnemyHazard = SlotHazard | DieHazard;
export type FaceHazard = { kind: 'petrified' } | { kind: 'corrupted'; value: number };
export interface Intent {
  owner: string;
  move: Move;
  value: number;
  hazard?: EnemyHazard;
  hazards?: readonly EnemyHazard[];
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
  burn?: number;
  power: number;
  /** Stacks: +50% damage taken while above 0, lose 1 at the end of the enemy turn. */
  vulnerable: number;
  /** Stacks: -50% damage dealt while above 0, lose 1 at the end of the enemy turn. */
  weak: number;
}
export type IntentFace = readonly [Move, number, HazardSpec?];
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
export type Room = Encounter | { type: 'workshop' | 'camp' | 'shop' | 'map' | 'event' | 'treasure'; name: string };
export interface RelicTurn {
  slots: Slot[];
  fired: RelicEffect[];
  rerollsUsed: number;
  pipped: number;
  nextPip?: boolean;
  blankGuard?: string;
  committedBlank?: boolean;
  drownedCompass?: boolean;
}
export interface Combat {
  turn: number;
  phase: 'roll' | 'play';
  rerolls: number;
  /** Starting allowance before relic bonuses. Older Fixed Five saves used three. */
  baseRerolls?: number;
  enemies: Enemy[];
  intents: Intent[];
  faceHazards?: Record<string, Partial<Record<Slot, FaceHazard>>>;
  pain?: Record<string, number>;
  selfDamageTaken?: boolean;
  rolls: Roll[];
  bag: string[];
  guard: number;
  ward: number;
  burn?: number;
  /** Present when a relic grants Frenzy. */
  frenzy?: number;
  /** Slot key -> turn when exhausted. Old saves can omit this map. */
  exhausted?: Record<string, number>;
  /** Die ID -> the turn number during which all of that die's faces are blank. */
  exerted: Record<string, number>;
  /** `dieId:slot` -> pips a face has gained this fight (growth). */
  grown: Record<string, number>;
  /** Pips of the die played just before, this turn (inspired); null before the first one. */
  previous: number | null;
  /** Last two primary pip values before match multipliers, plus manual Burn plays this turn. */
  sequence?: { pips: number[]; burnPlays: number; lastBurn: boolean };
  /** What happened on the last roll that the player did not click (cantrips). */
  events: string[];
  relicTurn?: RelicTurn;
  relicWardOnDamage?: boolean;
}
export type FaceCopyOffer = { kind: 'faceCopy'; from: Slot; to: Slot; price: number };
export type Offer =
  | { kind: 'item'; id: string; price?: number }
  | { kind: 'relic'; id: string; price: number }
  | FaceCopyOffer
  | { kind: 'add' | 'transform'; id: string }
  | { kind: 'upgrade'; keyword: string; x?: number }
  | { kind: 'restore' | 'gold'; amount: number }
  | { kind: 'remove' | 'heal' };
export interface State {
  version: 5 | 6;
  map?: CampaignMap;
  variant: Variant;
  character: string;
  seed: number;
  rng: number;
  combatRng: number;
  room: number;
  hp: number;
  maxHp: number;
  /** Gold earned this run. */
  gold: number;
  /** Gold awarded by the fight that just ended (shown on the reward screen). */
  lastGold: number;
  nextDie: number;
  dice: Die[];
  phase: 'map' | 'battle' | 'reward' | 'victory' | 'defeat';
  combat: Combat | null;
  offers: Offer[];
  relics?: string[];
  bossSpoils?: { item?: string; relic?: string };
}
