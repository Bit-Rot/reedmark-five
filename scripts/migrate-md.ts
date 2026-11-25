/**
 * One-time migration: parse the ACTIVE tables in the hand-edited design docs and write data/*.json.
 * Usage: node scripts/migrate-md.ts [docsDir] [dataDir]
 * Prints a report of anything that needed interpretation. Dangling references are preserved
 * (not guessed); the editor's validation panel flags them.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Collections, Face, Keyword, KeywordUse, Targeting } from '../src/data/types.ts';
import { SLOT_NAMES, emptyDb } from '../src/data/types.ts';
import { serialiseAll } from '../src/data/db.ts';

const docsDir = process.argv[2] ?? 'docs';
const dataDir = process.argv[3] ?? 'data';
const report: string[] = [];
const note = (s: string) => report.push(s);

const read = (name: string) => readFileSync(join(docsDir, name), 'utf8');

/** Split a markdown table row into trimmed cells. */
function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());
}

interface Section { heading: string; level: number; lines: string[] }

function sections(text: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { heading: '', level: 0, lines: [] };
  for (const line of text.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) { out.push(cur); cur = { heading: m[2].trim(), level: m[1].length, lines: [] }; } else cur.lines.push(line);
  }
  out.push(cur);
  return out;
}

/** Rows of the first table in a section as arrays of cells (header excluded). */
function tableRows(lines: string[]): { header: string[]; rows: string[][] } | undefined {
  const i = lines.findIndex(l => l.trim().startsWith('|'));
  if (i < 0) return undefined;
  const header = cells(lines[i]);
  const rows: string[][] = [];
  for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) rows.push(cells(lines[j]));
  return { header, rows };
}

const unTick = (s: string) => s.replace(/`/g, '').trim();

// ---- keywords
function migrateKeywords(db: Collections) {
  for (const sec of sections(read('Keywords.md'))) {
    const t = tableRows(sec.lines);
    if (!t) continue;
    if (t.header.join('|') !== 'Keyword|Rule text|Applies to|Notes') continue;
    for (const r of t.rows) {
      const raw = unTick(r[0]);
      const [id, marker] = raw.split(/\s+/);
      if (id === 'removed') { note(`keywords: skipped placeholder keyword "removed"`); continue; }
      const rule = r[1];
      const valueKind: Keyword['valueKind'] = marker === 'X' ? 'x' : /\bN\b/.test(rule) ? 'pips' : 'none';
      db.keywords.push({
        id, valueKind, ruleText: rule, category: sec.heading, appliesTo: unTick(r[2]),
        implemented: 'planned', notes: r[3] ?? '',
      });
    }
  }
}

// ---- faces
const TARGETING_MAP: Record<string, Targeting> = {
  none: 'none', self: 'self', 'single enemy': 'singleEnemy', 'all enemies': 'allEnemies',
};

function parseKeywordUses(text: string, faceId: string): KeywordUse[] {
  const out: KeywordUse[] = [];
  for (const m of text.matchAll(/\{([^}]*)\}/g)) {
    const parts = m[1].trim().split(/\s+/);
    if (!parts[0]) continue;
    const use: KeywordUse = { keyword: parts[0] };
    if (parts[1] !== undefined) {
      const x = Number(parts[1]);
      if (Number.isFinite(x)) use.x = x; else note(`faces: ${faceId}: could not read value "${parts[1]}" on keyword ${parts[0]}`);
    }
    out.push(use);
  }
  return out;
}

function migrateFaces(db: Collections) {
  const secs = sections(read('Dice Faces.md'));
  const active = secs.find(s => /^Active Dice Faces/i.test(s.heading));
  const t = active ? tableRows(active.lines) : undefined;
  if (!t) { note('faces: no "Active Dice Faces" table found'); return; }
  for (const r of t.rows) {
    const id = unTick(r[0]);
    const tkey = r[1].trim().toLowerCase();
    let targeting = TARGETING_MAP[tkey];
    if (!targeting) { note(`faces: ${id}: unknown targeting "${r[1]}", using "none"`); targeting = 'none'; }
    const face: Face = {
      id, targeting, keywords: parseKeywordUses(r[2], id),
      iconDescription: r[3] ?? '', image: '', notes: r[4] ?? '', status: 'active',
    };
    if (/<br>\s*$/.test(r[2])) note(`faces: ${id}: removed a trailing <br> in the Keywords cell`);
    db.faces.push(face);
  }
}

// ---- dice
function parseDieCell(cellText: string, dieId: string, slot: number) {
  const tokens = cellText.replace(/`/g, ' ').trim().split(/\s+/).filter(Boolean);
  const face = tokens[0] ?? '';
  const pips = tokens[1] !== undefined ? Number(tokens[1]) : undefined;
  if (tokens.length > 2 || (pips !== undefined && !Number.isFinite(pips))) note(`dice: ${dieId} slot ${slot + 1}: could not read "${cellText}"`);
  return pips !== undefined && Number.isFinite(pips) ? { face, pips } : { face };
}

function migrateDice(db: Collections) {
  const sec = sections(read('Dice.md')).find(s => s.heading === 'Dice');
  const t = sec ? tableRows(sec.lines) : undefined;
  if (!t) { note('dice: no "Dice" table found'); return; }
  for (const r of t.rows) {
    const id = unTick(r[0]).replace(/\*/g, '');
    const faces = r.slice(1, 1 + SLOT_NAMES.length).map((c, i) => parseDieCell(c, id, i));
    if (faces.length !== SLOT_NAMES.length) note(`dice: ${id}: expected ${SLOT_NAMES.length} faces, found ${faces.length}`);
    db.dice.push({ id, name: '', faces, notes: '' });
  }
}

// ---- characters (Formats.md)
function migrateCharacters(db: Collections) {
  const secs = sections(read('Formats.md'));
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    if (s.level !== 2) continue;
    const bullets = (heading: string) => {
      const sub = secs.slice(i + 1).find(x => x.level === 3 && x.heading === heading);
      if (!sub) return [];
      const stop = secs.indexOf(sub);
      if (secs.slice(i + 1, stop).some(x => x.level === 2)) return [];
      return sub.lines.map(l => /^\s*[*-]\s*(.*)$/.exec(l)?.[1]?.trim() ?? '').filter(Boolean).map(unTick);
    };
    db.characters.push({
      id: s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: s.heading,
      starterDice: bullets('Starter Dice'), items: bullets('Items'), unlocks: bullets('Unlocks'), notes: '',
    });
  }
}

// ---- rooms (Room Types.md)
function migrateRooms(db: Collections) {
  const lines = read('Room Types.md').split(/\r?\n/);
  let cur: { name: string; offers: string[] } | undefined;
  const flush = () => {
    if (!cur) return;
    const id = cur.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const kind = id === 'shop' ? 'shop' : id.startsWith('upgrade') ? 'upgrade' : 'other';
    const offers = cur.offers.map(o => o.toLowerCase()).filter((o): o is 'items' | 'relics' | 'potions' => ['items', 'relics', 'potions'].includes(o));
    db.rooms.push({ id, name: cur.name, kind, offers, notes: '' });
  };
  for (const line of lines) {
    const m = /^(\s*)[*-]\s*(.*)$/.exec(line);
    if (!m) continue;
    const text = m[2].trim();
    if (!text) continue;
    if (m[1].length === 0) { flush(); cur = { name: text, offers: [] }; } else cur?.offers.push(text);
  }
  flush();
}

const db = emptyDb();
migrateKeywords(db);
migrateFaces(db);
migrateDice(db);
migrateCharacters(db);
migrateRooms(db);

mkdirSync(dataDir, { recursive: true });
for (const [path, text] of Object.entries(serialiseAll(db))) writeFileSync(join(dataDir, path.replace(/^data\//, '')), text);

console.log(`keywords ${db.keywords.length}, faces ${db.faces.length}, dice ${db.dice.length}, characters ${db.characters.length}, rooms ${db.rooms.length}`);
for (const line of report) console.log(`- ${line}`);
