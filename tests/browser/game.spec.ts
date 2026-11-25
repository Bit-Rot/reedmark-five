import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { newRun, rollFace } from '../../src/game.ts';
import type { State, Variant } from '../../src/model.ts';
import { act, takeReward } from '../../scripts/policy.ts';
import type { Command } from '../../scripts/policy.ts';

async function center(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Cannot find drag position');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

async function drag(page: Page, source: Locator, target: Locator | { x: number; y: number }) {
  const from = await center(source);
  const to = 'x' in target ? target : await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

const die = (page: Page, id: string) => page.locator(`button[data-die="${id}"]`);
const action = (page: Page, name: string) => page.locator(`button[data-action="${name}"]`);
const actor = (page: Page, id: string) => page.locator(`button[data-actor="${id}"]`);

test('desktop holds a 3D die, rejects an invalid drop, and plays a valid drop', async ({ page }) => {
  const fixture = newRun('fixed', 231);
  fixture.combat!.rolls[0].slot = 'right';
  fixture.combat!.rolls[1].slot = 'left';
  await saveFixture(page, fixture);
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(page.locator('.intent')).toHaveCount(5);
  const hud = (await page.locator('.hud').boundingBox())!;
  for (const line of await page.locator('.intents').all()) {
    const bounds = (await line.boundingBox())!;
    expect(bounds.y).toBeGreaterThan(hud.y + hud.height);
  }
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await drag(page, die(page, 'd0'), page.locator('[data-socket="0"]'));
  await expect(page.locator('[data-socket="0"] [data-die="d0"]')).toBeVisible();
  await action(page, 'reroll').click();
  await expect(page.locator('[data-socket="0"] [data-die="d0"]')).toBeVisible();
  await action(page, 'commit').click();
  await drag(page, die(page, 'd0'), { x: 36, y: 659 });
  await expect(die(page, 'd0')).toBeVisible();
  await page.waitForTimeout(160);
  await drag(page, die(page, 'd0'), actor(page, 'courier'));
  await expect(page.locator('[data-socket="0"].is-spent')).toBeVisible();
  await expect(actor(page, 'courier').locator('.chip--guard')).toHaveText('1');
  const attack = page.locator('button.seated[aria-label*="Damage"]').first();
  await drag(page, attack, actor(page, 'gnat-a'));
  await expect(actor(page, 'gnat-a')).not.toContainText('7/7');
});

test('narrow touch layout exposes ten pool dice and supports tap targeting', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const pool = newRun('pool', 231);
  const attacker = pool.combat!.rolls.find(roll => rollFace(pool, roll).target === 'enemy')!.dieId;
  await page.goto('/?mode=pool&seed=231');
  await page.getByRole('button', { name: 'View dice bag' }).tap();
  await expect(page.locator('[data-action="inspect"]')).toHaveCount(10);
  await expect(page.getByText('5 remaining')).toBeVisible();
  await page.getByRole('button', { name: 'Close dice' }).tap();
  await action(page, 'commit').tap();
  await die(page, attacker).tap();
  await expect(actor(page, 'gnat-a')).toHaveClass(/is-legal/);
  await actor(page, 'gnat-a').tap();
  await expect(actor(page, 'gnat-a')).not.toContainText('7/7');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await context.close();
});

async function saveFixture(page: Page, state: State): Promise<void> {
  await page.addInitScript(save => {
    localStorage.setItem(`reedmark:${save.variant}:v1`, JSON.stringify(save));
  }, state);
  await page.goto('/');
}

test('hover and right click show illustrated faces and their in-game definitions', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[4].slot = 'left';
  await saveFixture(page, state);
  await die(page, 'd4').hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('2 Damage, 1 Vulnerable, Exert');
  await expect(tooltip).toContainText('The target takes 50% more damage');
  await expect(tooltip.locator('dt')).toHaveText([/Damage/, /Vulnerable/, /Exert/]);
  await expect(die(page, 'd4')).not.toHaveAttribute('title', /.+/);

  await die(page, 'd2').click({ button: 'right' });
  const layout = page.getByRole('dialog', { name: 'Shield die layout' });
  await expect(layout).toBeVisible();
  await expect(layout.locator('.net-tile img')).not.toHaveCount(0);
  await expect(layout.locator('.net-tile')).toHaveCount(6);
  await layout.locator('[data-slot="left"]').hover();
  await expect(tooltip).toContainText('3 Block');
  await expect(tooltip).toContainText('Absorbs incoming damage');
  const hintBounds = (await tooltip.boundingBox())!;
  const layoutBounds = (await layout.boundingBox())!;
  expect(hintBounds.x).toBeGreaterThan(layoutBounds.x + layoutBounds.width);
  await page.keyboard.press('Escape');
  await expect(layout).toHaveCount(0);
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await die(page, 'd4').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('dialog', { name: 'Hammer die layout' })).toBeVisible();
});

test('Fixed Five keeps every die visible and applies an item directly on drop', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.phase = 'reward';
  state.offers = [{ kind: 'item', id: 'sea' }, { kind: 'item', id: 'moss' }, { kind: 'item', id: 'nick' }];
  await saveFixture(page, state);
  const item = page.getByRole('button', { name: 'Sea Thread' });
  const target = page.locator('[data-imprint-target="d0"]');
  await expect(page.locator('[data-imprint-target]')).toHaveCount(5);
  await expect(target.locator('.net-tile')).toHaveCount(6);
  await drag(page, item, { x: 28, y: 650 });
  await expect(page.getByRole('heading', { name: 'Spoils' })).toBeVisible();

  const from = await center(item);
  const to = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await expect(target).toHaveClass(/is-previewing/);
  await expect(target.locator('.net-tile.is-changed')).toHaveCount(2);
  await page.mouse.up();

  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!)) as State;
  expect(saved.dice[0].imprints).toEqual({ top: 'sea', bottom: 'sea' });
  expect(saved.dice[1].imprints).toEqual({});
  expect(saved.room).toBe(1);
});

test('Fixed Five accepts a tap on an item and a tap on its destination', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const state = newRun('fixed', 231);
  state.phase = 'reward';
  state.offers = [{ kind: 'item', id: 'sea' }, { kind: 'item', id: 'moss' }, { kind: 'item', id: 'nick' }];
  await saveFixture(page, state);
  await page.getByRole('button', { name: 'Sea Thread' }).tap();
  await page.getByRole('button', { name: 'Imprint on Sword' }).first().tap();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await context.close();
});

async function perform(page: Page, command: Command): Promise<void> {
  if (command.action === 'hold') {
    await die(page, command.id).click();
  } else if (command.action === 'play') {
    await die(page, command.id).click();
    const target = command.target;
    if (target.kind === 'self') await actor(page, 'courier').click();
    else if (target.kind === 'enemy') await actor(page, target.id!).click();
    else await die(page, target.id!).click();
  } else if (command.action === 'take') {
    await page.locator(`button[data-action="offer"][data-index="${command.index}"]`).click();
    if (command.id) {
      const direct = page.locator(`button[data-imprint-target="${command.id}"]`);
      if (await direct.count()) await direct.click();
      else {
        await page.locator(`button[data-action="reward-die"][data-id="${command.id}"]`).click();
        await action(page, 'take').click();
      }
    }
  } else {
    await action(page, command.action).click();
  }
}

for (const variant of ['fixed', 'pool'] as Variant[]) {
  test(`mirrors a complete ${variant} run through the browser UI`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?mode=${variant}&seed=1`);
    const s: State = newRun(variant, 1);
    await expect(page.locator('#interface')).toHaveAttribute('data-variant', variant);
    for (let n = 0; n < 140 && (s.phase === 'battle' || s.phase === 'reward'); n++) {
      const commands: Command[] = [];
      if (s.phase === 'battle') act(s, commands);
      else takeReward(s, commands);
      for (const command of commands) await perform(page, command);
      await expect(page.locator('#interface')).toHaveAttribute('data-phase', s.phase);
    }
    // How the run ends depends on balance; the page must agree with the engine either way.
    expect(['victory', 'defeat']).toContain(s.phase);
    await expect(page.getByRole('heading', { name: s.phase === 'victory' ? 'Passage clear' : 'Run ended' })).toBeVisible();
    if (s.phase === 'victory') await expect(page.getByText(`${s.hp} HP left`)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('a fresh run asks for a hero and starts with that hero\'s dice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your hero' })).toBeVisible();
  await expect(page.locator('.character-choice')).toHaveCount(2);
  await page.getByRole('button', { name: 'Play Thief' }).click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!)) as State;
  expect(saved.character).toBe('thief');
  expect(saved.dice.map(d => d.template)).toEqual(['die_dagger', 'die_dagger', 'die_dodge', 'die_dodge', 'die_kris']);
  expect(errors).toEqual([]);
});

test('vulnerable stacks show on the enemy and exert blanks the die next turn', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[4].slot = 'left';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await die(page, 'd4').click();
  await actor(page, 'gnat-a').click();
  await expect(actor(page, 'gnat-a').locator('.chip--vulnerable')).toContainText('1');
  await expect(page.locator('[data-socket="4"].is-spent')).toBeVisible();
  await action(page, 'end').click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(actor(page, 'gnat-a').locator('.chip--vulnerable')).toHaveCount(0);
  await action(page, 'commit').click();
  await expect(page.locator('button.seated[aria-label*="Blank"]')).toHaveCount(1);
});

test('picking a hero works right away even with animations enabled', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Barbarian' }).click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await context.close();
});

test('each face is drawn with the image chosen for its face in the data', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[0].slot = 'left';
  state.combat!.rolls[2].slot = 'right';
  await saveFixture(page, state);
  await expect(page.locator('#stage canvas')).toBeVisible();
  await action(page, 'commit').click();
  // The seated chips and the die layout use the face image, not the generic effect icon.
  await expect(page.locator('button.seated[data-die="d0"] img')).toHaveAttribute('src', /face-art\/library\/sword\.webp$/);
  await expect(page.locator('button.seated[data-die="d2"] img')).toHaveAttribute('src', /face-art\/library\/shield\.webp$/);
  await die(page, 'd2').click({ button: 'right' });
  const layout = page.getByRole('dialog', { name: 'Shield die layout' });
  await expect(layout.locator('.net-tile img').first()).toHaveAttribute('src', /face-art\/library\/shield\.webp$/);
});

test('an exerted die shows the blank face image', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[4].slot = 'left';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await die(page, 'd4').click();
  await actor(page, 'gnat-a').click();
  await action(page, 'end').click();
  await action(page, 'commit').click();
  await expect(page.locator('button.seated[data-die="d4"] img')).toHaveAttribute('src', /face-art\/library\/blank\.webp$/);
});

test('the HUD shows gold, and a won fight pays gold on the spoils screen', async ({ page }) => {
  const state = newRun('fixed', 231);
  const c = state.combat!;
  c.enemies.forEach(e => { e.hp = 1; });
  c.rolls[0].slot = 'left';
  c.rolls[1].slot = 'left';
  await saveFixture(page, state);
  await expect(page.locator('.gold-hud')).toContainText('0');
  await action(page, 'commit').click();
  await die(page, 'd0').click();
  await actor(page, 'gnat-a').click();
  await die(page, 'd1').click();
  await actor(page, 'gnat-b').click();
  await expect(page.getByRole('heading', { name: 'Spoils' })).toBeVisible();
  const banner = page.locator('.gold-banner');
  await expect(banner).toBeVisible();
  const earned = Number((await banner.innerText()).replace(/\D/g, ''));
  expect(earned).toBeGreaterThanOrEqual(10);
  expect(earned).toBeLessThanOrEqual(20);
  await expect(page.locator('.gold-hud .gold-amount')).toHaveText(`${earned}`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!)) as State;
  expect(saved.gold).toBe(earned);
});

test('the gear opens a menu where a run can be abandoned after confirming', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?character=thief');
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.locator('.hud-right [data-action="ledger"]')).toBeVisible();
  const gear = page.locator('.hud-right [data-action="menu"]');
  await expect(gear).toBeVisible();
  await gear.click();
  const menu = page.getByRole('region', { name: 'Menu' });
  await expect(menu).toBeVisible();
  // Closing the menu leaves the run untouched.
  await menu.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await page.keyboard.press('Escape');

  await gear.click();
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await expect(page.getByText('Abandon this run?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('button', { name: 'Abandon run' })).toBeVisible();
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await page.getByRole('button', { name: 'Confirm abandon run' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your hero' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('reedmark:fixed:v1'))).toBeNull();
  // Reloading does not bring the abandoned run back.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your hero' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('abandoning a seeded run restarts the same seed', async ({ page }) => {
  await page.goto('/?seed=231');
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await action(page, 'commit').click();
  await page.locator('[data-action="menu"]').click();
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await page.getByRole('button', { name: 'Confirm abandon run' }).click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(action(page, 'commit')).toBeVisible();
});
