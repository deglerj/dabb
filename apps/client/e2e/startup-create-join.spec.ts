/**
 * Startup smoke test — replaces the old Android/Maestro flow now that there's no native
 * build to test. Boots the app, creates an online session, and joins it from a second
 * browser context (its own storage), against the Firebase RTDB emulator.
 */
import { test, expect } from '@playwright/test';

test('create a session and join it from a second browser context', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-title')).toBeVisible();

  await page.getByTestId('home-create-online-button').click();
  await page.getByTestId('home-nickname-input').fill('Host');
  await page.getByTestId('home-submit-button').click();

  await expect(page.getByTestId('waiting-room-session-code')).toBeVisible();
  const code = (await page.getByTestId('waiting-room-session-code').textContent())?.trim();
  expect(code).toBeTruthy();
  await expect(page.getByTestId('waiting-room-players-count')).toContainText('1/');

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  try {
    await guestPage.goto('/');
    await guestPage.getByTestId('home-join-online-button').click();
    await guestPage.getByTestId('home-nickname-input').fill('Guest');
    await guestPage.getByTestId('home-join-code-input').fill(code!);
    await guestPage.getByTestId('home-submit-button').click();

    await expect(guestPage.getByTestId('waiting-room-players-count')).toContainText('2/2');
    await expect(page.getByTestId('waiting-room-players-count')).toContainText('2/2');
  } finally {
    await guestContext.close();
  }
});
