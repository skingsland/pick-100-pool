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

module.exports = {
    TEST_EMAIL,
    TEST_PASSWORD,
    POOL_A_ID,
    POOL_B_ID,
    BRACKET_1_ID,
    ensureLoggedOut,
    login,
    loginOnCurrentPage,
};
