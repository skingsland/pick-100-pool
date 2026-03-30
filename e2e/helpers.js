const { expect } = require('@playwright/test');

const TEST_EMAIL = 'e2e-tests@pick100pool.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

if (!TEST_PASSWORD) {
    throw new Error('E2E_TEST_PASSWORD env var is required. See .env.example');
}

const POOL_A_ID = 'e2eTestPoolA';
const POOL_B_ID = 'e2eTestPoolB';
const BRACKET_1_ID = 'e2eBracket1';

async function ensureLoggedOut(page) {
    await page.goto('#/home');
    const userDropdown = page.locator('.navbar .dropdown-toggle', { hasText: /.+/ }).first();
    const isLoggedIn = await userDropdown.isVisible().catch(() => false);
    if (isLoggedIn) {
        await userDropdown.click();
        await page.locator('a', { hasText: 'Logout' }).click();
        await expect(page.locator('.navbar', { hasText: 'Log in' })).toBeVisible({ timeout: 10000 });
    }
}

async function login(page) {
    await page.goto('#/login');
    const form = page.locator('[ng-view] form');
    await form.locator('input[ng-model="email"]').fill(TEST_EMAIL);
    await form.locator('input[ng-model="pass"]').fill(TEST_PASSWORD);
    await form.locator('button', { hasText: 'Log In' }).click();
    await expect(page.locator('.navbar')).toContainText('E2E Test User', { timeout: 10000 });
}

// Like login(), but doesn't navigate — fills the login form already on screen
async function loginOnCurrentPage(page) {
    const form = page.locator('[ng-view] form');
    await form.locator('input[ng-model="email"]').fill(TEST_EMAIL);
    await form.locator('input[ng-model="pass"]').fill(TEST_PASSWORD);
    await form.locator('button', { hasText: 'Log In' }).click();
    await expect(page.locator('.navbar')).toContainText('E2E Test User', { timeout: 10000 });
}

// Ensure Pool B has no bracket for the test user.
// Waits for Firebase data to fully load before deciding whether cleanup is needed.
// Uses Promise.any so we don't silently skip deletion when data loads slowly.
async function cleanupPoolB(page) {
    await page.goto(`#/pools/${POOL_B_ID}`);
    await expect(page.locator('h2', { hasText: 'Test Pool B' })).toBeVisible({ timeout: 10000 });

    const deleteBtn = page.locator('button', { hasText: 'Delete Your Bracket' });
    const createLink = page.locator('a', { hasText: 'Select Your Teams' });

    // Wait for EITHER button to become visible — both exist in the DOM at all times
    // (one is ng-hide), so we race two visibility assertions instead of using or().
    await Promise.any([
        expect(deleteBtn).toBeVisible({ timeout: 15000 }),
        expect(createLink).toBeVisible({ timeout: 15000 }),
    ]);

    // If a bracket exists, delete it
    if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await expect(createLink).toBeVisible({ timeout: 10000 });
    }
}

module.exports = {
    TEST_EMAIL,
    TEST_PASSWORD,
    POOL_A_ID,
    POOL_B_ID,
    BRACKET_1_ID,
    ensureLoggedOut,
    login,
    loginOnCurrentPage,
    cleanupPoolB,
};
