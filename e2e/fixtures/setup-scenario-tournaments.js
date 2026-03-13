#!/usr/bin/env node

// Creates multiple tournament scenarios in Firebase for visual testing of the ceiling feature.
// Run: node e2e/fixtures/setup-scenario-tournaments.js
//
// Then visit each scenario by changing the ?tournament= URL param:
//   Pre-tourney (no ceiling):  http://localhost:5001/?tournament=Testing_PreTourney#/pools/e2eTestPoolA
//   Day 1 (max upside):        http://localhost:5001/?tournament=Testing_Day1#/pools/e2eTestPoolA
//   After Round 2 (mid):       http://localhost:5001/?tournament=Testing#/pools/e2eTestPoolA
//   After Round 5 (championship): http://localhost:5001/?tournament=Testing_Round5#/pools/e2eTestPoolA
//   Final (tourney over):      http://localhost:5001/?tournament=Testing_Final#/pools/e2eTestPoolA

require('dotenv').config();
const admin = require('firebase-admin');

const POOL_A_ID = 'e2eTestPoolA';
const POOL_B_ID = 'e2eTestPoolB';
const BRACKET_1_ID = 'e2eBracket1';
const BRACKET_2_ID = 'e2eBracket2';
const BRACKET_3_ID = 'e2eBracket3';
const FAKE_USER_1 = 'fakeUser001';
const FAKE_USER_2 = 'fakeUser002';

const BRACKET_1_TEAMS = ['Houston_2', 'Purdue_3', 'Duke_4', 'Marquette_5', 'Auburn_6', 'Iowa_7', 'Gonzaga_8', 'Oregon_10', 'NCST_11', 'Yale_12', 'Oakland_13', 'JMU_14', 'Vermont_15'];
const BRACKET_2_TEAMS = ['UConn_1', 'Houston_2', 'Purdue_3', 'Duke_4', 'Auburn_6', 'Iowa_7', 'Creighton_9', 'Oregon_10', 'NCST_11', 'Oakland_13', 'JMU_14', 'Vermont_15', 'Wagner_16'];
const BRACKET_3_TEAMS = ['UConn_1', 'Houston_2', 'Duke_4', 'Marquette_5', 'Auburn_6', 'Gonzaga_8', 'Creighton_9', 'Oregon_10', 'NCST_11', 'Yale_12', 'JMU_14', 'Vermont_15', 'Wagner_16'];

// Base team info (shared across scenarios, rounds vary)
const BASE_TEAMS = {
    'UConn_1':     { id: 'UConn_1',     full_name: 'Connecticut',     seed: 1,  region: 'East',    conference: 'Big East' },
    'Houston_2':   { id: 'Houston_2',   full_name: 'Houston',         seed: 2,  region: 'South',   conference: 'Big 12' },
    'Purdue_3':    { id: 'Purdue_3',    full_name: 'Purdue',          seed: 1,  region: 'Midwest', conference: 'Big Ten' },
    'Duke_4':      { id: 'Duke_4',      full_name: 'Duke',            seed: 4,  region: 'East',    conference: 'ACC' },
    'Marquette_5': { id: 'Marquette_5', full_name: 'Marquette',       seed: 2,  region: 'West',    conference: 'Big East' },
    'Auburn_6':    { id: 'Auburn_6',    full_name: 'Auburn',          seed: 4,  region: 'Midwest', conference: 'SEC' },
    'Iowa_7':      { id: 'Iowa_7',      full_name: 'Iowa State',      seed: 5,  region: 'South',   conference: 'Big 12' },
    'Gonzaga_8':   { id: 'Gonzaga_8',   full_name: 'Gonzaga',         seed: 5,  region: 'West',    conference: 'WCC' },
    'Creighton_9': { id: 'Creighton_9', full_name: 'Creighton',       seed: 3,  region: 'South',   conference: 'Big East' },
    'Oregon_10':   { id: 'Oregon_10',   full_name: 'Oregon',          seed: 11, region: 'South',   conference: 'Pac-12' },
    'NCST_11':     { id: 'NCST_11',     full_name: 'NC State',        seed: 11, region: 'East',    conference: 'ACC' },
    'Yale_12':     { id: 'Yale_12',     full_name: 'Yale',            seed: 13, region: 'East',    conference: 'Ivy League' },
    'Oakland_13':  { id: 'Oakland_13',  full_name: 'Oakland',         seed: 14, region: 'Midwest', conference: 'Horizon' },
    'JMU_14':      { id: 'JMU_14',      full_name: 'James Madison',   seed: 12, region: 'South',   conference: 'Sun Belt' },
    'Vermont_15':  { id: 'Vermont_15',  full_name: 'Vermont',         seed: 16, region: 'West',    conference: 'America East' },
    'Wagner_16':   { id: 'Wagner_16',   full_name: 'Wagner',          seed: 16, region: 'East',    conference: 'NEC' },
};

function makeTeams(roundsMap) {
    const teams = {};
    for (const [id, base] of Object.entries(BASE_TEAMS)) {
        const { rounds, is_eliminated } = roundsMap[id];
        teams[id] = { ...base, rounds, is_eliminated };
    }
    return teams;
}

function sumTeamPoints(rounds) {
    let total = 0;
    for (let r = 1; r <= 6; r++) total += (rounds[r] || 0);
    return total;
}

function buildBrackets(testUserId, teams) {
    function bracketStats(teamIds) {
        let total = 0, alive = 0;
        const roundTotals = [null, 0, 0, 0, 0, 0, 0];
        for (const id of teamIds) {
            const t = teams[id];
            if (!t.is_eliminated) alive++;
            for (let r = 1; r <= 6; r++) {
                const pts = t.rounds[r] || 0;
                total += pts;
                roundTotals[r] += pts;
            }
        }
        // Replace 0 with null for unplayed rounds
        for (let r = 1; r <= 6; r++) {
            if (roundTotals[r] === 0) roundTotals[r] = null;
        }
        return { total, alive, roundTotals };
    }

    const s1 = bracketStats(BRACKET_1_TEAMS);
    const s2 = bracketStats(BRACKET_2_TEAMS);
    const s3 = bracketStats(BRACKET_3_TEAMS);

    return {
        [BRACKET_1_ID]: {
            name: "Test User's Bracket", ownerId: testUserId, poolId: POOL_A_ID,
            teams: BRACKET_1_TEAMS, created_on: '2024-03-20T10:00:00Z',
            totalPoints: s1.total, num_teams_remaining: s1.alive,
            isNewOrUpdated: false, total_bracket_points_for_round: s1.roundTotals,
        },
        [BRACKET_2_ID]: {
            name: "Alice's Picks", ownerId: FAKE_USER_1, poolId: POOL_A_ID,
            teams: BRACKET_2_TEAMS, created_on: '2024-03-20T11:00:00Z',
            totalPoints: s2.total, num_teams_remaining: s2.alive,
            isNewOrUpdated: false, total_bracket_points_for_round: s2.roundTotals,
        },
        [BRACKET_3_ID]: {
            name: "Bob's Bracket", ownerId: FAKE_USER_2, poolId: POOL_A_ID,
            teams: BRACKET_3_TEAMS, created_on: '2024-03-20T12:00:00Z',
            totalPoints: s3.total, num_teams_remaining: s3.alive,
            isNewOrUpdated: false, total_bracket_points_for_round: s3.roundTotals,
        },
    };
}

function buildPools(testUserId) {
    return {
        [POOL_A_ID]: {
            name: 'Test Pool A', managerId: testUserId,
            allowBracketChangesDuringTourney: false, hideBracketsBeforeTourney: false,
            brackets: { [testUserId]: BRACKET_1_ID, [FAKE_USER_1]: BRACKET_2_ID, [FAKE_USER_2]: BRACKET_3_ID },
        },
        [POOL_B_ID]: {
            name: 'Test Pool B', managerId: testUserId,
            allowBracketChangesDuringTourney: true, hideBracketsBeforeTourney: true,
            brackets: {},
        },
    };
}

// ─── Scenario definitions ────────────────────────────────────────────────────

function noRounds() {
    // All teams alive, no games played yet
    const r = {};
    for (const id of Object.keys(BASE_TEAMS)) {
        r[id] = { rounds: [null, null, null, null, null, null, null], is_eliminated: false };
    }
    return r;
}

function afterRound2() {
    // 7 alive (won R1+R2), 9 eliminated
    return {
        'UConn_1':     { rounds: [null, 2, 3, null, null, null, null],  is_eliminated: false },
        'Houston_2':   { rounds: [null, 3, 4, null, null, null, null],  is_eliminated: false },
        'Purdue_3':    { rounds: [null, 2, 3, null, null, null, null],  is_eliminated: false },
        'Duke_4':      { rounds: [null, 5, 0, null, null, null, null],  is_eliminated: true },
        'Marquette_5': { rounds: [null, 3, 4, null, null, null, null],  is_eliminated: false },
        'Auburn_6':    { rounds: [null, 5, 0, null, null, null, null],  is_eliminated: true },
        'Iowa_7':      { rounds: [null, 6, 7, null, null, null, null],  is_eliminated: false },
        'Gonzaga_8':   { rounds: [null, 6, 0, null, null, null, null],  is_eliminated: true },
        'Creighton_9': { rounds: [null, 4, 0, null, null, null, null],  is_eliminated: true },
        'Oregon_10':   { rounds: [null, 12, 0, null, null, null, null], is_eliminated: true },
        'NCST_11':     { rounds: [null, 12, 13, null, null, null, null],is_eliminated: false },
        'Yale_12':     { rounds: [null, 14, 0, null, null, null, null], is_eliminated: true },
        'Oakland_13':  { rounds: [null, 15, 0, null, null, null, null], is_eliminated: true },
        'JMU_14':      { rounds: [null, 13, 0, null, null, null, null], is_eliminated: true },
        'Vermont_15':  { rounds: [null, 0, null, null, null, null, null], is_eliminated: true },
        'Wagner_16':   { rounds: [null, 0, null, null, null, null, null], is_eliminated: true },
    };
}

function afterRound5() {
    // After semifinals: UConn (E) beat Purdue (MW), Iowa St (S) beat Gonzaga (W)
    // Championship game pending. 2 alive, 14 eliminated.
    return {
        'UConn_1':     { rounds: [null, 2, 3, 5, 9, 17, null],      is_eliminated: false },
        'Houston_2':   { rounds: [null, 3, 4, 6, 0, null, null],    is_eliminated: true },
        'Purdue_3':    { rounds: [null, 2, 3, 5, 9, 0, null],       is_eliminated: true },
        'Duke_4':      { rounds: [null, 5, 0, null, null, null, null], is_eliminated: true },
        'Marquette_5': { rounds: [null, 3, 4, 6, 0, null, null],    is_eliminated: true },
        'Auburn_6':    { rounds: [null, 5, 0, null, null, null, null], is_eliminated: true },
        'Iowa_7':      { rounds: [null, 6, 7, 9, 13, 21, null],     is_eliminated: false },
        'Gonzaga_8':   { rounds: [null, 6, 7, 9, 13, 0, null],      is_eliminated: true },
        'Creighton_9': { rounds: [null, 4, 0, null, null, null, null], is_eliminated: true },
        'Oregon_10':   { rounds: [null, 12, 0, null, null, null, null], is_eliminated: true },
        'NCST_11':     { rounds: [null, 12, 13, 15, 0, null, null], is_eliminated: true },
        'Yale_12':     { rounds: [null, 14, 0, null, null, null, null], is_eliminated: true },
        'Oakland_13':  { rounds: [null, 15, 0, null, null, null, null], is_eliminated: true },
        'JMU_14':      { rounds: [null, 13, 0, null, null, null, null], is_eliminated: true },
        'Vermont_15':  { rounds: [null, 0, null, null, null, null, null], is_eliminated: true },
        'Wagner_16':   { rounds: [null, 0, null, null, null, null, null], is_eliminated: true },
    };
}

function tournamentOver() {
    // UConn won it all. Every team has complete round data.
    return {
        'UConn_1':     { rounds: [null, 2, 3, 5, 9, 17, 33],  is_eliminated: false },
        'Houston_2':   { rounds: [null, 3, 4, 6, 0, null, null], is_eliminated: true },
        'Purdue_3':    { rounds: [null, 2, 3, 5, 9, 0, null],  is_eliminated: true },
        'Duke_4':      { rounds: [null, 5, 0, null, null, null, null], is_eliminated: true },
        'Marquette_5': { rounds: [null, 3, 4, 6, 0, null, null], is_eliminated: true },
        'Auburn_6':    { rounds: [null, 5, 0, null, null, null, null], is_eliminated: true },
        'Iowa_7':      { rounds: [null, 6, 7, 0, null, null, null], is_eliminated: true },
        'Gonzaga_8':   { rounds: [null, 6, 0, null, null, null, null], is_eliminated: true },
        'Creighton_9': { rounds: [null, 4, 0, null, null, null, null], is_eliminated: true },
        'Oregon_10':   { rounds: [null, 12, 0, null, null, null, null], is_eliminated: true },
        'NCST_11':     { rounds: [null, 12, 13, 15, 19, 0, null], is_eliminated: true },
        'Yale_12':     { rounds: [null, 14, 0, null, null, null, null], is_eliminated: true },
        'Oakland_13':  { rounds: [null, 15, 0, null, null, null, null], is_eliminated: true },
        'JMU_14':      { rounds: [null, 13, 0, null, null, null, null], is_eliminated: true },
        'Vermont_15':  { rounds: [null, 0, null, null, null, null, null], is_eliminated: true },
        'Wagner_16':   { rounds: [null, 0, null, null, null, null, null], is_eliminated: true },
    };
}

const SCENARIOS = {
    'Testing_PreTourney': {
        name: 'Pre-Tournament (ceiling hidden)',
        start_time: '2099-03-21T12:15:00-04:00', // future = not started
        end_time: '2099-04-07T12:00:00-04:00',
        roundsMap: noRounds(),
    },
    'Testing_Day1': {
        name: 'Day 1 — No Games Played (max ceiling)',
        start_time: '2024-03-21T12:15:00-04:00',
        end_time: '2099-04-07T12:00:00-04:00', // future = not ended
        roundsMap: noRounds(),
    },
    // "Testing" (after round 2) is managed by setup-testing-tournament.js
    'Testing_Round5': {
        name: 'After Round 5 — Championship Pending',
        start_time: '2024-03-21T12:15:00-04:00',
        end_time: '2099-04-07T12:00:00-04:00',
        roundsMap: afterRound5(),
        // Add a 4th bracket with all eliminated teams (0 remaining)
        extraBrackets: {
            'e2eBracket4': {
                name: "Dave's Bracket",
                ownerId: 'fakeUser003',
                poolId: POOL_A_ID,
                // 13 eliminated teams, seeds: 2+1+4+2+4+5+3+11+11+13+12+16+16 = 100
                teams: ['Houston_2', 'Purdue_3', 'Duke_4', 'Marquette_5', 'Auburn_6', 'Gonzaga_8', 'Creighton_9', 'Oregon_10', 'NCST_11', 'Yale_12', 'JMU_14', 'Vermont_15', 'Wagner_16'],
            },
        },
    },
    'Testing_Final': {
        name: 'Tournament Over (ceiling hidden)',
        start_time: '2024-03-21T12:15:00-04:00',
        end_time: '2024-04-09T12:00:00-04:00', // past = ended
        roundsMap: tournamentOver(),
    },
};

async function main() {
    const googleAuthJson = process.env.GOOGLE_AUTH_JSON;
    if (!googleAuthJson) {
        const fs = require('fs');
        const keyFile = 'pick100pool-firebase-adminsdk-9lo71-395312b33b.json';
        if (fs.existsSync(keyFile)) {
            process.env.GOOGLE_AUTH_JSON = fs.readFileSync(keyFile, 'utf8');
        } else {
            console.error('Error: GOOGLE_AUTH_JSON env var not set and service account key file not found.');
            process.exit(1);
        }
    }

    const app = admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_AUTH_JSON)),
        databaseURL: 'https://pick100pool.firebaseio.com',
    });
    const db = app.database();

    let testUserId;
    try {
        const userRecord = await admin.auth().getUserByEmail('e2e-tests@pick100pool.com');
        testUserId = userRecord.uid;
    } catch (err) {
        console.error('Could not find test user. Run setup-testing-tournament.js first.');
        process.exit(1);
    }

    for (const [tournamentId, scenario] of Object.entries(SCENARIOS)) {
        const teams = makeTeams(scenario.roundsMap);
        const brackets = buildBrackets(testUserId, teams);
        const pools = buildPools(testUserId);

        // Add extra brackets (e.g. an all-eliminated bracket for testing)
        if (scenario.extraBrackets) {
            for (const [bracketId, extra] of Object.entries(scenario.extraBrackets)) {
                const stats = { total: 0, alive: 0, roundTotals: [null, 0, 0, 0, 0, 0, 0] };
                for (const teamId of extra.teams) {
                    const t = teams[teamId];
                    if (!t.is_eliminated) stats.alive++;
                    for (let r = 1; r <= 6; r++) {
                        const pts = t.rounds[r] || 0;
                        stats.total += pts;
                        stats.roundTotals[r] += pts;
                    }
                }
                for (let r = 1; r <= 6; r++) {
                    if (stats.roundTotals[r] === 0) stats.roundTotals[r] = null;
                }
                brackets[bracketId] = {
                    ...extra,
                    created_on: '2024-03-20T13:00:00Z',
                    totalPoints: stats.total,
                    num_teams_remaining: stats.alive,
                    isNewOrUpdated: false,
                    total_bracket_points_for_round: stats.roundTotals,
                };
                pools[POOL_A_ID].brackets[extra.ownerId] = bracketId;
            }
        }

        const data = {
            name: scenario.name,
            start_time: scenario.start_time,
            end_time: scenario.end_time,
            teams,
            brackets,
            pools,
        };

        console.log(`Writing ${tournamentId}: ${scenario.name}`);
        await db.ref(`tournaments/${tournamentId}`).set(data);
    }

    // Write user profiles (shared across all tournaments)
    await db.ref(`users/${testUserId}`).update({ email: 'e2e-tests@pick100pool.com', name: 'E2E Test User' });
    await db.ref('users/fakeUser001').set({ email: 'alice@example.com', name: 'Alice Tester' });
    await db.ref('users/fakeUser002').set({ email: 'bob@example.com', name: 'Bob Tester' });
    await db.ref('users/fakeUser003').set({ email: 'dave@example.com', name: 'Dave Tester' });

    console.log('\nDone! Visit these URLs to see each scenario:');
    console.log('  Pre-tourney:  http://localhost:5001/?tournament=Testing_PreTourney#/pools/e2eTestPoolA');
    console.log('  Day 1:        http://localhost:5001/?tournament=Testing_Day1#/pools/e2eTestPoolA');
    console.log('  After R2:     http://localhost:5001/?tournament=Testing#/pools/e2eTestPoolA');
    console.log('  After R5:     http://localhost:5001/?tournament=Testing_Round5#/pools/e2eTestPoolA');
    console.log('  Final:        http://localhost:5001/?tournament=Testing_Final#/pools/e2eTestPoolA');

    await app.delete();
}

main().catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
});
