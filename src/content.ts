import type { Encounter, IntentFace, IntentDie, Room } from './model.ts';

/**
 * Dice, items and characters come from the design data (data/*.json, edited in the editor).
 * Enemies and rooms are still authored here.
 */
export { BLANK_IMAGE, CHARACTERS, DATA, DATA_ISSUES, DICE, FACE_IMAGE_PATHS, ITEMS } from './content-data.ts';

const H = (n: number): IntentFace => ['hit', n];
const G = (n: number): IntentFace => ['guard', n];
const P = (n: number): IntentFace => ['power', n];
const W: IntentFace = ['wait', 0];
function enemyDie(owner: number, ...faces: [IntentFace, IntentFace, IntentFace, IntentFace, IntentFace, IntentFace]): IntentDie {
  return { owner, faces };
}
const gnat = (id: string, hp = 7) => ({ id, name: 'Mire Gnat', sprite: 'gnat', hp });
const warden = (id: string, hp: number) => ({ id, name: 'Reed Warden', sprite: 'warden', hp });
const normal = (name: string, enemies: Encounter['enemies'], dice: Encounter['dice']): Encounter => ({
  type: 'battle', rank: 'normal', name, enemies, dice,
});

export const ROOMS: readonly Room[] = [
  // Tuned for the starter dice (faces of 1-3): the first fights should usually be won without losing HP.
  normal('Mire Gnats', [gnat('gnat-a'), gnat('gnat-b')], [
    enemyDie(0, H(2), H(1), W, H(1), H(1), G(1)),
    enemyDie(1, H(2), H(1), W, H(1), H(1), G(1)),
    enemyDie(0, W, H(1), H(1), W, H(1), G(1)),
    enemyDie(1, W, H(1), H(1), W, H(1), G(1)),
    enemyDie(1, W, W, W, G(1), W, W),
  ]),
  normal('Mudrunner', [{ id: 'hound', name: 'Mudrunner', sprite: 'hound', hp: 14 }], [
    enemyDie(0, H(3), H(3), H(4), H(3), H(2), H(4)),
    enemyDie(0, H(1), H(2), H(1), H(1), G(1), H(1)),
    enemyDie(0, W, W, G(2), W, W, W),
    enemyDie(0, W, W, W, G(2), W, G(1)),
    enemyDie(0, W, W, W, W, W, P(1)),
  ]),
  { type: 'workshop', name: 'Workshop' },
  normal('Reed Wardens', [warden('warden-a', 10), warden('warden-b', 11)], [
    enemyDie(0, H(2), H(3), H(2), H(3), G(1), H(3)),
    enemyDie(1, H(2), H(3), H(2), H(3), G(1), H(3)),
    enemyDie(0, W, G(2), G(1), W, H(1), W),
    enemyDie(1, W, G(2), G(1), W, H(1), W),
    enemyDie(1, W, W, W, H(1), W, W),
  ]),
  {
    type: 'battle', rank: 'elite', name: 'Kilnback',
    enemies: [{ id: 'kilnback', name: 'Kilnback', sprite: 'kilnback', hp: 28 }],
    dice: [
      enemyDie(0, H(4), H(5), H(5), H(6), H(4), H(5)),
      enemyDie(0, H(2), H(2), H(3), H(2), G(2), H(2)),
      enemyDie(0, W, G(3), G(2), H(1), G(3), W),
      enemyDie(0, W, P(1), W, W, G(2), W),
      enemyDie(0, W, W, W, W, G(2), W),
    ],
  },
  { type: 'camp', name: 'Camp' },
  normal('Mire Brood', [
    { id: 'brood', name: 'Mire Brood', sprite: 'brood', hp: 16 },
    gnat('brood-gnat', 7),
  ], [
    enemyDie(0, H(4), H(5), H(3), H(4), H(3), H(5)),
    enemyDie(1, H(2), H(2), H(3), H(2), H(2), G(1)),
    enemyDie(0, W, G(2), W, P(1), H(2), W),
    enemyDie(1, W, H(1), H(2), W, G(1), W),
    enemyDie(0, W, W, G(1), W, W, H(1)),
  ]),
  { type: 'workshop', name: 'Workshop' },
  {
    type: 'battle', rank: 'boss', name: 'Bellroot',
    enemies: [{ id: 'bellroot', name: 'Bellroot', sprite: 'bellroot', hp: 46 }],
    dice: [
      enemyDie(0, H(4), H(6), H(5), H(5), H(4), H(6)),
      enemyDie(0, H(2), H(3), G(3), H(3), H(3), H(3)),
      enemyDie(0, G(2), G(3), G(3), W, G(4), W),
      enemyDie(0, W, G(2), W, P(1), W, W),
      enemyDie(0, W, W, W, G(2), W, W),
    ],
    phaseTwo: [
      enemyDie(0, H(6), H(8), H(7), H(6), H(7), H(7)),
      enemyDie(0, H(2), H(3), H(4), H(4), H(3), H(4)),
      enemyDie(0, H(2), W, H(3), W, H(2), G(1)),
      enemyDie(0, W, P(1), W, W, W, H(2)),
      enemyDie(0, W, W, W, W, G(2), W),
    ],
  }
];
