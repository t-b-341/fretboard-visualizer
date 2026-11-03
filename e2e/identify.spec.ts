import { expect, test, type Page } from '@playwright/test';
import { fakeMidi, neckCell, openApp } from './helpers';

async function identifyNames(page: Page) {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /identify/i.test(line));
}

test('picking D, F# and A names D and adds it as a step', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: /identify/i })).toHaveCount(1);
  expect(await identifyNames(page)).toHaveLength(1);

  await page.getByTestId('identify-tool').click();
  expect(await identifyNames(page)).toHaveLength(1);
  await expect(page.getByTestId('identify-result')).toContainText('Play or pick two or more notes');

  // Half-step-down 7-string: D2, F#2, A2, with D in the bass.
  await neckCell(page, 0, 4);
  await neckCell(page, 1, 3);
  await neckCell(page, 2, 1);
  await expect(page.getByTestId('identify-primary').locator('.identify-name')).toHaveText('D');
  await expect
    .poll(async () =>
      page.locator('.staff-measure.is-current [data-midi]').evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute('data-midi'))).sort((a, b) => a - b),
      ),
    )
    .toEqual([38, 42, 45]);

  await page.getByRole('button', { name: 'Add as step' }).click();
  const chip = page.getByTestId('step-chip');
  await expect(chip).toHaveCount(1);
  await expect(chip.locator('.step-symbol')).toHaveText('D');
  await expect(chip).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('radio', { name: 'Chord' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('identify-tool')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('identify-result')).toHaveCount(0);
});

test('held MIDI notes are named and added when nothing was clicked', async ({ page, context }) => {
  await fakeMidi(context);
  await openApp(page);
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: /Enable MIDI/ }).click();
  await page.getByRole('combobox', { name: 'Input' }).selectOption({ label: 'Fake Keys' });
  await page.keyboard.press('Escape');
  await page.getByTestId('identify-tool').click();

  const name = page.getByTestId('identify-primary').locator('.identify-name');
  await expect
    .poll(async () => {
      await page.evaluate(() => window.__midi.send([0x90, 60, 100]));
      await page.evaluate(() => window.__midi.send([0x90, 64, 100]));
      await page.evaluate(() => window.__midi.send([0x90, 67, 100]));
      return (await name.count()) > 0 ? name.innerText() : '';
    })
    .toBe('C');

  await page.getByRole('button', { name: 'Add as step' }).click();
  await expect(page.getByTestId('step-chip').locator('.step-symbol')).toHaveText('C');
  await expect(page.getByTestId('identify-tool')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('radio', { name: 'Chord' })).toHaveAttribute('aria-checked', 'true');
});

test('the chosen alternative is the step that gets added', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('identify-tool').click();
  // C E A G, C in the bass: C6, with Am7/C beside it.
  await neckCell(page, 0, 2);
  await neckCell(page, 1, 1);
  await neckCell(page, 2, 1);
  await neckCell(page, 3, 6);

  const top = await page.getByTestId('identify-primary').getAttribute('data-slash');
  const alt = page.getByTestId('identify-alt').first();
  await expect(alt).toBeVisible();
  const slash = await alt.getAttribute('data-slash');
  expect(slash).toBeTruthy();
  expect(slash).not.toBe(top);
  await alt.click();
  await expect(page.getByTestId('identify-primary')).toHaveAttribute('data-slash', slash!);
  await page.getByRole('button', { name: 'Add as step' }).click();
  await expect(page.getByTestId('step-chip').locator('.step-symbol')).toHaveText(slash!);
});

test('clicking a picked cell again removes that note', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('identify-tool').click();
  await neckCell(page, 0, 4);
  await expect(page.locator('svg.fretboard [data-identify="true"]')).toHaveCount(1);
  await neckCell(page, 0, 4);
  await expect(page.locator('svg.fretboard [data-identify="true"]')).toHaveCount(0);
});

test('Escape leaves the tool and keeps the steps', async ({ page }) => {
  await openApp(page);
  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.fill('Gm7');
  await input.press('Enter');
  await expect(page.getByTestId('step-chip').locator('.step-symbol')).toHaveText('Gm7');

  await page.getByTestId('identify-tool').click();
  await neckCell(page, 0, 4);
  await expect(page.locator('svg.fretboard [data-identify="true"]')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('identify-tool')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('identify-result')).toHaveCount(0);
  await expect(page.locator('svg.fretboard [data-identify="true"]')).toHaveCount(0);
  await expect(page.getByTestId('step-chip')).toHaveCount(1);
  await expect(page.getByTestId('step-chip').locator('.step-symbol')).toHaveText('Gm7');
  await expect(page.getByRole('radio', { name: 'Chord' })).toHaveAttribute('aria-checked', 'true');
});
