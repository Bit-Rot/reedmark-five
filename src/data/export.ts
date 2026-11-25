import type { Collections, Face, KeywordUse, Keyword, ItemEffect, Targeting } from './types.ts';
import { SLOT_NAMES } from './types.ts';

export const GENERATED_NOTE = '<!-- Generated from data/*.json by `npm run docs`. Edit data in the editor (editor/), not this file. -->';

const TARGETING_LABEL: Record<Targeting, string> = {
  none: 'None', self: 'Self', singleEnemy: 'Single Enemy', allEnemies: 'All Enemies',
};
export function targetingLabel(t: Targeting): string { return TARGETING_LABEL[t] ?? t; }

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

/** Padded markdown table. */
export function table(headers: string[], rows: string[][]): string {
  const clean = rows.map(r => r.map(cell));
  const widths = headers.map((h, i) => Math.max(h.length, 3, ...clean.map(r => (r[i] ?? '').length)));
  const line = (cols: string[]) => '| ' + cols.map((c, i) => (c ?? '').padEnd(widths[i])).join(' | ') + ' |';
  return [line(headers), '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |', ...clean.map(line)].join('\n');
}

export function keywordLabel(k: Keyword): string {
  return k.valueKind === 'x' ? `${k.id} X` : k.id;
}

function useLabel(u: KeywordUse): string {
  return u.x !== undefined ? `{${u.keyword} ${u.x}}` : `{${u.keyword}}`;
}

const code = (s: string) => '`' + s + '`';

export function exportKeywords(db: Collections): string {
  const cats = new Map<string, Keyword[]>();
  for (const k of db.keywords) {
    const list = cats.get(k.category) ?? [];
    list.push(k);
    cats.set(k.category, list);
  }
  let out = `${GENERATED_NOTE}\n\n# Keywords\n\n**${db.keywords.length} keywords.** \`N\` in rule text is the pip value of the face the keyword sits on. \`X\` is a number written on the keyword itself (e.g. \`pain 2\`).\n`;
  for (const [cat, list] of cats) {
    out += `\n## ${cat || 'Uncategorised'}\n\n` + table(
      ['Keyword', 'Rule text', 'Applies to', 'Implemented', 'Notes'],
      list.map(k => [code(keywordLabel(k)), k.ruleText, k.appliesTo, k.implemented, k.notes]),
    ) + '\n';
  }
  return out;
}

/** Renders the face's library image in GitHub markdown (docs/ is one level below the repo root). */
function imageCell(f: Face): string {
  return f.image ? `<img src="../public/${f.image}" width="48" alt="${f.id}">` : '';
}

export function exportFaces(db: Collections): string {
  const row = (f: Face) => [
    code(f.id), targetingLabel(f.targeting), f.keywords.map(useLabel).join('<br>'), imageCell(f), f.notes,
  ];
  const headers = ['Template', 'Targeting', 'Keywords', 'Image', 'Notes'];
  const active = db.faces.filter(f => f.status === 'active');
  const inactive = db.faces.filter(f => f.status === 'inactive');
  let out = `${GENERATED_NOTE}\n\n## Active Dice Faces\n\nThese dice faces are active and intended to be enabled and implemented in-game.\n\n${table(headers, active.map(row))}\n`;
  if (inactive.length) out += `\n## Inactive Dice Faces\n\nThese dice faces are kept for reference only.\n\n${table(headers, inactive.map(row))}\n`;
  return out;
}

export function exportDice(db: Collections): string {
  const mapping = SLOT_NAMES.map((s, i) => [
    `Face ${i + 1}`,
    ['Left end of the row', 'Middle of the row', 'Top, above the middle', 'Bottom, below the middle', 'Right of the middle', 'Far right end of the row'][i],
    s,
  ]);
  const rows = db.dice.map(d => [
    code(d.id), ...d.faces.map(s => (s.pips !== undefined ? `${code(s.face)} ${s.pips}` : code(s.face))),
  ]);
  const headers = ['ID', ...SLOT_NAMES.map((_, i) => `Face ${i + 1}`)];
  return `${GENERATED_NOTE}\n\n## About Dice Tables\n\n### Face Mapping\n\nThe below chart describes which face corresponds to which position in a die's "t" diagram.\n\n${table(['Column', 'Position', 'Item text name'], mapping)}\n\n## Dice\n\n${table(headers, rows)}\n`;
}

export function exportCharacters(db: Collections): string {
  let out = GENERATED_NOTE + '\n';
  for (const c of db.characters) {
    const list = (xs: string[]) => (xs.length ? xs.map(x => `* ${code(x)}`).join('\n') : '');
    const relic = c.starterRelic ? `### Starter Relic\n\n${code(c.starterRelic)}\n\n` : '';
    out += `\n## ${c.name}\n\n${relic}### Starter Dice\n\n${list(c.starterDice)}\n\n### Items\n\n${list(c.items)}\n\n### Unlocks\n\n${c.unlocks.map(u => `* ${u}`).join('\n')}\n`;
  }
  return out;
}

function effectLabel(e: ItemEffect): string {
  const where = e.target === 'all' ? 'all faces' : e.target.join(', ');
  switch (e.op) {
    case 'setFace': return `${where}: become ${code(e.face ?? '?')}${e.pips !== undefined ? ` ${e.pips}` : ''}`;
    case 'addKeyword': return `${where}: gain ${code(e.keyword ?? '?')}${e.x !== undefined ? ` ${e.x}` : ''}`;
    case 'pipDelta': return `${where}: pips ${(e.delta ?? 0) >= 0 ? '+' : ''}${e.delta ?? 0}`;
    case 'setPips': return `${where}: pips = ${e.pips ?? 0}`;
  }
}

export function exportItems(db: Collections): string {
  return `${GENERATED_NOTE}\n\n# Items\n\n${table(
    ['ID', 'Name', 'Reward Pool', 'Rarity', 'Description', 'Effects', 'Implemented'],
    db.items.map(i => [
      code(i.id), i.name, i.rewardCharacter === undefined ? 'Shared (inactive)' : code(i.rewardCharacter),
      i.rarity, i.description, i.effects.map(effectLabel).join('<br>'), i.implemented,
    ]),
  )}\n`;
}

export function exportRelics(db: Collections): string {
  return `${GENERATED_NOTE}\n\n# Relics\n\n${table(
    ['ID', 'Name', 'Rarity', 'Description', 'Trigger', 'Implemented'],
    db.relics.map(r => [code(r.id), r.name, r.rarity ?? '', r.description, r.trigger, r.implemented]),
  )}\n`;
}

export function exportRooms(db: Collections): string {
  return `${GENERATED_NOTE}\n\n# Room Types\n\n${table(
    ['ID', 'Name', 'Kind', 'Shop offers', 'Notes'],
    db.rooms.map(r => [code(r.id), r.name, r.kind, r.offers.join(', '), r.notes]),
  )}\n`;
}

/** Map of doc path (under docs/) to generated content. */
export function exportAll(db: Collections): Record<string, string> {
  return {
    'docs/Keywords.md': exportKeywords(db),
    'docs/Dice Faces.md': exportFaces(db),
    'docs/Dice.md': exportDice(db),
    'docs/Formats.md': exportCharacters(db),
    'docs/Items.md': exportItems(db),
    'docs/Relics.md': exportRelics(db),
    'docs/Room Types.md': exportRooms(db),
  };
}
