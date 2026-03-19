const { test, expect } = require('@playwright/test');
const { POOL_A_ID } = require('./helpers');

test('pools list: clicking bracket name navigates to pool page and scrolls to bracket', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/?tournament=Testing_Final#/pools');
    await expect(page.locator('h2')).toContainText('March Madness Pools');
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });

    // Bracket names should be clickable links (scope to Pool A to avoid ng-grid buffer duplicates)
    const poolACard = page.locator(`#pool-${POOL_A_ID}`);
    const aliceLink = poolACard.locator('.ngRow .ngCell a', { hasText: "Alice's Picks" });
    await expect(aliceLink).toBeVisible();

    await aliceLink.click();

    // Should navigate to the single pool page
    await expect(page.locator('h2')).toContainText('Test Pool A', { timeout: 10000 });
    await expect(page).toHaveURL(/\/pools\/e2eTestPoolA/);

    // Alice's bracket detail should be visible and scrolled to
    const aliceBracket = page.locator('.viewBracket h3', { hasText: "Alice's Picks" });
    await expect(aliceBracket).toBeVisible({ timeout: 10000 });
    await expect(aliceBracket).toBeInViewport({ timeout: 5000 });

    expect(errors).toEqual([]);
});

test('single pool page: bracket name links still scroll within page', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/?tournament=Testing_Final#/pools/e2eTestPoolA');
    await expect(page.locator('h2')).toContainText('Test Pool A');
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.viewBracket h3').first()).toBeVisible({ timeout: 10000 });

    // Scroll to top first
    await page.evaluate(() => window.scrollTo(0, 0));

    // Click the last bracket link in the grid — should scroll within the page
    const bracketLinks = page.locator('.ngRow .ngCell a');
    const lastLink = bracketLinks.last();
    await lastLink.click();
    await page.waitForTimeout(500);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);

    // Should still be on the same pool page (no navigation)
    await expect(page).toHaveURL(/\/pools\/e2eTestPoolA/);

    expect(errors).toEqual([]);
});
