'use strict';

// 1. Pure functions at FILE SCOPE

var REGION_BRACKET = [
    [[[1, 16], [8, 9]], [[5, 12], [4, 13]]],
    [[[6, 11], [3, 14]], [[7, 10], [2, 15]]]
];

function sumRoundPoints(roundPoints) {
    if (!roundPoints) return 0;
    var total = 0;
    for (var r = 1; r <= 6; r++) {
        total += parseInt(roundPoints[r], 10) || 0;
    }
    return total;
}

function getHighestRoundWon(roundPoints) {
    if (!roundPoints) return 0;
    var highest = 0;
    for (var r = 1; r <= 6; r++) {
        if (roundPoints[r] > 0) {
            highest = r;
        }
    }
    return highest;
}

function buildTeamData(team) {
    var roundPoints = team.rounds || {};
    return {
        seed: parseInt(team.seed, 10) || 0,
        region: team.region,
        isEliminated: team.is_eliminated === true,
        highestRoundWon: getHighestRoundWon(roundPoints),
        roundPoints: roundPoints,
        totalEarnedPoints: sumRoundPoints(roundPoints)
    };
}


function findCollisions(teams) {
    if (!teams || teams.length < 2) return [];

    // Group teams by region: { region -> { seed -> team } }
    var byRegion = {};
    teams.forEach(function(t) {
        var seed = parseInt(t.seed, 10) || 0;
        if (!t.region || seed === 0) return;
        if (!byRegion[t.region]) byRegion[t.region] = {};
        byRegion[t.region][seed] = t;
    });

    var r1Collisions = [];
    var r2Collisions = [];

    // R1 leaf nodes: [a, b]. R2 subtrees: [[a,b],[c,d]].
    // Walk REGION_BRACKET to find both levels.
    function walkR2Subtrees(subtree) {
        if (isLeaf(subtree)) return; // single leaf, handled below
        // Check if this is an R2 subtree (both children are leaves)
        if (isLeaf(subtree[0]) && isLeaf(subtree[1])) {
            checkR2Subtree(subtree);
            return;
        }
        walkR2Subtrees(subtree[0]);
        walkR2Subtrees(subtree[1]);
    }

    function checkR2Subtree(subtree) {
        var leafA = subtree[0]; // [seed1, seed2]
        var leafB = subtree[1]; // [seed3, seed4]

        for (var region in byRegion) {
            if (!byRegion.hasOwnProperty(region)) continue;
            var regionTeams = byRegion[region];

            // Check R1 collisions within each leaf
            if (regionTeams[leafA[0]] && regionTeams[leafA[1]]) {
                r1Collisions.push({
                    round: 1, region: region,
                    team1Name: regionTeams[leafA[0]].full_name,
                    team2Name: regionTeams[leafA[1]].full_name
                });
            }
            if (regionTeams[leafB[0]] && regionTeams[leafB[1]]) {
                r1Collisions.push({
                    round: 1, region: region,
                    team1Name: regionTeams[leafB[0]].full_name,
                    team2Name: regionTeams[leafB[1]].full_name
                });
            }

            // Check R2 collisions: one team from each leaf, but skip if R1 already covers it
            var leafATeams = [leafA[0], leafA[1]].filter(function(s) { return !!regionTeams[s]; });
            var leafBTeams = [leafB[0], leafB[1]].filter(function(s) { return !!regionTeams[s]; });
            if (leafATeams.length > 0 && leafBTeams.length > 0) {
                // At least one team in each R1 matchup within this R2 subtree
                leafATeams.forEach(function(sA) {
                    leafBTeams.forEach(function(sB) {
                        r2Collisions.push({
                            round: 2, region: region,
                            team1Name: regionTeams[sA].full_name,
                            team2Name: regionTeams[sB].full_name
                        });
                    });
                });
            }
        }
    }

    walkR2Subtrees(REGION_BRACKET);

    return r1Collisions.concat(r2Collisions);
}

function pointsForRound(team, round) {
    if (round <= 0) return 0;
    var seed = parseInt(team.seed, 10) || 0;
    if (team.highestRoundWon >= round) {
        return parseInt(team.roundPoints[round], 10) || 0;
    }
    if (team.roundPoints) {
        for (var r = team.highestRoundWon + 1; r <= round; r++) {
            if (parseInt(team.roundPoints[r], 10) === 0) return 0;
        }
    }
    return seed + Math.pow(2, round - 1);
}

function isLeaf(subtree) {
    return typeof subtree[0] === 'number';
}

function computeRegionCeiling(subtree, userTeams, round) {
    if (isLeaf(subtree)) {
        var present = subtree.map(function(s) { return userTeams[s]; }).filter(Boolean);
        if (present.length === 0) return {bestSeed: null, bestTeam: null, points: 0};
        var winner = present.reduce(function(a, b) { return a.seed > b.seed ? a : b; });
        return {bestSeed: winner.seed, bestTeam: winner, points: pointsForRound(winner, round)};
    }

    var left = computeRegionCeiling(subtree[0], userTeams, round - 1);
    var right = computeRegionCeiling(subtree[1], userTeams, round - 1);
    var totalPoints = left.points + right.points;

    var advancer = null, advancerTeam = null;
    if (left.bestSeed && right.bestSeed) {
        if (left.bestSeed > right.bestSeed) {
            advancer = left.bestSeed; advancerTeam = left.bestTeam;
        } else {
            advancer = right.bestSeed; advancerTeam = right.bestTeam;
        }
    } else if (left.bestSeed) {
        advancer = left.bestSeed; advancerTeam = left.bestTeam;
    } else if (right.bestSeed) {
        advancer = right.bestSeed; advancerTeam = right.bestTeam;
    }

    if (advancerTeam) {
        totalPoints += pointsForRound(advancerTeam, round);
    }

    return {bestSeed: advancer, bestTeam: advancerTeam, points: totalPoints};
}

function computeFinalFourCeiling(regionResults, finalFourPairings) {
    var extraPoints = 0;
    var semiWinners = [];

    finalFourPairings.forEach(function(pair) {
        var r1 = regionResults[pair[0]], r2 = regionResults[pair[1]];
        var team1 = r1 ? r1.bestTeam : null;
        var team2 = r2 ? r2.bestTeam : null;

        var advancer = null;
        if (team1 && team2) {
            advancer = (team1.seed > team2.seed) ? team1 : team2;
        } else {
            advancer = team1 || team2;
        }

        if (advancer) {
            extraPoints += pointsForRound(advancer, 5);
            semiWinners.push(advancer);
        }
    });

    if (semiWinners.length === 2) {
        var champion = (semiWinners[0].seed > semiWinners[1].seed) ? semiWinners[0] : semiWinners[1];
        extraPoints += pointsForRound(champion, 6);
    } else if (semiWinners.length === 1) {
        extraPoints += pointsForRound(semiWinners[0], 6);
    }

    return extraPoints;
}

function computeBracketCeiling(teams, finalFourPairings) {
    finalFourPairings = finalFourPairings || [];
    var surviving = teams.filter(function(t) { return !t.isEliminated; });

    var regionNames = {};
    surviving.forEach(function(t) { if (t.region) regionNames[t.region] = true; });
    var anyMatch = false;
    finalFourPairings.forEach(function(pair) {
        pair.forEach(function(region) {
            if (regionNames[region]) anyMatch = true;
        });
    });
    if (surviving.length > 0 && !anyMatch) {
        console.warn('FINAL_FOUR_PAIRINGS regions do not match any surviving team regions');
    }

    var byRegion = {};
    surviving.forEach(function(t) {
        var seed = parseInt(t.seed, 10) || 0;
        if (seed === 0) {
            console.warn('Team has unparseable seed, excluded from ceiling:', t.seed, t.region);
            return;
        }
        if (!t.region) {
            console.warn('Team has no region, excluded from ceiling:', seed);
            return;
        }
        if (!byRegion[t.region]) byRegion[t.region] = {};
        byRegion[t.region][seed] = t;
    });

    var regionResults = {};
    var totalPoints = 0;
    for (var region in byRegion) {
        if (byRegion.hasOwnProperty(region)) {
            regionResults[region] = computeRegionCeiling(REGION_BRACKET, byRegion[region], 4);
            totalPoints += regionResults[region].points;
        }
    }

    totalPoints += computeFinalFourCeiling(regionResults, finalFourPairings);

    var earnedTotal = 0;
    teams.forEach(function(t) {
        var earned = t.totalEarnedPoints || 0;
        if (t.isEliminated === true) totalPoints += earned;
        earnedTotal += earned;
    });

    // Floor guarantee: ceiling can never be less than already-earned points.
    // The collision-aware algorithm can underestimate when its greedy heuristic
    // picks a blocked team to advance, losing an active team's earned points.
    return Math.max(totalPoints, earnedTotal);
}

function formatRemainingTeams(teams) {
    if (!teams || teams.length === 0) return '';
    return teams
        .filter(function(t) { return t && t.is_eliminated !== true; })
        .sort(function(a, b) { return (parseInt(a.seed, 10) || 0) - (parseInt(b.seed, 10) || 0); })
        .map(function(t) { return t.full_name; })
        .join(', ');
}

// Points earned by a team winning rounds fromRound through toRound (inclusive).
// Each round awards seed + 2^(round-1).
function futurePoints(seed, fromRound, toRound) {
    var total = 0;
    for (var r = fromRound; r <= toRound; r++) {
        total += seed + Math.pow(2, r - 1);
    }
    return total;
}

// Enumerate all possible tournament outcomes from the Elite 8 onward.
// aliveByRegion: { regionName: [seed1, seed2] } (0, 1, or 2 seeds per region)
// finalFourPairings: [['East','South'], ['Midwest','West']]
// Returns: array of outcome maps, each mapping "region:seed" -> lastRoundWon (4, 5, or 6)
function enumerateTournamentOutcomes(aliveByRegion, finalFourPairings) {
    // Step 1: enumerate regional winners (round 4)
    // For each region: either team could win, or if only 1 team, it auto-advances
    var regions = [];
    var regionSeeds = {};
    finalFourPairings.forEach(function(pair) {
        pair.forEach(function(region) {
            regions.push(region);
            regionSeeds[region] = aliveByRegion[region] || [];
        });
    });

    // Generate all combinations of regional winners
    function enumRegionalWinners(regionIdx) {
        if (regionIdx >= regions.length) return [{}];
        var region = regions[regionIdx];
        var seeds = regionSeeds[region];
        var rest = enumRegionalWinners(regionIdx + 1);

        if (seeds.length === 0) {
            // No one advances from this region
            return rest.map(function(r) {
                var copy = {};
                for (var k in r) copy[k] = r[k];
                copy[region] = null;
                return copy;
            });
        }

        var results = [];
        seeds.forEach(function(seed) {
            rest.forEach(function(r) {
                var copy = {};
                for (var k in r) copy[k] = r[k];
                copy[region] = seed;
                results.push(copy);
            });
        });
        return results;
    }

    var regionalOutcomes = enumRegionalWinners(0);
    var allOutcomes = [];

    regionalOutcomes.forEach(function(regWinners) {
        // Round 4 points: every alive team that doesn't win their region only has R4 if they win R4.
        // Actually, with 2 teams per region at E8, the loser gets nothing from R4 onward.
        // The winner gets R4 points. R4 is the regional final.

        // For each pairing, enumerate the Final Four (round 5)
        var semi1Region1 = finalFourPairings[0][0], semi1Region2 = finalFourPairings[0][1];
        var semi2Region1 = finalFourPairings[1][0], semi2Region2 = finalFourPairings[1][1];

        var semi1A = regWinners[semi1Region1], semi1B = regWinners[semi1Region2];
        var semi2A = regWinners[semi2Region1], semi2B = regWinners[semi2Region2];

        // Enumerate semi 1 outcomes
        var semi1Winners = [];
        if (semi1A !== null && semi1B !== null) {
            semi1Winners.push({ seed: semi1A, region: semi1Region1 });
            semi1Winners.push({ seed: semi1B, region: semi1Region2 });
        } else if (semi1A !== null) {
            semi1Winners.push({ seed: semi1A, region: semi1Region1 });
        } else if (semi1B !== null) {
            semi1Winners.push({ seed: semi1B, region: semi1Region2 });
        } else {
            semi1Winners.push(null);
        }

        // Enumerate semi 2 outcomes
        var semi2Winners = [];
        if (semi2A !== null && semi2B !== null) {
            semi2Winners.push({ seed: semi2A, region: semi2Region1 });
            semi2Winners.push({ seed: semi2B, region: semi2Region2 });
        } else if (semi2A !== null) {
            semi2Winners.push({ seed: semi2A, region: semi2Region1 });
        } else if (semi2B !== null) {
            semi2Winners.push({ seed: semi2B, region: semi2Region2 });
        } else {
            semi2Winners.push(null);
        }

        semi1Winners.forEach(function(s1Winner) {
            semi2Winners.forEach(function(s2Winner) {
                // Enumerate championship (round 6)
                var champWinners = [];
                if (s1Winner && s2Winner) {
                    champWinners.push(s1Winner, s2Winner);
                } else if (s1Winner) {
                    champWinners.push(s1Winner);
                } else if (s2Winner) {
                    champWinners.push(s2Winner);
                } else {
                    champWinners.push(null);
                }

                champWinners.forEach(function(champion) {
                    // Build the outcome: map "region:seed" -> last round won
                    var outcome = {};

                    // All regional winners get at least R4
                    regions.forEach(function(region) {
                        var winner = regWinners[region];
                        if (winner !== null && winner !== undefined) {
                            outcome[region + ':' + winner] = 4;
                        }
                    });

                    // Semi winners get R5
                    if (s1Winner) outcome[s1Winner.region + ':' + s1Winner.seed] = 5;
                    if (s2Winner) outcome[s2Winner.region + ':' + s2Winner.seed] = 5;

                    // Champion gets R6
                    if (champion) outcome[champion.region + ':' + champion.seed] = 6;

                    allOutcomes.push(outcome);
                });
            });
        });
    });

    return allOutcomes;
}

// Determine which brackets cannot possibly finish first (highest points) in any
// tournament outcome. Only runs when <= 8 teams are alive (Elite 8 or later).
//
// bracketData: [{ id, currentPoints, aliveTeamKeys: ["East:1", "West:2", ...] }]
// aliveTeams: [{ seed, region }] - all alive tournament teams
// finalFourPairings: [['East','South'], ['Midwest','West']]
// Returns: Set of bracket IDs that cannot win
function findBracketsThatCannotWin(bracketData, aliveTeams, finalFourPairings) {
    if (!bracketData || bracketData.length < 2) return new Set();
    if (!aliveTeams || aliveTeams.length === 0 || aliveTeams.length > 8) return new Set();

    // Group alive teams by region: { region: [seed1, seed2] }
    var aliveByRegion = {};
    aliveTeams.forEach(function(t) {
        var region = t.region;
        var seed = parseInt(t.seed, 10);
        if (!aliveByRegion[region]) aliveByRegion[region] = [];
        aliveByRegion[region].push(seed);
    });

    // Determine the current round (next round to be played).
    // With 8 teams -> round 4 (Elite 8), 4 -> round 5 (F4), 2 -> round 6 (Championship)
    var nextRound;
    if (aliveTeams.length > 4) nextRound = 4;
    else if (aliveTeams.length > 2) nextRound = 5;
    else nextRound = 6;

    // Build a seed lookup: "region:seed" -> seed (for point calculations)
    var seedLookup = {};
    aliveTeams.forEach(function(t) {
        seedLookup[t.region + ':' + parseInt(t.seed, 10)] = parseInt(t.seed, 10);
    });

    var outcomes = enumerateTournamentOutcomes(aliveByRegion, finalFourPairings);
    var canWin = {};

    outcomes.forEach(function(outcome) {
        // For each bracket, compute total points in this outcome
        var maxPoints = -1;
        var scores = [];

        bracketData.forEach(function(b) {
            var total = b.currentPoints || 0;
            b.aliveTeamKeys.forEach(function(key) {
                var lastRound = outcome[key];
                if (lastRound && lastRound >= nextRound) {
                    var seed = seedLookup[key];
                    if (seed !== undefined) {
                        total += futurePoints(seed, nextRound, lastRound);
                    }
                }
            });
            scores.push({ id: b.id, total: total });
            if (total > maxPoints) maxPoints = total;
        });

        // Mark all brackets that tie for first as "can win"
        scores.forEach(function(s) {
            if (s.total === maxPoints) {
                canWin[s.id] = true;
            }
        });
    });

    // Any bracket not in canWin is eliminated
    var result = new Set();
    bracketData.forEach(function(b) {
        if (!canWin[b.id]) {
            result.add(b.id);
        }
    });
    return result;
}

// 2. Angular service registration - GUARDED for Jest compatibility
if (typeof angular !== 'undefined') {
    angular.module('myApp.services').service('ceilingCalculator', [function() {
        this.buildTeamData = buildTeamData;
        this.computeBracketCeiling = computeBracketCeiling;
        this.findCollisions = findCollisions;
        this.formatRemainingTeams = formatRemainingTeams;
        this.findBracketsThatCannotWin = findBracketsThatCannotWin;
    }]);
}

// 3. UMD export for Jest - ES5 syntax
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        computeBracketCeiling: computeBracketCeiling,
        findCollisions: findCollisions,
        computeRegionCeiling: computeRegionCeiling,
        computeFinalFourCeiling: computeFinalFourCeiling,
        getHighestRoundWon: getHighestRoundWon,
        buildTeamData: buildTeamData,
        sumRoundPoints: sumRoundPoints,
        pointsForRound: pointsForRound,
        isLeaf: isLeaf,
        formatRemainingTeams: formatRemainingTeams,
        findBracketsThatCannotWin: findBracketsThatCannotWin,
        enumerateTournamentOutcomes: enumerateTournamentOutcomes,
        futurePoints: futurePoints,
        REGION_BRACKET: REGION_BRACKET
    };
}
