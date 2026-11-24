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
  await expect(actor(page, 'courier')).toContainText('⬟ 3');
  const attack = page.locator('button.seated[aria-label*="Hit"]').first();
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
      await page.locator(`button[data-action="reward-die"][data-id="${command.id}"]`).click();
      await action(page, 'take').click();
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
