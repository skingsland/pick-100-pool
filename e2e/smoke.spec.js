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

test('bracket view: column sorting works', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}/brackets/${BRACKET_1_ID}`);
    await expect(page.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });

    // Default sort is by seed ascending — first row should be seed 1
    const firstSeed = page.locator('.bracketTable tbody tr').first().locator('td').nth(1);
    await expect(firstSeed).toHaveText('1');

    // Click "Team Total" header to sort descending — highest-scoring team first
    await page.locator('.bracketTable th', { hasText: 'Team Total' }).click();
    const firstTotal = page.locator('.bracketTable tbody tr').first().locator('td:last-child');
    const firstTotalValue = Number(await firstTotal.textContent());
    expect(firstTotalValue).toBeGreaterThan(0);

    // Click again to reverse — lowest-scoring team first
    await page.locator('.bracketTable th', { hasText: 'Team Total' }).click();
    const newFirstTotal = Number(await page.locator('.bracketTable tbody tr').first().locator('td:last-child').textContent());
    expect(newFirstTotal).toBeLessThanOrEqual(firstTotalValue);
});

test('pool view: clicking column headers sorts without errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`#/pools/${POOL_A_ID}`);
    await expect(page.locator('.ngRow')).toHaveCount(3, { timeout: 10000 });

    // Wait for ceiling column to appear
    const ceilingHeader = page.locator('.ngHeaderText', { hasText: 'Ceiling' });
    await expect(ceilingHeader).toBeVisible({ timeout: 5000 });

    // Click Points header — should sort without JS errors
    await page.locator('.ngHeaderText', { hasText: 'Points' }).click();

    // Click Ceiling header — should not throw (was causing "Cannot read properties of undefined")
    await ceilingHeader.click();

    // Click Teams header — should also work
    await page.locator('.ngHeaderText', { hasText: 'Teams' }).click();

    expect(errors).toEqual([]);
});

test('bracket view: max possible points shown next to bracket name', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}/brackets/${BRACKET_1_ID}`);

    // Wait for team data to load
    await expect(page.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });

    // "Max possible points" label should be visible with correct value
    const ceilingLabel = page.locator('.bracketCeiling');
    await expect(ceilingLabel).toBeVisible();
    await expect(ceilingLabel).toContainText('Max possible points:');
    await expect(ceilingLabel).toContainText('310');

    // Table should NOT have a Ceiling column (removed in favor of header display)
    await expect(page.locator('.bracketTable thead')).not.toContainText('Ceiling');
});

test('pool view: "Show ceiling?" checkbox visible and toggles Ceiling column', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for brackets to load
    await expect(page.locator('.ngRow')).toHaveCount(3, { timeout: 10000 });

    // "Show ceiling?" checkbox should be visible (tournament has started)
    const checkbox = page.locator('input[ng-model="model.showCeiling"]');
    await expect(checkbox).toBeVisible({ timeout: 5000 });

    // Checkbox should be checked by default (auto-enabled when tourney started)
    await expect(checkbox).toBeChecked();

    // Ceiling column should be visible
    const ceilingHeader = page.locator('.ngHeaderText', { hasText: 'Ceiling' });
    await expect(ceilingHeader).toBeVisible();

    // Wait for ceiling values to populate (async computation with 200ms debounce)
    const firstCeilingCell = page.locator('.ngRow').first().locator('.ngCell').nth(2);
    await expect(firstCeilingCell).not.toHaveText('', { timeout: 10000 });

    // Invariant: Ceiling >= Points for every bracket row
    const rows = page.locator('.ngRow');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
        const pointsText = await rows.nth(i).locator('.ngCell').nth(1).textContent();
        const ceilingText = await rows.nth(i).locator('.ngCell').nth(2).textContent();
        const points = Number(pointsText.trim());
        const ceiling = Number(ceilingText.trim());
        if (!isNaN(points) && !isNaN(ceiling)) {
            expect(ceiling).toBeGreaterThanOrEqual(points);
        }
    }

    // Uncheck — Ceiling column should disappear
    await checkbox.uncheck();
    await expect(ceilingHeader).toBeHidden();

    // Re-check — Ceiling column should reappear
    await checkbox.check();
    await expect(ceilingHeader).toBeVisible();
});

test('all-pools page shows ceiling column, no checkbox, no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('#/pools');
    await expect(page.locator('h3')).toContainText('March Madness Pools');

    // Ceiling column should be visible (always-on, no checkbox on this page)
    const ceilingHeader = page.locator('.ngHeaderText', { hasText: 'Ceiling' });
    await expect(ceilingHeader.first()).toBeVisible({ timeout: 10000 });

    // "Show ceiling?" checkbox should NOT be visible on the all-pools page
    const checkbox = page.locator('input[ng-model="model.showCeiling"]');
    await expect(checkbox.first()).toBeHidden();

    expect(errors).toEqual([]);
});

test('bracket with 0 teams remaining is grayed out', async ({ page }) => {
    // Testing_Round5 has Dave's Bracket with all teams eliminated
    await page.goto('/?tournament=Testing_Round5#/pools/e2eTestPoolA');
    await expect(page.locator('.ngRow')).toHaveCount(4, { timeout: 10000 });

    // Dave's Bracket should have the eliminated class (grayed out, 0 teams remaining)
    const daveRow = page.locator('.ngRow', { hasText: "Dave's Bracket" });
    await expect(daveRow.locator('.eliminated')).toBeVisible();
});

test('pre-tourney: no ceiling anywhere', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    // Pool view: no ceiling column, no checkbox
    await page.goto('/?tournament=Testing_PreTourney#/pools/e2eTestPoolA');
    await expect(page.locator('.ngRow')).toHaveCount(3, { timeout: 10000 });
    await expect(page.locator('.ngHeaderText', { hasText: 'Ceiling' })).toHaveCount(0);
    const checkbox = page.locator('input[ng-model="model.showCeiling"]');
    if (await checkbox.count() > 0) {
        await expect(checkbox.first()).toBeHidden();
    }

    // Bracket view: no "Max possible points" label
    await page.goto('/?tournament=Testing_PreTourney#/pools/e2eTestPoolA/brackets/e2eBracket1');
    await expect(page.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });
    await expect(page.locator('.bracketCeiling')).toHaveCount(0);

    expect(errors).toEqual([]);
});

test('day 1: ceiling visible, all teams alive, max upside', async ({ page }) => {
    await page.goto('/?tournament=Testing_Day1#/pools/e2eTestPoolA');
    await expect(page.locator('.ngRow')).toHaveCount(3, { timeout: 10000 });

    // Ceiling column should be visible with values > 0
    const ceilingHeader = page.locator('.ngHeaderText', { hasText: 'Ceiling' });
    await expect(ceilingHeader.first()).toBeVisible({ timeout: 5000 });

    // Wait for ceiling values to populate
    const firstCeilingCell = page.locator('.ngRow').first().locator('.ngCell').nth(2);
    await expect(firstCeilingCell).not.toHaveText('', { timeout: 10000 });
    expect(Number(await firstCeilingCell.textContent())).toBeGreaterThan(0);

    // All brackets should have 13 teams remaining (no one eliminated yet)
    const rows = page.locator('.ngRow');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
        const teamsText = await rows.nth(i).locator('.ngCell').nth(3).textContent();
        expect(Number(teamsText.trim())).toBe(13);
    }

    // Bracket view should show "Max possible points"
    await page.goto('/?tournament=Testing_Day1#/pools/e2eTestPoolA/brackets/e2eBracket1');
    await expect(page.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });
    const ceilingLabel = page.locator('.bracketCeiling');
    await expect(ceilingLabel).toBeVisible();
    const ceilingValue = Number((await ceilingLabel.textContent()).match(/\d+/)[0]);
    expect(ceilingValue).toBeGreaterThan(0);
});

test('round 5: ceiling >= points for all brackets, no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/?tournament=Testing_Round5#/pools/e2eTestPoolA');
    await expect(page.locator('.ngRow')).toHaveCount(4, { timeout: 10000 });

    // Wait for ceiling values to populate
    const firstCeilingCell = page.locator('.ngRow').first().locator('.ngCell').nth(2);
    await expect(firstCeilingCell).not.toHaveText('', { timeout: 10000 });

    // Invariant: Ceiling >= Points for every bracket
    const rows = page.locator('.ngRow');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
        const pointsText = await rows.nth(i).locator('.ngCell').nth(1).textContent();
        const ceilingText = await rows.nth(i).locator('.ngCell').nth(2).textContent();
        const points = Number(pointsText.trim());
        const ceiling = Number(ceilingText.trim());
        expect(ceiling).toBeGreaterThanOrEqual(points);
    }

    expect(errors).toEqual([]);
});

test('post-tourney: no ceiling, no gray brackets, no errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    // Pool view
    await page.goto('/?tournament=Testing_Final#/pools/e2eTestPoolA');
    await expect(page.locator('.ngRow')).toHaveCount(3, { timeout: 10000 });

    // No ceiling column
    await expect(page.locator('.ngHeaderText', { hasText: 'Ceiling' })).toHaveCount(0);

    // No "Show ceiling?" checkbox visible
    const checkbox = page.locator('input[ng-model="model.showCeiling"]');
    if (await checkbox.count() > 0) {
        await expect(checkbox.first()).toBeHidden();
    }

    // No gray/eliminated bracket names (tournament is over, tourneyInProgress is false)
    const eliminated = page.locator('.ngRow .eliminated');
    if (await eliminated.count() > 0) {
        await expect(eliminated.first()).toBeHidden();
    }

    // Bracket detail view: no "Max possible points"
    await page.goto('/?tournament=Testing_Final#/pools/e2eTestPoolA/brackets/e2eBracket1');
    await expect(page.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });
    await expect(page.locator('.bracketCeiling')).toHaveCount(0);

    expect(errors).toEqual([]);
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
