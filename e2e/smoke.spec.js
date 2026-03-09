const { test, expect } = require('@playwright/test');
const { POOL_A_ID, BRACKET_1_ID } = require('./helpers');

test('home page loads with heading and rules, no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('#/home');

    await expect(page.locator('h1')).toContainText('Pick 100 Tournament Pool');
    await expect(page.locator('.copy')).toContainText('rules for the game are simple');
    expect(errors).toEqual([]);
});

test('pools list shows Test Pool A', async ({ page }) => {
    await page.goto('#/pools');

    await expect(page.locator('h3')).toContainText('March Madness Pools');

    // Wait for Firebase data to load and pool names to appear
    const poolLink = page.locator('.poolsList h4 a', { hasText: 'Test Pool A' });
    await expect(poolLink).toBeVisible();
});

test('pool view shows brackets table with data', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Pool name
    await expect(page.locator('h2')).toContainText('Test Pool A');

    // Bracket list grid should be visible with bracket data
    const bracketsGrid = page.locator('.allBracketsGrid');
    await expect(bracketsGrid).toBeVisible();

    // ng-grid renders data in .ngRow elements
    await expect(page.locator('.ngRow')).toHaveCount(3, { timeout: 10000 });

    // Verify bracket data columns are populated (names, points, teams-remaining)
    const firstRow = page.locator('.ngRow').first();
    await expect(firstRow.locator('.ngCell').nth(0)).not.toBeEmpty();  // bracket name
    await expect(firstRow.locator('.ngCell').nth(1)).not.toBeEmpty();  // points
    await expect(firstRow.locator('.ngCell').nth(2)).not.toBeEmpty();  // teams remaining
});

test('bracket view shows team table with scores', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}/brackets/${BRACKET_1_ID}`);

    // Bracket name
    await expect(page.locator('.viewBracket h3')).toContainText("Test User's Bracket");

    // Team table should have 13 data rows
    const teamRows = page.locator('.bracketTable tbody tr');
    await expect(teamRows).toHaveCount(13, { timeout: 10000 });

    // Column headers should include round labels and team total
    await expect(page.locator('.bracketTable thead')).toContainText('Seed');
    await expect(page.locator('.bracketTable thead')).toContainText('Round 1');
    await expect(page.locator('.bracketTable thead')).toContainText('Round 6');
    await expect(page.locator('.bracketTable thead')).toContainText('Team Total');

    // Footer should show totals
    const footer = page.locator('.bracketTable tfoot');
    await expect(footer).toContainText('TOTALS:');
    await expect(footer).toContainText('100'); // seed sum

    // Eliminated teams should have the 'eliminated' CSS class
    const eliminatedRows = page.locator('.bracketTable tbody tr.eliminated');
    await expect(eliminatedRows.first()).toBeVisible();

    // Team totals should be numbers (not NaN or blank)
    const teamTotals = page.locator('.bracketTable tbody tr td:last-child');
    const count = await teamTotals.count();
    for (let i = 0; i < count; i++) {
        const text = await teamTotals.nth(i).textContent();
        expect(Number(text)).not.toBeNaN();
    }
});

test('header has navigation links', async ({ page }) => {
    await page.goto('#/home');

    // Rules (brand) link and Play Now (pools) link
    await expect(page.locator('.navbar-brand')).toContainText('Rules');
    await expect(page.locator('.navbar-nav a', { hasText: 'Play Now' })).toBeVisible();

    // Log in / Register dropdowns visible when not logged in
    await expect(page.locator('.navbar', { hasText: 'Log in' })).toBeVisible();
    await expect(page.locator('.navbar', { hasText: 'Register' })).toBeVisible();
});
