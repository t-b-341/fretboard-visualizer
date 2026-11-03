import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

const appUrl = pathToFileURL(resolve(process.cwd(), 'fretboard-visualizer.html')).href;

function octavesIn(label: string): number[] {
  return [...label.matchAll(/[A-G](?:#+|b+)?(-?\d+)/g)].map((match) => Number(match[1]));
}

async function addSymbol(page: Page, symbol: string) {
  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.fill(symbol);
  await input.press('Enter');
}

async function openQuery(page: Page, search: string) {
  page.on('pageerror', (error) => {
    throw new Error(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') throw new Error(`console error: ${message.text()}`);
  });
  await page.context().addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      // The blank document Playwright opens first has no storage.
    }
  });
  await page.goto(`${appUrl}${search}`);
  await page.locator('svg.fretboard').waitFor();
}

test('the grand staff is two groups of lines with clefs that do not overlap', async ({ page }) => {
  await openApp(page);
  const lines = await page.locator('svg.staff line.staff-line').evaluateAll((nodes) =>
    nodes
      .map((node) => Number(node.getAttribute('y1')))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => a - b),
  );
  expect(lines).toHaveLength(10);
  const treble = lines.slice(0, 5);
  const bass = lines.slice(5);
  const spacing = treble[1] - treble[0];
  expect(spacing).toBeGreaterThan(0);
  expect(bass[1] - bass[0]).toBeCloseTo(spacing, 5);
  const gap = bass[0] - treble[4];
  expect(gap).toBeGreaterThanOrEqual(4 * spacing - 0.01);

  const boxes = await page.evaluate(() => {
    const boxOf = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return { treble: boxOf('.staff-clef-treble'), bass: boxOf('.staff-clef-bass') };
  });
  expect(boxes.treble.height).toBeGreaterThan(15);
  expect(boxes.bass.height).toBeGreaterThan(15);
  const separated =
    boxes.treble.x + boxes.treble.width <= boxes.bass.x ||
    boxes.bass.x + boxes.bass.width <= boxes.treble.x ||
    boxes.treble.y + boxes.treble.height <= boxes.bass.y ||
    boxes.bass.y + boxes.bass.height <= boxes.treble.y;
  expect(separated).toBe(true);
});

test('Cm7 F7 Bbmaj7 draws 3 measures and the highlighted one follows Next', async ({ page }) => {
  await openApp(page);
  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  const measures = page.locator('svg.staff .staff-measure');
  await expect(measures).toHaveCount(3);
  await expect(measures.nth(0).locator('.staff-chord')).toHaveText('Cm7');
  await expect(measures.nth(1).locator('.staff-chord')).toHaveText('F7');
  await expect(measures.nth(2).locator('.staff-chord')).toHaveText('Bbmaj7');

  await page.locator('[data-step-index="0"]').click();
  await expect(measures.nth(0)).toHaveClass(/is-current/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(measures.nth(1)).toHaveClass(/is-current/);
  await expect(measures.nth(0)).not.toHaveClass(/is-current/);
});

test('Written on 7-string draws 5 lines with an 8 and raises every octave', async ({ page }) => {
  await openApp(page);
  const concert = (await page.locator('svg.staff').getAttribute('aria-label')) ?? '';
  const concertOctaves = octavesIn(concert);
  expect(concertOctaves.length).toBeGreaterThan(0);

  await page.getByTestId('staff-card').getByRole('radio', { name: 'Written' }).click();
  await expect(page.locator('svg.staff line.staff-line')).toHaveCount(5);
  await expect(page.locator('svg.staff .staff-clef-treble')).toHaveCount(1);
  await expect(page.locator('svg.staff .staff-clef-bass')).toHaveCount(0);
  await expect(page.locator('svg.staff .staff-clef-eight')).toHaveText('8');

  const written = (await page.locator('svg.staff').getAttribute('aria-label')) ?? '';
  const writtenOctaves = octavesIn(written);
  expect(writtenOctaves).toHaveLength(concertOctaves.length);
  writtenOctaves.forEach((octave, index) => {
    expect(octave).toBe(concertOctaves[index] + 1);
  });
});

test('6-string bass Written draws a bass clef', async ({ page }) => {
  await openQuery(page, '?n=6&sf=1');
  await page.getByTestId('staff-card').getByRole('radio', { name: 'Written' }).click();
  await expect(page.locator('svg.staff .staff-clef-bass')).toHaveCount(1);
  await expect(page.locator('svg.staff .staff-clef-treble')).toHaveCount(0);
  await expect(page.locator('svg.staff line.staff-line')).toHaveCount(5);
  await expect(page.locator('svg.staff .staff-clef-eight')).toHaveText('8');
});

test('clicking measure 3 selects step 3', async ({ page }) => {
  await openApp(page);
  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  await page.locator('[data-step-index="0"]').click();
  await expect(page.locator('[data-step-index="0"]')).toHaveClass(/is-current/);
  await page.locator('svg.staff .staff-measure').nth(2).locator('.staff-chord').click();
  await expect(page.locator('[data-step-index="2"]')).toHaveClass(/is-current/);
  await expect(page.locator('svg.staff .staff-measure').nth(2)).toHaveClass(/is-current/);
});
