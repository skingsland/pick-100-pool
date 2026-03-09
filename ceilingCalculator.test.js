var calc = require('./client/js/services/ceilingCalculator');

describe('ceilingCalculator', function() {
    test('module loads and exports expected functions', function() {
        expect(typeof calc.sumRoundPoints).toBe('function');
        expect(typeof calc.getHighestRoundWon).toBe('function');
        expect(typeof calc.buildTeamData).toBe('function');
        expect(typeof calc.getNaiveTeamCeiling).toBe('function');
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

    describe('getNaiveTeamCeiling', function() {
        test('seed 1, no games, not eliminated -> 69', function() {
            // R1: 1+1=2, R2: 1+2=3, R3: 1+4=5, R4: 1+8=9, R5: 1+16=17, R6: 1+32=33 => 69
            expect(calc.getNaiveTeamCeiling(1, {}, false)).toBe(69);
        });

        test('seed 13, no games, not eliminated -> 141', function() {
            // R1: 13+1=14, R2: 13+2=15, R3: 13+4=17, R4: 13+8=21, R5: 13+16=29, R6: 13+32=45 => 141
            expect(calc.getNaiveTeamCeiling(13, {}, false)).toBe(141);
        });

        test('seed 5, won R1-R3, not eliminated -> 93', function() {
            // earned: 6+7+9=22, remaining: R4: 5+8=13, R5: 5+16=21, R6: 5+32=37 => 22+71=93
            expect(calc.getNaiveTeamCeiling(5, {1: 6, 2: 7, 3: 9}, false)).toBe(93);
        });

        test('seed 8, eliminated, roundPoints={1:9, 2:0} -> 9', function() {
            expect(calc.getNaiveTeamCeiling(8, {1: 9, 2: 0}, true)).toBe(9);
        });

        test('staleness: seed 12, roundPoints={1:13, 2:14, 3:0}, not eliminated -> 27', function() {
            expect(calc.getNaiveTeamCeiling(12, {1: 13, 2: 14, 3: 0}, false)).toBe(27);
        });

        test('null roundPoints, not eliminated -> projects all rounds', function() {
            expect(calc.getNaiveTeamCeiling(1, null, false)).toBe(69);
        });

        test('staleness detects string "0" as a loss', function() {
            expect(calc.getNaiveTeamCeiling(12, {1: 13, 2: 14, 3: "0"}, false)).toBe(27);
        });

        test('Firebase array format works correctly', function() {
            // [null, 3, 4, 6, 0, null, null] - won R1-R3, lost R4
            expect(calc.getNaiveTeamCeiling(2, [null, 3, 4, 6, 0, null, null], false)).toBe(13);
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

        test('seed 3 East + seed 7 West, cross-region championship -> 151', function() {
            var teams = [makeTeam(3, 'East'), makeTeam(7, 'West')];
            expect(calc.computeBracketCeiling(teams, pairings)).toBe(151);
        });

        test('all eliminated: 3 teams earned 14, 20, 8 -> 42', function() {
            var teams = [
                makeTeam(5, 'East', {isEliminated: true, totalEarnedPoints: 14}),
                makeTeam(8, 'West', {isEliminated: true, totalEarnedPoints: 20}),
                makeTeam(3, 'South', {isEliminated: true, totalEarnedPoints: 8})
            ];
            expect(calc.computeBracketCeiling(teams, pairings)).toBe(42);
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
            expect(calc.computeBracketCeiling(teams, pairings)).toBe(129);
        });

        test('sparse array rounds: [null, 6, 0] -> highestRoundWon=1, earned=6', function() {
            var teams = [makeTeam(5, 'East', {
                highestRoundWon: 1,
                roundPoints: [null, 6, 0],
                totalEarnedPoints: 6
            })];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(6);
        });

        test('object rounds {"1": 6, "2": 0} -> same behavior as array', function() {
            var teams = [makeTeam(5, 'East', {
                highestRoundWon: 1,
                roundPoints: {"1": 6, "2": 0},
                totalEarnedPoints: 6
            })];
            var result = calc.computeBracketCeiling(teams, pairings);
            expect(result).toBe(6);
        });

        test('staleness full path: roundPoints={1:13, 2:14, 3:0}, alone in region -> 27', function() {
            var teams = [makeTeam(12, 'East', {
                highestRoundWon: 2,
                roundPoints: {1: 13, 2: 14, 3: 0},
                totalEarnedPoints: 27
            })];
            expect(calc.computeBracketCeiling(teams, pairings)).toBe(27);
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
            expect(calc.computeBracketCeiling(teams, pairings)).toBe(415);
        });
    });
});
