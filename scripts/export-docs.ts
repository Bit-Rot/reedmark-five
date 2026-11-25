/** Regenerate docs/*.md from data/*.json. Usage: node scripts/export-docs.ts [--check] */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { COLLECTION_NAMES } from '../src/data/types.ts';
import { filePath, parseAll } from '../src/data/db.ts';
import { exportAll } from '../src/data/export.ts';

const files: Record<string, string> = {};
for (const n of COLLECTION_NAMES) {
  const p = filePath(n);
  if (existsSync(p)) files[p] = readFileSync(p, 'utf8');
}
const out = exportAll(parseAll(files));
const check = process.argv.includes('--check');
let stale = 0;
for (const [path, text] of Object.entries(out)) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (current === text) continue;
  stale++;
  if (check) { console.error(`stale: ${path}`); continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote ${path}`);
}
if (check && stale) { console.error(`${stale} doc(s) out of date: run npm run docs`); process.exit(1); }
