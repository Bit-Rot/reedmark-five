import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DICE } from './content.ts';
import { facesFor } from './game.ts';
import type { Die, Enemy, Face, Intent, Kind, Slot } from './model.ts';

const urls = import.meta.glob('./art/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
export const art = (name: string): string => urls[`./art/${name}.webp`] ?? '';
export const symbols: Record<Kind, string> = { hit: '✦', guard: '⬟', seep: '◈', boost: '✚', ward: '◒' };
export const names: Record<Kind, string> = { hit: 'Hit', guard: 'Guard', seep: 'Seep', boost: 'Tune', ward: 'Ward' };
const colors: Record<string, string> = { rust: '#ad624c', blue: '#4e788a', olive: '#818954', jade: '#487b6f', sand: '#a48b65', slate: '#696e82' };
const faceOrder: Slot[] = ['right', 'left', 'top', 'bottom', 'center', 'far'];
const normals = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];
const up = new THREE.Vector3(0, 1, 0);
const clockLine = new THREE.Vector3(0, 0, -1);
function yaw(slot: Slot, index: number): THREE.Quaternion {
  const face = faceOrder.indexOf(slot);
  const basis = new THREE.Quaternion().setFromUnitVectors(normals[face], up);
  const localUp = face === 2 ? clockLine : face === 3 ? new THREE.Vector3(0, 0, 1) : up;
  const viewUp = localUp.clone().applyQuaternion(basis);
  const base = Math.atan2(viewUp.x, -viewUp.z);
  const angle = base + (index - 2) * 0.09;
  return new THREE.Quaternion().setFromAxisAngle(up, angle).multiply(basis);
}

interface Throw {
  start: number;
  delay: number;
  duration: number;
  to: THREE.Vector3;
  from: THREE.Vector3;
  facing: THREE.Quaternion;
  phase: number;
}
interface Cube {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  flight?: Throw;
  index: number;
  slot: Slot;
  style: string;
}
interface Actor {
  sprite: THREE.Sprite;
  ellipse: THREE.Mesh;
  position: THREE.Vector3;
  height: number;
}

export class Battlefield {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry = new RoundedBoxGeometry(.99, .99, .99, 3, .105);
  private shadowGeometry = new THREE.CircleGeometry(1, 24);
  private loader = new THREE.TextureLoader();
  private cachedFaces = new Map<string, THREE.MeshStandardMaterial>();
  private cachedSprites = new Map<string, THREE.SpriteMaterial>();
  private cubes = new Map<string, Cube>();
  private incomingDice: { mesh: THREE.Mesh; start: number; from: THREE.Vector3; to: THREE.Vector3; index: number }[] = [];
  private actors = new Map<string, Actor>();
  private resizeObserver: ResizeObserver;
  private drawPending = false;
  private width = 1;
  private height = 1;
  private compact = false;
  private onProjection: () => void;
  readonly motion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private container: HTMLElement, onProjection: () => void) {
    this.onProjection = onProjection;
    this.camera.position.set(0, 11, 13);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = .1;
    this.camera.far = 60;
    const daylight = new THREE.HemisphereLight('#ffefd4', '#577b7a', 2.65);
    const lamp = new THREE.DirectionalLight('#ffdfac', 2.2);
    lamp.position.set(-6, 8, 5);
    this.scene.add(daylight, lamp);
    if (art('marsh')) this.container.style.setProperty('--painting', `url("${art('marsh')}")`);
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      container.append(this.renderer.domElement);
    } catch {
      container.dataset.fallback = 'true';
    }
    this.createActor('reeds-a', 'reeds', new THREE.Vector3(-6.3, 0, -.45), 2.65);
    this.createActor('reeds-b', 'reeds', new THREE.Vector3(6.1, 0, -1.8), 2.2);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private resize(): void {
    this.width = Math.max(this.container.clientWidth, 1);
    this.height = Math.max(this.container.clientHeight, 1);
    const aspect = this.width / this.height;
    this.compact = aspect < 1.04;
    const visibleWidth = Math.max(this.compact ? 10.0 : 13.4, Math.min(aspect * 8.25, 21));
    const visibleHeight = visibleWidth / aspect;
    Object.assign(this.camera, { left: -visibleWidth / 2, right: visibleWidth / 2, top: visibleHeight / 2, bottom: -visibleHeight / 2 });
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.renderer?.setSize(this.width, this.height);
    const courier = this.actors.get('courier');
    if (courier) courier.position.x = this.compact ? -2.9 : -4.05;
    this.positionEnemyActors();
    this.draw();
  }

  private sphereShadow(color: number, opacity: number): THREE.Mesh {
    const mesh = new THREE.Mesh(this.shadowGeometry, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, toneMapped: false,
    }));
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  private spriteMaterial(name: string): THREE.SpriteMaterial {
    const cached = this.cachedSprites.get(name);
    if (cached) return cached;
    const texture = art(name) ? this.loader.load(art(name), () => this.draw()) : null;
    if (texture) texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false, opacity: texture ? 1 : 0 });
    this.cachedSprites.set(name, material);
    return material;
  }

  private createActor(id: string, name: string, position: THREE.Vector3, height: number): Actor {
    const sprite = new THREE.Sprite(this.spriteMaterial(name));
    sprite.center.set(.5, .09);
    const ellipse = this.sphereShadow(0x061314, .39);
    ellipse.scale.set(height * .30, height * .16, 1);
    const actor = { sprite, ellipse, position, height };
    this.scene.add(sprite, ellipse);
    this.actors.set(id, actor);
    return actor;
  }

  setActors(enemies: readonly Enemy[]): void {
    if (!this.actors.has('courier')) this.createActor('courier', 'courier', new THREE.Vector3(this.compact ? -2.9 : -4.05, 0, -.55), 2.94);
    const allowed = new Set(enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id));
    for (const [id, actor] of this.actors) {
      if (id === 'courier' || id.startsWith('reeds-') || allowed.has(id)) continue;
      this.scene.remove(actor.sprite, actor.ellipse);
      (actor.ellipse.material as THREE.Material).dispose();
      this.actors.delete(id);
    }
    for (const enemy of enemies) {
      if (enemy.hp <= 0 || this.actors.has(enemy.id)) continue;
      const height = enemy.sprite === 'bellroot' ? 3.88 : enemy.sprite === 'gnat' ? 2.12 : enemy.sprite === 'kilnback' ? 3.35 : 2.82;
      this.createActor(enemy.id, enemy.sprite, new THREE.Vector3(), height);
    }
    this.positionEnemyActors();
    this.draw();
  }

  private positionEnemyActors(): void {
    const enemies = [...this.actors].filter(([id]) => id !== 'courier' && !id.startsWith('reeds-'));
    for (let index = 0; index < enemies.length; index++) {
      const [id, actor] = enemies[index];
      const x = enemies.length === 1 ? (this.compact ? 2.65 : 3.7)
        : (this.compact ? 1.37 + index * 2.2 : 2.02 + index * 2.52);
      actor.position.set(x, id.includes('gnat') ? .36 : 0, id === 'bellroot' ? .18 : index === 0 ? -.57 : -.86);
    }
  }

  private faceMaterial(face: Face, tone: string): THREE.MeshStandardMaterial {
    const key = JSON.stringify([face, tone]);
    const cached = this.cachedFaces.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#172226';
    ctx.fillRect(0, 0, 128, 128);
    const sheen = ctx.createLinearGradient(0, 0, 105, 128);
    sheen.addColorStop(0, colors[tone]);
    sheen.addColorStop(1, '#253939');
    ctx.beginPath();
    ctx.roundRect(5, 5, 118, 118, 17);
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e6c99a80';
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(10, 10, 108, 108, 12);
    ctx.strokeStyle = '#fff1c032';
    ctx.stroke();
    const [first, ...rest] = face.parts;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff4d8';
    ctx.shadowColor = '#111717';
    ctx.shadowBlur = 2;
    const main = first.value === 0 ? '·' : first.count ? `${first.value}×${first.count}` : `${first.value}`;
    ctx.font = `bold ${first.count ? 39 : 48}px Georgia`;
    ctx.fillText(main, 64, rest.length ? 64 : 71);
    ctx.font = 'bold 24px system-ui';
    ctx.fillText(symbols[first.kind], 64, rest.length ? 30 : 34);
    ctx.font = 'bold 17px system-ui';
    if (rest.length) ctx.fillText(rest.map(part => `${symbols[part.kind]}${part.value}`).join('  '), 64, 101);
    if (face.salvage) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd881';
      ctx.fillText(`↻${face.salvage}`, 14, 106);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer?.capabilities.getMaxAnisotropy() ?? 1);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .76, metalness: .12 });
    this.cachedFaces.set(key, material);
    return material;
  }

  private dicePosition(index: number): THREE.Vector3 {
    return new THREE.Vector3((index - 2) * (this.compact ? 1.68 : 1.66), .5, this.compact ? 2.38 : 2.35);
  }

  syncDice(dice: readonly { die: Die; slot: Slot; shown: boolean }[], animate: ReadonlySet<string> = new Set(), lead = 0): void {
    const active = new Set(dice.map(entry => entry.die.id));
    for (const [id, cube] of this.cubes) {
      if (active.has(id)) continue;
      this.scene.remove(cube.mesh, cube.shadow);
      (cube.shadow.material as THREE.Material).dispose();
      this.cubes.delete(id);
    }
    for (const [index, entry] of dice.entries()) {
      const template = DICE[entry.die.template];
      const resolved = facesFor(entry.die);
      const style = JSON.stringify([entry.die.template, entry.die.imprints]);
      let cube = this.cubes.get(entry.die.id);
      if (!cube) {
        const mesh = new THREE.Mesh(this.geometry);
        const shadow = this.sphereShadow(0x00090b, .57);
        shadow.scale.set(.56, .38, 1);
        this.scene.add(mesh, shadow);
        cube = { mesh, shadow, index, slot: entry.slot, style: '' };
        this.cubes.set(entry.die.id, cube);
      }
      if (cube.style !== style) {
        cube.mesh.material = faceOrder.map(slot => this.faceMaterial(resolved[slot], template.tone));
        cube.style = style;
      }
      cube.index = index;
      cube.slot = entry.slot;
      cube.mesh.visible = cube.shadow.visible = entry.shown;
      if (!entry.shown) cube.flight = undefined;
      if (entry.shown && animate.has(entry.die.id) && !this.motion.matches && this.renderer) {
        const to = this.dicePosition(index);
        cube.flight = {
          start: performance.now(), delay: lead + index * 38, duration: 570 + index * 24,
          to, from: new THREE.Vector3(to.x * .52 - 1.7, .5, 4.65 + (index % 2) * .3),
          facing: yaw(entry.slot, index), phase: index * .72,
        };
      }
    }
    this.schedule();
  }

  tossIntents(intents: readonly Intent[]): void {
    if (!this.renderer || this.motion.matches) return;
    const start = performance.now();
    for (const [index, intent] of intents.entries()) {
      const effect: Kind = intent.move === 'power' ? 'boost' : intent.move === 'hit' ? 'hit' : 'guard';
      const surface = (kind: Kind, value: number) => this.faceMaterial({ target: 'self', parts: [{ kind, value }] }, 'slate');
      const sides = [surface('guard', 1), surface('hit', 2), surface(effect, intent.value),
        surface('hit', 3), surface('boost', 1), surface('guard', 0)];
      const mesh = new THREE.Mesh(this.geometry, sides);
      mesh.scale.setScalar(.52);
      const to = new THREE.Vector3(.64 + index * .86, .28, .48 + (index % 2) * .18);
      const from = new THREE.Vector3(5.3 + index * .11, .34, -.26 + (index % 2) * .28);
      mesh.visible = false;
      this.scene.add(mesh);
      this.incomingDice.push({ mesh, start: start + index * 22, from, to, index });
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.drawPending) return;
    this.drawPending = true;
    requestAnimationFrame(now => {
      this.drawPending = false;
      this.draw(now);
      if (this.incomingDice.length || [...this.cubes.values()].some(cube => cube.flight)) this.schedule();
    });
  }

  private draw(now = performance.now()): void {
    for (const actor of this.actors.values()) {
      const material = actor.sprite.material;
      const img = material.map?.image as HTMLImageElement | undefined;
      const aspect = img?.width && img?.height ? img.width / img.height : 1;
      actor.sprite.position.copy(actor.position);
      actor.sprite.scale.set(actor.height * aspect, actor.height, 1);
      actor.ellipse.position.set(actor.position.x, .017, actor.position.z);
    }
    for (const cube of this.cubes.values()) {
      if (cube.flight) {
        const flight = cube.flight;
        const t = THREE.MathUtils.clamp((now - flight.start - flight.delay) / flight.duration, 0, 1);
        const travel = 1 - (1 - t) ** 2;
        cube.mesh.position.lerpVectors(flight.from, flight.to, travel);
        cube.mesh.position.y += Math.abs(Math.sin(t * Math.PI * 3.2)) * (1 - t) * 1.42;
        const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(t * Math.PI * 5.8, travel * 1.5, t * 2.7 + flight.phase));
        cube.mesh.quaternion.copy(spin).slerp(flight.facing, THREE.MathUtils.smoothstep(t, .70, .99));
        if (t === 1) cube.flight = undefined;
      } else {
        cube.mesh.position.copy(this.dicePosition(cube.index));
        cube.mesh.quaternion.copy(yaw(cube.slot, cube.index));
      }
      cube.shadow.position.set(cube.mesh.position.x, .023, cube.mesh.position.z);
    }
    this.incomingDice = this.incomingDice.filter(cube => {
      const progress = (now - cube.start) / 400;
      if (progress >= 1.22) {
        this.scene.remove(cube.mesh);
        return false;
      }
      cube.mesh.visible = progress >= 0;
      const t = THREE.MathUtils.clamp(progress, 0, 1);
      cube.mesh.position.lerpVectors(cube.from, cube.to, 1 - (1 - t) ** 2);
      cube.mesh.position.y += Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * .80;
      cube.mesh.quaternion.setFromEuler(new THREE.Euler(t * 13, t * 5 + cube.index * .2, t * 8))
        .slerp(yaw('top', cube.index), THREE.MathUtils.smoothstep(t, .65, 1));
      const exit = 1 - THREE.MathUtils.smoothstep(progress, 1, 1.22);
      cube.mesh.scale.setScalar(.52 * exit);
      return true;
    });
    this.renderer?.render(this.scene, this.camera);
    this.onProjection();
  }

  private projection(position: THREE.Vector3): { x: number; y: number } {
    const p = position.clone().project(this.camera);
    return { x: (p.x + 1) * this.width / 2, y: (1 - p.y) * this.height / 2 };
  }

  actorPoint(id: string, point: 'center' | 'label' | 'intent'): { x: number; y: number } | null {
    const actor = this.actors.get(id);
    if (!actor) return null;
    const base = this.projection(actor.position);
    const spriteHeight = actor.height * this.height / (this.camera.top - this.camera.bottom);
    if (point === 'center') return { x: base.x, y: base.y - spriteHeight * .35 };
    if (point === 'label') return { x: base.x, y: base.y + (this.compact ? -5 : 11) };
    return { x: base.x, y: Math.max(this.compact ? 96 : 118, base.y - spriteHeight * .92 - 11) };
  }

  diePoint(id: string): { x: number; y: number } | null {
    const cube = this.cubes.get(id);
    if (!cube) return null;
    return this.projection(cube.mesh.position);
  }
}
