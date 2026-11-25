/**
 * Renders the face icon library: public/face-art/library/<id>.webp plus index.json.
 * Usage: node scripts/make-face-art.ts [--sheet <file.png>]
 * Needs a Chromium for canvas WebP encoding; set PW_CHANNEL=chrome to use installed Chrome.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { ICONS, STYLE, TILE } from './face-art/icons.ts';
import type { Tile } from './face-art/icons.ts';

const OUT = 'public/face-art/library';

/** The original hand-made icons that ship with the game, reused as library entries. */
const ORIGINALS: { id: string; file: string; label: string; tags: string[]; tile: Tile }[] = [
  { id: 'sword', file: 'hit', label: 'Sword', tags: ['damage', 'attack', 'weapon', 'blade', 'slash', 'plain sword', 'hit'], tile: 'red' },
  { id: 'shield', file: 'guard', label: 'Shield', tags: ['block', 'defend', 'guard', 'protect', 'plain shield'], tile: 'blue' },
  { id: 'drop', file: 'seep', label: 'Poison drop', tags: ['poison', 'venom', 'toxic', 'drip', 'seep', 'single drop of poison'], tile: 'green' },
  { id: 'tune', file: 'boost', label: 'Tune (boost)', tags: ['boost', 'buff', 'support', 'enhance', 'plus'], tile: 'cyan' },
  { id: 'ward', file: 'ward', label: 'Ward', tags: ['protect', 'store', 'charge', 'bank', 'shield'], tile: 'purple' },
  { id: 'reroll', file: 'salvage', label: 'Reroll (salvage)', tags: ['reroll', 'salvage', 'recycle', 'refund', 'again'], tile: 'gold' },
];

export const svgFor = (body: string, tile: Tile): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192"><style>${STYLE}</style>`
  + `<rect width="192" height="192" fill="${TILE[tile]}"/><circle cx="176" cy="196" r="84" fill="#000" opacity=".1"/>`
  + `<g class="s">${body}</g></svg>`;

const sheetIndex = process.argv.indexOf('--sheet');
const sheetPath = sheetIndex >= 0 ? process.argv[sheetIndex + 1] : '';

mkdirSync(OUT, { recursive: true });
const ids = new Set<string>();
for (const icon of ICONS) {
  if (ids.has(icon.id)) throw new Error(`duplicate icon id ${icon.id}`);
  ids.add(icon.id);
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="192" height="192"></canvas>');

const rendered: { id: string; webp: string; svg: string }[] = [];
for (const icon of ICONS) {
  const svg = svgFor(icon.body, icon.tile);
  const webp = await page.evaluate(async (markup: string) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    await img.decode();
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 192, 192);
    ctx.drawImage(img, 0, 0, 192, 192);
    return canvas.toDataURL('image/webp', 0.92).split(',')[1];
  }, svg);
  rendered.push({ id: icon.id, webp, svg });
  writeFileSync(`${OUT}/${icon.id}.webp`, Buffer.from(webp, 'base64'));
}

for (const o of ORIGINALS) copyFileSync(`src/art/faces/${o.file}.webp`, `${OUT}/${o.id}.webp`);

const index = [
  ...ORIGINALS.map(o => ({ id: o.id, label: o.label, tags: o.tags, tile: o.tile, path: `face-art/library/${o.id}.webp` })),
  ...ICONS.map(i => ({ id: i.id, label: i.label, tags: i.tags, tile: i.tile, path: `face-art/library/${i.id}.webp` })),
].sort((a, b) => a.label.localeCompare(b.label));
writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 2) + '\n');

if (sheetPath) {
  const cells = [
    ...ORIGINALS.map(o => `<figure><img src="../src/art/faces/${o.file}.webp"><figcaption>${o.id}</figcaption></figure>`),
    ...rendered.map(r => `<figure><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.svg)}"><figcaption>${r.id}</figcaption></figure>`),
  ].join('');
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.setContent(`<style>body{margin:8px;background:#101e23;color:#ddd;font:11px sans-serif;display:grid;grid-template-columns:repeat(12,1fr);gap:6px}figure{margin:0;text-align:center}img{width:100%;border-radius:8px}</style>${cells}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: sheetPath, fullPage: true });
}
await browser.close();
console.log(`${ICONS.length} generated + ${ORIGINALS.length} original icons -> ${OUT}`);
