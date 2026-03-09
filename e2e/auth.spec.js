const { test, expect } = require('@playwright/test');
const { ensureLoggedOut, login } = require('./helpers');

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
