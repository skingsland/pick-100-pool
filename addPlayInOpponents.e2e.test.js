// End-to-end test against real Firebase (Development tournament).
// Skipped unless GOOGLE_AUTH_JSON is set.
// Run with: GOOGLE_AUTH_JSON='...' npx jest addPlayInOpponents.e2e

const firebaseAdmin = require('firebase-admin');

const hasCredentials = !!process.env.GOOGLE_AUTH_JSON;
const describeE2E = hasCredentials ? describe : describe.skip;

describeE2E('addPlayInOpponents e2e (real Firebase)', () => {
    const { buildFirebaseEntry } = require('./addPlayInOpponents');
    const { loginToFirebase } = require('./tournamentConfig');

    let firebase;
    let teamsRef;

    const testTeam = { id: 99999, short_name: 'E2E', medium_name: 'E2E Test Team', conference: 'Test Conference' };
    const testEntry = buildFirebaseEntry(testTeam, 1, 'South');
    const testTeamPath = testEntry.id; // E2E_99999

    beforeAll(() => {
        firebase = loginToFirebase();
        teamsRef = firebase.ref('tournaments/Development/teams');
    });

    afterAll(async () => {
        await teamsRef.child(testTeamPath).remove();
        // loginToFirebase() returns a Database ref; get the app from firebase-admin to shut down cleanly
        await firebaseAdmin.app().delete();
    });

    test('writes a team to Firebase and reads it back with matching format', async () => {
        // Write
        await teamsRef.child(testTeamPath).set(testEntry);

        // Read back
        const snapshot = await teamsRef.child(testTeamPath).once('value');
        const written = snapshot.val();

        expect(written).toEqual({
            id: 'E2E_99999',
            full_name: 'E2E Test Team',
            seed: 1,
            region: 'South',
            conference: 'Test Conference',
        });
    });

    test('written entry has same shape as teams written by theScore.js', async () => {
        // Read a real team that theScore.js wrote (copied from MarchMadness2025)
        const realSnapshot = await teamsRef.parent.parent
            .child('MarchMadness2025/teams')
            .limitToFirst(1)
            .once('value');

        let realTeam;
        realSnapshot.forEach(child => { realTeam = child.val(); });

        if (!realTeam) {
            console.log('No MarchMadness2025 teams found; skipping shape comparison');
            return;
        }

        // Both should have these base fields
        const baseFields = ['id', 'full_name', 'seed', 'region', 'conference'];
        for (const field of baseFields) {
            expect(testEntry).toHaveProperty(field);
            expect(realTeam).toHaveProperty(field);
            expect(typeof testEntry[field]).toBe(typeof realTeam[field]);
        }
    });
}, 15000);
