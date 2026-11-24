import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { newRun } from '../../src/game.ts';
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
  await page.goto('/?seed=231');
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
  await expect(actor(page, 'courier').locator('.chip--guard')).toHaveText('3');
  const attack = page.locator('button.seated[aria-label*="Damage"]').first();
  await drag(page, attack, actor(page, 'gnat-a'));
  await expect(actor(page, 'gnat-a')).not.toContainText('10/10');
});

test('narrow touch layout exposes ten pool dice and supports tap targeting', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4177/?mode=pool&seed=231');
  await page.getByRole('button', { name: 'View dice bag' }).tap();
  await expect(page.locator('[data-action="inspect"]')).toHaveCount(10);
  await expect(page.getByText('5 remaining')).toBeVisible();
  await page.getByRole('button', { name: 'Close dice' }).tap();
  await action(page, 'commit').tap();
  await die(page, 'd0').tap();
  await expect(actor(page, 'gnat-a')).toHaveClass(/is-legal/);
  await actor(page, 'gnat-a').tap();
  await expect(actor(page, 'gnat-a')).not.toContainText('10/10');
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
  state.combat!.rolls[3].slot = 'left';
  await saveFixture(page, state);
  await die(page, 'd3').hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('3 Block, 2 Tune');
  await expect(tooltip).toContainText('Increases another unspent die’s first Damage or Block value');
  await expect(tooltip.locator('dt')).toHaveText(['Block', 'Tune']);
  await expect(die(page, 'd3')).not.toHaveAttribute('title', /.+/);

  await die(page, 'd2').click({ button: 'right' });
  const layout = page.getByRole('dialog', { name: 'Bristle die layout' });
  await expect(layout).toBeVisible();
  await expect(layout.locator('.net-tile img')).not.toHaveCount(0);
  await expect(layout.locator('.net-tile')).toHaveCount(6);
  await layout.locator('[data-slot="left"]').hover();
  await expect(tooltip).toContainText('3 Damage, 3 Poison');
  await expect(tooltip).toContainText('Poison bypasses Block');
  const hintBounds = (await tooltip.boundingBox())!;
  const layoutBounds = (await layout.boundingBox())!;
  expect(hintBounds.x).toBeGreaterThan(layoutBounds.x + layoutBounds.width);
  await page.keyboard.press('Escape');
  await expect(layout).toHaveCount(0);
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await die(page, 'd3').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('dialog', { name: 'Switch die layout' })).toBeVisible();
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
    baseURL: 'http://localhost:4177', viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const state = newRun('fixed', 231);
  state.phase = 'reward';
  state.offers = [{ kind: 'item', id: 'sea' }, { kind: 'item', id: 'moss' }, { kind: 'item', id: 'nick' }];
  await saveFixture(page, state);
  await page.getByRole('button', { name: 'Sea Thread' }).tap();
  await page.getByRole('button', { name: 'Imprint on Needle' }).tap();
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
  test(`plays a complete ${variant} victory through the browser UI`, async ({ page }) => {
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
    expect(s.phase).toBe('victory');
    await expect(page.getByRole('heading', { name: 'Passage clear' })).toBeVisible();
    await expect(page.getByText(`${s.hp} HP left`)).toBeVisible();
    expect(errors).toEqual([]);
  });
}
