import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const manualImageDir = path.resolve(process.cwd(), 'docs', 'manuals', 'images');

async function saveManualScreenshot(page: Page, fileName: string): Promise<void> {
  await mkdir(manualImageDir, { recursive: true });
  await page.screenshot({
    path: path.join(manualImageDir, fileName),
    fullPage: true,
  });
}

async function startNewGame(page: Page, seed: number): Promise<void> {
  await page.getByLabel('Seed').fill(String(seed));
  await page.getByRole('button', { name: 'New Game' }).click();
  await expect(page.getByRole('heading', { name: 'Status' })).toBeVisible();
}

async function clickFirstEnabledAction(page: Page, labels: string[]): Promise<boolean> {
  for (const label of labels) {
    const button = page.getByRole('button', { name: label });
    if (!(await button.isVisible())) {
      continue;
    }
    if (await button.isEnabled()) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function playUntilFinished(page: Page, maxTurns = 220): Promise<void> {
  for (let i = 0; i < maxTurns; i += 1) {
    const resultBox = page.locator('.result-box');
    if (await resultBox.isVisible()) {
      return;
    }

    const acted = await clickFirstEnabledAction(page, [
      'Work Sustain',
      'Work Deliver',
      'Invest Edge Asset',
      'Invest Asset',
      'Invest Maturity',
      'Pass',
    ]);

    await page.waitForTimeout(acted ? 120 : 300);
  }

  throw new Error('Game did not finish within the expected turns');
}

async function playPassOnlyUntilFinished(page: Page, maxTurns = 240): Promise<void> {
  for (let i = 0; i < maxTurns; i += 1) {
    const resultBox = page.locator('.result-box');
    if (await resultBox.isVisible()) {
      return;
    }

    const pass = page.getByRole('button', { name: 'Pass' });
    if ((await pass.isVisible()) && (await pass.isEnabled())) {
      await pass.click();
      await page.waitForTimeout(120);
    } else {
      await page.waitForTimeout(300);
    }
  }

  throw new Error('Game did not finish with pass-only policy');
}

async function readResultSnapshot(page: Page): Promise<{ playerFinal: number; aiFinal: number; ch: number }> {
  const resultBox = page.locator('.result-box');
  await expect(resultBox).toBeVisible();

  const text = (await resultBox.textContent()) ?? '';
  const match = text.match(/Player Final ([0-9.]+) \/ AI Final ([0-9.]+)/);
  if (!match) {
    throw new Error('Result text parse failed');
  }

  const chText = await page.locator('.status-grid div', { hasText: 'CH' }).locator('strong').innerText();
  return {
    playerFinal: Number.parseFloat(match[1]),
    aiFinal: Number.parseFloat(match[2]),
    ch: Number.parseInt(chText, 10),
  };
}

test('主要UIが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ship & Sustain' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selected Node' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selected Edge' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI Decision Trace' })).toBeVisible();
});

test('E2Eで1ゲーム完走し、スクリーンショットを保存する', async ({ page }) => {
  await page.goto('/');
  await startNewGame(page, 42);
  await saveManualScreenshot(page, 'e2e-01-initial.png');

  const edgeInvest = page.getByRole('button', { name: 'Invest Edge Asset' });
  await expect(edgeInvest).toBeEnabled();
  await edgeInvest.click();
  const edgePanel = page.locator('.node-detail').filter({ has: page.getByLabel('target edge') });
  await expect(edgePanel).toContainText('player');
  await saveManualScreenshot(page, 'e2e-02-edge-invest.png');

  await playUntilFinished(page);
  await expect(page.locator('.result-box')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI Decision Trace' })).toBeVisible();
  await saveManualScreenshot(page, 'e2e-03-result.png');
});

test('同一Seed + 同一操作ポリシーで結果が再現する', async ({ page }) => {
  await page.goto('/');
  await startNewGame(page, 314);
  await playPassOnlyUntilFinished(page);
  const first = await readResultSnapshot(page);

  await startNewGame(page, 314);
  await playPassOnlyUntilFinished(page);
  const second = await readResultSnapshot(page);

  expect(second.playerFinal).toBe(first.playerFinal);
  expect(second.aiFinal).toBe(first.aiFinal);
  expect(second.ch).toBe(first.ch);
});
