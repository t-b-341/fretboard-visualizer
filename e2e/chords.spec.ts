import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

async function addSymbol(page: import('@playwright/test').Page, symbol: string) {
  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.fill(symbol);
  await input.press('Enter');
}

test('typing chords adds steps with function tags', async ({ page }) => {
  await openApp(page);
  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.fill('H7');
  await input.press('Enter');
  await expect(page.getByTestId('add-chord')).toContainText("Can't read that chord.");
  await expect(page.getByTestId('step-chip')).toHaveCount(0);

  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  const chips = page.getByTestId('step-chip');
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0).locator('.step-symbol')).toHaveText('Cm7');
  await expect(chips.nth(1).locator('.step-symbol')).toHaveText('F7');
  await expect(chips.nth(2).locator('.step-symbol')).toHaveText('Bbmaj7');
  await expect(chips.nth(0).locator('.step-fn')).toHaveText('SD');
  await expect(chips.nth(1).locator('.step-fn')).toHaveText('D');
  await expect(chips.nth(2).locator('.step-fn')).toHaveText('T');
  await expect(page.getByRole('radio', { name: 'Progression' })).toHaveAttribute('aria-checked', 'true');

  for (let index = 0; index < 3; index++) {
    await chips.nth(index).click();
    const why = (await page.getByTestId('step-why').innerText()).replace(/^Why:\s*/, '');
    expect(why.length).toBeGreaterThan(8);
  }
});

test('the palette adds the diatonic V, as a seventh when asked', async ({ page }) => {
  await openApp(page);
  const palette = page.getByTestId('chord-palette');
  await palette.getByRole('button', { name: 'V', exact: true }).click();
  await expect(page.getByTestId('step-chip').nth(0).locator('.step-symbol')).toHaveText('F');
  await palette.getByRole('checkbox', { name: '7th chords' }).check();
  await palette.getByRole('button', { name: 'V', exact: true }).click();
  await expect(page.getByTestId('step-chip').nth(1).locator('.step-symbol')).toHaveText('F7');
});

test('Suggest keeps a locked step and Reroll changes only the current one', async ({ page }) => {
  await openApp(page);
  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  const chips = page.getByTestId('step-chip');
  const lockedSymbol = await chips.nth(1).locator('.step-symbol').innerText();
  await chips.nth(1).click();
  await page.getByRole('button', { name: 'Lock this step' }).click();
  await expect(chips.nth(1)).toHaveAttribute('data-locked', 'true');
  await page.getByRole('button', { name: 'Suggest', exact: true }).click();
  await expect(page.getByTestId('step-chip').nth(1).locator('.step-symbol')).toHaveText(lockedSymbol);

  await page.getByTestId('step-chip').nth(0).click();
  const before = await page.locator('.step-symbol').allTextContents();
  const fn = await page.getByTestId('step-chip').nth(0).locator('.step-fn').innerText();
  await page.getByRole('button', { name: 'Reroll this step' }).click();
  const after = await page.locator('.step-symbol').allTextContents();
  expect(after[0]).not.toBe(before[0]);
  expect(after[1]).toBe(before[1]);
  if (before[2] !== undefined) expect(after[2]).toBe(before[2]);
  await expect(page.getByTestId('step-chip').nth(0).locator('.step-fn')).toHaveText(fn);
});

test('a borrowed chord is drawn with a dashed chip', async ({ page }) => {
  await openApp(page);
  await addSymbol(page, 'Ebm');
  const chip = page.getByTestId('step-chip');
  await expect(chip).toHaveClass(/is-borrowed/);
  await expect(chip).toHaveCSS('border-top-style', 'dashed');
});
