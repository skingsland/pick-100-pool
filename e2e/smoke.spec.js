const { test, expect } = require('@playwright/test');
const { POOL_A_ID, BRACKET_1_ID, login } = require('./helpers');

test('home page loads with heading and rules, no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('#/home');

    await expect(page.locator('h1')).toContainText('Pick 100 Tournament Pool');
    await expect(page.locator('.rules-section')).toContainText('rules for the game are simple');
    expect(errors).toEqual([]);
});

test('pools list shows Test Pool A', async ({ page }) => {
    await page.goto('#/pools');

    await expect(page.locator('h2')).toContainText('March Madness Pools');

    // Wait for Firebase data to load and pool names to appear
    const poolLink = page.locator('.poolsList h4 a', { hasText: 'Test Pool A' });
    await expect(poolLink).toBeVisible();
});

test('pools list shows jump-to navigation with pool names', async ({ page }) => {
    await page.goto('#/pools');

    const jumpTo = page.locator('.poolJumpTo');
    await expect(jumpTo).toBeVisible({ timeout: 10000 });

    // Should contain both pool names as links
    await expect(jumpTo.locator('a', { hasText: 'Test Pool A' })).toBeVisible();
    await expect(jumpTo.locator('a', { hasText: 'Test Pool B' })).toBeVisible();
});

test('pool view shows brackets table with data', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Pool name
    await expect(page.locator('h2')).toContainText('Test Pool A');

    // Bracket list grid should be visible with bracket data
    const bracketsGrid = page.locator('.allBracketsGrid');
    await expect(bracketsGrid).toBeVisible();

    // ng-grid renders data in .ngRow elements
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });
    const rowCount = await page.locator('.ngRow').count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

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
    await expect(page.locator('.bracketTable thead')).toContainText('R64');
    await expect(page.locator('.bracketTable thead')).toContainText('Finals');
    await expect(page.locator('.bracketTable thead')).toContainText('Total');

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

    // Click "Total" header to sort descending — highest-scoring team first
    await page.locator('.bracketTable th', { hasText: 'Total' }).click();
    const firstTotal = page.locator('.bracketTable tbody tr').first().locator('td:last-child');
    const firstTotalValue = Number(await firstTotal.textContent());
    expect(firstTotalValue).toBeGreaterThan(0);

    // Click again to reverse — lowest-scoring team first
    await page.locator('.bracketTable th', { hasText: 'Total' }).click();
    const newFirstTotal = Number(await page.locator('.bracketTable tbody tr').first().locator('td:last-child').textContent());
    expect(newFirstTotal).toBeLessThanOrEqual(firstTotalValue);
});

test('pool view: bracket details ordered by points descending', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for all 3 known brackets to render their names
    await expect(page.locator('.poolBracket .viewBracket h3', { hasText: "Test User's Bracket" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.poolBracket .viewBracket h3', { hasText: "Alice's Picks" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.poolBracket .viewBracket h3', { hasText: "Bob's Bracket" })).toBeVisible({ timeout: 10000 });

    // Get bracket names in the order they appear on the page
    const names = await page.locator('.poolBracket .viewBracket h3').allTextContents();

    // Test User's Bracket (127 pts) should come before Alice's Picks (109 pts) before Bob's Bracket (103 pts)
    const testUserIdx = names.findIndex(n => n.includes("Test User's Bracket"));
    const aliceIdx = names.findIndex(n => n.includes("Alice's Picks"));
    const bobIdx = names.findIndex(n => n.includes("Bob's Bracket"));
    expect(testUserIdx).toBeLessThan(aliceIdx);
    expect(aliceIdx).toBeLessThan(bobIdx);
});

test('pool view: clicking column headers sorts without errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`#/pools/${POOL_A_ID}`);
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });

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

    // "Ceiling" label should be visible with correct value
    const ceilingLabel = page.locator('.bracketCeiling');
    await expect(ceilingLabel).toBeVisible();
    await expect(ceilingLabel).toContainText('Ceiling:');
    await expect(ceilingLabel).toContainText('307');

    // Table should NOT have a Ceiling column (removed in favor of header display)
    await expect(page.locator('.bracketTable thead')).not.toContainText('Ceiling');
});

test('pool view: "Show ceiling?" checkbox visible and toggles Ceiling column', async ({ page }) => {
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for brackets to load
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });

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
    await expect(page.locator('h2')).toContainText('March Madness Pools');

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
    // Wait for at least 3 brackets to load (may have extra from previous test runs)
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });
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

    // Bracket view should show ceiling
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
    // At least 3 fixture brackets (may be more if manually created)
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });
    const rowCount = await page.locator('.ngRow').count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

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

test('edit bracket page: collision warnings', async ({ page }) => {
    await login(page);

    // Navigate to edit bracket page (13 teams pre-selected in the Testing tournament)
    await page.goto(`#/pools/${POOL_A_ID}/brackets/${BRACKET_1_ID}/edit`);

    // Wait for team grid to load (16 teams)
    await expect(page.locator('.selectTeamsGrid .ngRow')).toHaveCount(16, { timeout: 10000 });

    // Collision warnings: bracket 1 has two R1 collisions
    const warnings = page.locator('.collision-warning');
    await expect(warnings).toHaveCount(2);
    const warningTexts = await page.locator('.collision-warnings').textContent();
    expect(warningTexts).toContain('Duke');
    expect(warningTexts).toContain('Yale');
    expect(warningTexts).toContain('meet in Round 1');
    expect(warningTexts).toContain('Iowa State');
    expect(warningTexts).toContain('James Madison');
    // Both should have red R1 styling
    await expect(warnings.nth(0)).toHaveClass(/collision-r1/);
    await expect(warnings.nth(1)).toHaveClass(/collision-r1/);

    // Clear all picks — collision warnings should disappear
    await page.locator('button', { hasText: 'Clear' }).click();
    await expect(warnings).toHaveCount(0);
});

test('header has navigation links', async ({ page }) => {
    await page.goto('#/home');

    // Brand and navigation links
    await expect(page.locator('.navbar-brand')).toContainText('PICK 100');
    await expect(page.locator('.navbar-nav a', { hasText: 'Play Now' })).toBeVisible();

    // Log in / Register dropdowns visible when not logged in
    await expect(page.locator('.navbar', { hasText: 'Log in' })).toBeVisible();
    await expect(page.locator('.navbar', { hasText: 'Register' })).toBeVisible();
});

// ─── Mobile viewport tests ───────────────────────────────────────────────────

test('mobile: jump-to links have adequate spacing', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    await page.goto('http://localhost:5001/?tournament=Testing#/pools');
    await expect(page.locator('h2')).toContainText('March Madness Pools');

    const jumpTo = page.locator('.poolJumpTo');
    await expect(jumpTo).toBeVisible({ timeout: 10000 });

    // Separators should have visible margin on each side (not collapsed to zero)
    const sep = page.locator('.poolJumpTo .sep').first();
    await expect(sep).toBeVisible();
    const sepBox = await sep.boundingBox();
    // The separator ("|") plus its margins should be at least 10px wide
    expect(sepBox.width).toBeGreaterThanOrEqual(10);

    // Jump-to links should have at least 10px vertical gap to the Create button (if visible)
    const createBtn = page.locator('a.btn-primary', { hasText: 'Create a Pool' });
    if (await createBtn.isVisible()) {
        const jumpToBox = await jumpTo.boundingBox();
        const btnBox = await createBtn.boundingBox();
        const gap = btnBox.y - (jumpToBox.y + jumpToBox.height);
        expect(gap).toBeGreaterThanOrEqual(10);
    }

    await context.close();
});

test('mobile: pool view renders without errors', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('http://localhost:5001/?tournament=Testing#/pools/' + POOL_A_ID);

    // Pool name visible
    await expect(page.locator('h2')).toContainText('Test Pool A');

    // Bracket grid loads with data
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });

    // Ceiling column visible (tournament is in progress)
    const ceilingHeader = page.locator('.ngHeaderText', { hasText: 'Ceiling' });
    await expect(ceilingHeader).toBeVisible({ timeout: 5000 });

    expect(errors).toEqual([]);
    await context.close();
});

test('mobile: bracket view renders ceiling without errors', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('http://localhost:5001/?tournament=Testing#/pools/' + POOL_A_ID + '/brackets/' + BRACKET_1_ID);

    // Bracket name visible
    await expect(page.locator('.viewBracket h3')).toContainText("Test User's Bracket");

    // Team table loads
    await expect(page.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });

    // "Ceiling" visible (not hidden or overflowing)
    const ceilingLabel = page.locator('.bracketCeiling');
    await expect(ceilingLabel).toBeVisible();
    await expect(ceilingLabel).toContainText('Ceiling:');

    expect(errors).toEqual([]);
    await context.close();
});

test('mobile: navigating to a new route scrolls to top', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    // Navigate to a pool page with brackets (long enough to scroll)
    await page.goto('http://localhost:5001/?tournament=Testing#/pools/' + POOL_A_ID);
    await expect(page.locator('.poolBracket').first()).toBeVisible({ timeout: 10000 });

    // Scroll down significantly
    await page.evaluate(() => window.scrollTo(0, 1000));
    const scrolledY = await page.evaluate(() => window.scrollY);
    expect(scrolledY).toBeGreaterThan(0);

    // Navigate to the home page via hash routing
    await page.evaluate(() => window.location.hash = '#/home');
    await expect(page.locator('h1')).toContainText('Pick 100 Tournament Pool');

    // Scroll position should be reset to 0
    const newScrollY = await page.evaluate(() => window.scrollY);
    expect(newScrollY).toBe(0);

    await context.close();
});

test('mobile: header scrolls with page instead of staying fixed', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    await page.goto('http://localhost:5001/?tournament=Testing#/pools/' + POOL_A_ID);

    // Wait for content to load so the page is scrollable
    await expect(page.locator('h2')).toContainText('Test Pool A');
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });

    const navbar = page.locator('.navbar');
    await expect(navbar).toBeVisible();

    // On mobile, the navbar should NOT have position: fixed
    const position = await navbar.evaluate(el => getComputedStyle(el).position);
    expect(position).not.toBe('fixed');

    // Scroll down — the navbar should leave the viewport (not pinned)
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(navbar).not.toBeInViewport();

    await context.close();
});

test('mobile: edit and delete bracket buttons have adequate spacing', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    // Log in first (buttons only visible to bracket owner)
    await page.goto('http://localhost:5001/?tournament=Testing_PreTourney#/login');
    const form = page.locator('[ng-view] form');
    await form.locator('input[ng-model="email"]').fill('e2e-tests@pick100pool.com');
    await form.locator('input[ng-model="pass"]').fill(process.env.E2E_TEST_PASSWORD);
    await form.locator('button', { hasText: 'Log In' }).click();
    await expect(page.locator('.navbar')).toContainText('E2E Test User', { timeout: 10000 });

    // Navigate to bracket view (use PreTourney so edit/delete buttons are visible regardless of pool settings)
    await page.goto('http://localhost:5001/?tournament=Testing_PreTourney#/pools/' + POOL_A_ID + '/brackets/' + BRACKET_1_ID);
    await expect(page.locator('.bracketTable tbody tr')).toHaveCount(13, { timeout: 10000 });

    // Both buttons should be visible
    const editBtn = page.locator('a.btn-primary', { hasText: 'Change Your Teams' });
    const deleteBtn = page.locator('button.btn-danger', { hasText: 'Delete Your Bracket' });
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // Buttons should be side-by-side on mobile, not stacked vertically
    const editBox = await editBtn.boundingBox();
    const deleteBox = await deleteBtn.boundingBox();

    // They should be on roughly the same row (Y coordinates overlap)
    const sameRow = Math.abs(editBox.y - deleteBox.y) < editBox.height;
    expect(sameRow).toBe(true);

    await context.close();
});

test('mobile: bracket name label and input on same line', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    // Log in first
    await page.goto('http://localhost:5001/?tournament=Testing#/login');
    const form = page.locator('[ng-view] form');
    await form.locator('input[ng-model="email"]').fill('e2e-tests@pick100pool.com');
    await form.locator('input[ng-model="pass"]').fill(process.env.E2E_TEST_PASSWORD);
    await form.locator('button', { hasText: 'Log In' }).click();
    await expect(page.locator('.navbar')).toContainText('E2E Test User', { timeout: 10000 });

    // Navigate to edit bracket page
    await page.goto('http://localhost:5001/?tournament=Testing#/pools/' + POOL_A_ID + '/brackets/' + BRACKET_1_ID + '/edit');
    await expect(page.locator('.selectTeamsGrid .ngRow')).toHaveCount(16, { timeout: 10000 });

    // Label and input should be on the same row
    const label = page.locator('label[for="name"]');
    const input = page.locator('#name');
    await expect(label).toBeVisible();
    await expect(input).toBeVisible();

    const labelBox = await label.boundingBox();
    const inputBox = await input.boundingBox();

    // They should overlap vertically (same row), not be stacked
    const sameRow = Math.abs(labelBox.y - inputBox.y) < labelBox.height;
    expect(sameRow).toBe(true);

    await context.close();
});


