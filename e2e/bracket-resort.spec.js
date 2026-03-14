const { test, expect } = require('@playwright/test');
const admin = require('firebase-admin');
const { POOL_A_ID } = require('./helpers');

const TOURNAMENT_ID = 'Testing';

// Original fixture values — restored after every test run
const ORIGINAL_POINTS = {
    e2eBracket1: 127,
    e2eBracket2: 109,
    e2eBracket3: 103,
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
    }, 'e2e-resort');
    return app.database();
}

test.beforeAll(() => {
    db = initFirebaseAdmin();
});

test.afterAll(async () => {
    if (!db) return;
    // Restore all bracket points to fixture values
    const updates = {};
    for (const [bracketId, points] of Object.entries(ORIGINAL_POINTS)) {
        updates[`tournaments/${TOURNAMENT_ID}/brackets/${bracketId}/totalPoints`] = points;
    }
    await db.ref().update(updates);
    await admin.app('e2e-resort').delete();
});

test('bracket table re-sorts when points change in Firebase', async ({ page }) => {
    test.skip(!db, 'GOOGLE_AUTH_JSON or service account key file required');

    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for brackets to load (at least 3 fixture brackets, possibly more from manual testing)
    await expect(page.locator('.ngRow').first()).toBeVisible({ timeout: 10000 });
    const rowCount = await page.locator('.ngRow').count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // Bob's Bracket (103 pts, lowest) should be in the last row
    const lastRow = page.locator('.ngRow').nth(rowCount - 1);
    await expect(lastRow.locator('.ngCell').nth(0)).toContainText("Bob's Bracket");

    // Bump Bob's Bracket from 103 to 200 — should jump to #1
    await db.ref(`tournaments/${TOURNAMENT_ID}/brackets/e2eBracket3/totalPoints`).set(200);

    // Wait for the UI to re-sort: Bob should now be first
    const firstRow = page.locator('.ngRow').nth(0);
    await expect(firstRow.locator('.ngCell').nth(0)).toContainText("Bob's Bracket", { timeout: 10000 });

    // Verify the points value in the UI also updated
    await expect(firstRow.locator('.ngCell').nth(1)).toContainText('200');
});
