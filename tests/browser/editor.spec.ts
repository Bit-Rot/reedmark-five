import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { COLLECTION_NAMES } from '../../src/data/types.ts';
import { filePath } from '../../src/data/db.ts';
import { FakeGitHub } from '../helpers/fake-github.ts';

/** Serve the editor a fake GitHub seeded with the repo's real data files. */
async function openEditor(page: Page) {
  const files: Record<string, string> = {};
  for (const n of COLLECTION_NAMES) files[filePath(n)] = readFileSync(filePath(n), 'utf8');
  const fake = new FakeGitHub(files);
  await page.addInitScript(() => {
    localStorage.setItem('fivedice-editor-token', 'test-token');
    localStorage.setItem('fivedice-editor-repo', JSON.stringify({ owner: 'o', repo: 'r', branch: 'main' }));
  });
  await page.route('https://api.github.com/**', async route => {
    const req = route.request();
    const res = await fake.fetch(req.url(), { method: req.method(), body: req.postData() ?? undefined });
    await route.fulfill({ status: res.status, body: await res.text(), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/editor/');
  await expect(page.locator('#bar .status')).toContainText('o/r@main');
  return fake;
}

test('lists data, shows the T diagram, flags dangling references, and renames with propagation', async ({ page }) => {
  await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await expect(page.locator('#items li')).toHaveCount(10);

  await page.locator('#nav button', { hasText: 'Dice' }).click();
  await page.locator('#items button', { hasText: 'die_hammer' }).click();
  await expect(page.locator('.tdiagram .slot[data-slot]')).toHaveCount(6);
  await expect(page.locator('.slot[data-slot="top"] select')).toHaveClass(/missing/);
  await expect(page.locator('.issues .error').first()).toContainText('slash_bash');

  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('#items button', { hasText: /^slash$/ }).click();
  await expect(page.locator('.usedby li').first()).toBeVisible();
  await page.locator('#id-input').fill('cut');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.locator('#toast')).toContainText('Renamed');

  await page.locator('#nav button', { hasText: 'Dice' }).click();
  await page.locator('#items button', { hasText: 'die_sword' }).click();
  await expect(page.locator('.slot[data-slot="left"] select')).toHaveValue('cut');
  await expect(page.locator('#bar button.primary')).toBeEnabled();
});

test('saves all edits as one commit and regenerates the docs', async ({ page }) => {
  const fake = await openEditor(page);
  const before = fake.head;
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('#items button', { hasText: /^stab$/ }).click();
  await page.locator('textarea').last().fill('hand-edited note');
  await page.locator('#bar button.primary').click();
  await page.getByRole('button', { name: 'Commit to GitHub' }).click();
  await expect(page.locator('#toast')).toContainText('Saved');
  expect(fake.head).not.toBe(before);
  expect(fake.commits.get(fake.head)!.parents).toEqual([before]);
  expect(fake.file('data/faces.json')).toContain('hand-edited note');
  expect(fake.file('docs/Dice Faces.md')).toContain('hand-edited note');
  await expect(page.locator('#bar button.primary')).toBeDisabled();
});

test('creates a new face and builds a die and an item that reference it', async ({ page }) => {
  await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('.list-new input').fill('smite');
  await page.getByRole('button', { name: '+ New' }).click();
  await expect(page.locator('#id-input')).toHaveValue('smite');
  await page.getByRole('button', { name: '+ add keyword' }).click();

  await page.locator('#nav button', { hasText: 'Items' }).click();
  await page.locator('.list-new input').fill('holy_symbol');
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByRole('button', { name: '+ add effect' }).click();
  await expect(page.locator('.effect')).toHaveCount(1);
  await expect(page.locator('#items li').filter({ hasText: 'holy_symbol' })).toBeVisible();
});

test('uploads a face image and commits it as a binary file', async ({ page }) => {
  const fake = await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('#items button', { hasText: /^stab$/ }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('.image-field input[type=file]').setInputFiles({ name: 'dagger.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.face-image')).toBeVisible();
  await expect(page.locator('.image-field .hint')).toContainText('face-art/stab.webp');
  await page.locator('#bar button.primary').click();
  await page.getByRole('button', { name: 'Commit to GitHub' }).click();
  await expect(page.locator('#toast')).toContainText('Saved');
  const sha = fake.trees.get(fake.commits.get(fake.head)!.tree)!.get('public/face-art/stab.webp')!;
  expect(fake.blobs.get(sha)!.encoding).toBe('base64');
  expect(fake.file('data/faces.json')).toContain('face-art/stab.webp');
});

test('narrow screens show one pane at a time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await expect(page.locator('#list')).toBeVisible();
  await expect(page.locator('#detail')).toBeHidden();
  await page.locator('#items button').first().click();
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#list')).toBeHidden();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.locator('#list')).toBeVisible();
});
