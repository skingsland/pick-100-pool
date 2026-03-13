var calc = require('./client/js/services/ceilingCalculator');

// Mirrors e2e/fixtures/setup-testing-tournament.js TEAMS data (after round 2)
function fixtureTeams() {
    return {
        'UConn_1':     { seed: 1,  region: 'East',    is_eliminated: false, rounds: [null, 2, 3, null, null, null, null] },
        'Houston_2':   { seed: 2,  region: 'South',   is_eliminated: false, rounds: [null, 3, 4, null, null, null, null] },
        'Purdue_3':    { seed: 1,  region: 'Midwest', is_eliminated: false, rounds: [null, 2, 3, null, null, null, null] },
        'Duke_4':      { seed: 4,  region: 'East',    is_eliminated: true,  rounds: [null, 5, 0, null, null, null, null] },
        'Marquette_5': { seed: 2,  region: 'West',    is_eliminated: false, rounds: [null, 3, 4, null, null, null, null] },
        'Auburn_6':    { seed: 4,  region: 'Midwest', is_eliminated: true,  rounds: [null, 5, 0, null, null, null, null] },
        'Iowa_7':      { seed: 5,  region: 'South',   is_eliminated: false, rounds: [null, 6, 7, null, null, null, null] },
        'Gonzaga_8':   { seed: 5,  region: 'West',    is_eliminated: true,  rounds: [null, 6, 0, null, null, null, null] },
        'Creighton_9': { seed: 3,  region: 'South',   is_eliminated: true,  rounds: [null, 4, 0, null, null, null, null] },
        'Oregon_10':   { seed: 11, region: 'South',   is_eliminated: true,  rounds: [null, 12, 0, null, null, null, null] },
        'NCST_11':     { seed: 11, region: 'East',    is_eliminated: false, rounds: [null, 12, 13, null, null, null, null] },
        'Yale_12':     { seed: 13, region: 'East',    is_eliminated: true,  rounds: [null, 14, 0, null, null, null, null] },
        'Oakland_13':  { seed: 14, region: 'Midwest', is_eliminated: true,  rounds: [null, 15, 0, null, null, null, null] },
        'JMU_14':      { seed: 12, region: 'South',   is_eliminated: true,  rounds: [null, 13, 0, null, null, null, null] },
        'Vermont_15':  { seed: 16, region: 'West',    is_eliminated: true,  rounds: [null, 0, null, null, null, null, null] },
        'Wagner_16':   { seed: 16, region: 'East',    is_eliminated: true,  rounds: [null, 0, null, null, null, null, null] },
    };
}

describe('ceilingCalculator', function() {
    test('module loads and exports expected functions', function() {
        expect(typeof calc.sumRoundPoints).toBe('function');
        expect(typeof calc.getHighestRoundWon).toBe('function');
        expect(typeof calc.buildTeamData).toBe('function');

        expect(typeof calc.pointsForRound).toBe('function');
        expect(typeof calc.isLeaf).toBe('function');
        expect(typeof calc.computeRegionCeiling).toBe('function');
        expect(typeof calc.computeFinalFourCeiling).toBe('function');
        expect(typeof calc.computeBracketCeiling).toBe('function');
        expect(calc.REGION_BRACKET).toBeDefined();
    });

    describe('sumRoundPoints', function() {
        test('null/undefined returns 0', function() {
            expect(calc.sumRoundPoints(null)).toBe(0);
            expect(calc.sumRoundPoints(undefined)).toBe(0);
        });

        test('object with round keys sums correctly', function() {
            expect(calc.sumRoundPoints({1: 5, 2: 7})).toBe(12);
        });

        test('array form skips index 0, sums from index 1', function() {
            expect(calc.sumRoundPoints([null, 5, 7])).toBe(12);
        });

        test('parseInt handles string values', function() {
            expect(calc.sumRoundPoints({1: "5"})).toBe(5);
        });

        test('array with value at index 0 still only sums indices 1-6', function() {
            expect(calc.sumRoundPoints([99, 5, 7])).toBe(12);
        });
    });

    describe('getHighestRoundWon', function() {
        test('no rounds / undefined returns 0', function() {
            expect(calc.getHighestRoundWon(undefined)).toBe(0);
            expect(calc.getHighestRoundWon(null)).toBe(0);
        });

        test('won R1 and R2 returns 2', function() {
            expect(calc.getHighestRoundWon({1: 5, 2: 7})).toBe(2);
        });

        test('won R1 lost R2 returns 1 (not 2)', function() {
            expect(calc.getHighestRoundWon({1: 5, 2: 0})).toBe(1);
        });

        test('only R3 data returns 3', function() {
            expect(calc.getHighestRoundWon({3: 12})).toBe(3);
        });
    });

    describe('buildTeamData', function() {
        test('converts team with rounds and is_eliminated correctly', function() {
            var result = calc.buildTeamData({seed: 5, region: 'East', is_eliminated: true, rounds: {1: 6, 2: 7}});
            expect(result).toEqual({
                seed: 5,
                region: 'East',
                isEliminated: true,
                highestRoundWon: 2,
                roundPoints: {1: 6, 2: 7},
                totalEarnedPoints: 13
            });
        });

        test('team with no rounds returns defaults', function() {
            var result = calc.buildTeamData({seed: 3, region: 'West'});
            expect(result.roundPoints).toEqual({});
            expect(result.totalEarnedPoints).toBe(0);
            expect(result.highestRoundWon).toBe(0);
        });

        test('string seed is parsed to integer', function() {
            expect(calc.buildTeamData({seed: "5", region: 'South'}).seed).toBe(5);
        });

        test('is_eliminated undefined becomes false', function() {
            expect(calc.buildTeamData({seed: 1, region: 'East'}).isEliminated).toBe(false);
        });

        test('is_eliminated null becomes false', function() {
            expect(calc.buildTeamData({seed: 1, region: 'East', is_eliminated: null}).isEliminated).toBe(false);
        });
    });

    describe('isLeaf', function() {
        test('pair of numbers is a leaf', function() {
            expect(calc.isLeaf([1, 16])).toBe(true);
        });

        test('nested arrays is not a leaf', function() {
            expect(calc.isLeaf([[[1,16],[8,9]],[[5,12],[4,13]]])).toBe(false);
        });
    });

    describe('pointsForRound', function() {
        test('round 0 returns 0', function() {
            expect(calc.pointsForRound({seed: 5, highestRoundWon: 0, roundPoints: {}}, 0)).toBe(0);
        });

        test('round -1 returns 0', function() {
            expect(calc.pointsForRound({seed: 5, highestRoundWon: 0, roundPoints: {}}, -1)).toBe(0);
        });

        test('future round projects seed + 2^(round-1)', function() {
            var team = {seed: 5, highestRoundWon: 2, roundPoints: {1: 6, 2: 7}};
            expect(calc.pointsForRound(team, 3)).toBe(9); // 5 + 2^2 = 9
        });

        test('past round returns actual earned points', function() {
            var team = {seed: 5, highestRoundWon: 2, roundPoints: {1: 6, 2: 7}};
            expect(calc.pointsForRound(team, 2)).toBe(7);
        });

        test('staleness: roundPoints shows loss (0), returns 0 for that round', function() {
            var team = {seed: 8, highestRoundWon: 1, roundPoints: {1: 9, 2: 0}};
            expect(calc.pointsForRound(team, 3)).toBe(0);
        });

        test('staleness propagates to later rounds', function() {
            var team = {seed: 8, highestRoundWon: 1, roundPoints: {1: 9, 2: 0}};
            expect(calc.pointsForRound(team, 4)).toBe(0);
        });

        test('staleness detects string "0" as a loss', function() {
            var team = {seed: 8, highestRoundWon: 1, roundPoints: {1: 9, 2: "0"}};
            expect(calc.pointsForRound(team, 3)).toBe(0);
        });
    });

    describe('computeRegionCeiling', function() {
        var BRACKET = calc.REGION_BRACKET;

        function makeTeam(seed, opts) {
            opts = opts || {};
            return {
                seed: seed,
                highestRoundWon: opts.highestRoundWon || 0,
                roundPoints: opts.roundPoints || {},
                isEliminated: opts.isEliminated || false
            };
        }

        function teamsMap(seeds, opts) {
            var map = {};
            seeds.forEach(function(s) {
                map[s] = makeTeam(s, opts && opts[s]);
            });
            return map;
        }

        test('single team seed 5, no games -> 35', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([5]), 4);
            expect(result.points).toBe(35);
        });

        test('R1 collision: seeds 1 and 16, keep 16 -> 79', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([1, 16]), 4);
            expect(result.points).toBe(79);
            expect(result.bestSeed).toBe(16);
        });

        test('R2 collision: seeds 1 and 8, keep 8 -> 49', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([1, 8]), 4);
            expect(result.points).toBe(49);
        });

        test('R3 collision: seeds 1 and 5, keep 5 -> 40', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([1, 5]), 4);
            expect(result.points).toBe(40);
        });

        test('R4 collision: seeds 1 and 6, keep 6 -> 49', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([1, 6]), 4);
            expect(result.points).toBe(49);
        });

        test('three-team cascade: seeds 1, 8, 5 -> 62', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([1, 8, 5]), 4);
            expect(result.points).toBe(62);
        });

        test('four-team: seeds 1, 8, 5, 4 -> 67', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([1, 8, 5, 4]), 4);
            expect(result.points).toBe(67);
        });

        test('five-team: seeds 1, 8, 5, 6, 3 -> 91', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([1, 8, 5, 6, 3]), 4);
            expect(result.points).toBe(91);
        });

        test('mid-tournament: seed 5 won R1 -> 35', function() {
            var result = calc.computeRegionCeiling(BRACKET, teamsMap([5], {5: {highestRoundWon: 1, roundPoints: {1: 6}}}), 4);
            expect(result.points).toBe(35);
        });

        test('staleness: seed 8 with R2 loss, not eliminated -> 9', function() {
            var teams = teamsMap([8], {8: {highestRoundWon: 1, roundPoints: {1: 9, 2: 0}}});
            var result = calc.computeRegionCeiling(BRACKET, teams, 4);
            expect(result.points).toBe(9);
        });
    });

    describe('computeFinalFourCeiling', function() {
        function makeTeam(seed) {
            return {seed: seed, highestRoundWon: 0, roundPoints: {}};
        }

        var pairings = [['South', 'West'], ['East', 'Midwest']];

        test('two region winners in same semi: seed 8 South, seed 3 West -> 64', function() {
            var regionResults = {
                South: {bestTeam: makeTeam(8)},
                West: {bestTeam: makeTeam(3)}
            };
            expect(calc.computeFinalFourCeiling(regionResults, pairings)).toBe(64);
        });

        test('one region only: East seed 10 -> 68', function() {
            var regionResults = {
                East: {bestTeam: makeTeam(10)}
            };
            expect(calc.computeFinalFourCeiling(regionResults, pairings)).toBe(68);
        });

        test('championship collision: semi winners seed 12 and seed 9 -> 97', function() {
            var regionResults = {
                South: {bestTeam: makeTeam(12)},
                East: {bestTeam: makeTeam(9)}
            };
            expect(calc.computeFinalFourCeiling(regionResults, pairings)).toBe(97);
        });

        test('equal seeds: both seed 5, no error', function() {
            var regionResults = {
                South: {bestTeam: makeTeam(5)},
                West: {bestTeam: makeTeam(5)}
            };
            expect(function() {
                calc.computeFinalFourCeiling(regionResults, pairings);
            }).not.toThrow();
        });
    });

    describe('computeBracketCeiling', function() {
        var pairings = [['South', 'West'], ['East', 'Midwest']];

        function makeTeam(seed, region, opts) {
            opts = opts || {};
            return {
                seed: seed,
                region: region,
                isEliminated: opts.isEliminated || false,
                highestRoundWon: opts.highestRoundWon || 0,
                roundPoints: opts.roundPoints || {},
                totalEarnedPoints: opts.totalEarnedPoints || 0
            };
        }

        // Invariant: ceiling must always be >= sum of earned points
        function assertCeilingFloor(teams, result) {
            var earnedTotal = teams.reduce(function(sum, t) {
                return sum + (t.totalEarnedPoints || 0);
            }, 0);
            expect(result).toBeGreaterThanOrEqual(earnedTotal);
        }

        test('seed 3 East + seed 7 West, cross-region championship -> 151', function() {
            var teams = [makeTeam(3, 'East'), makeTeam(7, 'West')];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(151);
            assertCeilingFloor(teams, result);
        });

        test('all eliminated: 3 teams earned 14, 20, 8 -> 42', function() {
            var teams = [
                makeTeam(5, 'East', {isEliminated: true, totalEarnedPoints: 14}),
                makeTeam(8, 'West', {isEliminated: true, totalEarnedPoints: 20}),
                makeTeam(3, 'South', {isEliminated: true, totalEarnedPoints: 8})
            ];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(42);
            assertCeilingFloor(teams, result);
        });

        test('empty bracket -> 0', function() {
            expect(calc.computeBracketCeiling([], pairings)).toBe(0);
        });

        test('null seed warns and excludes team, returns 0', function() {
            var spy = jest.spyOn(console, 'warn').mockImplementation();
            var teams = [makeTeam(null, 'East')];
            expect(calc.computeBracketCeiling(teams, pairings)).toBe(0);
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('unparseable seed'),
                null,
                'East'
            );
            spy.mockRestore();
        });

        test('undefined region warns and excludes team', function() {
            var spy = jest.spyOn(console, 'warn').mockImplementation();
            var teams = [makeTeam(5, undefined)];
            expect(calc.computeBracketCeiling(teams, pairings)).toBe(0);
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('no region'),
                expect.anything()
            );
            spy.mockRestore();
        });

        test('missing finalFourPairings does not crash', function() {
            var teams = [makeTeam(5, 'East')];
            expect(function() {
                calc.computeBracketCeiling(teams);
            }).not.toThrow();
        });

        test('seed 11 alone in South -> 129 (R1-R6)', function() {
            var teams = [makeTeam(11, 'South')];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(129);
            assertCeilingFloor(teams, result);
        });

        test('sparse array rounds: [null, 6, 0] -> highestRoundWon=1, earned=6', function() {
            var teams = [makeTeam(5, 'East', {
                highestRoundWon: 1,
                roundPoints: [null, 6, 0],
                totalEarnedPoints: 6
            })];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(6);
            assertCeilingFloor(teams, result);
        });

        test('object rounds {"1": 6, "2": 0} -> same behavior as array', function() {
            var teams = [makeTeam(5, 'East', {
                highestRoundWon: 1,
                roundPoints: {"1": 6, "2": 0},
                totalEarnedPoints: 6
            })];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(6);
            assertCeilingFloor(teams, result);
        });

        test('staleness full path: roundPoints={1:13, 2:14, 3:0}, alone in region -> 27', function() {
            var teams = [makeTeam(12, 'East', {
                highestRoundWon: 2,
                roundPoints: {1: 13, 2: 14, 3: 0},
                totalEarnedPoints: 27
            })];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(27);
            assertCeilingFloor(teams, result);
        });

        test('FINAL_FOUR_PAIRINGS mismatch warning', function() {
            var spy = jest.spyOn(console, 'warn').mockImplementation();
            var teams = [makeTeam(5, 'East')];
            var badPairings = [['North', 'South'], ['Alpha', 'Beta']];
            calc.computeBracketCeiling(teams, badPairings);
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('FINAL_FOUR_PAIRINGS regions do not match')
            );
            spy.mockRestore();
        });

        test('ceiling is never less than sum of earned points', function() {
            // Bug: greedy "pick highest seed" collision resolution can drop earned points.
            // Seed 11 is picked over seed 1 to advance from East (11 > 1), but seed 11
            // is blocked (rounds[5]=0) while seed 1 already won through R6.
            // Seed 1's R4-R6 earned points (59) are lost, making ceiling < earned total.
            var teams = [
                {seed: 1, region: 'East', isEliminated: false, highestRoundWon: 6,
                 roundPoints: {1: 2, 2: 3, 3: 5, 4: 9, 5: 17, 6: 33}, totalEarnedPoints: 69},
                {seed: 11, region: 'East', isEliminated: false, highestRoundWon: 4,
                 roundPoints: {1: 12, 2: 13, 3: 15, 4: 19, 5: 0}, totalEarnedPoints: 59}
            ];
            var result = calc.computeBracketCeiling(teams, pairings);
            // Earned total = 69 + 59 = 128. Must never be less than that.
            expect(result).toBeGreaterThanOrEqual(128);
        });

        test('fixture data: bracket 1 (Test User) ceiling is 310', function() {
            var FINAL_FOUR = [['South', 'West'], ['East', 'Midwest']];
            var TEAMS = fixtureTeams();
            var ids = ['Houston_2', 'Purdue_3', 'Duke_4', 'Marquette_5', 'Auburn_6', 'Iowa_7', 'Gonzaga_8', 'Oregon_10', 'NCST_11', 'Yale_12', 'Oakland_13', 'JMU_14', 'Vermont_15'];
            var data = ids.map(function(id) { return calc.buildTeamData(TEAMS[id]); });
            var result = calc.computeBracketCeiling(data, FINAL_FOUR);
            expect(result).toBe(310);
            assertCeilingFloor(data, result);
        });

        test('fixture data: bracket 2 (Alice) ceiling is 281', function() {
            var FINAL_FOUR = [['South', 'West'], ['East', 'Midwest']];
            var TEAMS = fixtureTeams();
            var ids = ['UConn_1', 'Houston_2', 'Purdue_3', 'Duke_4', 'Auburn_6', 'Iowa_7', 'Creighton_9', 'Oregon_10', 'NCST_11', 'Oakland_13', 'JMU_14', 'Vermont_15', 'Wagner_16'];
            var data = ids.map(function(id) { return calc.buildTeamData(TEAMS[id]); });
            var result = calc.computeBracketCeiling(data, FINAL_FOUR);
            expect(result).toBe(281);
            assertCeilingFloor(data, result);
        });

        test('fixture data: bracket 3 (Bob) ceiling is 262', function() {
            var FINAL_FOUR = [['South', 'West'], ['East', 'Midwest']];
            var TEAMS = fixtureTeams();
            var ids = ['UConn_1', 'Houston_2', 'Duke_4', 'Marquette_5', 'Auburn_6', 'Gonzaga_8', 'Creighton_9', 'Oregon_10', 'NCST_11', 'Yale_12', 'JMU_14', 'Vermont_15', 'Wagner_16'];
            var data = ids.map(function(id) { return calc.buildTeamData(TEAMS[id]); });
            var result = calc.computeBracketCeiling(data, FINAL_FOUR);
            expect(result).toBe(262);
            assertCeilingFloor(data, result);
        });


        test('full integration: 13 teams across 4 regions', function() {
            // East: seeds 3 (at [3,14]), 14 (at [3,14]), 7 (at [7,10]), 2 (at [2,15])
            // South: seeds 1 (at [1,16]), 8 (at [8,9]), 5 (at [5,12])
            // West: seeds 6 (at [6,11]), 11 (at [6,11]), 10 (at [7,10])
            // Midwest: seeds 4 (at [4,13]), 13 (at [4,13]) -- plus 1 eliminated
            var teams = [
                makeTeam(3, 'East'),
                makeTeam(14, 'East'),
                makeTeam(7, 'East'),
                makeTeam(2, 'East'),
                makeTeam(1, 'South'),
                makeTeam(8, 'South'),
                makeTeam(5, 'South'),
                makeTeam(6, 'West'),
                makeTeam(11, 'West'),
                makeTeam(10, 'West'),
                makeTeam(4, 'Midwest'),
                makeTeam(13, 'Midwest'),
                makeTeam(9, 'Midwest', {isEliminated: true, totalEarnedPoints: 10})
            ];

            // I'll compute the expected value by using the verified helper functions:
            // East region: seeds 3,14 at [3,14]; seed 7 at [7,10]; seed 2 at [2,15]
            //   [3,14] R1: collision, keep 14. pts=15
            //   [7,10] R1: only 7. pts=8
            //   [2,15] R1: only 2. pts=3
            //   [[3,14],[7,10]] R2: 14 vs 7, keep 14. pts=15+8+16=39
            //   [[7,10],[2,15]] wait, 7 and 2 are in the bottom half
            //   Let me re-check: REGION_BRACKET = [top, bottom]
            //     top = [[[1,16],[8,9]], [[5,12],[4,13]]]
            //     bottom = [[[6,11],[3,14]], [[7,10],[2,15]]]
            //   East seeds: 3 at [3,14], 14 at [3,14], 7 at [7,10], 2 at [2,15]
            //   All in bottom half!
            //   Bottom: [[[6,11],[3,14]], [[7,10],[2,15]]]
            //     [6,11] R1: no East teams here. pts=0
            //     [3,14] R1: both present, keep 14. pts=15
            //     [[6,11],[3,14]] R2: advancer=14. pts=0+15+16=31
            //     [7,10] R1: only 7. pts=8
            //     [2,15] R1: only 2. pts=3
            //     [[7,10],[2,15]] R2: 7 vs 2, keep 7. pts=8+3+9=20
            //   Bottom R3: 14 vs 7, keep 14. pts=31+20+18=69
            //   Top: nothing. pts=0
            //   REGION R4: advancer=14. pts=0+69+22=91
            //   East bestSeed=14, points=91

            // South region: seeds 1 at [1,16], 8 at [8,9], 5 at [5,12]
            //   Top half: [[[1,16],[8,9]], [[5,12],[4,13]]]
            //     [1,16] R1: only 1. pts=2
            //     [8,9] R1: only 8. pts=9
            //     [[1,16],[8,9]] R2: 1 vs 8, keep 8. pts=2+9+10=21
            //     [5,12] R1: only 5. pts=6
            //     [4,13] R1: no teams. pts=0
            //     [[5,12],[4,13]] R2: advancer=5. pts=6+0+7=13
            //   Top R3: 8 vs 5, keep 8. pts=21+13+12=46
            //   Bottom half: nothing. pts=0
            //   REGION R4: advancer=8. pts=46+0+16=62
            //   South bestSeed=8, points=62

            // West region: seeds 6 at [6,11], 11 at [6,11], 10 at [7,10]
            //   Bottom half: [[[6,11],[3,14]], [[7,10],[2,15]]]
            //     [6,11] R1: both present, keep 11. pts=12
            //     [3,14] R1: no West teams. pts=0
            //     [[6,11],[3,14]] R2: advancer=11. pts=12+0+13=25
            //     [7,10] R1: only 10. pts=11
            //     [2,15] R1: no West teams. pts=0
            //     [[7,10],[2,15]] R2: advancer=10. pts=11+0+12=23
            //   Bottom R3: 11 vs 10, keep 11. pts=25+23+15=63
            //   Top half: nothing. pts=0
            //   REGION R4: advancer=11. pts=0+63+19=82
            //   West bestSeed=11, points=82

            // Midwest region: seeds 4 at [4,13], 13 at [4,13], (9 eliminated)
            //   Top half: [[[1,16],[8,9]], [[5,12],[4,13]]]
            //     [4,13] R1: both present, keep 13. pts=14
            //     everything else empty
            //     [[5,12],[4,13]] R2: advancer=13. pts=0+14+15=29
            //   Top R3: advancer=13. pts=0+29+17=46
            //   Bottom: nothing. pts=0
            //   REGION R4: advancer=13. pts=46+0+21=67
            //   Midwest bestSeed=13, points=67

            // Final Four pairings: [['South','West'],['East','Midwest']]
            //   Semi 1: South(8) vs West(11), keep 11. R5: 11+16=27
            //   Semi 2: East(14) vs Midwest(13), keep 14. R5: 14+16=30
            //   Championship: 14 vs 11, keep 14. R6: 14+32=46
            //   FF extra = 27+30+46 = 103

            // Eliminated: seed 9 earned 10

            // Total = 91 + 62 + 82 + 67 + 103 + 10 = 415
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(415);
            assertCeilingFloor(teams, result);
        });
    });
});
