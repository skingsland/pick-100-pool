const { test, expect, devices } = require('@playwright/test');
const { ensureLoggedOut, login, cleanupPoolB, POOL_B_ID } = require('./helpers');

// Use iPhone 13 device profile to emulate mobile iOS Safari
const iPhone = devices['iPhone 13'];
test.use({ ...iPhone });


test('Pick for me on mobile create page selects exactly 13 teams', async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);
    await cleanupPoolB(page);

    await page.locator('a', { hasText: 'Select Your Teams' }).click();
    // Wait for grid to fully render all rows (ng-grid needs this before selectItem works)
    await expect(page.locator('.selectTeamsGrid .ngRow')).toHaveCount(16, { timeout: 10000 });

    await page.locator('button', { hasText: 'Pick for me' }).click();

    await expect(page.locator('.selectedItems li')).toHaveCount(13, { timeout: 10000 });
    await expect(page.locator('text=Seeds: 100 / 100')).toBeVisible();

    await page.locator('a', { hasText: 'Cancel' }).click();
});

test('Pick for me on edit page does not accumulate teams from deferred bracket loading', async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);
    await cleanupPoolB(page);

    // Create a bracket so we have something to edit
    await page.locator('a', { hasText: 'Select Your Teams' }).click();
    await expect(page.locator('.selectTeamsGrid .ngRow')).toHaveCount(16, { timeout: 10000 });
    await page.locator('button', { hasText: 'Pick for me' }).click();
    await expect(page.locator('.selectedItems li')).toHaveCount(13, { timeout: 10000 });
    await page.locator('#name').fill('Race Condition Test');
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page).toHaveURL(new RegExp(`#/pools/${POOL_B_ID}$`), { timeout: 10000 });

    // Navigate to the EDIT page for the bracket
    await expect(page.locator('a', { hasText: 'Change Your Teams' })).toBeVisible({ timeout: 10000 });
    await page.locator('a', { hasText: 'Change Your Teams' }).click();
    await expect(page.locator('.selectTeamsGrid')).toBeVisible({ timeout: 10000 });

    // Simulate the race condition that occurs on mobile iOS Safari:
    // When bracket data loads slowly, randomPicks() completes first (13 teams selected),
    // then the deferred getBracketForEditing callback fires and tries to add the bracket's
    // original teams on top. The fix should prevent this via the userOverrodePicks flag.
    const teamCount = await page.evaluate(() => {
        return new Promise((resolve) => {
            const el = document.querySelector('[data-ng-controller="CreateEditBracketController"]');
            const scope = angular.element(el).scope();

            scope.teams.$loaded().then(() => {
                // Step 1: randomPicks clears and selects 13 random teams
                scope.randomPicks();
                scope.$apply();

                // Step 2: simulate the deferred getBracketForEditing callback firing
                // AFTER randomPicks — exactly as getBracketForEditing does it.
                // On slow mobile, bracket.$loaded() resolves after the user clicks "Pick for me".
                scope.getBracketForEditing();
                scope.$apply();

                setTimeout(() => {
                    scope.$apply();
                    resolve(scope.selectedTeams.length);
                }, 1000);
            });
        });
    });

    console.log(`Edit page after race condition: ${teamCount} teams`);
    expect(teamCount).toBe(13);

    // Cleanup: delete the bracket
    await page.goto(`#/pools/${POOL_B_ID}`);
    await cleanupPoolB(page);
});

test('mash buttons then manual picks then Pick for me selects exactly 13 (iPhone SE)', async ({ browser }) => {
    // Use iPhone SE specifically — smaller viewport than iPhone 13
    const iPhoneSE = devices['iPhone SE'];
    const context = await browser.newContext({ ...iPhoneSE });
    const page = await context.newPage();

    await ensureLoggedOut(page);
    await login(page);
    await cleanupPoolB(page);

    await page.locator('a', { hasText: 'Select Your Teams' }).click();
    await expect(page.locator('.selectTeamsGrid .ngRow')).toHaveCount(16, { timeout: 10000 });

    // Reproduce the exact user scenario via scope manipulation to bypass
    // Playwright's event serialization. This simulates the interleaving
    // that happens with rapid taps on real mobile.
    const afterState = await page.evaluate(() => {
        return new Promise((resolve) => {
            const el = document.querySelector('[data-ng-controller="CreateEditBracketController"]');
            const scope = angular.element(el).scope();

            // Step 1: Mash Pick-for-me and Clear rapidly (last action is Clear)
            scope.randomPicks();
            scope.clearPicks();
            scope.randomPicks();
            scope.randomPicks();
            scope.clearPicks();
            scope.randomPicks();
            scope.clearPicks();
            scope.$apply();

            // Step 2: Let digest settle, then manually pick 2 teams
            setTimeout(() => {
                // randomPicks is synchronous and clearPicks was last, so 0 selected.
                const afterMashing = scope.selectedTeams.length;

                // Manually select rows 0 and 1 via ng-grid API
                scope.selectTeamsGridOptions.selectItem(0, true);
                scope.selectTeamsGridOptions.selectItem(1, true);
                scope.$apply();

                const afterManualPicks = scope.selectedTeams.length;

                // Step 3: Click "Pick for me" one more time
                scope.randomPicks();
                scope.$apply();

                // Let digest settle
                setTimeout(() => {
                    scope.$apply();
                    resolve({
                        afterMashing: afterMashing,
                        afterManualPicks: afterManualPicks,
                        selectedTeams: scope.selectedTeams.length,
                        sumOfSeeds: scope.sumOfSeeds
                    });
                }, 1000);
            }, 2000);
        });
    });
    console.log(`Result:`, JSON.stringify(afterState));

    // After mashing (last action was Clear), stale callbacks should be discarded
    expect(afterState.afterMashing).toBe(0);
    // After manually selecting 2 teams
    expect(afterState.afterManualPicks).toBe(2);
    // After final Pick for me
    expect(afterState.selectedTeams).toBe(13);
    expect(afterState.sumOfSeeds).toBe(100);

    await context.close();
});

test('double-tap Pick for me does not select more than 13 teams', async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);
    await cleanupPoolB(page);

    await page.locator('a', { hasText: 'Select Your Teams' }).click();
    await expect(page.locator('.selectTeamsGrid .ngRow')).toHaveCount(16, { timeout: 10000 });

    // Simulate rapid double-invocation of randomPicks(). Both calls are synchronous
    // and each sets all 16 teams to the correct state, so the second overwrites the
    // first. Result should be exactly 13.
    const teamCount = await page.evaluate(() => {
        return new Promise((resolve) => {
            const el = document.querySelector('[data-ng-controller="CreateEditBracketController"]');
            const scope = angular.element(el).scope();

            // Call randomPicks twice in rapid succession, just like a double-tap would
            scope.randomPicks();
            scope.randomPicks();
            scope.$apply();

            // Let digest settle
            setTimeout(() => {
                scope.$apply();
                resolve(scope.selectedTeams.length);
            }, 500);
        });
    });

    console.log(`After double-tap: ${teamCount} teams`);
    expect(teamCount).toBe(13);
});
