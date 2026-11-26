export const RADIUS = 6;
export const BOSS_TURNS = [16, 32, 48] as const;
export const CHEST_TURNS = [5, 21, 37] as const;
export const CENTER = '0,0';
export const MOUNTAIN_COUNT = 6;
export const TILE_TYPES = ['normal', 'event', 'elite', 'camp', 'shop', 'mountain'] as const;
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
  const tiles: Tile[] = [{ q: 0, r: 0, id: CENTER, kind: 'normal', sector: -1, visited: true }];
  for (let sector = 0; sector < 6; sector++) {
    const a = directions[sector];
    const b = directions[(sector + 1) % 6];
    for (let ring = 1; ring <= RADIUS; ring++) {
      for (let j = 0; j < ring; j++) {
        const q = a.q * (ring - j) + b.q * j;
        const r = a.r * (ring - j) + b.r * j;
        tiles.push({ id: key(q, r), q, r, sector, kind: 'normal', visited: false });
      }
    }
  }
  const map: CampaignMap = {
    tiles, turn: 0, last: CENTER, active: null, wave: 0, sectorDrops: Array(6).fill(0),
    dropRng: (seed ^ 0xab13ef47) >>> 0,
    encounterRng: (seed ^ 0x66cd2701) >>> 0,
    eventRng: (seed ^ 0x2534cd38) >>> 0,
    encounterBags: {}, eventBag: [], eventVisits: 0,
  };

  // Keep the opening ring clear. Interior mountains can shape routes across the board.
  const interior = tiles.filter(tile => distance(tile) >= 2 && distance(tile) < RADIUS);
  let mountains = 0;
  for (const tile of shuffle(interior, random)) {
    tile.kind = 'mountain';
    if (explorationDistance(map).size !== tiles.length - mountains - 1) {
      tile.kind = 'normal';
      continue;
    }
    if (++mountains === MOUNTAIN_COUNT) break;
  }
  if (mountains !== MOUNTAIN_COUNT) throw new Error('Campaign cannot fit all mountains');

  const opening = shuffle(tiles.filter(tile => distance(tile) === 1), random);
  const openingEvents = 2 + random.pick(3);
  for (const tile of opening.slice(0, openingEvents)) tile.kind = 'event';

  const roomOrder = shuffle(tiles.filter(tile => tile.kind === 'normal' && distance(tile) >= 2), random);
  const paths = explorationDistance(map);
  const place = (kind: TileType, count: number, early = false) => {
    for (const tile of roomOrder) {
      if (tile.kind !== 'normal' || (early && paths.get(tile.id)! > 3)) continue;
      tile.kind = kind;
      if (--count === 0) return;
    }
    throw new Error('Campaign cannot fit ' + kind);
  };
  // A few early services give the player options. The rest draw from one board-wide pool.
  place('camp', 2, true);
  place('shop', 1, true);
  place('elite', 1, true);
  place('camp', 8);
  place('shop', 5);
  place('elite', 11);
  place('event', 38 - openingEvents);
  return map;
}

export function frontier(map: CampaignMap): Set<string> {
  const visited = new Set(map.tiles.filter(tile => tile.visited).map(tile => tile.id));
  const adjacent = new Set(map.tiles.filter(tile => tile.visited).flatMap(neighbors));
  return new Set(map.tiles.filter(tile => adjacent.has(tile.id) && tile.kind !== 'mountain' && !visited.has(tile.id)).map(tile => tile.id));
}

export function visibleTile(tile: Tile, reachable: ReadonlySet<string>): VisibleTile {
  if (tile.visited) return 'cleared';
  if (tile.chest !== undefined) return 'treasure';
  return tile.kind === 'elite' || tile.kind === 'camp' || tile.kind === 'shop' || tile.kind === 'mountain' || reachable.has(tile.id) ? tile.kind : 'unknown';
}

export function explorationDistance(map: CampaignMap): Map<string, number> {
  const byId = new Map(map.tiles.filter(tile => tile.kind !== 'mountain').map(tile => [tile.id, tile]));
  const queue = [...byId.values()].filter(tile => tile.visited).map(tile => tile.id);
  const result = new Map(queue.map(id => [id, 0]));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const adjacent of neighbors(byId.get(id)!)) {
      if (!byId.has(adjacent) || result.has(adjacent)) continue;
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
  const explored = map.tiles.filter(tile => tile.visited);
  const paths = explorationDistance(map);
  const candidates = shuffle(map.tiles.filter(tile => {
    const moves = paths.get(tile.id) ?? Infinity;
    return moves >= 3 && moves <= 5 && tile.chest === undefined && (tile.kind === 'normal' || tile.kind === 'event')
      && explored.every(other => distance(tile, other) >= 3);
  }), random);

  // Keep the distance rule even when a wide exploration pattern leaves fewer legal sites.
  const placed = map.tiles.filter(tile => tile.chest !== undefined);
  for (let i = 0; i < 3 && candidates.length; i++) {
    const spacing = (tile: Tile) => placed.length ? Math.min(...placed.map(other => distance(tile, other))) : 0;
    const sharedSector = (tile: Tile) => Number(placed.some(other => other.sector === tile.sector));
    candidates.sort((a, b) => spacing(b) - spacing(a)
      || sharedSector(a) - sharedSector(b)
      || map.sectorDrops[a.sector] - map.sectorDrops[b.sector]);

    const tile = candidates.shift()!;
    tile.chest = index;
    map.sectorDrops[tile.sector]++;
    placed.push(tile);
  }
  map.wave = index + 1;
  map.dropRng = random.seed;
}
