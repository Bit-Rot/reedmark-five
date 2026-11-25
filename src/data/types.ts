/** Slot names for a die's "t" diagram. Index 0..5 = Face 1..6 in the design docs. */
export const SLOT_NAMES = ['left', 'middle', 'top', 'bottom', 'right', 'rightmost'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

export const TARGETING = ['none', 'self', 'singleEnemy', 'allEnemies'] as const;
export type Targeting = (typeof TARGETING)[number];

export const VALUE_KINDS = ['none', 'pips', 'x'] as const;
export type ValueKind = (typeof VALUE_KINDS)[number];

export const IMPLEMENTED = ['planned', 'partial', 'implemented'] as const;
export type Implemented = (typeof IMPLEMENTED)[number];

export const FACE_STATUS = ['active', 'inactive'] as const;
export type FaceStatus = (typeof FACE_STATUS)[number];

export const RARITIES = ['common', 'uncommon', 'rare'] as const;
export type Rarity = (typeof RARITIES)[number];

export const EFFECT_OPS = ['setFace', 'addKeyword', 'pipDelta', 'setPips'] as const;
export type EffectOp = (typeof EFFECT_OPS)[number];

export const ROOM_KINDS = ['upgrade', 'shop', 'other'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export const TONES = ['rust', 'blue', 'olive', 'jade', 'sand'] as const;
export type Tone = (typeof TONES)[number];

export const SHOP_OFFERS = ['items', 'relics', 'potions'] as const;
export type ShopOffer = (typeof SHOP_OFFERS)[number];

export interface Keyword {
  id: string;
  /** Where the keyword's number comes from: nothing, the face's pips (N), or a value written on the keyword (X). */
  valueKind: ValueKind;
  ruleText: string;
  category: string;
  /** Free-text list of what the keyword can attach to (carried over from the design docs). */
  appliesTo: string;
  implemented: Implemented;
  notes: string;
}

export interface KeywordUse {
  keyword: string;
  x?: number;
}

export interface Face {
  id: string;
  targeting: Targeting;
  keywords: KeywordUse[];
  /** Library image path relative to the site root, e.g. `face-art/library/sword.webp` (empty for none). */
  image: string;
  notes: string;
  status: FaceStatus;
}

export interface DieSlot {
  face: string;
  pips?: number;
}

export interface Die {
  id: string;
  name: string;
  /** Colour family used to draw the die in the game. */
  tone: Tone;
  /** Exactly six entries, in the order of SLOT_NAMES. */
  faces: DieSlot[];
  notes: string;
}

export interface Character {
  id: string;
  name: string;
  starterDice: string[];
  items: string[];
  unlocks: string[];
  notes: string;
}

export interface ItemEffect {
  /** Slots affected, or 'all' for every face on the die. */
  target: SlotName[] | 'all';
  op: EffectOp;
  /** setFace: the face to place; setPips/pipDelta use `pips`/`delta`. */
  face?: string;
  keyword?: string;
  x?: number;
  delta?: number;
  pips?: number;
}

export interface Item {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  effects: ItemEffect[];
  implemented: Implemented;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  trigger: string;
  implemented: Implemented;
}

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  offers: ShopOffer[];
  notes: string;
}

export interface Collections {
  keywords: Keyword[];
  faces: Face[];
  dice: Die[];
  characters: Character[];
  items: Item[];
  relics: Relic[];
  rooms: Room[];
}

export type CollectionName = keyof Collections;
export const COLLECTION_NAMES: CollectionName[] = ['keywords', 'faces', 'dice', 'characters', 'items', 'relics', 'rooms'];

export type Entity = Collections[CollectionName][number];

export function emptyDb(): Collections {
  return { keywords: [], faces: [], dice: [], characters: [], items: [], relics: [], rooms: [] };
}
