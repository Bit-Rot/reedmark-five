import { ROOMS } from './content.ts';
import { seededRandom, shuffle } from './campaign-map.ts';
import type { CampaignMap } from './campaign-map.ts';
import type { Encounter, EnemyDefinition, HazardSpec, IntentDie, IntentFace, Rarity } from './model.ts';

const hit = (value: number, hazard?: HazardSpec): IntentFace => ['hit', value, hazard];
const guard = (value: number, hazard?: HazardSpec): IntentFace => ['guard', value, hazard];
const power = (hazard?: HazardSpec): IntentFace => ['power', 1, hazard];
const hex = (hazard: HazardSpec): IntentFace => ['wait', 0, hazard];
const wait: IntentFace = ['wait', 0];
const die = (owner: number, ...faces: [IntentFace, IntentFace, IntentFace, IntentFace, IntentFace, IntentFace]): IntentDie => ({ owner, faces });

const trap = (value: number, slots = 1): HazardSpec => ({ kind: 'trap', value, slots });
const seal = (targeting: 'center' | 'edge' = 'center', slots = 1): HazardSpec => ({ kind: 'lock', value: 0, targeting, slots });
const drain = (value: number, slots = 1): HazardSpec => ({ kind: 'drain', value, slots });
const stone = (slots = 1): HazardSpec => ({ kind: 'petrifyOnUse', value: 0, slots });
const rot = (slots = 1): HazardSpec => ({ kind: 'corruptOnUse', value: 1, slots });
const petrify: HazardSpec = { kind: 'petrifyDice', value: 0, count: 2 };
const corrupt: HazardSpec = { kind: 'corruptDice', value: 1, count: 2 };
const pain: HazardSpec = { kind: 'pain', value: 1 };

type Profile = 'trap' | 'drain' | 'seal' | 'petrify' | 'corrupt' | 'burst' | 'power';
type Family = readonly [name: string, sprite: string, profile: Profile, hp: number];
const gnat: Family = ['Mire Gnat', 'gnat', 'trap', 5];
const mudrunner: Family = ['Mudrunner', 'hound', 'drain', 12];
const warden: Family = ['Reed Warden', 'warden', 'seal', 10];
const brood: Family = ['Mire Brood', 'brood', 'corrupt', 14];
const skater: Family = ['Silt Skater', 'silt-skater', 'petrify', 7];
const reedback: Family = ['Reedback', 'reedback', 'seal', 10];
const eel: Family = ['Glass Eel', 'glass-eel', 'burst', 8];
const lantern: Family = ['Bog Lantern', 'bog-lantern', 'corrupt', 9];
const harrier: Family = ['Fen Harrier', 'fen-harrier', 'drain', 9];
const matron: Family = ['Ford Matron', 'ford-matron', 'seal', 21];
const hook: Family = ['Tidehook', 'tidehook', 'burst', 20];
const herald: Family = ['Husk Herald', 'husk-herald', 'power', 22];
const stag: Family = ['Furnace Stag', 'furnace-stag', 'power', 23];
const kilnback: Family = ['Kilnback', 'kilnback', 'burst', 23];

function familyDie(family: Family, owner: number, tier: number, elite: boolean): IntentDie {
  const strike = (owner === 0 ? 4 : 3) + tier + Number(tier === 2) + Number(elite);
  const protection = 2 + Number(tier > 0) + Number(elite);
  const heavy = elite || tier === 2;
  // Every hazard has a tell. Most faces threatening multiple slots still leave somewhere safe.
  switch (family[2]) {
    case 'trap':
      return die(owner, hit(2, trap(1)), hit(3), hit(2, trap(2)), guard(2),
        hex(trap(2, 2)), hit(1));
    case 'drain':
      return die(owner, hit(strike + 2), hit(strike, drain(2)), hit(strike - 1, drain(1, 2)),
        hit(strike + 1), guard(protection, drain(2, 2)), power(elite ? pain : drain(2)));
    case 'seal':
      return die(owner, guard(protection + 1), hit(strike, seal()), guard(protection, seal('edge')),
        hit(strike - 1, drain(2)), guard(protection + 2, heavy ? petrify : seal()), hex(seal('edge', 2)));
    case 'petrify':
      return die(owner, hit(strike - 1, stone()), hit(strike), guard(protection, stone(2)),
        hit(strike - 1, stone()), hex(heavy ? petrify : stone(2)), hit(strike - 1));
    case 'corrupt':
      return die(owner, power(pain), hit(strike + 1), guard(protection, rot(2)),
        hit(strike, rot()), hex(heavy ? corrupt : rot(2)), hit(strike));
    case 'burst':
      return die(owner, hit(strike + 4), wait, hit(strike + 1, stone()),
        guard(protection, heavy ? petrify : undefined), hit(strike + 3), hex(heavy ? corrupt : stone(2)));
    case 'power':
      return die(owner, power(), hit(strike + 1), guard(protection, rot()),
        hit(strike, trap(2)), power(elite ? pain : drain(2, 2)), hit(strike));
  }
}

type Rank = 'normal' | 'elite';
function encounter(id: string, roster: readonly Family[], tier: number, rank: Rank, old?: Encounter, title?: string): Encounter {
  const enemies = roster.map((family, index): EnemyDefinition => ({
    id: old?.enemies[index]?.sprite === family[1] ? old.enemies[index].id : index === 0 && old ? old.enemies[0].id : id + '-' + index,
    name: family[0], sprite: family[1], hp: family[3] + (index === 0 ? tier * 4 : tier * 2),
  }));
  const lead = roster[0];
  return {
    type: 'battle', rank, name: title ?? old?.name ?? lead[0] + ' Patrol',
    enemies,
    dice: roster.map((family, index) => familyDie(family, index, tier, rank === 'elite' && index === 0)),
  };
}

const legacy = (name: string) => ROOMS.find((room): room is Encounter => room.type === 'battle' && room.name === name)!;
type Roster = readonly [Family, ...Family[]];
type Patrol = readonly [name: string, roster: Roster, alternateName: string, alternateRoster: Roster];
// The alternate keeps each lead's core threat and changes which escorts the player must prioritize.
const normalPatrols: readonly (readonly Patrol[])[] = [
  [
    ['Mire Gnats', [gnat, gnat, gnat], 'Mire Crossfire', [gnat, mudrunner, gnat]],
    ['Mudrunner', [mudrunner, gnat], 'Runners at the Ford', [mudrunner, warden, gnat]],
    ['Reed Wardens', [warden, warden, gnat], 'Sealed Nursery', [warden, brood, gnat]],
    ['Mire Brood', [brood, gnat], 'Brittle Brood', [brood, skater, gnat]],
    ['Silt Skater Patrol', [skater, gnat], 'Silt Trap', [skater, gnat, gnat]],
  ],
  [
    ['Mudrunner Patrol', [mudrunner, skater, warden], 'Drowned Charge', [mudrunner, eel, skater, skater]],
    ['Reed Warden Patrol', [warden, skater, reedback], 'Wardens of the Shoal', [warden, reedback, gnat, skater]],
    ['Reedback Patrol', [reedback, skater, eel], 'Lantern Bulwark', [reedback, lantern, skater, skater]],
    ['Glass Eel Patrol', [eel, skater, lantern], 'Glass and Reeds', [eel, warden, skater, skater]],
    ['Bog Lantern Patrol', [lantern, skater, mudrunner], 'Lantern Pursuit', [lantern, mudrunner, gnat, skater]],
  ],
  [
    ['Mire Brood Patrol', [brood, skater, skater], 'Brood of Glass', [brood, eel, skater, skater]],
    ['Silt Skater Patrol', [skater, skater, eel], 'Silt Bulwark', [skater, reedback, skater, skater]],
    ['Glass Eel Patrol', [eel, skater, lantern], 'Storm Shoal', [eel, harrier, skater, skater]],
    ['Bog Lantern Patrol', [lantern, skater, harrier], 'Sinking Lanterns', [lantern, brood, skater, skater]],
    ['Fen Harrier Patrol', [harrier, skater, brood], 'Furnace Pursuit', [harrier, stag, skater, skater]],
  ],
];
const eliteFamilies: readonly (readonly (readonly Family[])[])[] = [
  [[matron, gnat], [hook, skater]],
  [[matron, eel, skater], [hook, warden], [herald, mudrunner, gnat]],
  [[herald, harrier, eel], [stag, reedback], [hook, lantern, skater]],
];

function boss(id: string, name: string, hp: number, tier: number, escort: readonly Family[],
  opening: IntentDie, enraged: IntentDie): Encounter {
  const adds = escort.map((family, index): EnemyDefinition => ({
    id: `${id}-escort-${index}`, name: family[0], sprite: family[1], hp: family[3] + tier * 2,
  }));
  const escortDice = escort.map((family, index) => familyDie(family, index + 1, tier, false));
  return {
    type: 'battle', rank: 'boss', name,
    enemies: [{ id, name, sprite: id, hp }, ...adds],
    dice: [opening, ...escortDice], phaseTwo: [enraged, ...escortDice],
  };
}

export const BOSS_IDS = ['bellroot', 'floodgate-keeper', 'stormwing-matriarch'] as const;
export const CAMPAIGN_FIGHTS: Record<string, Encounter> = {
  bellroot: boss('bellroot', 'Bellroot', 40, 0, [warden, gnat],
    die(0, hit(7), guard(6, seal()), hit(5, trap(2, 2)), power(drain(1, 2)), hit(6), guard(4)),
    die(0, hit(10), hit(7, stone(2)), guard(6, petrify), hit(8, trap(2, 2)), hit(9), power(drain(2, 2)))),
  [BOSS_IDS[1]]: boss('floodgate-keeper', 'Floodgate Keeper', 56, 1, [reedback, eel],
    die(0, hit(10), guard(8, seal('edge', 2)), hit(8, drain(2, 2)), guard(6, petrify), hit(9), power(stone(2))),
    die(0, hit(13), hit(11, trap(2, 2)), guard(8, petrify), hit(10, seal('edge', 2)), hit(11), hit(8, drain(2, 2)))),
  [BOSS_IDS[2]]: boss('stormwing-matriarch', 'Stormwing Matriarch', 70, 2, [harrier, lantern],
    die(0, hit(15), hit(12, rot(2)), hit(13, drain(2, 2)), guard(8, corrupt), power(pain), hit(15)),
    die(0, hit(19), hit(15, rot(2)), guard(9, corrupt), hit(17), hit(14, seal('edge', 2)), hit(16, pain))),
};

const opening: string[] = [];
export const ENCOUNTER_POOLS = normalPatrols.map((patrols, tier) => {
  const normal = patrols.flatMap(([name, roster, alternateName, alternateRoster], index) => {
    const id = 'cycle-' + (tier + 1) + '-' + roster[0][1];
    const old = tier === 0 && index < 4 ? legacy(name) : undefined;
    CAMPAIGN_FIGHTS[id] = encounter(id, roster, tier, 'normal', old, name);
    CAMPAIGN_FIGHTS[id + '-pair'] = encounter(id + '-pair', alternateRoster, tier, 'normal', undefined, alternateName);
    if (tier === 0 && index < 2) opening.push(id);
    return [id, id + '-pair'];
  });
  const elite = eliteFamilies[tier].map(roster => {
    const id = 'cycle-' + (tier + 1) + '-elite-' + roster[0][1];
    CAMPAIGN_FIGHTS[id] = encounter(id, roster, tier, 'elite');
    return id;
  });
  if (tier === 0) {
    CAMPAIGN_FIGHTS.kilnback = encounter('kilnback', [kilnback, gnat], 0, 'elite', legacy('Kilnback'));
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
