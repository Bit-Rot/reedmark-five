import { ROOMS } from './content.ts';
import { seededRandom, shuffle } from './campaign-map.ts';
import type { CampaignMap } from './campaign-map.ts';
import type { Encounter, EnemyDefinition, IntentDie, IntentFace, Rarity } from './model.ts';

const H = (n: number): IntentFace => ['hit', n];
const G = (n: number): IntentFace => ['guard', n];
const P: IntentFace = ['power', 1];
const W: IntentFace = ['wait', 0];
const die = (owner: number, ...faces: [IntentFace, IntentFace, IntentFace, IntentFace, IntentFace, IntentFace]): IntentDie => ({ owner, faces });

type Profile = 'swarm' | 'rush' | 'guard' | 'burst' | 'power';
type Family = readonly [name: string, sprite: string, profile: Profile, hp: number];
const gnat: Family = ['Mire Gnat', 'gnat', 'swarm', 14];
const mudrunner: Family = ['Mudrunner', 'hound', 'rush', 14];
const warden: Family = ['Reed Warden', 'warden', 'guard', 17];
const brood: Family = ['Mire Brood', 'brood', 'power', 20];
const skater: Family = ['Silt Skater', 'silt-skater', 'swarm', 16];
const reedback: Family = ['Reedback', 'reedback', 'guard', 18];
const eel: Family = ['Glass Eel', 'glass-eel', 'burst', 17];
const lantern: Family = ['Bog Lantern', 'bog-lantern', 'power', 19];
const harrier: Family = ['Fen Harrier', 'fen-harrier', 'rush', 18];
const matron: Family = ['Ford Matron', 'ford-matron', 'guard', 28];
const hook: Family = ['Tidehook', 'tidehook', 'burst', 28];
const herald: Family = ['Husk Herald', 'husk-herald', 'power', 28];
const stag: Family = ['Furnace Stag', 'furnace-stag', 'power', 28];

function familyDice(profile: Profile, owner: number, tier: number, elite: boolean): IntentDie[] {
  const hit = 3 + tier + Number(elite);
  const guard = 2 + Number(tier === 2) + Number(elite);
  const strike = {
    swarm: die(owner, H(hit - 1), H(hit), H(hit - 1), H(hit - 1), G(1), H(hit)),
    rush: die(owner, H(hit + 1), H(hit), H(hit + 1), H(hit - 1), H(hit), W),
    guard: die(owner, G(guard), H(hit), G(guard + 1), H(hit), G(guard), H(hit + 1)),
    burst: die(owner, H(hit + 3), W, W, H(hit + 2), G(guard), W),
    power: die(owner, P, H(hit), G(guard), H(hit), P, H(hit + 1)),
  }[profile];
  return [
    strike,
    die(owner, H(hit - 1), W, H(hit - 1), G(guard), H(1), W),
    die(owner, G(guard), W, W, G(guard), W, H(1)),
    profile === 'power' ? die(owner, W, P, W, G(1), W, P) : die(owner, W, H(1), W, G(1), W, W),
    die(owner, W, W, G(1), W, W, G(guard)),
  ];
}

function encounter(id: string, lead: Family, supports: Family | undefined, hp: number, tier: number, rank: 'elite' | 'normal'): Encounter {
  const enemy = (family: Family, slot: number, health: number): EnemyDefinition => ({
    id: id + '-' + slot, name: family[0], sprite: family[1], hp: health,
  });
  const supportHp = supports ? Math.round(hp * .28) : 0;
  const leadDice = familyDice(lead[2], 0, tier, rank === 'elite');
  return {
    type: 'battle', rank, name: supports ? lead[0] + ' & ' + supports[0] : lead[0],
    enemies: supports ? [enemy(lead, 0, hp - supportHp), enemy(supports, 1, supportHp)] : [enemy(lead, 0, hp)],
    dice: supports ? [...leadDice.slice(0, 3), ...familyDice(supports[2], 1, tier, false).slice(1, 3)] : leadDice,
  };
}

const legacy = (name: string) => ROOMS.find((room): room is Encounter => room.type === 'battle' && room.name === name)!;
const normalFamilies = [
  [gnat, mudrunner, warden, brood, skater],
  [mudrunner, warden, reedback, eel, lantern],
  [brood, skater, eel, lantern, harrier],
] as const;

const eliteFamilies: readonly (readonly (readonly [Family, Family?])[])[] = [
  [[matron], [hook]],
  [[matron, eel], [hook], [herald]],
  [[herald, harrier], [stag], [hook, lantern]],
];

const keeper: Encounter = {
  type: 'battle', rank: 'boss', name: 'Floodgate Keeper',
  enemies: [{ id: 'floodgate-keeper', name: 'Floodgate Keeper', sprite: 'floodgate-keeper', hp: 66 }],
  dice: [
    die(0, H(6), G(5), H(7), G(5), H(6), G(5)),
    die(0, G(4), H(3), G(3), H(4), G(4), H(3)),
    die(0, W, G(4), G(4), W, P, G(3)),
    die(0, W, H(2), W, G(2), W, G(2)),
    die(0, W, W, G(2), W, W, H(1)),
  ],
  phaseTwo: [
    die(0, H(9), H(8), H(10), H(8), H(9), H(8)),
    die(0, H(5), G(3), H(4), H(5), H(4), H(4)),
    die(0, G(4), W, H(2), G(3), P, G(3)),
    die(0, W, H(2), W, G(2), W, H(2)),
    die(0, W, W, G(2), W, W, H(1)),
  ],
};

const stormwing: Encounter = {
  type: 'battle', rank: 'boss', name: 'Stormwing Matriarch',
  enemies: [{ id: 'stormwing-matriarch', name: 'Stormwing Matriarch', sprite: 'stormwing-matriarch', hp: 86 }],
  dice: [
    die(0, H(13), W, H(11), W, H(12), W),
    die(0, H(6), H(5), H(6), G(4), H(5), H(6)),
    die(0, W, G(5), P, G(5), W, G(4)),
    die(0, H(2), W, G(3), W, H(2), W),
    die(0, W, W, G(2), W, W, P),
  ],
  phaseTwo: [
    die(0, H(16), H(11), H(15), P, H(15), H(11)),
    die(0, H(8), H(7), H(9), P, H(7), H(8)),
    die(0, W, G(4), P, H(3), P, G(3)),
    die(0, H(3), W, G(3), H(2), H(2), W),
    die(0, W, W, G(2), W, P, H(1)),
  ],
};

export const BOSS_IDS = ['bellroot', 'floodgate-keeper', 'stormwing-matriarch'] as const;
export const CAMPAIGN_FIGHTS: Record<string, Encounter> = { bellroot: legacy('Bellroot'), [BOSS_IDS[1]]: keeper, [BOSS_IDS[2]]: stormwing };
const opening: string[] = [];
export const ENCOUNTER_POOLS = normalFamilies.map((families, tier) => {
  const normal = families.flatMap((lead, index) => {
    const id = 'cycle-' + (tier + 1) + '-' + lead[1];
    const old = tier === 0 ? ['Mire Gnats', 'Mudrunner', 'Reed Wardens', 'Mire Brood'][index] : undefined;
    const hp = Math.round(lead[3] * [1, 1.35, 1.7][tier]);
    CAMPAIGN_FIGHTS[id] = old ? legacy(old) : encounter(id, lead, undefined, hp, tier, 'normal');
    CAMPAIGN_FIGHTS[id + '-pair'] = encounter(id + '-pair', lead, families[(index + 1) % families.length], hp + Math.round(3 + tier), tier, 'normal');
    if (tier === 0 && index < 2) opening.push(id);
    return [id, id + '-pair'];
  });
  const elite = eliteFamilies[tier].map(([lead, support]) => {
    const id = 'cycle-' + (tier + 1) + '-elite-' + lead[1];
    CAMPAIGN_FIGHTS[id] = encounter(id, lead, support, [28, 40, 54][tier], tier, 'elite');
    return id;
  });
  if (tier === 0) {
    CAMPAIGN_FIGHTS.kilnback = legacy('Kilnback');
    elite.unshift('kilnback');
  }
  return { normal, elite };
});

export function nextEncounter(map: CampaignMap, cycle: number, rank: 'normal' | 'elite'): string {
  const random = seededRandom(map.encounterRng);
  const key = cycle + '-' + rank;
  const oldBag = map.encounterBags[key];
  let bag = oldBag;
  if (!bag?.length) {
    const choices = ENCOUNTER_POOLS[cycle][rank];
    bag = !oldBag && cycle === 0 && rank === 'normal'
      ? [...shuffle(opening, random), ...shuffle(choices.filter(id => !opening.includes(id)), random)]
      : shuffle(choices, random);
    map.encounterBags[key] = bag;
  }
  const last = map.lastEncounter ? CAMPAIGN_FIGHTS[map.lastEncounter] : undefined;
  const chosen = bag.findIndex(id => id !== map.lastEncounter && CAMPAIGN_FIGHTS[id].enemies[0].sprite !== last?.enemies[0].sprite);
  const openingDraw = cycle === 0 && rank === 'normal' && opening.includes(bag[0]) && bag.length >= 9;
  const alternate = bag.findIndex(id => id !== map.lastEncounter);
  const index = openingDraw ? 0 : chosen >= 0 ? chosen : Math.max(0, alternate);
  const id = bag.splice(index, 1)[0];
  map.lastEncounter = id;
  map.encounterRng = random.seed;
  return id;
}

export type EventEffect =
  | { kind: 'heal' | 'gold'; amount: number }
  | { kind: 'upgrade' | 'copy' }
  | { kind: 'item' | 'relic'; rarity: Exclude<Rarity, 'rare'> };
export interface EventChoice {
  label: string;
  gold?: number;
  hp?: number;
  effect: EventEffect;
}
export interface CampaignEvent { name: string; description: string; choices: EventChoice[] }

const heal = (amount: number): EventEffect => ({ kind: 'heal', amount });
const gold = (amount: number): EventEffect => ({ kind: 'gold', amount });
const upgrade: EventEffect = { kind: 'upgrade' };
const copy: EventEffect = { kind: 'copy' };
const common: EventEffect = { kind: 'item', rarity: 'common' };
const uncommon: EventEffect = { kind: 'item', rarity: 'uncommon' };

function choice(label: string, effect: EventEffect, cost: { gold?: number; hp?: number } = {}): EventChoice {
  return { label, effect, ...cost };
}

export const EVENTS: Record<string, CampaignEvent> = {
  lamp: { name: 'Oil Lamp', description: 'A lit lamp marks a rest stop. There are coins beneath its base.', choices: [choice('Heal 5 HP', heal(5)), choice('Take 10 gold', gold(10))] },
  toll: { name: 'Crossing Toll', description: 'The keeper of a dry crossing offers to dress your wounds.', choices: [choice('Pay 10 gold to heal 9 HP', heal(9), { gold: 10 })] },
  cache: { name: 'Stinging Cache', description: 'Most of the coins are deep inside a nest of biting insects.', choices: [choice('Pay 4 HP for 18 gold', gold(18), { hp: 4 }), choice('Take 5 gold', gold(5))] },
  smith: { name: 'Reedsmith', description: 'A smith has a hammer small enough to work on a die.', choices: [choice('Pay 14 gold for a face upgrade', upgrade, { gold: 14 })] },
  chisel: { name: 'Mooring Chisel', description: 'A rusted chisel still has enough edge to cut a new mark.', choices: [choice('Pay 4 HP for a face upgrade', upgrade, { hp: 4 })] },
  mirror: { name: 'Broken Mirror', description: 'The broken glass reflects a die face twice.', choices: [choice('Pay 5 HP for a face copy', copy, { hp: 5 })] },
  engraver: { name: 'Traveling Engraver', description: 'An engraver offers to reproduce a face while the light holds.', choices: [choice('Pay 15 gold for a face copy', copy, { gold: 15 })] },
  satchel: { name: 'Lost Satchel', description: 'A mud-stiff satchel contains a bundle of tools and a handful of coins.', choices: [choice('Imprint a common item', common), choice('Take 12 gold', gold(12))] },
  bargain: { name: 'Bog Bargain', description: 'An uncommon imprint sits at the bottom of a thorny pool.', choices: [choice('Pay 6 HP for an uncommon item', uncommon, { hp: 6 })] },
  shrine: { name: 'Wayfarer’s Shrine', description: 'Travelers have left small keepsakes at the shrine.', choices: [choice('Pay 20 gold for a common relic', { kind: 'relic', rarity: 'common' }, { gold: 20 })] },
  reliquary: { name: 'Flooded Reliquary', description: 'Something valuable glints below a floor of broken tiles.', choices: [choice('Pay 7 HP for an uncommon relic', { kind: 'relic', rarity: 'uncommon' }, { hp: 7 })] },
  camp: { name: 'Abandoned Camp', description: 'The coals are still warm, and a set of tools lies nearby.', choices: [choice('Heal 6 HP', heal(6)), choice('Take a face upgrade', upgrade)] },
  marker: { name: 'Toll Marker', description: 'A merchant’s marker holds change and a small bundle for sale.', choices: [choice('Take 8 gold', gold(8)), choice('Pay 12 gold for a common item', common, { gold: 12 })] },
  ferry: { name: 'Reed Ferry', description: 'The ferryman will share his medicine or pay for help with a snagged rope.', choices: [choice('Pay 8 gold to heal 6 HP', heal(6), { gold: 8 }), choice('Pay 3 HP for 12 gold', gold(12), { hp: 3 })] },
  bench: { name: 'Glasswork Bench', description: 'The bench has a working mold and a set of engraving tools.', choices: [choice('Pay 18 gold for a face copy', copy, { gold: 18 }), choice('Take a face upgrade', upgrade)] },
};

export function nextEvent(map: CampaignMap): string {
  if (!map.eventBag.length) {
    const random = seededRandom(map.eventRng);
    map.eventBag = shuffle(Object.keys(EVENTS).filter(id => id !== map.lastEvent), random);
    if (map.lastEvent) map.eventBag.push(map.lastEvent);
    map.eventRng = random.seed;
  }
  const id = map.eventBag.shift()!;
  map.lastEvent = id;
  return id;
}
