import type { FieldDef } from '../src/data/schema.ts';
import type { Collections, CollectionName, Die, Face, Item, ItemEffect, KeywordUse, SlotName } from '../src/data/types.ts';
import { EFFECT_OPS, SLOT_NAMES } from '../src/data/types.ts';
import { h, select } from './dom.ts';

export interface PendingImageEntry { path: string; base64: string; dataUrl: string }

export interface FormCtx {
  db: Collections;
  /** A value changed in place; no need to rebuild the form. */
  changed(): void;
  /** The structure of the form changed (rows added/removed); rebuild it. */
  rerender(): void;
  /** Uploaded images not yet committed, keyed by repo path. */
  images: Map<string, PendingImageEntry>;
  /** Convert a chosen file into a pending image for repo path `path`. */
  pickImage(file: File, path: string): Promise<void>;
}

type Rec = Record<string, unknown>;

const ids = (list: { id: string }[]) => list.map(e => e.id);

export function renderField(ctx: FormCtx, entity: { id: string }, f: FieldDef): HTMLElement {
  const rec = entity as unknown as Rec;
  const row = (control: HTMLElement | HTMLElement[]) =>
    h('div.field', null, h('label', null, f.label), ...(Array.isArray(control) ? control : [control]));
  switch (f.kind) {
    case 'text':
      return row(h('input', { type: 'text', value: String(rec[f.key] ?? ''), onInput: (e: Event) => { rec[f.key] = (e.target as HTMLInputElement).value; ctx.changed(); } }));
    case 'longtext':
      return row(h('textarea', { rows: 3, value: String(rec[f.key] ?? ''), onInput: (e: Event) => { rec[f.key] = (e.target as HTMLTextAreaElement).value; ctx.changed(); } }));
    case 'number':
      return row(h('input', { type: 'number', value: String(rec[f.key] ?? ''), onInput: (e: Event) => { rec[f.key] = Number((e.target as HTMLInputElement).value); ctx.changed(); } }));
    case 'enum':
      return row(select(f.options, String(rec[f.key] ?? ''), v => { rec[f.key] = v; ctx.changed(); }));
    case 'ref':
      return row(select(ids(ctx.db[f.to]), String(rec[f.key] ?? ''), v => { rec[f.key] = v; ctx.changed(); }));
    case 'refList':
      return row(refList(ctx, rec[f.key] as string[], f.to));
    case 'stringList':
      return row(stringList(ctx, rec[f.key] as string[]));
    case 'enumList':
      return row(enumList(ctx, rec[f.key] as string[], f.options));
    case 'keywordUses':
      return row(keywordUses(ctx, rec[f.key] as KeywordUse[]));
    case 'dieFaces':
      return row(dieDiagram(ctx, entity as Die));
    case 'effects':
      return row(effects(ctx, entity as Item));
    case 'image':
      return row(imageField(ctx, entity as Face));
  }
}

function listShell(rows: HTMLElement[], add: HTMLElement): HTMLElement {
  return h('div.list-editor', null, ...rows, add);
}

function refList(ctx: FormCtx, list: string[], to: CollectionName): HTMLElement {
  const rows = list.map((v, i) => h('div.row', null,
    select(ids(ctx.db[to]), v, nv => { list[i] = nv; ctx.changed(); }),
    h('button.small', { type: 'button', title: 'Move up', onClick: () => { if (i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; ctx.rerender(); } } }, '↑'),
    h('button.small.danger', { type: 'button', title: 'Remove', onClick: () => { list.splice(i, 1); ctx.rerender(); } }, '✕')));
  return listShell(rows, h('button.small', { type: 'button', onClick: () => { list.push(ctx.db[to][0]?.id ?? ''); ctx.rerender(); } }, '+ add'));
}

function stringList(ctx: FormCtx, list: string[]): HTMLElement {
  const rows = list.map((v, i) => h('div.row', null,
    h('input', { type: 'text', value: v, onInput: (e: Event) => { list[i] = (e.target as HTMLInputElement).value; ctx.changed(); } }),
    h('button.small.danger', { type: 'button', onClick: () => { list.splice(i, 1); ctx.rerender(); } }, '✕')));
  return listShell(rows, h('button.small', { type: 'button', onClick: () => { list.push(''); ctx.rerender(); } }, '+ add'));
}

function enumList(ctx: FormCtx, list: string[], options: readonly string[]): HTMLElement {
  return h('div.checks', null, ...options.map(o => h('label.check', null,
    h('input', { type: 'checkbox', checked: list.includes(o), onChange: (e: Event) => {
      const on = (e.target as HTMLInputElement).checked;
      const i = list.indexOf(o);
      if (on && i < 0) list.push(o);
      if (!on && i >= 0) list.splice(i, 1);
      ctx.changed();
    } }), o)));
}

function keywordUses(ctx: FormCtx, list: KeywordUse[]): HTMLElement {
  const rows = list.map((u, i) => {
    const kw = ctx.db.keywords.find(k => k.id === u.keyword);
    const needsX = kw?.valueKind === 'x';
    return h('div.row', null,
      select(ids(ctx.db.keywords), u.keyword, v => { u.keyword = v; ctx.rerender(); }),
      needsX || u.x !== undefined ? h('input.num', {
        type: 'number', placeholder: 'X', title: 'X value written on the keyword', value: u.x === undefined ? '' : String(u.x),
        onInput: (e: Event) => { const t = (e.target as HTMLInputElement).value; if (t === '') delete u.x; else u.x = Number(t); ctx.changed(); },
      }) : null,
      kw ? h('span.hint', null, kw.ruleText) : h('span.hint.bad', null, 'not in the keyword list'),
      h('button.small.danger', { type: 'button', onClick: () => { list.splice(i, 1); ctx.rerender(); } }, '✕'));
  });
  return listShell(rows, h('button.small', { type: 'button', onClick: () => { list.push({ keyword: ctx.db.keywords[0]?.id ?? '' }); ctx.rerender(); } }, '+ add keyword'));
}

/** The "t" diagram: top above the middle, bottom below it, a row of four across. */
function dieDiagram(ctx: FormCtx, die: Die): HTMLElement {
  while (die.faces.length < SLOT_NAMES.length) die.faces.push({ face: ctx.db.faces[0]?.id ?? '' });
  const cell = (index: number) => {
    const slot = die.faces[index];
    const face = ctx.db.faces.find(f => f.id === slot.face);
    return h('div.slot', { 'data-slot': SLOT_NAMES[index] },
      h('div.slot-name', null, `Face ${index + 1} · ${SLOT_NAMES[index]}`),
      select(ids(ctx.db.faces), slot.face, v => { slot.face = v; ctx.rerender(); }),
      h('input.num', {
        type: 'number', placeholder: 'pips', title: 'pips', value: slot.pips === undefined ? '' : String(slot.pips),
        onInput: (e: Event) => { const t = (e.target as HTMLInputElement).value; if (t === '') delete slot.pips; else slot.pips = Number(t); ctx.changed(); },
      }),
      face ? h('div.hint', null, face.keywords.map(k => k.keyword + (k.x !== undefined ? ` ${k.x}` : '')).join(', ') || 'no keywords') : h('div.hint.bad', null, 'face missing'));
  };
  const empty = () => h('div.slot.empty');
  return h('div.tdiagram', null, empty(), cell(2), empty(), empty(), cell(0), cell(1), cell(4), cell(5), empty(), cell(3), empty(), empty());
}

function effects(ctx: FormCtx, item: Item): HTMLElement {
  const rows = item.effects.map((e, i) => effectRow(ctx, item, e, i));
  const add = h('button.small', { type: 'button', onClick: () => {
    item.effects.push({ target: 'all', op: 'pipDelta', delta: 1 });
    ctx.rerender();
  } }, '+ add effect');
  return listShell(rows, add);
}

function effectRow(ctx: FormCtx, item: Item, e: ItemEffect, i: number): HTMLElement {
  const isAll = e.target === 'all';
  const slots = isAll ? [] : e.target;
  const targetBox = h('div.checks', null,
    h('label.check', null, h('input', { type: 'checkbox', checked: isAll, onChange: (ev: Event) => {
      e.target = (ev.target as HTMLInputElement).checked ? 'all' : [];
      ctx.rerender();
    } }), 'all faces'),
    ...(isAll ? [] : SLOT_NAMES.map(s => h('label.check', null, h('input', { type: 'checkbox', checked: slots.includes(s as SlotName), onChange: (ev: Event) => {
      const list = e.target as SlotName[];
      const on = (ev.target as HTMLInputElement).checked;
      const at = list.indexOf(s);
      if (on && at < 0) list.push(s);
      if (!on && at >= 0) list.splice(at, 1);
      ctx.changed();
    } }), s))));
  const opSelect = select(EFFECT_OPS, e.op, v => {
    e.op = v as ItemEffect['op'];
    delete e.face; delete e.keyword; delete e.x; delete e.delta; delete e.pips;
    if (e.op === 'pipDelta') e.delta = 1;
    if (e.op === 'setPips') e.pips = 1;
    if (e.op === 'setFace') e.face = ctx.db.faces[0]?.id ?? '';
    if (e.op === 'addKeyword') e.keyword = ctx.db.keywords[0]?.id ?? '';
    ctx.rerender();
  });
  const num = (key: 'delta' | 'pips' | 'x', label: string) => h('input.num', {
    type: 'number', placeholder: label, title: label, value: e[key] === undefined ? '' : String(e[key]),
    onInput: (ev: Event) => { const t = (ev.target as HTMLInputElement).value; if (t === '') delete e[key]; else e[key] = Number(t); ctx.changed(); },
  });
  const detail: HTMLElement[] = [];
  if (e.op === 'setFace') detail.push(select(ids(ctx.db.faces), e.face ?? '', v => { e.face = v; ctx.changed(); }));
  if (e.op === 'addKeyword') {
    detail.push(select(ids(ctx.db.keywords), e.keyword ?? '', v => { e.keyword = v; ctx.rerender(); }));
    if (ctx.db.keywords.find(k => k.id === e.keyword)?.valueKind === 'x') detail.push(num('x', 'X'));
  }
  if (e.op === 'pipDelta') detail.push(num('delta', 'pip change'));
  if (e.op === 'setPips') detail.push(num('pips', 'pips'));
  return h('div.effect', null, targetBox, h('div.row', null, opSelect, ...detail,
    h('button.small.danger', { type: 'button', onClick: () => { item.effects.splice(i, 1); ctx.rerender(); } }, '✕')));
}

export function faceImagePath(id: string): string { return `face-art/${id}.webp`; }

function imageField(ctx: FormCtx, face: Face): HTMLElement {
  const repoPath = `public/${face.image || faceImagePath(face.id)}`;
  const pending = ctx.images.get(repoPath);
  const src = pending?.dataUrl ?? (face.image ? `../${face.image}` : '');
  const input = h('input', { type: 'file', accept: 'image/*', onChange: async (ev: Event) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const path = faceImagePath(face.id);
    await ctx.pickImage(file, `public/${path}`);
    face.image = path;
    ctx.rerender();
  } });
  return h('div.image-field', null,
    src ? h('img.face-image', { src, alt: face.id }) : h('div.hint', null, 'No image'),
    h('div.row', null, input, face.image ? h('button.small.danger', { type: 'button', onClick: () => {
      ctx.images.delete(repoPath);
      face.image = '';
      ctx.rerender();
    } }, 'remove') : null),
    face.image ? h('div.hint', null, `${face.image}${pending ? ' (uploads when you save)' : ''}`) : null);
}
