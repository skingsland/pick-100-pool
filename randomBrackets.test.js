var calc = require('./client/js/services/ceilingCalculator');

// Any valid pairing of the four regions works; does not need to match the real bracket in config.js
var FINAL_FOUR_PAIRINGS = [['South', 'West'], ['East', 'Midwest']];
var REGIONS = ['East', 'South', 'West', 'Midwest'];

// Bracket slot order from flattening REGION_BRACKET leaves.
// Round 1 matchups: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
var BRACKET_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAllTeams() {
    var teams = [];
    for (var r = 0; r < REGIONS.length; r++) {
        for (var seed = 1; seed <= 16; seed++) {
            teams.push({
                id: REGIONS[r] + '_' + seed,
                seed: seed,
                region: REGIONS[r],
                full_name: REGIONS[r] + ' ' + seed + '-seed',
                is_eliminated: false,
                rounds: {}
            });
        }
    }
    return teams;
}

// Copied from client/js/controllers/bracket-create-edit.js (private function)
function randomlyPickTeams(teams) {
    var totalSeed = 0;
    var pickedTeams = [];
    var remainingTeams = teams.slice();

    while (pickedTeams.length < 13 && remainingTeams.length > 0) {
        if (pickedTeams.length === 12) {
            while (remainingTeams.length > 0) {
                var randomIndex = Math.floor(Math.random() * remainingTeams.length);
                var pickedTeam = remainingTeams[randomIndex];
                if (totalSeed + pickedTeam.seed === 100) {
                    pickedTeams.push(pickedTeam.id);
                    return pickedTeams;
                }
                remainingTeams.splice(randomIndex, 1);
            }
            return pickedTeams;
        }

        var randomIndex2 = Math.floor(Math.random() * remainingTeams.length);
        var pickedTeam2 = remainingTeams[randomIndex2];
        if (totalSeed + pickedTeam2.seed < 100) {
            totalSeed += pickedTeam2.seed;
            pickedTeams.push(pickedTeam2.id);
        }
        remainingTeams.splice(randomIndex2, 1);
    }
    return pickedTeams;
}

// Retry wrapper (mirrors the controller's while loop)
function pickValidBracket(teams) {
    var picks;
    var attempts = 0;
    do {
        picks = randomlyPickTeams(teams);
        attempts++;
        if (attempts > 10000) throw new Error('Failed after 10000 attempts');
    } while (picks.length !== 13);
    return picks;
}

// ─── Manual ceiling calculator (independent from computeBracketCeiling) ──────
// Simulates the tournament round by round. At each matchup:
//   - Both user teams: higher seed advances (greedy optimal)
//   - One user team: it advances (beats non-user opponent)
//   - Neither: non-user advances (no points)
// Points per round for a pre-tournament team: seed + 2^(round-1)
function manualCeiling(pickedTeams) {
    var pickedByRegion = {};
    for (var i = 0; i < pickedTeams.length; i++) {
        var t = pickedTeams[i];
        if (!pickedByRegion[t.region]) pickedByRegion[t.region] = {};
        pickedByRegion[t.region][t.seed] = true;
    }

    var totalPoints = 0;
    var regionWinners = {};

    for (var r = 0; r < REGIONS.length; r++) {
        var region = REGIONS[r];
        var userSeeds = pickedByRegion[region] || {};

        // Initialize bracket slots
        var slots = [];
        for (var s = 0; s < BRACKET_ORDER.length; s++) {
            slots.push({ seed: BRACKET_ORDER[s], isUser: !!userSeeds[BRACKET_ORDER[s]] });
        }

        // Simulate rounds 1-4 within this region
        for (var round = 1; round <= 4; round++) {
            var nextSlots = [];
            for (var j = 0; j < slots.length; j += 2) {
                var a = slots[j];
                var b = slots[j + 1];

                if (a.isUser && b.isUser) {
                    var winner = a.seed > b.seed ? a : b;
                    totalPoints += winner.seed + Math.pow(2, round - 1);
                    nextSlots.push(winner);
                } else if (a.isUser) {
                    totalPoints += a.seed + Math.pow(2, round - 1);
                    nextSlots.push(a);
                } else if (b.isUser) {
                    totalPoints += b.seed + Math.pow(2, round - 1);
                    nextSlots.push(b);
                } else {
                    nextSlots.push(a);
                }
            }
            slots = nextSlots;
        }

        regionWinners[region] = slots[0];
    }

    // Final Four (round 5)
    var semiWinners = [];
    for (var p = 0; p < FINAL_FOUR_PAIRINGS.length; p++) {
        var r1 = FINAL_FOUR_PAIRINGS[p][0];
        var r2 = FINAL_FOUR_PAIRINGS[p][1];
        var w1 = regionWinners[r1];
        var w2 = regionWinners[r2];

        if (w1.isUser && w2.isUser) {
            var semiWinner = w1.seed > w2.seed ? w1 : w2;
            totalPoints += semiWinner.seed + 16; // 2^4
            semiWinners.push(semiWinner);
        } else if (w1.isUser) {
            totalPoints += w1.seed + 16;
            semiWinners.push(w1);
        } else if (w2.isUser) {
            totalPoints += w2.seed + 16;
            semiWinners.push(w2);
        } else {
            semiWinners.push(w1);
        }
    }

    // Championship (round 6)
    var s1 = semiWinners[0];
    var s2 = semiWinners[1];
    if (s1.isUser && s2.isUser) {
        var champ = s1.seed > s2.seed ? s1 : s2;
        totalPoints += champ.seed + 32; // 2^5
    } else if (s1.isUser) {
        totalPoints += s1.seed + 32;
    } else if (s2.isUser) {
        totalPoints += s2.seed + 32;
    }

    return totalPoints;
}

// ─── Percentile computation (mirrors bracket-create-edit.js logic) ────────────
// CEILING_PERCENTILES = [min, P5, P10, P25, P50, P75, P90, P95, max]
var CEILING_PERCENTILES = [415, 460, 471, 488, 504, 517, 528, 535, 555];
var PCT_THRESHOLDS = [0, 5, 10, 25, 50, 75, 90, 95, 100];

function computeCeilingPercentile(ceiling) {
    var percentile = 0;
    for (var i = CEILING_PERCENTILES.length - 1; i >= 0; i--) {
        if (ceiling >= CEILING_PERCENTILES[i]) {
            percentile = PCT_THRESHOLDS[i];
            break;
        }
    }
    return Math.min(percentile, 99);
}

function computeCeilingColorClass(ceiling) {
    var percentile = computeCeilingPercentile(ceiling);
    // Undo the clamp to get the raw percentile for color logic
    var rawPercentile = 0;
    for (var i = CEILING_PERCENTILES.length - 1; i >= 0; i--) {
        if (ceiling >= CEILING_PERCENTILES[i]) {
            rawPercentile = PCT_THRESHOLDS[i];
            break;
        }
    }
    if (rawPercentile >= 75) return 'ceiling-color-great';
    if (rawPercentile >= 50) return 'ceiling-color-good';
    if (rawPercentile >= 25) return 'ceiling-color-fair';
    return 'ceiling-color-low';
}

// ─── Tests: ceiling percentile edge cases ─────────────────────────────────────

describe('ceiling percentile computation', function() {
    test('ceiling below historical min returns 0%', function() {
        expect(computeCeilingPercentile(300)).toBe(0);
        expect(computeCeilingPercentile(0)).toBe(0);
        expect(computeCeilingPercentile(414)).toBe(0);
    });

    test('ceiling above historical max returns 99% (clamped)', function() {
        expect(computeCeilingPercentile(600)).toBe(99);
        expect(computeCeilingPercentile(556)).toBe(99);
        expect(computeCeilingPercentile(1000)).toBe(99);
    });

    test('ceiling exactly at historical min returns 0%', function() {
        expect(computeCeilingPercentile(415)).toBe(0);
    });

    test('ceiling exactly at historical max returns 99%', function() {
        expect(computeCeilingPercentile(555)).toBe(99);
    });

    test('ceiling at P50 threshold returns 50%', function() {
        expect(computeCeilingPercentile(504)).toBe(50);
    });

    test('ceiling between P25 and P50 returns 25%', function() {
        expect(computeCeilingPercentile(495)).toBe(25);
    });

    test('color class below min is ceiling-color-low', function() {
        expect(computeCeilingColorClass(300)).toBe('ceiling-color-low');
    });

    test('color class above max is ceiling-color-great', function() {
        expect(computeCeilingColorClass(600)).toBe('ceiling-color-great');
    });

    test('color classes follow quartile boundaries', function() {
        expect(computeCeilingColorClass(415)).toBe('ceiling-color-low');   // P0
        expect(computeCeilingColorClass(471)).toBe('ceiling-color-low');   // P10 (< P25)
        expect(computeCeilingColorClass(488)).toBe('ceiling-color-fair');  // P25
        expect(computeCeilingColorClass(504)).toBe('ceiling-color-good');  // P50
        expect(computeCeilingColorClass(517)).toBe('ceiling-color-great'); // P75
        expect(computeCeilingColorClass(555)).toBe('ceiling-color-great'); // P100
    });
});

// ─── Tests: randomlyPickTeams ─────────────────────────────────────────────────

describe('randomlyPickTeams', function() {
    var allTeams = generateAllTeams();

    test('returns exactly 13 team IDs (with retry)', function() {
        var picks = pickValidBracket(allTeams);
        expect(picks.length).toBe(13);
    });

    test('seeds sum to exactly 100', function() {
        for (var i = 0; i < 100; i++) {
            var picks = pickValidBracket(allTeams);
            var sum = 0;
            for (var j = 0; j < picks.length; j++) {
                var team = allTeams.find(function(t) { return t.id === picks[j]; });
                sum += team.seed;
            }
            expect(sum).toBe(100);
        }
    });

    test('no duplicate team IDs', function() {
        for (var i = 0; i < 100; i++) {
            var picks = pickValidBracket(allTeams);
            var unique = {};
            for (var j = 0; j < picks.length; j++) {
                expect(unique[picks[j]]).toBeUndefined();
                unique[picks[j]] = true;
            }
        }
    });

    test('all IDs come from the input teams', function() {
        var validIds = {};
        for (var i = 0; i < allTeams.length; i++) validIds[allTeams[i].id] = true;

        var picks = pickValidBracket(allTeams);
        for (var j = 0; j < picks.length; j++) {
            expect(validIds[picks[j]]).toBe(true);
        }
    });

    test('produces varied results across calls', function() {
        var results = [];
        for (var i = 0; i < 10; i++) {
            results.push(pickValidBracket(allTeams).sort().join(','));
        }
        var unique = {};
        for (var j = 0; j < results.length; j++) unique[results[j]] = true;
        expect(Object.keys(unique).length).toBeGreaterThan(1);
    });

    test('single attempt can fail (returns < 13 teams)', function() {
        // With only 16 teams (seeds 1-16, one region), finding sum=100 is hard.
        // Many single attempts will fail.
        var smallPool = [];
        for (var s = 1; s <= 16; s++) {
            smallPool.push({ id: 'T_' + s, seed: s, region: 'East' });
        }
        var failures = 0;
        for (var i = 0; i < 100; i++) {
            var result = randomlyPickTeams(smallPool);
            if (result.length !== 13) failures++;
        }
        // With only 16 teams, most attempts should fail since we need 13 of 16
        // and the remaining 3 seeds must sum to exactly (136-100) = 36.
        expect(failures).toBeGreaterThan(0);
    });

    test('returns empty array for insufficient teams', function() {
        var tinyPool = [
            { id: 'A', seed: 50 },
            { id: 'B', seed: 50 },
            { id: 'C', seed: 1 }
        ];
        var result = randomlyPickTeams(tinyPool);
        expect(result.length).toBeLessThan(13);
    });

    test('handles teams with duplicate seeds across regions', function() {
        // 64 teams have 4 of each seed. The picker should work fine.
        for (var i = 0; i < 50; i++) {
            var picks = pickValidBracket(allTeams);
            expect(picks.length).toBe(13);
        }
    });
});

// ─── Tests: ceiling calculator vs manual simulation ───────────────────────────

describe('ceiling calculator vs manual simulation', function() {
    var allTeams = generateAllTeams();

    test('manual ceiling matches for a known simple bracket', function() {
        // Pick one team per region (4 teams, all different regions, no collisions)
        var teams = [
            { seed: 1, region: 'East', is_eliminated: false, rounds: {} },
            { seed: 1, region: 'South', is_eliminated: false, rounds: {} },
            { seed: 1, region: 'West', is_eliminated: false, rounds: {} },
            { seed: 1, region: 'Midwest', is_eliminated: false, rounds: {} }
        ];

        var ceilingResult = calc.computeBracketCeiling(
            teams.map(function(t) { return calc.buildTeamData(t); }),
            FINAL_FOUR_PAIRINGS
        );
        var manualResult = manualCeiling(teams);

        // Each 1-seed: R1=2, R2=3, R3=5, R4=9 = 19 per team × 4 = 76
        // Final Four: two 1-seeds meet, winner gets R5=17. Other semi also has 1-seed = 17. = 34
        // Championship: both 1-seeds, winner gets R6=33. = 33
        // Total: 76 + 34 + 33 = 143
        expect(ceilingResult).toBe(143);
        expect(manualResult).toBe(143);
    });

    test('manual ceiling matches for two teams in same region (collision)', function() {
        // Seeds 1 and 16 in East: they meet in Round 1 (bracket position [1,16])
        var teams = [
            { seed: 1, region: 'East', is_eliminated: false, rounds: {} },
            { seed: 16, region: 'East', is_eliminated: false, rounds: {} }
        ];

        var ceilingResult = calc.computeBracketCeiling(
            teams.map(function(t) { return calc.buildTeamData(t); }),
            FINAL_FOUR_PAIRINGS
        );
        var manualResult = manualCeiling(teams);

        // R1: 16 wins (higher seed), points: 16+1=17
        // R2: 16 advances, points: 16+2=18
        // R3: 16 advances, points: 16+4=20
        // R4: 16 advances, points: 16+8=24
        // R5: 16 advances, points: 16+16=32
        // R6: 16 advances, points: 16+32=48
        // Total: 17+18+20+24+32+48 = 159
        expect(ceilingResult).toBe(159);
        expect(manualResult).toBe(159);
    });

    test('manual ceiling matches for teams that collide in Round 2', function() {
        // Seeds 1 and 8 in East: 1 is in slot [1,16], 8 is in slot [8,9]
        // They meet in Round 2
        var teams = [
            { seed: 1, region: 'East', is_eliminated: false, rounds: {} },
            { seed: 8, region: 'East', is_eliminated: false, rounds: {} }
        ];

        var ceilingResult = calc.computeBracketCeiling(
            teams.map(function(t) { return calc.buildTeamData(t); }),
            FINAL_FOUR_PAIRINGS
        );
        var manualResult = manualCeiling(teams);

        // R1: 1 wins own matchup (1+1=2), 8 wins own matchup (8+1=9)
        // R2: 1 vs 8, 8 wins (higher seed). Points: 8+2=10
        // R3-R6: 8 advances alone: (8+4)+(8+8)+(8+16)+(8+32) = 12+16+24+40 = 92
        // Total: 2+9+10+92 = 113
        expect(ceilingResult).toBe(113);
        expect(manualResult).toBe(113);
    });

    test('manual ceiling matches for Final Four collision', function() {
        // One team in South, one in West. They meet in Final Four semi (per pairings).
        var teams = [
            { seed: 16, region: 'South', is_eliminated: false, rounds: {} },
            { seed: 15, region: 'West', is_eliminated: false, rounds: {} }
        ];

        var ceilingResult = calc.computeBracketCeiling(
            teams.map(function(t) { return calc.buildTeamData(t); }),
            FINAL_FOUR_PAIRINGS
        );
        var manualResult = manualCeiling(teams);

        // South 16: in slot [1,16]. R1: 16+1=17, R2: 16+2=18, R3: 16+4=20, R4: 16+8=24 = 79
        // West 15: in slot [2,15]. R1: 15+1=16, R2: 15+2=17, R3: 15+4=19, R4: 15+8=23 = 75
        // Final Four (R5): South 16 vs West 15 → 16 wins: 16+16=32
        // Championship (R6): 16: 16+32=48
        // Total: 79+75+32+48 = 234
        expect(ceilingResult).toBe(234);
        expect(manualResult).toBe(234);
    });

    test('matches for 1000 random brackets (pre-tournament)', function() {
        var mismatches = [];

        for (var i = 0; i < 1000; i++) {
            var pickedIds = pickValidBracket(allTeams);
            var pickedTeamObjects = pickedIds.map(function(id) {
                return allTeams.find(function(t) { return t.id === id; });
            });

            var ceilingResult = calc.computeBracketCeiling(
                pickedTeamObjects.map(function(t) { return calc.buildTeamData(t); }),
                FINAL_FOUR_PAIRINGS
            );
            var manualResult = manualCeiling(pickedTeamObjects);

            if (ceilingResult !== manualResult) {
                mismatches.push({
                    bracket: pickedIds,
                    ceiling: ceilingResult,
                    manual: manualResult,
                    teams: pickedTeamObjects.map(function(t) { return t.region + ' ' + t.seed; })
                });
            }
        }

        if (mismatches.length > 0) {
            console.log('First mismatch:', JSON.stringify(mismatches[0], null, 2));
        }
        expect(mismatches.length).toBe(0);
    });
});
