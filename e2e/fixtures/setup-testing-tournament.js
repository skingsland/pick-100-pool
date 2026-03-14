#!/usr/bin/env node

// Populates the "Testing" tournament in Firebase with stable fixture data for E2E tests.
// Run once: node e2e/fixtures/setup-testing-tournament.js
// Requires: GOOGLE_AUTH_JSON env var (Firebase Admin SDK service account key JSON string)

require('dotenv').config();

const admin = require('firebase-admin');

const TOURNAMENT_ID = 'Testing';

// A past start time so the tournament is "started" (brackets visible, no edits unless pool allows it)
const TOURNAMENT_START_TIME = '2024-03-21T12:15:00-04:00';
// A future end time so the tournament is still "in progress" (ceiling shown)
const TOURNAMENT_END_TIME = '2099-04-07T12:00:00-04:00';

// 16 teams across 4 regions, mix of seeds. Modeled after real March Madness data.
// After Round 2: 7 teams alive (won R1+R2, future rounds null), 9 eliminated
const TEAMS = {
    'UConn_1':     { id: 'UConn_1',     full_name: 'Connecticut',     seed: 1,  region: 'East',    conference: 'Big East',    is_eliminated: false, rounds: [null, 2, 3, null, null, null, null] },
    'Houston_2':   { id: 'Houston_2',   full_name: 'Houston',         seed: 2,  region: 'South',   conference: 'Big 12',      is_eliminated: false, rounds: [null, 3, 4, null, null, null, null] },
    'Purdue_3':    { id: 'Purdue_3',    full_name: 'Purdue',          seed: 1,  region: 'Midwest', conference: 'Big Ten',     is_eliminated: false, rounds: [null, 2, 3, null, null, null, null] },
    'Duke_4':      { id: 'Duke_4',      full_name: 'Duke',            seed: 4,  region: 'East',    conference: 'ACC',         is_eliminated: true,  rounds: [null, 5, 0, null, null, null, null] },
    'Marquette_5': { id: 'Marquette_5', full_name: 'Marquette',       seed: 2,  region: 'West',    conference: 'Big East',    is_eliminated: false, rounds: [null, 3, 4, null, null, null, null] },
    'Auburn_6':    { id: 'Auburn_6',    full_name: 'Auburn',          seed: 4,  region: 'Midwest', conference: 'SEC',         is_eliminated: true,  rounds: [null, 5, 0, null, null, null, null] },
    'Iowa_7':      { id: 'Iowa_7',      full_name: 'Iowa State',      seed: 5,  region: 'South',   conference: 'Big 12',      is_eliminated: false, rounds: [null, 6, 7, null, null, null, null] },
    'Gonzaga_8':   { id: 'Gonzaga_8',   full_name: 'Gonzaga',         seed: 5,  region: 'West',    conference: 'WCC',         is_eliminated: true,  rounds: [null, 6, 0, null, null, null, null] },
    'Creighton_9': { id: 'Creighton_9', full_name: 'Creighton',       seed: 3,  region: 'South',   conference: 'Big East',    is_eliminated: true,  rounds: [null, 4, 0, null, null, null, null] },
    'Oregon_10':   { id: 'Oregon_10',   full_name: 'Oregon',          seed: 11, region: 'South',   conference: 'Pac-12',      is_eliminated: true,  rounds: [null, 12, 0, null, null, null, null] },
    'NCST_11':     { id: 'NCST_11',     full_name: 'NC State',        seed: 11, region: 'East',    conference: 'ACC',         is_eliminated: false, rounds: [null, 12, 13, null, null, null, null] },
    'Yale_12':     { id: 'Yale_12',     full_name: 'Yale',            seed: 13, region: 'East',    conference: 'Ivy League',  is_eliminated: true,  rounds: [null, 14, 0, null, null, null, null] },
    'Oakland_13':  { id: 'Oakland_13',  full_name: 'Oakland',         seed: 14, region: 'Midwest', conference: 'Horizon',     is_eliminated: true,  rounds: [null, 15, 0, null, null, null, null] },
    'JMU_14':      { id: 'JMU_14',      full_name: 'James Madison',   seed: 12, region: 'South',   conference: 'Sun Belt',    is_eliminated: true,  rounds: [null, 13, 0, null, null, null, null] },
    'Vermont_15':  { id: 'Vermont_15',  full_name: 'Vermont',         seed: 16, region: 'West',    conference: 'America East',is_eliminated: true,  rounds: [null, 0, null, null, null, null, null] },
    'Wagner_16':   { id: 'Wagner_16',   full_name: 'Wagner',          seed: 16, region: 'East',    conference: 'NEC',         is_eliminated: true,  rounds: [null, 0, null, null, null, null, null] },
};

const TEST_USER_EMAIL = 'e2e-tests@pick100pool.com';

// Stable pool IDs (using push-style keys so they look like real Firebase keys)
const POOL_A_ID = 'e2eTestPoolA';
const POOL_B_ID = 'e2eTestPoolB';

// Stable bracket IDs
const BRACKET_1_ID = 'e2eBracket1';
const BRACKET_2_ID = 'e2eBracket2';
const BRACKET_3_ID = 'e2eBracket3';

const FAKE_USER_1 = 'fakeUser001';
const FAKE_USER_2 = 'fakeUser002';

// Each bracket has 13 teams with seeds summing to 100
function buildBrackets(testUserId) {
    return {
        [BRACKET_1_ID]: {
            name: "Test User's Bracket",
            ownerId: testUserId,
            poolId: POOL_A_ID,
            // 13 teams, seeds: 2+1+4+2+4+5+5+11+11+13+14+12+16 = 100
            teams: ['Houston_2', 'Purdue_3', 'Duke_4', 'Marquette_5', 'Auburn_6', 'Iowa_7', 'Gonzaga_8', 'Oregon_10', 'NCST_11', 'Yale_12', 'Oakland_13', 'JMU_14', 'Vermont_15'],
            created_on: '2024-03-20T10:00:00Z',
            totalPoints: 127,
            num_teams_remaining: 5,
            isNewOrUpdated: false,
            total_bracket_points_for_round: [null, 96, 31, null, null, null, null],
        },
        [BRACKET_2_ID]: {
            name: "Alice's Picks",
            ownerId: FAKE_USER_1,
            poolId: POOL_A_ID,
            // 13 teams, seeds: 1+2+1+4+4+5+3+11+11+14+12+16+16 = 100
            teams: ['UConn_1', 'Houston_2', 'Purdue_3', 'Duke_4', 'Auburn_6', 'Iowa_7', 'Creighton_9', 'Oregon_10', 'NCST_11', 'Oakland_13', 'JMU_14', 'Vermont_15', 'Wagner_16'],
            created_on: '2024-03-20T11:00:00Z',
            totalPoints: 109,
            num_teams_remaining: 5,
            isNewOrUpdated: false,
            total_bracket_points_for_round: [null, 79, 30, null, null, null, null],
        },
        [BRACKET_3_ID]: {
            name: "Bob's Bracket",
            ownerId: FAKE_USER_2,
            poolId: POOL_A_ID,
            // 13 teams, seeds: 1+2+4+2+4+5+3+11+11+13+12+16+16 = 100
            teams: ['UConn_1', 'Houston_2', 'Duke_4', 'Marquette_5', 'Auburn_6', 'Gonzaga_8', 'Creighton_9', 'Oregon_10', 'NCST_11', 'Yale_12', 'JMU_14', 'Vermont_15', 'Wagner_16'],
            created_on: '2024-03-20T12:00:00Z',
            totalPoints: 103,
            num_teams_remaining: 4,
            isNewOrUpdated: false,
            total_bracket_points_for_round: [null, 79, 24, null, null, null, null],
        },
    };
}

function buildPools(testUserId) {
    return {
        [POOL_A_ID]: {
            name: 'Test Pool A',
            managerId: testUserId,
            allowBracketChangesDuringTourney: false,
            hideBracketsBeforeTourney: false,
            brackets: {
                // indexed by ownerId -> bracketId
            },
        },
        [POOL_B_ID]: {
            name: 'Test Pool B',
            managerId: testUserId,
            allowBracketChangesDuringTourney: true,
            hideBracketsBeforeTourney: true,
            brackets: {},
        },
    };
}

function buildFakeUsers() {
    return {
        [FAKE_USER_1]: { name: 'Alice Tester' },
        [FAKE_USER_2]: { name: 'Bob Tester' },
    };
}

async function main() {
    const googleAuthJson = process.env.GOOGLE_AUTH_JSON;
    if (!googleAuthJson) {
        // Try loading from the service account key file as a fallback
        const fs = require('fs');
        const keyFile = 'pick100pool-firebase-adminsdk-9lo71-395312b33b.json';
        if (fs.existsSync(keyFile)) {
            process.env.GOOGLE_AUTH_JSON = fs.readFileSync(keyFile, 'utf8');
        } else {
            console.error('Error: GOOGLE_AUTH_JSON env var not set and service account key file not found.');
            console.error('Set the env var or place the key file at:', keyFile);
            process.exit(1);
        }
    }

    const app = admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_AUTH_JSON)),
        databaseURL: 'https://pick100pool.firebaseio.com',
    });

    const db = app.database();

    // Look up the test user's UID from Firebase Auth
    let testUserId;
    try {
        const userRecord = await admin.auth().getUserByEmail(TEST_USER_EMAIL);
        testUserId = userRecord.uid;
        console.log(`Found test user: ${TEST_USER_EMAIL} -> ${testUserId}`);
    } catch (err) {
        console.error(`Error: Could not find Firebase Auth user for ${TEST_USER_EMAIL}`);
        console.error('Create the user manually in the Firebase console first.');
        process.exit(1);
    }

    const brackets = buildBrackets(testUserId);
    const pools = buildPools(testUserId);
    const fakeUsers = buildFakeUsers();

    // Set up the bracket index in each pool
    pools[POOL_A_ID].brackets[testUserId] = BRACKET_1_ID;
    pools[POOL_A_ID].brackets[FAKE_USER_1] = BRACKET_2_ID;
    pools[POOL_A_ID].brackets[FAKE_USER_2] = BRACKET_3_ID;

    const tournamentData = {
        name: 'E2E Testing Tournament',
        start_time: TOURNAMENT_START_TIME,
        end_time: TOURNAMENT_END_TIME,
        teams: TEAMS,
        brackets: brackets,
        pools: pools,
    };

    console.log('Writing tournament data to:', `tournaments/${TOURNAMENT_ID}`);
    await db.ref(`tournaments/${TOURNAMENT_ID}`).set(tournamentData);

    // Write test user profile and fake user profiles
    console.log('Writing user profiles...');
    await db.ref(`users/${testUserId}`).update({ name: 'E2E Test User' });
    for (const [userId, profile] of Object.entries(fakeUsers)) {
        await db.ref(`users/${userId}`).set(profile);
    }

    console.log('Done! Testing tournament created with:');
    console.log(`  - ${Object.keys(TEAMS).length} teams`);
    console.log(`  - ${Object.keys(pools).length} pools`);
    console.log(`  - ${Object.keys(brackets).length} brackets`);
    console.log(`  - Test user profile for ${TEST_USER_EMAIL}`);
    console.log(`  - ${Object.keys(fakeUsers).length} fake user profiles`);

    // Export IDs for use in tests
    console.log('\nFixture IDs for tests:');
    console.log(`  POOL_A_ID: '${POOL_A_ID}'`);
    console.log(`  POOL_B_ID: '${POOL_B_ID}'`);
    console.log(`  BRACKET_1_ID: '${BRACKET_1_ID}' (owned by test user)`);
    console.log(`  BRACKET_2_ID: '${BRACKET_2_ID}' (owned by Alice)`);
    console.log(`  BRACKET_3_ID: '${BRACKET_3_ID}' (owned by Bob)`);

    await app.delete();
}

main().catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
});
