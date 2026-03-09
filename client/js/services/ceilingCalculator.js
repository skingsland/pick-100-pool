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

function getNaiveTeamCeiling(seed, roundPoints, isEliminated) {
    seed = parseInt(seed, 10) || 0;
    var earned = sumRoundPoints(roundPoints);
    if (isEliminated) return earned;
    var highestWon = getHighestRoundWon(roundPoints);
    var remaining = 0;
    for (var r = highestWon + 1; r <= 6; r++) {
        if (roundPoints && parseInt(roundPoints[r], 10) === 0) break;
        remaining += seed + Math.pow(2, r - 1);
    }
    return earned + remaining;
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

    teams.forEach(function(t) {
        if (t.isEliminated === true) totalPoints += (t.totalEarnedPoints || 0);
    });

    return totalPoints;
}

// 2. Angular service registration - GUARDED for Jest compatibility
if (typeof angular !== 'undefined') {
    angular.module('myApp.services').service('ceilingCalculator', [function() {
        this.computeBracketCeiling = computeBracketCeiling;
        this.computeRegionCeiling = computeRegionCeiling;
        this.computeFinalFourCeiling = computeFinalFourCeiling;
        this.getHighestRoundWon = getHighestRoundWon;
        this.getNaiveTeamCeiling = getNaiveTeamCeiling;
        this.buildTeamData = buildTeamData;
        this.sumRoundPoints = sumRoundPoints;
        this.pointsForRound = pointsForRound;
        this.isLeaf = isLeaf;
    }]);
}

// 3. UMD export for Jest - ES5 syntax
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        computeBracketCeiling: computeBracketCeiling,
        computeRegionCeiling: computeRegionCeiling,
        computeFinalFourCeiling: computeFinalFourCeiling,
        getHighestRoundWon: getHighestRoundWon,
        getNaiveTeamCeiling: getNaiveTeamCeiling,
        buildTeamData: buildTeamData,
        sumRoundPoints: sumRoundPoints,
        pointsForRound: pointsForRound,
        isLeaf: isLeaf,
        REGION_BRACKET: REGION_BRACKET
    };
}
