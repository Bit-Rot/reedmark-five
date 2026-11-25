import { clone, filePath, parseAll } from '../src/data/db.ts';
import { deleteEntity, displayName, find, renameId, usedBy } from '../src/data/graph.ts';
import { GitHubClient, GitHubError, repoFromLocation } from '../src/data/github.ts';
import type { RepoRef } from '../src/data/github.ts';
import { resolveConflict } from '../src/data/merge.ts';
import type { Conflict } from '../src/data/merge.ts';
import { SCHEMA } from '../src/data/schema.ts';
import type { Snapshot } from '../src/data/sync.ts';
import { loadSnapshot, save } from '../src/data/sync.ts';
import type { CollectionName, Collections, Entity } from '../src/data/types.ts';
import { COLLECTION_NAMES, SLOT_NAMES, emptyDb } from '../src/data/types.ts';
import { validate } from '../src/data/validate.ts';
import type { Issue } from '../src/data/validate.ts';
import { clear, h } from './dom.ts';
import type { FormCtx, PendingImageEntry } from './forms.ts';
import { renderField } from './forms.ts';
import { imageToWebp } from './images.ts';

const DEFAULT_REPO: RepoRef = { owner: 'Bit-Rot', repo: 'reedmark-five', branch: 'main' };
const KEY_TOKEN = 'fivedice-editor-token';
const KEY_REPO = 'fivedice-editor-repo';
const KEY_DRAFT = 'fivedice-editor-draft';

type View = CollectionName | 'validation';

const store = {
  get(k: string): string { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del(k: string): void { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

const state = {
  base: null as Snapshot | null,
  db: emptyDb() as Collections,
  images: new Map<string, PendingImageEntry>(),
  view: 'faces' as View,
  selected: '' as string,
  search: '',
  status: 'Loading…',
  loadError: '',
};

function repo(): RepoRef {
  try {
    const saved = JSON.parse(store.get(KEY_REPO) || 'null') as RepoRef | null;
    if (saved?.owner && saved.repo && saved.branch) return saved;
  } catch { /* fall through */ }
  return repoFromLocation(location, DEFAULT_REPO);
}
const client = () => new GitHubClient(repo(), store.get(KEY_TOKEN));

// ---------- change tracking
interface Change { collection: CollectionName; id: string; kind: 'added' | 'changed' | 'removed' }

function changes(): Change[] {
  const out: Change[] = [];
  if (!state.base) return out;
  for (const n of COLLECTION_NAMES) {
    const before = new Map((state.base.db[n] as Entity[]).map(e => [e.id, JSON.stringify(e)] as const));
    const after = new Map((state.db[n] as Entity[]).map(e => [e.id, JSON.stringify(e)] as const));
    for (const [id, json] of after) {
      if (!before.has(id)) out.push({ collection: n, id, kind: 'added' });
      else if (before.get(id) !== json) out.push({ collection: n, id, kind: 'changed' });
    }
    for (const id of before.keys()) if (!after.has(id)) out.push({ collection: n, id, kind: 'removed' });
  }
  return out;
}

const dirtyCount = () => changes().length + state.images.size;
let issuesCache: Issue[] = [];

function recompute(): void { issuesCache = validate(state.db); }

function saveDraft(): void {
  if (!state.base) return;
  if (!dirtyCount()) { store.del(KEY_DRAFT); return; }
  store.set(KEY_DRAFT, JSON.stringify({ commit: state.base.commit, db: state.db, images: [...state.images.values()] }));
}

// ---------- shell
const app = document.getElementById('app')!;
const nav = h('nav#nav');
const listPane = h('section#list');
const detailPane = h('section#detail');
const bar = h('header#bar');
const toast = h('div#toast', { role: 'status' });
app.append(bar, h('div#panes', null, nav, listPane, detailPane), toast);

let toastTimer = 0;
function say(message: string, bad = false): void {
  toast.textContent = message;
  toast.className = bad ? 'show bad' : 'show';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.className = ''; }, bad ? 7000 : 3500);
}

function refreshChrome(): void {
  recompute();
  saveDraftSoon();
  renderBar();
  renderNav();
  renderList();
}

let draftTimer = 0;
function saveDraftSoon(): void {
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(saveDraft, 400);
}

function fullRender(): void {
  recompute();
  renderBar();
  renderNav();
  renderList();
  renderDetail();
  document.body.classList.toggle('has-selection', !!state.selected || state.view === 'validation');
}

// ---------- top bar
function renderBar(): void {
  clear(bar);
  const n = dirtyCount();
  const errors = issuesCache.filter(i => i.severity === 'error').length;
  bar.append(
    h('h1', null, 'FiveDice editor'),
    h('span.status', null, state.base ? `${repo().owner}/${repo().repo}@${repo().branch}${state.base.commit ? ' · ' + state.base.commit.slice(0, 7) : ' · read-only copy'}` : state.status),
    h('span.spacer'),
    h('button', { type: 'button', onClick: () => { state.view = 'validation'; state.selected = ''; fullRender(); } }, errors ? `⚠ ${errors} error${errors === 1 ? '' : 's'}` : '✓ valid'),
    h('button', { type: 'button', onClick: openSettings }, '⚙'),
    h('button.primary', { type: 'button', disabled: n === 0 || !state.base, onClick: openSave }, n ? `Save ${n} change${n === 1 ? '' : 's'}` : 'Saved'),
  );
  const saveBtn = bar.querySelector('button.primary') as HTMLButtonElement;
  saveBtn.disabled = n === 0 || !state.base;
}

// ---------- navigation and list
function renderNav(): void {
  clear(nav);
  const errorsBy = new Map<string, number>();
  for (const i of issuesCache) if (i.severity === 'error') errorsBy.set(i.collection, (errorsBy.get(i.collection) ?? 0) + 1);
  for (const n of COLLECTION_NAMES) {
    const count = state.db[n].length;
    const errs = errorsBy.get(n) ?? 0;
    nav.append(h('button', { type: 'button', class: state.view === n ? 'active' : '', onClick: () => { state.view = n; state.selected = ''; state.search = ''; fullRender(); } },
      SCHEMA[n].label, h('span.count', null, String(count)), errs ? h('span.dot', { title: `${errs} errors` }, '●') : null));
  }
}

function matches(collection: CollectionName, e: Entity): boolean {
  const q = state.search.trim().toLowerCase();
  if (!q) return true;
  return displayName(collection, e).toLowerCase().includes(q) || JSON.stringify(e).toLowerCase().includes(q);
}

function renderList(): void {
  clear(listPane);
  if (state.view === 'validation') {
    listPane.append(h('div.list-head', null, h('strong', null, 'Validation')));
    return;
  }
  const c = state.view;
  const changed = new Map(changes().filter(x => x.collection === c).map(x => [x.id, x.kind] as const));
  const errIds = new Set(issuesCache.filter(i => i.collection === c && i.severity === 'error').map(i => i.id));
  const search = h('input', { type: 'search', placeholder: `Search ${SCHEMA[c].label.toLowerCase()}…`, value: state.search, onInput: (e: Event) => { state.search = (e.target as HTMLInputElement).value; renderListItems(); } });
  const newId = h('input', { type: 'text', placeholder: `new ${SCHEMA[c].singular} ID`, onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') create(); } });
  const create = () => {
    const id = (newId as HTMLInputElement).value.trim();
    createEntity(c, id);
  };
  listPane.append(
    h('div.list-head', null, search),
    h('div.list-new', null, newId, h('button', { type: 'button', onClick: create }, '+ New')),
    h('ul#items'),
  );
  function renderListItems() {
    const ul = listPane.querySelector('#items')!;
    clear(ul);
    for (const e of state.db[c] as Entity[]) {
      if (!matches(c, e)) continue;
      const kind = changed.get(e.id);
      ul.append(h('li', { class: e.id === state.selected ? 'selected' : '' }, h('button', { type: 'button', onClick: () => { state.selected = e.id; fullRender(); } },
        h('span.name', null, displayName(c, e)),
        kind ? h('span.badge', null, kind === 'added' ? 'new' : 'edited') : null,
        errIds.has(e.id) ? h('span.dot', null, '●') : null)));
    }
    if (!ul.children.length) ul.append(h('li.empty', null, 'Nothing here.'));
  }
  renderListItems();
}

function blankEntity(c: CollectionName, id: string): Entity {
  const faceId = state.db.faces.find(f => f.id === 'blank')?.id ?? state.db.faces[0]?.id ?? '';
  switch (c) {
    case 'keywords': return { id, valueKind: 'none', ruleText: '', category: '', appliesTo: '', implemented: 'planned', notes: '' };
    case 'faces': return { id, targeting: 'none', keywords: [], iconDescription: '', image: '', notes: '', status: 'active' };
    case 'dice': return { id, name: '', tone: 'rust', faces: SLOT_NAMES.map(() => ({ face: faceId })), notes: '' };
    case 'characters': return { id, name: id, starterDice: [], items: [], unlocks: [], notes: '' };
    case 'items': return { id, name: id, rarity: 'common', description: '', effects: [], implemented: 'planned' };
    case 'relics': return { id, name: id, description: '', trigger: '', implemented: 'planned' };
    case 'rooms': return { id, name: id, kind: 'other', offers: [], notes: '' };
  }
}

function createEntity(c: CollectionName, id: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) { say('IDs may use letters, digits, _ and - (and must not start with _ or -).', true); return; }
  if (find(state.db, c, id)) { say(`${SCHEMA[c].singular} "${id}" already exists.`, true); return; }
  (state.db[c] as Entity[]).push(blankEntity(c, id));
  state.selected = id;
  saveDraftSoon();
  fullRender();
}

// ---------- detail
const formCtx: FormCtx = {
  get db() { return state.db; },
  images: state.images,
  changed: () => refreshChrome(),
  rerender: () => { refreshChrome(); renderDetail(); },
  pickImage: async (file, path) => {
    const img = await imageToWebp(file, 256);
    state.images.set(path, { path, base64: img.base64, dataUrl: img.dataUrl });
  },
};

function renderDetail(): void {
  clear(detailPane);
  if (state.view === 'validation') { renderValidation(); return; }
  const c = state.view;
  const e = state.selected ? find(state.db, c, state.selected) : undefined;
  if (!e) {
    detailPane.append(h('div.placeholder', null, state.base ? `Pick a ${SCHEMA[c].singular} or create a new one.` : state.loadError || state.status));
    return;
  }
  const schema = SCHEMA[c];
  const idInput = h('input#id-input', { type: 'text', value: e.id, onKeydown: (ev: KeyboardEvent) => { if (ev.key === 'Enter') doRename(); } });
  const doRename = () => {
    const to = (idInput as HTMLInputElement).value.trim();
    const r = renameId(state.db, c, e.id, to);
    if (!r.ok) { say(r.error ?? 'Could not rename.', true); return; }
    state.selected = to;
    say(r.updated.length ? `Renamed. Updated ${r.updated.length} reference${r.updated.length === 1 ? '' : 's'}.` : 'Renamed.');
    saveDraftSoon();
    fullRender();
  };
  const refs = usedBy(state.db, c, e.id);
  let confirming = false;
  const delBtn = h('button.danger', { type: 'button', onClick: () => {
    if (refs.length && !confirming) {
      confirming = true;
      delBtn.textContent = `Used in ${refs.length} place${refs.length === 1 ? '' : 's'} — click again to delete anyway`;
      return;
    }
    deleteEntity(state.db, c, e.id, true);
    state.selected = '';
    say(refs.length ? 'Deleted. References to it are now flagged as errors.' : 'Deleted.');
    saveDraftSoon();
    fullRender();
  } }, 'Delete');
  detailPane.append(
    h('div.detail-head', null,
      h('button.back', { type: 'button', onClick: () => { state.selected = ''; fullRender(); } }, '← Back'),
      h('h2', null, `${schema.singular[0].toUpperCase()}${schema.singular.slice(1)}`)),
    h('div.field', null, h('label', { for: 'id-input' }, 'ID'), h('div.row', null, idInput,
      h('button', { type: 'button', onClick: doRename }, 'Rename'),
      h('button', { type: 'button', onClick: () => {
        let id = `${e.id}_copy`;
        for (let i = 2; find(state.db, c, id); i++) id = `${e.id}_copy${i}`;
        (state.db[c] as Entity[]).push({ ...clone(e), id } as Entity);
        state.selected = id;
        fullRender();
      } }, 'Duplicate')),
      h('div.hint', null, 'Renaming rewrites every reference to this ID.')),
    ...schema.fields.map(f => renderField(formCtx, e, f)),
    h('div.field', null, h('label', null, `Used by (${refs.length})`),
      refs.length ? h('ul.usedby', null, ...refs.map(r => h('li', null, h('button.link', { type: 'button', onClick: () => {
        state.view = r.owner.collection; state.selected = r.owner.id; fullRender();
      } }, `${r.owner.collection}/${r.owner.id}`), ` ${r.path}`))) : h('div.hint', null, 'Nothing references this.')),
    ownIssues(c, e.id) ?? '',
    h('div.actions', null, delBtn),
  );
}

function ownIssues(c: CollectionName, id: string): HTMLElement | null {
  const mine = issuesCache.filter(i => i.collection === c && i.id === id);
  if (!mine.length) return null;
  return h('div.field', null, h('label', null, 'Problems'), h('ul.issues', null, ...mine.map(i => h('li', { class: i.severity }, i.message))));
}

function renderValidation(): void {
  const errs = issuesCache.filter(i => i.severity === 'error');
  const warns = issuesCache.filter(i => i.severity === 'warning');
  const group = (title: string, list: Issue[], cls: string) => h('div.field', null, h('label', null, `${title} (${list.length})`),
    list.length ? h('ul.issues', null, ...list.map(i => h('li', { class: cls }, h('button.link', { type: 'button', onClick: () => {
      state.view = i.collection; state.selected = i.id; fullRender();
    } }, `${i.collection}/${i.id}`), `: ${i.message}`))) : h('div.hint', null, 'None'));
  detailPane.append(
    h('div.detail-head', null, h('button.back', { type: 'button', onClick: () => { state.view = 'faces'; fullRender(); } }, '← Back'), h('h2', null, 'Validation')),
    group('Errors', errs, 'error'),
    group('Warnings', warns, 'warning'),
  );
}

// ---------- dialogs
function dialog(content: HTMLElement[], onClose?: () => void): HTMLDialogElement {
  const d = h('dialog') as HTMLDialogElement;
  d.append(...content);
  d.addEventListener('close', () => { d.remove(); onClose?.(); });
  document.body.append(d);
  d.showModal();
  return d;
}

function openSettings(): void {
  const r = repo();
  const token = h('input', { type: 'password', value: store.get(KEY_TOKEN), placeholder: 'github_pat_…', autocomplete: 'off' });
  const owner = h('input', { type: 'text', value: r.owner });
  const name = h('input', { type: 'text', value: r.repo });
  const branch = h('input', { type: 'text', value: r.branch });
  const d: HTMLDialogElement = dialog([
    h('h2', null, 'Settings'),
    h('p.hint', null, 'Saving commits to GitHub using a fine-grained personal access token with Contents: read and write access to this repository only. The token is stored in this browser only.'),
    h('div.field', null, h('label', null, 'Access token'), token),
    h('div.field', null, h('label', null, 'Owner'), owner),
    h('div.field', null, h('label', null, 'Repository'), name),
    h('div.field', null, h('label', null, 'Branch'), branch),
    h('div.actions', null,
      h('button.primary', { type: 'button', onClick: async () => {
        store.set(KEY_TOKEN, (token as HTMLInputElement).value.trim());
        store.set(KEY_REPO, JSON.stringify({ owner: (owner as HTMLInputElement).value.trim(), repo: (name as HTMLInputElement).value.trim(), branch: (branch as HTMLInputElement).value.trim() }));
        d.close();
        say('Settings saved.');
        if (!dirtyCount()) await load(); else renderBar();
      } }, 'Save settings'),
      h('button', { type: 'button', onClick: () => { store.del(KEY_TOKEN); d.close(); say('Token removed from this browser.'); } }, 'Forget token'),
      h('button', { type: 'button', onClick: async () => {
        d.close();
        if (dirtyCount() && !confirm('Discard unsaved changes and reload from GitHub?')) return;
        state.images.clear();
        store.del(KEY_DRAFT);
        await load(true);
      } }, 'Discard changes & reload'),
      h('button', { type: 'button', onClick: () => d.close() }, 'Close')),
  ]);
}

function summary(): string {
  const cs = changes();
  const names = cs.slice(0, 4).map(c => `${c.collection}/${c.id}`);
  const more = cs.length > 4 ? ` and ${cs.length - 4} more` : '';
  return names.length ? `Edit ${names.join(', ')}${more}` : 'Update images';
}

function openSave(): void {
  if (!store.get(KEY_TOKEN)) { say('Add a GitHub access token in settings first.', true); openSettings(); return; }
  const cs = changes();
  const msg = h('textarea', { rows: 3, value: summary() });
  const status = h('div.hint');
  const list = h('ul.issues', null, ...cs.map(c => h('li', null, `${c.kind}: ${c.collection}/${c.id}`)), ...[...state.images.keys()].map(p => h('li', null, `image: ${p}`)));
  const go = h('button.primary', { type: 'button', onClick: async () => {
    (go as HTMLButtonElement).disabled = true;
    status.textContent = 'Saving…';
    const ok = await doSave((msg as HTMLTextAreaElement).value.trim() || summary(), status);
    if (ok) d.close(); else (go as HTMLButtonElement).disabled = false;
  } }, 'Commit to GitHub');
  const d = dialog([
    h('h2', null, 'Save to GitHub'),
    h('div.field', null, h('label', null, 'Changes'), list),
    h('div.field', null, h('label', null, 'Commit message'), msg),
    status,
    h('div.actions', null, go, h('button', { type: 'button', onClick: () => d.close() }, 'Cancel')),
  ]);
}

async function doSave(message: string, status: HTMLElement, base: Snapshot | null = state.base): Promise<boolean> {
  if (!base) return false;
  try {
    const r = await save(client(), base, state.db, [...state.images.values()].map(i => ({ path: i.path, base64: i.base64 })), message);
    if (r.status === 'conflict') {
      state.base = r.theirs;
      state.db = r.merged;
      status.textContent = '';
      await resolveConflicts(r.conflicts, message);
      return true;
    }
    state.base = r.snapshot;
    state.db = clone(r.snapshot.db);
    state.images.clear();
    store.del(KEY_DRAFT);
    say(r.status === 'saved' ? `Saved ${r.snapshot.commit.slice(0, 7)}. The site redeploys in a minute or two.` : 'Nothing to save.');
    fullRender();
    return true;
  } catch (e) {
    const err = e instanceof GitHubError ? e : null;
    status.textContent = err?.isAuth ? `GitHub refused the request (${err.message}). Check the token and its repository access.` : `Save failed: ${(e as Error).message}`;
    return false;
  }
}

function resolveConflicts(conflicts: Conflict[], message: string): Promise<void> {
  return new Promise(resolve => {
    const choices = new Map<number, 'mine' | 'theirs'>(conflicts.map((_, i) => [i, 'mine']));
    const rows = conflicts.map((c, i) => h('div.field', null,
      h('label', null, `${c.collection}/${c.id}${c.fields[0] === '*' ? ' (deleted on one side)' : ` — ${c.fields.join(', ')}`}`),
      h('div.row', null,
        h('label.check', null, h('input', { type: 'radio', name: `c${i}`, checked: true, onChange: () => choices.set(i, 'mine') }), 'Keep mine'),
        h('label.check', null, h('input', { type: 'radio', name: `c${i}`, onChange: () => choices.set(i, 'theirs') }), 'Keep theirs'))));
    const status = h('div.hint');
    const go = h('button.primary', { type: 'button', onClick: async () => {
      conflicts.forEach((c, i) => resolveConflict(state.db, c, choices.get(i) ?? 'mine'));
      const ok = await doSave(message, status);
      if (ok) d.close();
    } }, 'Apply and save');
    const d = dialog([
      h('h2', null, 'Someone else changed the same things'),
      h('p.hint', null, 'These items were edited on GitHub after you loaded them. Everything else merged automatically.'),
      ...rows, status,
      h('div.actions', null, go, h('button', { type: 'button', onClick: () => d.close() }, 'Cancel')),
    ], resolve);
    fullRender();
  });
}

// ---------- loading
async function load(forceRemote = false): Promise<void> {
  state.status = 'Loading…';
  state.loadError = '';
  renderBar();
  try {
    let snap: Snapshot;
    try {
      snap = await loadSnapshot(client());
    } catch (e) {
      // Fall back to the copy published with this page (read-only start; saving still needs a token).
      const files: Record<string, string> = {};
      for (const n of COLLECTION_NAMES) {
        const res = await fetch(`../${filePath(n)}`);
        if (res.ok) files[filePath(n)] = await res.text();
      }
      if (!Object.keys(files).length) throw e;
      snap = { commit: '', tree: '', db: parseAll(files) };
      say('Could not reach GitHub; showing the published copy.', true);
    }
    state.base = snap;
    state.db = clone(snap.db);
    state.images.clear();
    if (!forceRemote) restoreDraft(snap);
    if (!state.selected) state.selected = '';
  } catch (e) {
    state.base = null;
    state.loadError = `Could not load data: ${(e as Error).message}`;
    state.status = 'Not loaded';
  }
  fullRender();
}

function restoreDraft(snap: Snapshot): void {
  const raw = store.get(KEY_DRAFT);
  if (!raw) return;
  try {
    const d = JSON.parse(raw) as { commit: string; db: Collections; images: PendingImageEntry[] };
    if (d.commit !== snap.commit) { store.del(KEY_DRAFT); return; }
    state.db = d.db;
    for (const i of d.images) state.images.set(i.path, i);
    say('Restored your unsaved changes.');
  } catch { store.del(KEY_DRAFT); }
}

window.addEventListener('beforeunload', ev => { if (dirtyCount()) { saveDraft(); ev.preventDefault(); } });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline shell is optional */ });
}
void load();
