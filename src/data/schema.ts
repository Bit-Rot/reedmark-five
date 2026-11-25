import { RELIC_EFFECTS } from '../relic-data.ts';
import type { CollectionName } from './types.ts';
import {
  EFFECT_OPS, FACE_STATUS, IMPLEMENTED, RARITIES, ROOM_KINDS, SHOP_OFFERS, TARGETING, TONES, VALUE_KINDS,
} from './types.ts';

/**
 * Field descriptions drive the editor forms, ID references (rename / used-by / delete),
 * validation and doc export. Reference fields store the target entity's ID.
 */
export type FieldDef =
  | { key: string; label: string; kind: 'text' | 'longtext' | 'number' | 'image' }
  | { key: string; label: string; kind: 'enum'; options: readonly string[] }
  | { key: string; label: string; kind: 'ref'; to: CollectionName; emptyLabel?: string }
  | { key: string; label: string; kind: 'refList'; to: CollectionName }
  | { key: string; label: string; kind: 'stringList' }
  | { key: string; label: string; kind: 'enumList'; options: readonly string[] }
  | { key: string; label: string; kind: 'keywordUses' }
  | { key: string; label: string; kind: 'dieFaces' }
  | { key: string; label: string; kind: 'effects' };

export interface CollectionSchema {
  name: CollectionName;
  singular: string;
  label: string;
  /** Field holding a human-readable name, if separate from the ID. */
  nameField?: string;
  fields: FieldDef[];
}

export const SCHEMA: Record<CollectionName, CollectionSchema> = {
  keywords: {
    name: 'keywords', singular: 'keyword', label: 'Keywords',
    fields: [
      { key: 'valueKind', label: 'Value', kind: 'enum', options: VALUE_KINDS },
      { key: 'ruleText', label: 'Rule text', kind: 'longtext' },
      { key: 'category', label: 'Category', kind: 'text' },
      { key: 'appliesTo', label: 'Applies to', kind: 'text' },
      { key: 'implemented', label: 'Implemented', kind: 'enum', options: IMPLEMENTED },
      { key: 'notes', label: 'Notes', kind: 'longtext' },
    ],
  },
  faces: {
    name: 'faces', singular: 'face', label: 'Faces',
    fields: [
      { key: 'targeting', label: 'Targeting', kind: 'enum', options: TARGETING },
      { key: 'keywords', label: 'Keywords', kind: 'keywordUses' },
      { key: 'image', label: 'Image', kind: 'image' },
      { key: 'status', label: 'Status', kind: 'enum', options: FACE_STATUS },
      { key: 'notes', label: 'Notes', kind: 'longtext' },
    ],
  },
  dice: {
    name: 'dice', singular: 'die', label: 'Dice', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'tone', label: 'Colour', kind: 'enum', options: TONES },
      { key: 'faces', label: 'Faces', kind: 'dieFaces' },
      { key: 'notes', label: 'Notes', kind: 'longtext' },
    ],
  },
  characters: {
    name: 'characters', singular: 'character', label: 'Characters', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'starterDice', label: 'Starter dice', kind: 'refList', to: 'dice' },
      { key: 'starterRelic', label: 'Starter relic', kind: 'ref', to: 'relics', emptyLabel: 'None' },
      { key: 'items', label: 'Items', kind: 'refList', to: 'items' },
      { key: 'unlocks', label: 'Unlocks', kind: 'stringList' },
      { key: 'notes', label: 'Notes', kind: 'longtext' },
    ],
  },
  items: {
    name: 'items', singular: 'item', label: 'Items', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'rewardCharacter', label: 'Reward pool', kind: 'ref', to: 'characters', emptyLabel: 'Shared (inactive)' },
      { key: 'rarity', label: 'Rarity', kind: 'enum', options: RARITIES },
      { key: 'description', label: 'Description', kind: 'longtext' },
      { key: 'effects', label: 'Effects', kind: 'effects' },
      { key: 'implemented', label: 'Implemented', kind: 'enum', options: IMPLEMENTED },
    ],
  },
  relics: {
    name: 'relics', singular: 'relic', label: 'Relics', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'description', label: 'Description', kind: 'longtext' },
      { key: 'trigger', label: 'Trigger', kind: 'text' },
      { key: 'effect', label: 'Effect', kind: 'enum', options: ['', ...RELIC_EFFECTS] },
      { key: 'rarity', label: 'Rarity', kind: 'enum', options: ['starter', ...RARITIES] },
      { key: 'image', label: 'Icon', kind: 'image' },
      { key: 'implemented', label: 'Implemented', kind: 'enum', options: IMPLEMENTED },
    ],
  },
  rooms: {
    name: 'rooms', singular: 'room', label: 'Room types', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'kind', label: 'Kind', kind: 'enum', options: ROOM_KINDS },
      { key: 'offers', label: 'Shop offers', kind: 'enumList', options: SHOP_OFFERS },
      { key: 'notes', label: 'Notes', kind: 'longtext' },
    ],
  },
};

export const EFFECT_OP_OPTIONS = EFFECT_OPS;
