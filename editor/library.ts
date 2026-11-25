import { clear, h } from './dom.ts';

export interface LibraryImage {
  id: string;
  label: string;
  tags: string[];
  tile: string;
  /** Path relative to the site root, e.g. `face-art/library/sword.webp`. */
  path: string;
}

let images: LibraryImage[] = [];

/** Load the icon library manifest (published with the site next to the editor). */
export async function loadLibrary(): Promise<void> {
  try {
    const res = await fetch(new URL('../face-art/library/index.json', location.href));
    if (res.ok) images = (await res.json()) as LibraryImage[];
  } catch {
    images = [];
  }
}

export const libraryImages = (): readonly LibraryImage[] => images;

/** URL of a site-relative image path as seen from the editor page. */
export function imageUrl(path: string): string {
  return new URL(`../${path}`, location.href).href;
}

export function thumb(path: string, alt: string, size = 28): HTMLElement {
  return h('img.thumb', { src: imageUrl(path), alt, width: size, height: size, loading: 'lazy' });
}

function score(img: LibraryImage, words: string[]): number {
  if (!words.length) return 1;
  const label = img.label.toLowerCase();
  const id = img.id.toLowerCase();
  const tags = img.tags.map(t => t.toLowerCase());
  let total = 0;
  for (const w of words) {
    if (id === w || label === w) total += 6;
    else if (tags.includes(w)) total += 4;
    else if (id.includes(w) || label.includes(w)) total += 3;
    else if (tags.some(t => t.includes(w))) total += 2;
    else return 0;
  }
  return total;
}

export function searchLibrary(query: string): LibraryImage[] {
  const words = query.toLowerCase().split(/[^a-z0-9?!]+/).filter(Boolean);
  return images
    .map(img => ({ img, s: score(img, words) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.img.label.localeCompare(b.img.label))
    .map(x => x.img);
}

/** Modal grid of library images with search. Resolves with the chosen path, '' to clear, or null if cancelled. */
export function chooseImage(current: string, seed = ''): Promise<string | null> {
  return new Promise(resolve => {
    let result: string | null = null;
    const grid = h('div.image-grid');
    const search = h('input', { type: 'search', placeholder: 'Search icons (sword, fire, poison, shield…)', value: seed }) as HTMLInputElement;
    const dialog = h('dialog.picker') as HTMLDialogElement;
    const fill = () => {
      clear(grid);
      const found = searchLibrary(search.value);
      for (const img of found) {
        grid.append(h('button.image-choice', {
          type: 'button', title: `${img.label} (${img.id})`, class: img.path === current ? 'current' : '',
          onClick: () => { result = img.path; dialog.close(); },
        }, h('img', { src: imageUrl(img.path), alt: img.label, width: 64, height: 64, loading: 'lazy' }), h('span', null, img.label)));
      }
      if (!found.length) grid.append(h('div.hint', null, images.length ? 'No icons match that search.' : 'The icon library could not be loaded.'));
    };
    search.addEventListener('input', fill);
    dialog.append(
      h('h2', null, 'Choose an image'),
      h('p.hint', null, `${images.length} icons. Pick one to use on this face.`),
      search, grid,
      h('div.actions', null,
        h('button', { type: 'button', onClick: () => { result = ''; dialog.close(); } }, 'No image'),
        h('button', { type: 'button', onClick: () => dialog.close() }, 'Cancel')),
    );
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
    document.body.append(dialog);
    fill();
    dialog.showModal();
    search.focus();
  });
}
