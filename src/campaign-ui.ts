import { BOSS_IDS, CAMPAIGN_FIGHTS } from './campaign-content.ts';
import { CENTER, bossDue, cycleAt, frontier, nextBoss, visibleTile } from './campaign-map.ts';
import type { CampaignMap, Tile, VisibleTile } from './campaign-map.ts';
import { button, element } from './ui.ts';
import campArt from './art/map/camp.webp';
import chestArt from './art/map/chest.webp';
import eliteArt from './art/map/elite.webp';
import eventArt from './art/map/event.webp';
import fightArt from './art/map/fight.webp';
import shopArt from './art/map/shop.webp';
import startArt from './art/map/start.webp';

const labels: Record<VisibleTile, string> = {
  normal: 'Combat', elite: 'Elite', camp: 'Campfire', shop: 'Shop', event: 'Event',
  treasure: 'Treasure', unknown: 'Unrevealed', cleared: 'Cleared',
};
const landmarks = {
  normal: fightArt, elite: eliteArt, event: eventArt,
  camp: campArt, shop: shopArt, treasure: chestArt,
};

function landmark(src: string): HTMLImageElement {
  const image = element('img', 'map-landmark');
  image.src = src;
  image.alt = '';
  image.draggable = false;
  return image;
}

const x = (tile: Tile) => Math.sqrt(3) * (tile.q + tile.r / 2);
const y = (tile: Tile) => 1.5 * tile.r;

export function campaignScreen(map: CampaignMap): HTMLElement {
  const next = nextBoss(map)!;
  const due = bossDue(map);
  const encounter = CAMPAIGN_FIGHTS[BOSS_IDS[cycleAt(next)]];
  const heading = element('h1', '', due ? 'Boss this turn' : 'Explore Reedmark');
  const timer = element('span', 'campaign-timer', due ? encounter.name : 'Boss in ' + (next - map.turn) + ' turns');
  const controls = element('div', 'campaign-controls');
  const zoomOut = button('subtle', 'map-zoom-out', 'Zoom out', '−');
  const zoomIn = button('subtle', 'map-zoom-in', 'Zoom in', '+');
  const recenter = button('subtle', 'map-center', 'Center on your position', 'Recenter');
  controls.append(zoomOut, zoomIn, recenter);
  if (due) {
    controls.append(button('control control--primary', 'start-boss', 'Fight ' + encounter.name, 'Fight ' + encounter.name));
  }
  const viewport = element('div', 'campaign-viewport');
  const board = element('div', 'campaign-board');
  viewport.append(board);
  const reachable = frontier(map);
  const cells = map.tiles.map(tile => {
    const kind = visibleTile(tile, reachable);
    const current = map.last === tile.id;
    const start = tile.id === CENTER;
    const marker = element('span', 'hex-marker');
    marker.setAttribute('aria-hidden', 'true');
    if (start) {
      marker.append(landmark(startArt), element('span', 'hex-start-name', 'Start'),
        element('span', 'hex-start-state', 'Cleared'));
    } else if (kind === 'cleared') {
      marker.textContent = '✓';
    } else if (kind !== 'unknown') {
      marker.append(landmark(landmarks[kind]));
    }
    const name = start ? 'Start, already explored' : labels[kind];
    const label = name + ' at ' + tile.q + ', ' + tile.r + (current ? ', your position' : '');
    const active = !due && reachable.has(tile.id);
    const cell = active
      ? button('campaign-hex', 'explore-tile', 'Explore ' + label, marker)
      : element('span', 'campaign-hex', marker);
    cell.dataset.tile = tile.id;
    cell.dataset.kind = kind;
    if (start) cell.dataset.start = 'true';
    if (active) {
      cell.dataset.focus = 'map-' + tile.id;
      cell.dataset.reachable = 'true';
    } else {
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', label);
    }
    cell.title = name;
    if (current) cell.dataset.current = 'true';
    board.append(cell);
    return { tile, cell };
  });

  const extent = Math.max(...map.tiles.map(tile => Math.abs(x(tile))));
  const vertical = Math.max(...map.tiles.map(tile => Math.abs(y(tile))));
  const position = map.tiles.find(tile => tile.id === map.last)!;
  let zoom = 31;
  const width = () => Math.max(viewport.clientWidth, (extent * 2 + 4) * zoom);
  const height = () => Math.max(viewport.clientHeight, (vertical * 2 + 4) * zoom);
  function layout(): void {
    board.style.width = width() + 'px';
    board.style.height = height() + 'px';
    board.style.setProperty('--hex-size', (zoom * 2) + 'px');
    for (const { cell, tile } of cells) {
      cell.style.left = (x(tile) * zoom + width() / 2) + 'px';
      cell.style.top = (y(tile) * zoom + height() / 2) + 'px';
    }
    zoomIn.disabled = zoom >= 47;
    zoomOut.disabled = zoom <= 13;
  }
  function center(): void {
    viewport.scrollLeft = width() / 2 + x(position) * zoom - viewport.clientWidth / 2;
    viewport.scrollTop = height() / 2 + y(position) * zoom - viewport.clientHeight / 2;
  }
  function resize(delta: number): void {
    const fractionX = (viewport.scrollLeft + viewport.clientWidth / 2) / width();
    const fractionY = (viewport.scrollTop + viewport.clientHeight / 2) / height();
    zoom = Math.max(13, Math.min(47, zoom + delta));
    layout();
    viewport.scrollLeft = width() * fractionX - viewport.clientWidth / 2;
    viewport.scrollTop = height() * fractionY - viewport.clientHeight / 2;
  }
  zoomOut.addEventListener('click', () => resize(-6));
  zoomIn.addEventListener('click', () => resize(6));
  recenter.addEventListener('click', center);

  let pan: { id: number; x: number; y: number; left: number; top: number; moved: boolean } | undefined;
  let suppressClick = false;
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    suppressClick = false;
    pan = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
  });
  viewport.addEventListener('pointermove', event => {
    if (pan?.id !== event.pointerId || !event.buttons) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 6) return;
    if (!pan.moved) viewport.setPointerCapture(event.pointerId);
    pan.moved = true;
    suppressClick = true;
    viewport.scrollLeft = pan.left - dx;
    viewport.scrollTop = pan.top - dy;
  });
  viewport.addEventListener('pointerup', () => { pan = undefined; });
  viewport.addEventListener('pointercancel', () => { pan = undefined; suppressClick = false; });
  viewport.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);

  const legend = element('div', 'campaign-legend');
  for (const kind of ['normal', 'elite', 'event', 'camp', 'shop', 'treasure'] as const) {
    legend.append(element('span', '', landmark(landmarks[kind]), labels[kind]));
  }
  const panel = element('section', 'campaign-panel',
    element('div', 'campaign-heading', element('div', '', heading, timer,
      due ? null : element('p', 'campaign-path-hint', 'Explore a gold-edged hex.')), controls),
    viewport, legend);
  panel.setAttribute('aria-label', 'Exploration map');
  panel.dataset.turn = String(map.turn);
  layout();
  requestAnimationFrame(() => { layout(); center(); });
  return element('div', 'overlay campaign-overlay', panel);
}
