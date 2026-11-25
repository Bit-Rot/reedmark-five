export const RADIUS = 6;
export const BOSS_TURNS = [16, 32, 48] as const;
export const CHEST_TURNS = [5, 21, 37] as const;
export const CENTER = '0,0';
export const TILE_TYPES = ['normal', 'event', 'elite', 'camp', 'shop'] as const;
export type TileType = (typeof TILE_TYPES)[number];
export type VisibleTile = TileType | 'treasure' | 'unknown' | 'cleared';

export interface Hex { q: number; r: number }
export interface Tile extends Hex {
  id: string;
  kind: TileType;
  sector: number;
  visited: boolean;
  chest?: number;
}
export type ActiveRoom =
  | { kind: 'encounter'; id: string }
  | { kind: 'shop' | 'camp' }
  | { kind: 'event'; id: string; choiceIndexes: number[] }
  | { kind: 'treasure'; gold: number; relic?: string };

export interface CampaignMap {
  tiles: Tile[];
  turn: number;
  last: string;
  active: ActiveRoom | null;
  dropRng: number;
  encounterRng: number;
  eventRng: number;
  encounterBags: Record<string, string[]>;
  lastEncounter?: string;
  eventBag: string[];
  lastEvent?: string;
  eventVisits: number;
  wave: number;
  sectorDrops: number[];
}

const directions: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

const key = (q: number, r: number) => q + ',' + r;
export const distance = (a: Hex, b: Hex = { q: 0, r: 0 }) =>
  Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
export const neighbors = ({ q, r }: Hex): string[] => directions.map(d => key(q + d.q, r + d.r));
export const cycleAt = (turn: number): number => Math.min(2, Math.floor(Math.max(0, turn - 1) / 16));
export const nextBoss = (map: CampaignMap) => BOSS_TURNS.find(turn => turn > map.turn);
export const bossDue = (map: CampaignMap) => nextBoss(map) === map.turn + 1;

export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return {
    pick(length: number) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return Math.floor(value / 4294967296 * length);
    },
    get seed() { return value; },
  };
}

export function shuffle<T>(values: readonly T[], random: ReturnType<typeof seededRandom>): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.pick(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createCampaign(seed: number): CampaignMap {
  const random = seededRandom(seed ^ 0x369dea0f);
  const sectorOrder = shuffle([0, 1, 2, 3, 4, 5], random);
  const parity = random.pick(2);
  const tiles: Tile[] = [{ q: 0, r: 0, id: CENTER, kind: 'normal', sector: -1, visited: true }];
  for (let sector = 0; sector < 6; sector++) {
    const a = directions[sector];
    const b = directions[(sector + 1) % 6];
    const region: Tile[] = [];
    for (let ring = 1; ring <= RADIUS; ring++) {
      for (let j = 0; j < ring; j++) {
        const q = a.q * (ring - j) + b.q * j;
        const r = a.r * (ring - j) + b.r * j;
        region.push({ id: key(q, r), q, r, sector, kind: 'normal', visited: false });
      }
    }
    const order = shuffle(region, random);
    // One color of the hex grid provides an evenly spaced, nonadjacent set of locations.
    const special = order.filter(tile => (tile.q - tile.r) % 3 === 0);
    const place = (kind: TileType, min: number, max: number, candidates = special) => {
      const tile = candidates.find(t => t.kind === 'normal' && distance(t) >= min && distance(t) <= max);
      if (!tile) throw new Error('Sector cannot fit ' + kind);
      tile.kind = kind;
    };
    place('camp', 2, 3);
    place('shop', 3, RADIUS);
    if (sectorOrder.indexOf(sector) < 4) place('camp', 4, RADIUS);
    place('elite', 2, RADIUS);
    place('elite', 2, RADIUS);
    const openingEvent = sector % 2 === parity ? 1 : 0;
    if (openingEvent) region[0].kind = 'event';
    for (let i = 0; i < 2; i++) place('event', 2, 3, order);
    const extras = sectorOrder.indexOf(sector) < 2 ? 1 : 0;
    for (let i = 0; i < 4 + extras - openingEvent; i++) place('event', 4, RADIUS, order);
    tiles.push(...region);
  }
  return {
    tiles, turn: 0, last: CENTER, active: null, wave: 0, sectorDrops: Array(6).fill(0),
    dropRng: (seed ^ 0xab13ef47) >>> 0,
    encounterRng: (seed ^ 0x66cd2701) >>> 0,
    eventRng: (seed ^ 0x2534cd38) >>> 0,
    encounterBags: {}, eventBag: [], eventVisits: 0,
  };
}

export function frontier(map: CampaignMap): Set<string> {
  const visited = new Set(map.tiles.filter(tile => tile.visited).map(tile => tile.id));
  const adjacent = new Set(map.tiles.filter(tile => tile.visited).flatMap(neighbors));
  return new Set(map.tiles.filter(tile => adjacent.has(tile.id) && !visited.has(tile.id)).map(tile => tile.id));
}

export function visibleTile(tile: Tile, reachable: ReadonlySet<string>): VisibleTile {
  if (tile.visited) return 'cleared';
  if (tile.chest !== undefined) return 'treasure';
  return tile.kind === 'elite' || tile.kind === 'camp' || tile.kind === 'shop' || reachable.has(tile.id) ? tile.kind : 'unknown';
}

export function explorationDistance(map: CampaignMap): Map<string, number> {
  const ids = new Set(map.tiles.map(tile => tile.id));
  const queue = map.tiles.filter(tile => tile.visited).map(tile => tile.id);
  const result = new Map(queue.map(id => [id, 0]));
  const byId = new Map(map.tiles.map(tile => [tile.id, tile]));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const adjacent of neighbors(byId.get(id)!)) {
      if (!ids.has(adjacent) || result.has(adjacent)) continue;
      result.set(adjacent, result.get(id)! + 1);
      queue.push(adjacent);
    }
  }
  return result;
}

/** Run once at the map boundary so reloads cannot alter the revealed placement. */
export function revealTreasureWave(map: CampaignMap): void {
  const index = CHEST_TURNS.findIndex(turn => turn === map.turn + 1);
  if (index < 0 || map.wave > index) return;
  const random = seededRandom(map.dropRng);
  const candidates = shuffle(map.tiles.filter(t => !t.visited && t.chest === undefined && (t.kind === 'normal' || t.kind === 'event')), random);
  const last = map.tiles.find(tile => tile.id === map.last)!;
  const paths = explorationDistance(map);
  const near = candidates.filter(tile => (paths.get(tile.id) ?? Infinity) <= 5).sort((a, b) => {
    const priority = (tile: Tile) => {
      const d = distance(tile, last);
      return d >= 2 && d <= 4 ? 0 : d <= 5 ? 1 : 2;
    };
    return priority(a) - priority(b) || paths.get(a.id)! - paths.get(b.id)! || distance(a, last) - distance(b, last);
  })[0];
  if (!near) throw new Error('Campaign has no reachable treasure location');
  const chosen = [near];
  for (let i = 0; i < 2; i++) {
    const spacing = (tile: Tile) => Math.min(...chosen.map(other => distance(tile, other)));
    const available = candidates.filter(tile => !chosen.includes(tile)).sort((a, b) => {
      const shared = (tile: Tile) => Number(chosen.some(other => other.sector === tile.sector));
      return shared(a) - shared(b)
        || Number(spacing(a) < 3) - Number(spacing(b) < 3)
        || map.sectorDrops[a.sector] - map.sectorDrops[b.sector];
    });
    if (!available.length) throw new Error('Campaign has too few treasure locations');
    chosen.push(available[0]);
  }
  for (const tile of chosen) {
    tile.chest = index;
    map.sectorDrops[tile.sector]++;
  }
  map.wave = index + 1;
  map.dropRng = random.seed;
}
