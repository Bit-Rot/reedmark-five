type Child = Node | string | null | undefined | false;

/** Tiny hyperscript helper: h('div.card', { onclick }, child, ...). */
export function h(
  tag: string,
  props?: Record<string, unknown> | null,
  ...children: (Child | Child[])[]
): HTMLElement {
  const [head, ...classes] = tag.split('.');
  const [name, id] = head.split('#');
  const el = document.createElement(name);
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'value') (el as unknown as HTMLInputElement).value = String(v);
    else if (k === 'checked') (el as unknown as HTMLInputElement).checked = Boolean(v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function option(value: string, label: string, selected: boolean): HTMLOptionElement {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  o.selected = selected;
  return o;
}

/** A <select> for choosing among `values`; keeps an unknown current value visible (marked missing). */
export function select(values: readonly string[], current: string, onChange: (v: string) => void, opts: { allowEmpty?: boolean; labels?: Record<string, string> } = {}): HTMLSelectElement {
  const s = document.createElement('select');
  if (opts.allowEmpty || current === '') s.append(option('', '(none)', current === ''));
  const all = current !== '' && !values.includes(current) ? [...values, current] : values;
  for (const v of all) {
    const missing = !values.includes(v);
    s.append(option(v, (opts.labels?.[v] ?? v) + (missing ? '  (missing!)' : ''), v === current));
  }
  if (current !== '' && !values.includes(current)) s.classList.add('missing');
  s.addEventListener('change', () => onChange(s.value));
  return s;
}
