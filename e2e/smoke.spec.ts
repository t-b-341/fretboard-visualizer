import { expect, test } from '@playwright/test';
import { fakeMidi, neckCell, neckLabels, openApp, recordSynth } from './helpers';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      // The blank document Playwright opens first has no storage.
    }
  });
});

test('loads with no errors and draws note labels on the neck', async ({ page }) => {
  await openApp(page);
  const labels = await neckLabels(page);
  expect(labels.length).toBeGreaterThan(0);
  expect(labels).toContainEqual({ string: 0, fret: 0, label: 'Bb' });
  await neckCell(page, 0, 0);
  await expect(page.locator('svg.fretboard')).toBeVisible();
});

test('shows the staff on the workspace', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('staff-card')).toBeVisible();
  await expect(page.locator('svg.staff')).toBeVisible();
});

test('installs a fake MIDI input named Fake Keys', async ({ page, context }) => {
  await fakeMidi(context);
  await openApp(page);
  const name = await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess();
    const input = [...access.inputs.values()][0];
    window.__midi.send([0x90, 60, 100]);
    return input?.name ?? '';
  });
  expect(name).toBe('Fake Keys');
});

test('records oscillator starts when a scale is played', async ({ page, context }) => {
  await recordSynth(context);
  await openApp(page);
  await page.getByTestId('transport').getByRole('button', { name: 'Play' }).click();
  await expect.poll(async () => page.evaluate(() => window.__played ?? [])).not.toEqual([]);
  const played = await page.evaluate(() => window.__played);
  expect(played.every((freq) => freq > 0)).toBe(true);
});
