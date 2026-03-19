const { test, expect } = require('@playwright/test');
const { login, POOL_A_ID } = require('./helpers');
const admin = require('firebase-admin');

const FIREBASE_DB_URL = 'https://pick100pool.firebaseio.com';
const FAKE_USER_1 = 'fakeUser001';
const FAKE_USER_2 = 'fakeUser002';
const FAKE_USER_3 = 'fakeUser003';

// The test user (e2e-tests@pick100pool.com) is also the pool manager for Pool A.
// This mirrors production: skingsland@gmail.com (simplelogin:1) manages the Ashlawn pool.

function initAdmin() {
    if (admin.apps.length) return admin;
    const serviceAccount = require('../pick100pool-firebase-adminsdk-9lo71-395312b33b.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: FIREBASE_DB_URL,
    });
    return admin;
}

test('viewing pool page does not overwrite other bracket owners\' user profiles', async ({ page }) => {
    const db = initAdmin().database();

    // Reset fake user profiles to known values
    await db.ref(`users/${FAKE_USER_1}`).set({ name: 'Alice Tester' });
    await db.ref(`users/${FAKE_USER_2}`).set({ name: 'Bob Tester' });

    // Log in and navigate to Pool A (3 brackets from 3 different owners)
    await login(page);
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for all bracket views to render (each bracket has a .viewBracket container)
    await expect(page.locator('.viewBracket')).toHaveCount(3, { timeout: 15000 });

    // Wait for any async $bindTo writes to propagate back to Firebase
    await page.waitForTimeout(2000);

    // Verify fake user profiles were NOT corrupted by the $bindTo three-way binding
    const user1Snap = await db.ref(`users/${FAKE_USER_1}`).once('value');
    const user2Snap = await db.ref(`users/${FAKE_USER_2}`).once('value');

    expect(user1Snap.val().name).toBe('Alice Tester');
    expect(user2Snap.val().name).toBe('Bob Tester');
});

test('updating a user profile while pool page is open does not corrupt other user profiles', async ({ page }) => {
    const db = initAdmin().database();

    // Reset fake user profiles to known values
    await db.ref(`users/${FAKE_USER_1}`).set({ name: 'Alice Tester' });
    await db.ref(`users/${FAKE_USER_2}`).set({ name: 'Bob Tester' });

    // Log in and navigate to Pool A
    await login(page);
    await page.goto(`#/pools/${POOL_A_ID}`);

    // Wait for all bracket views to render
    await expect(page.locator('.viewBracket')).toHaveCount(3, { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Simulate an external profile update (like what happened in production):
    // change one bracket owner's name while the page is open
    await db.ref(`users/${FAKE_USER_1}`).update({ name: 'Alice CHANGED' });

    // Wait for the real-time update to propagate to the browser and any
    // AngularFire $bindTo write-backs to settle
    await page.waitForTimeout(3000);

    // Verify: fakeUser1 should have the new name, and fakeUser2 must be untouched
    const user1Snap = await db.ref(`users/${FAKE_USER_1}`).once('value');
    const user2Snap = await db.ref(`users/${FAKE_USER_2}`).once('value');

    expect(user1Snap.val().name).toBe('Alice CHANGED');
    expect(user2Snap.val().name).toBe('Bob Tester');
});

test('bracket-view $bindTo does not corrupt user profile of the logged-in user who is also the pool manager', async ({ page }) => {
    const db = initAdmin().database();

    // Reset fake user profiles
    await db.ref(`users/${FAKE_USER_1}`).set({ name: 'Alice Tester' });
    await db.ref(`users/${FAKE_USER_2}`).set({ name: 'Bob Tester' });

    // Get the test user's current profile name
    const testUser = await admin.auth().getUserByEmail('e2e-tests@pick100pool.com');
    const testUserProfile = await db.ref(`users/${testUser.uid}`).once('value');
    const originalTestUserName = testUserProfile.val().name;

    // Log in and navigate to Pool A
    await login(page);
    await page.goto(`#/pools/${POOL_A_ID}`);
    await expect(page.locator('.viewBracket')).toHaveCount(3, { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Change a fake user's name while the page is open
    await db.ref(`users/${FAKE_USER_1}`).update({ name: 'Alice RENAMED' });
    await page.waitForTimeout(3000);

    // The logged-in user's profile (who is also the pool manager) must NOT
    // be overwritten with a bracket owner's name
    const testUserSnap = await db.ref(`users/${testUser.uid}`).once('value');
    expect(testUserSnap.val().name).toBe(originalTestUserName);
});
