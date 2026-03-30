const { test, expect } = require('@playwright/test');
const { ensureLoggedOut, login, cleanupPoolB, POOL_A_ID, POOL_B_ID } = require('./helpers');

test('view own bracket when logged in', async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);

    // Navigate to pool A (which has our test user's bracket)
    await page.goto(`#/pools/${POOL_A_ID}`);

    // The current user's bracket should be displayed first (embedded in the pool view)
    const ownBracket = page.locator('.viewBracket', { hasText: "Test User's Bracket" });
    await expect(ownBracket).toBeVisible({ timeout: 10000 });

    // Verify it has the correct team data (13 rows)
    await expect(ownBracket.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });
});

test('create bracket via Pick for me, then clean up', async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);

    // Navigate to Test Pool B (allows bracket changes during tourney) and clean up any stale bracket
    await cleanupPoolB(page);

    // Click "Select Your Teams" to create a new bracket
    await page.locator('a', { hasText: 'Select Your Teams' }).click();

    // Wait for team grid to load
    await expect(page.locator('.selectTeamsGrid')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.selectTeamsGrid .ngRow')).toHaveCount(16, { timeout: 10000 });

    // Click "Pick for me" to auto-select valid teams
    await page.locator('button', { hasText: 'Pick for me' }).click();

    // Verify 13 teams selected with seeds summing to 100
    await expect(page.locator('.selectedItems li')).toHaveCount(13, { timeout: 10000 });
    await expect(page.locator('text=Seeds: 100 / 100')).toBeVisible();

    // Fill in bracket name
    await page.locator('#name').fill('E2E Test Bracket');

    // Save
    await page.locator('button', { hasText: 'Save' }).click();

    // Should redirect back to pool view
    await expect(page).toHaveURL(new RegExp(`#/pools/${POOL_B_ID}$`), { timeout: 10000 });

    // Verify the bracket appears
    const ownBracket = page.locator('.viewBracket', { hasText: 'E2E Test Bracket' });
    await expect(ownBracket).toBeVisible({ timeout: 10000 });

    // Cleanup: delete the created bracket
    await ownBracket.locator('button', { hasText: 'Delete Your Bracket' }).click();

    // Verify bracket is gone — "Select Your Teams" button should reappear
    await expect(page.locator('a', { hasText: 'Select Your Teams' })).toBeVisible({ timeout: 10000 });
});

test('show owners checkbox toggles owner names', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for brackets grid to load
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });
    const rowCount = await page.locator('.ngRow').count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // Show owners checkbox should exist
    const checkbox = page.locator('#showOwners');
    await expect(checkbox).toBeVisible();

    // Check it — owner names should appear (assert the "by ..." spans become visible, not a hardcoded name)
    await checkbox.check();
    await expect(page.locator('.allBracketsGrid .ngRow span[ng-show="model.showOwners"]').first()).toBeVisible({ timeout: 5000 });

    // Uncheck it — owner names should be hidden
    await checkbox.uncheck();
    // The "by" text with owner names should not be visible
    await expect(page.locator('.allBracketsGrid .ngRow span[ng-show="model.showOwners"]').first()).toBeHidden();
});
