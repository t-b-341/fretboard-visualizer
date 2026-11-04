import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openApp, recordSynth } from './helpers';

const NEXT_CM_TO_F = 'Next: Bb\u2192A (\u22121), G\u2192F (\u22122), C holds, Eb holds';

async function addSymbol(page: Page, symbol: string) {
  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.fill(symbol);
  await input.press('Enter');
}

async function currentIndex(page: Page): Promise<number> {
  const value = await page.locator('[data-testid="step-chip"][aria-current="step"]').getAttribute('data-step-index');
  return Number(value);
}

async function fastTempo(page: Page) {
  await page.getByTestId('transport').getByRole('spinbutton', { name: 'Tempo' }).fill('240');
}

test('play steps every view, and stop halts it', async ({ page, context }) => {
  await recordSynth(context);
  await openApp(page);
  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  await fastTempo(page);
  const transport = page.getByTestId('transport');
  await page.evaluate(() => {
    const seen = { chips: [] as number[], staff: [] as number[] };
    (window as unknown as { __steps: typeof seen }).__steps = seen;
    window.setInterval(() => {
      const chip = document.querySelector('[data-testid="step-chip"][aria-current="step"]');
      const measure = document.querySelector('.staff-measure.is-current');
      const index = Number(chip?.getAttribute('data-step-index'));
      const staffIndex = Number(measure?.getAttribute('data-measure-index'));
      if (Number.isInteger(index) && seen.chips.at(-1) !== index) seen.chips.push(index);
      if (Number.isInteger(staffIndex) && seen.staff.at(-1) !== staffIndex) seen.staff.push(staffIndex);
    }, 40);
  });
  await transport.getByRole('button', { name: 'Play' }).click();
  await expect
    .poll(async () => page.evaluate(() => {
      const seen = (window as unknown as { __steps: { chips: number[]; staff: number[] } }).__steps;
      return `${seen.chips.join(',')}|${seen.staff.join(',')}`;
    }), { timeout: 5000 })
    .toMatch(/0,1,2.*\|.*0,1,2/);
  const trace = await page.evaluate(() => {
    const seen = (window as unknown as { __steps: { chips: number[]; staff: number[] } }).__steps;
    return `${seen.chips.join(',')}|${seen.staff.join(',')}`;
  });
  const [chips, staff] = trace.split('|');
  expect(staff).toBe(chips);

  await expect(transport.getByRole('button', { name: 'Stop' })).toBeVisible();
  await transport.getByRole('button', { name: 'Stop' }).click();
  const stoppedAt = await page.evaluate(() => window.__played.length);
  const index = await currentIndex(page);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__played.length)).toBe(stoppedAt);
  expect(await currentIndex(page)).toBe(index);
  await expect(transport.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('loop off stops on the last step', async ({ page, context }) => {
  await recordSynth(context);
  await openApp(page);
  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  const transport = page.getByTestId('transport');
  await transport.getByRole('checkbox', { name: 'Loop' }).uncheck();
  await fastTempo(page);
  await transport.getByRole('button', { name: 'Play' }).click();
  await expect(transport.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect
    .poll(async () => {
      const label = await transport.getByRole('button', { name: /^(Play|Stop)$/ }).innerText();
      return `${await currentIndex(page)}:${label}`;
    }, { timeout: 5000 })
    .toBe('2:Play');
  await page.waitForTimeout(400);
  await expect(transport.getByRole('button', { name: 'Play' })).toBeVisible();
  expect(await currentIndex(page)).toBe(2);
});

test('space toggles play unless the chord field is focused', async ({ page, context }) => {
  await recordSynth(context);
  await openApp(page);
  await addSymbol(page, 'Cm7');
  await page.locator('h1').click();
  const transport = page.getByTestId('transport');
  await page.keyboard.press('Space');
  await expect(transport.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(transport.getByRole('button', { name: 'Play' })).toBeVisible();

  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.click();
  await input.fill('');
  await page.keyboard.press('Space');
  await expect(input).toHaveValue(' ');
  await expect(transport.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('the next line, voice motion, and tab export follow the steps', async ({ page }) => {
  await openApp(page);
  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  await page.getByTestId('voicing-panel').getByRole('radio', { name: 'Drop-2' }).click();
  await page.getByTestId('step-chip').nth(0).click();
  await expect(page.getByTestId('step-next')).toHaveText(NEXT_CM_TO_F);
  await expect(page.locator('.motion-ring').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Voice motion' }).uncheck();
  await expect(page.locator('.motion-ring')).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'Download tab (.txt)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  const text = await readFile(await download.path(), 'utf8');
  expect(text).toContain('Cm7');
});

test('scale material plays fifteen notes and lights each view', async ({ page, context }) => {
  await recordSynth(context);
  await openApp(page);
  await page.evaluate(() => {
    const seen = { keys: [] as number[], neck: 0, staff: 0 };
    (window as unknown as { __lit: typeof seen }).__lit = seen;
    window.setInterval(() => {
      const key = document.querySelector('svg.keyboard [data-sounding="true"]');
      const neck = document.querySelector('svg.fretboard [data-sounding="true"]');
      const staff = document.querySelector('svg.staff [data-sounding="true"]');
      if (key) {
        const midi = Number(key.getAttribute('data-midi'));
        if (seen.keys.at(-1) !== midi) seen.keys.push(midi);
      }
      if (neck) seen.neck += 1;
      if (staff) seen.staff += 1;
    }, 30);
  });
  await fastTempo(page);
  await page.getByTestId('transport').getByRole('button', { name: 'Play' }).click();
  const expected = [70, 72, 74, 75, 77, 79, 81, 82, 81, 79, 77, 75, 74, 72, 70];
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __lit: { keys: number[]; neck: number; staff: number } }).__lit), {
      timeout: 8000,
    })
    .toEqual({ keys: expected, neck: expect.any(Number), staff: expect.any(Number) });
  const lit = await page.evaluate(() => (window as unknown as { __lit: { neck: number; staff: number } }).__lit);
  expect(lit.neck).toBeGreaterThan(0);
  expect(lit.staff).toBeGreaterThan(0);
  await expect.poll(async () => page.evaluate(() => window.__played.length), { timeout: 8000 }).toBe(expected.length * 2);
});
