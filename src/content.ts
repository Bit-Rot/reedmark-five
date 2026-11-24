import { SLOTS } from './model.ts';
import type { DieDefinition, Encounter, Face, IntentDie, IntentFace, Item, Part, Room, Slot, TargetKind } from './model.ts';

const part = (kind: Part['kind'], value: number, count?: number): Part => ({ kind, value, count });
const face = (target: TargetKind, ...parts: Part[]): Face => ({ target, parts });
const strike = (n: number, count?: number) => face('enemy', part('hit', n, count));
const guard = (n: number, salvage?: number): Face => ({ ...face('self', part('guard', n)), salvage });
const seep = (n: number, hit = 0) => face('enemy', ...(hit ? [part('hit', hit), part('seep', n)] : [part('seep', n)]));
const split = (hit: number, cover: number) => face('enemy', part('hit', hit), part('guard', cover));
const brace = (cover: number, ward: number) => face('self', part('guard', cover), part('ward', ward));
const tune = (cover: number, value: number) => face('die', part('guard', cover), part('boost', value));

function die(name: string, tone: string, left: Face, center: Face, right: Face, far: Face, top: Face, bottom: Face): DieDefinition {
  const values = [left, center, right, far, top, bottom];
  return { name, tone, faces: Object.fromEntries(SLOTS.map((slot, i) => [slot, values[i]])) as Record<Slot, Face> };
}

export const DICE: Record<string, DieDefinition> = {
  needle: die('Needle', 'rust', strike(2, 3), strike(4), strike(3), strike(2), guard(3), seep(1, 2)),
  cowl: die('Cowl', 'blue', guard(6), guard(4), guard(3), strike(2), guard(4), brace(2, 2)),
  bristle: die('Bristle', 'olive', seep(3, 3), seep(1, 3), seep(2), strike(2), guard(3), face('enemy', part('guard', 2), part('seep', 1))),
  switch: die('Switch', 'jade', tune(3, 2), strike(3), guard(3, 2), strike(2), guard(3), tune(2, 1)),
  whet: die('Whet', 'sand', strike(6), strike(4), strike(3), strike(2), guard(4), split(2, 2)),
  fork: die('Fork', 'rust', strike(2, 3), strike(2, 2), strike(3), guard(2), guard(3), split(2, 1)),
  mantle: die('Mantle', 'blue', guard(5), guard(4), guard(3, 2), strike(2), guard(4), brace(2, 2)),
  tincture: die('Tincture', 'olive', seep(4, 2), seep(3), seep(1, 3), strike(1), guard(3), face('enemy', part('guard', 2), part('seep', 1))),
  shuttle: die('Shuttle', 'jade', tune(4, 2), guard(3), strike(3), strike(2), brace(2, 2), guard(2, 2)),
  skirmish: die('Skirmish', 'sand', split(5, 2), strike(4), split(3, 1), strike(2), guard(3), guard(4)),
  knurl: die('Knurl', 'rust', strike(2, 4), strike(5), strike(2, 2), strike(2), guard(3), split(3, 2)),
  reservoir: die('Reservoir', 'olive', seep(5, 2), seep(3, 2), seep(3), split(2, 1), guard(4), brace(3, 2)),
  shuck: die('Shuck', 'blue', brace(5, 4), guard(5, 2), guard(4), split(2, 1), guard(5), strike(4)),
  ricochet: die('Ricochet', 'jade', tune(4, 3), split(4, 2), guard(3, 3), strike(3), tune(2, 2), strike(2, 2)),
  emberpin: die('Emberpin', 'sand', split(7, 2), strike(6), seep(2, 3), strike(3), guard(5), guard(4, 2)),
};
export const STARTERS = ['needle', 'cowl', 'bristle', 'switch', 'whet', 'fork', 'mantle', 'tincture', 'shuttle', 'skirmish'];
export const DISCOVERIES = ['knurl', 'reservoir', 'shuck', 'ricochet', 'emberpin'];

export const ITEMS: Record<string, Item> = {
  chitin: { name: 'Chitin Stitch', rarity: 'common', edits: { left: strike(7) } },
  sea: { name: 'Sea Thread', rarity: 'common', edits: { top: guard(4), bottom: brace(3, 2) } },
  nick: { name: 'Nickstone', rarity: 'common', edits: { center: split(4, 2) } },
  shale: { name: 'Shale Tooth', rarity: 'common', edits: { far: strike(4) } },
  moss: { name: 'Moss Vial', rarity: 'common', edits: { right: seep(2, 2) } },
  copper: { name: 'Copper Flecks', rarity: 'common', edits: { far: guard(3, 2) } },
  clove: { name: 'Iron Clove', rarity: 'common', edits: { bottom: seep(2, 3) } },
  spindles: { name: 'Twin Spindles', rarity: 'uncommon', edits: { right: strike(2, 2), far: split(3, 2) } },
  wreath: { name: 'Wicker Wreath', rarity: 'uncommon', edits: { top: guard(5), bottom: brace(4, 2) } },
  retort: { name: 'Violet Retort', rarity: 'uncommon', edits: { center: seep(3, 3) } },
  snag: { name: 'Snag Loop', rarity: 'uncommon', edits: { center: guard(4, 3), far: strike(4) } },
  wax: { name: 'Pitchwax', rarity: 'uncommon', edits: { left: tune(4, 3), bottom: guard(4) } },
  salt: { name: 'Salt Crown', rarity: 'rare', edits: { left: seep(5, 4) } },
  burr: { name: 'Moon Burr', rarity: 'rare', edits: { left: strike(3, 3), far: split(4, 2) } },
  mast: { name: 'Flood Bell', rarity: 'rare', edits: { top: brace(6, 3), bottom: guard(5, 3) } },
  still: { name: 'Stillwicket', rarity: 'rare', edits: { left: split(5, 4), right: tune(3, 3) } }
};

const H = (n: number): IntentFace => ['hit', n];
const G = (n: number): IntentFace => ['guard', n];
const P = (n: number): IntentFace => ['power', n];
const W: IntentFace = ['wait', 0];
function enemyDie(owner: number, ...faces: [IntentFace, IntentFace, IntentFace, IntentFace, IntentFace, IntentFace]): IntentDie {
  return { owner, faces };
}
const gnat = (id: string, hp = 10) => ({ id, name: 'Mire Gnat', sprite: 'gnat', hp });
const warden = (id: string, hp: number) => ({ id, name: 'Reed Warden', sprite: 'warden', hp });
const normal = (name: string, enemies: Encounter['enemies'], dice: Encounter['dice']): Encounter => ({
  type: 'battle', rank: 'normal', name, enemies, dice,
});

export const ROOMS: readonly Room[] = [
  normal('Mire Gnats', [gnat('gnat-a'), gnat('gnat-b')], [
    enemyDie(0, H(3), H(3), H(4), H(3), G(1), H(3)),
    enemyDie(1, H(3), H(3), H(4), H(3), G(1), H(3)),
    enemyDie(0, W, H(2), W, W, H(2), G(1)),
    enemyDie(1, W, H(2), W, W, H(2), G(1)),
    enemyDie(1, W, W, W, G(1), W, W),
  ]),
  normal('Mudrunner', [{ id: 'hound', name: 'Mudrunner', sprite: 'hound', hp: 25 }], [
    enemyDie(0, H(5), H(6), H(7), H(6), H(5), H(8)),
    enemyDie(0, H(2), H(3), H(2), H(2), G(2), H(2)),
    enemyDie(0, W, W, G(2), W, W, W),
    enemyDie(0, W, W, W, G(2), W, G(1)),
    enemyDie(0, W, W, W, W, W, P(1)),
  ]),
  { type: 'workshop', name: 'Workshop' },
  normal('Reed Wardens', [warden('warden-a', 15), warden('warden-b', 16)], [
    enemyDie(0, H(4), H(5), H(4), H(5), G(2), H(5)),
    enemyDie(1, H(4), H(5), H(4), H(5), G(2), H(5)),
    enemyDie(0, W, G(3), G(2), W, H(2), W),
    enemyDie(1, W, G(3), G(2), W, H(2), W),
    enemyDie(1, W, W, W, H(2), W, W),
  ]),
  {
    type: 'battle', rank: 'elite', name: 'Kilnback',
    enemies: [{ id: 'kilnback', name: 'Kilnback', sprite: 'kilnback', hp: 43 }],
    dice: [
      enemyDie(0, H(7), H(9), H(8), H(10), H(9), H(8)),
      enemyDie(0, H(3), H(4), H(4), H(5), G(3), H(4)),
      enemyDie(0, W, G(4), G(3), H(2), G(4), W),
      enemyDie(0, W, P(1), W, W, G(2), W),
      enemyDie(0, W, W, W, W, G(2), W),
    ],
  },
  { type: 'camp', name: 'Camp' },
  normal('Mire Brood', [
    { id: 'brood', name: 'Mire Brood', sprite: 'brood', hp: 23 },
    gnat('brood-gnat', 12),
  ], [
    enemyDie(0, H(6), H(7), H(5), H(6), H(5), H(7)),
    enemyDie(1, H(4), H(4), H(5), H(4), H(3), G(2)),
    enemyDie(0, W, G(3), W, P(1), H(3), W),
    enemyDie(1, W, H(2), H(3), W, G(2), W),
    enemyDie(0, W, W, G(2), W, W, H(2)),
  ]),
  { type: 'workshop', name: 'Workshop' },
  {
    type: 'battle', rank: 'boss', name: 'Bellroot',
    enemies: [{ id: 'bellroot', name: 'Bellroot', sprite: 'bellroot', hp: 66 }],
    dice: [
      enemyDie(0, H(7), H(10), H(8), H(9), H(8), H(9)),
      enemyDie(0, H(4), H(5), G(4), H(4), H(6), H(5)),
      enemyDie(0, G(3), G(4), G(4), W, G(5), W),
      enemyDie(0, W, G(2), W, P(1), W, W),
      enemyDie(0, W, W, W, G(3), W, W),
    ],
    phaseTwo: [
      enemyDie(0, H(8), H(11), H(9), H(8), H(10), H(10)),
      enemyDie(0, H(3), H(4), H(5), H(5), H(4), H(5)),
      enemyDie(0, H(3), W, H(4), W, H(3), G(1)),
      enemyDie(0, W, P(1), W, W, W, H(2)),
      enemyDie(0, W, W, W, W, G(2), W),
    ],
  }
];