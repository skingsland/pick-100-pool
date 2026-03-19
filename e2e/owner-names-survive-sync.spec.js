const { test, expect } = require('@playwright/test');
const admin = require('firebase-admin');
const { POOL_A_ID } = require('./helpers');

const TOURNAMENT_ID = 'Testing';

// Only touch e2eBracket2 (Alice's bracket) to avoid conflicting with
// bracket-resort.spec.js which modifies e2eBracket3 in parallel.
const ORIGINAL_POINTS = {
    e2eBracket2: 109,
};

let db;

function initFirebaseAdmin() {
    let credentialJson = process.env.GOOGLE_AUTH_JSON;
    if (!credentialJson) {
        const fs = require('fs');
        const keyFile = 'pick100pool-firebase-adminsdk-9lo71-395312b33b.json';
        if (fs.existsSync(keyFile)) {
            credentialJson = fs.readFileSync(keyFile, 'utf8');
        }
    }
    if (!credentialJson) return null;

    const app = admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(credentialJson)),
        databaseURL: 'https://pick100pool.firebaseio.com',
    }, 'e2e-owner-sync');
    return app.database();
}

test.beforeAll(async () => {
    db = initFirebaseAdmin();
    if (!db) return;

    // Reset fake user profiles to known values (may be stale from other tests)
    await db.ref('users/fakeUser001').set({ name: 'Alice Tester' });
    await db.ref('users/fakeUser002').set({ name: 'Bob Tester' });
});

test.afterAll(async () => {
    if (!db) return;
    // Restore bracket points to fixture values
    const updates = {};
    for (const [bracketId, points] of Object.entries(ORIGINAL_POINTS)) {
        updates[`tournaments/${TOURNAMENT_ID}/brackets/${bracketId}/totalPoints`] = points;
    }
    await db.ref().update(updates);
    await admin.app('e2e-owner-sync').delete();
});

test('owner names in bracket table survive bracket data sync from Firebase', async ({ page }) => {
    test.skip(!db, 'GOOGLE_AUTH_JSON or service account key file required');

    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for brackets grid to load
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });

    // Check "Show owners?" to display owner names
    await page.locator('#showOwners').check();
    await expect(page.locator('.allBracketsGrid')).toContainText('Alice Tester', { timeout: 5000 });
    await expect(page.locator('.allBracketsGrid')).toContainText('Bob Tester', { timeout: 5000 });

    // Update Alice's bracket points via Firebase Admin SDK.
    // This triggers a $firebaseObject sync which wipes any locally-added
    // properties (like the 'owner' name) that aren't in Firebase.
    await db.ref(`tournaments/${TOURNAMENT_ID}/brackets/e2eBracket2/totalPoints`).set(110);

    // Wait for the UI to reflect the new points (proving the sync happened)
    await expect(page.locator('.allBracketsGrid')).toContainText('110', { timeout: 10000 });

    // Owner name should STILL be visible after the sync
    await expect(page.locator('.allBracketsGrid')).toContainText('Alice Tester');
});

test('ceiling values in bracket table survive bracket data sync from Firebase', async ({ page }) => {
    test.skip(!db, 'GOOGLE_AUTH_JSON or service account key file required');

    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for brackets grid to load with ceiling column
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });

    // Get Alice's bracket row and verify it has a ceiling value
    // Alice's Picks (e2eBracket2) should have a non-empty ceiling
    const aliceRow = page.locator('.ngRow', { hasText: "Alice's Picks" });
    const aliceCeiling = aliceRow.locator('.ngCell').nth(2);
    await expect(aliceCeiling).not.toHaveText('', { timeout: 5000 });
    const ceilingBefore = await aliceCeiling.textContent();

    // Update Alice's bracket points via Firebase Admin SDK
    await db.ref(`tournaments/${TOURNAMENT_ID}/brackets/e2eBracket2/totalPoints`).set(110);

    // Wait for the UI to reflect the new points (proving the sync happened)
    await expect(page.locator('.allBracketsGrid')).toContainText('110', { timeout: 10000 });

    // Wait for the debounced re-sort (200ms) to fire and ng-grid to re-render.
    // Without this, the assertion can pass because the DOM still has the old ceiling
    // value before ng-grid re-renders with the wiped data.
    await page.waitForTimeout(500);

    // Ceiling should STILL be present after the sync (same value; only points changed, not teams)
    await expect(aliceCeiling).toHaveText(ceilingBefore.trim());
});
