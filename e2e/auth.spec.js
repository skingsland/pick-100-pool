const { test, expect } = require('@playwright/test');
const { ensureLoggedOut, login, POOL_A_ID, BRACKET_1_ID } = require('./helpers');

test('login shows user name in navbar', async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);

    // Verify user dropdown is visible and contains the test user's name
    const userDropdown = page.locator('.dropdown-toggle', { hasText: 'E2E Test User' });
    await expect(userDropdown).toBeVisible();

    // Verify Login/Register dropdowns are gone (replaced by user dropdown)
    await expect(page.locator('.navbar .dropdown-toggle', { hasText: 'Log in' })).toBeHidden();
    await expect(page.locator('.navbar .dropdown-toggle', { hasText: 'Register' })).toBeHidden();
});

test('bracket view shows owner name from user profile', async ({ page }) => {
    // This reads /users/{ownerId}/name to display "by {name}" — verifies cross-user profile reads work
    await page.goto(`#/pools/${POOL_A_ID}/brackets/${BRACKET_1_ID}`);

    await expect(page.locator('.bracketOwner')).toContainText('by E2E Test User', { timeout: 10000 });
});

test('pool view shows manager name from user profile', async ({ page }) => {
    // This reads /users/{managerId}/name to display "Manager: {name}" — verifies cross-user profile reads work
    await page.goto(`#/pools/${POOL_A_ID}`);

    await expect(page.locator('text=Manager:')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('span', { hasText: 'Manager: E2E Test User' })).toBeVisible();
});

test('protected route redirects to login when not authenticated', async ({ page }) => {
    await ensureLoggedOut(page);

    await page.goto('#/pools/create');

    // Should redirect to login page
    await expect(page).toHaveURL(/.*#\/login/, { timeout: 10000 });
});

test('logout returns to unauthenticated state', async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);

    // Click user dropdown, then logout
    await page.locator('.dropdown-toggle', { hasText: 'E2E Test User' }).click();
    await page.locator('a', { hasText: 'Logout' }).click();

    // Header should show Log in / Register again
    await expect(page.locator('.navbar', { hasText: 'Log in' })).toBeVisible({ timeout: 10000 });

    // Protected route should redirect to login
    await page.goto('#/pools/create');
    await expect(page).toHaveURL(/.*#\/login/, { timeout: 10000 });
});
