// Utility script: auto-populate play-in ("First Four") opponents into Firebase
// Run once after Selection Sunday, before brackets open.

var got = require('got');
var moment = require('moment');
var readline = require('readline');
var {
    FIREBASE_TOURNAMENT_ID,
    TOURNAMENT_START_TIME,
    API_TOURNAMENT_NAME,
    loginToFirebase,
    getTeamID,
    getRound,
} = require('./tournamentConfig');

function firstRoundOpponentSeed(playInSeed) {
    if (playInSeed === 16) return 1;
    if (playInSeed === 11) return 6;
    throw new Error(`Unexpected play-in seed: ${playInSeed}`);
}

function parsePlayInGames(events) {
    return events
        .filter(game => game.tournament_name === API_TOURNAMENT_NAME && getRound(game) === 0)
        .map(game => ({
            region: game.home_region,
            seed: game.home_ranking || game.away_ranking,
            teamNames: [game.home_team.medium_name, game.away_team.medium_name],
        }));
}

function findTeamInEvents(teamName, events) {
    const needle = teamName.toLowerCase();

    function extractTeam(event, side) {
        return {
            id: event[`${side}_team`].id,
            short_name: event[`${side}_team`].short_name,
            medium_name: event[`${side}_team`].medium_name,
            conference: event[`${side}_conference`],
        };
    }

    // Prefer exact match on medium_name, then fall back to substring
    let substringMatch = null;
    for (const event of events) {
        for (const side of ['home', 'away']) {
            const team = event[`${side}_team`];
            const fields = [team.medium_name, team.short_name, team.name].filter(Boolean);

            if (fields.some(f => f.toLowerCase() === needle)) {
                return extractTeam(event, side);
            }
            if (!substringMatch && fields.some(f => f.toLowerCase().includes(needle))) {
                substringMatch = extractTeam(event, side);
            }
        }
    }

    return substringMatch;
}

function buildFirebaseEntry(team, seed, region) {
    return {
        id: getTeamID(team),
        full_name: team.medium_name,
        seed,
        region,
        conference: team.conference,
    };
}

function findFirstRoundOpponents(ncaaGames, playInGames) {
    const results = [];

    for (const playIn of playInGames) {
        const opponentSeed = firstRoundOpponentSeed(playIn.seed);

        for (const game of ncaaGames) {
            if (game.bracketRegion !== playIn.region) continue;

            const homeSeed = parseInt(game.home.seed, 10);
            const awaySeed = parseInt(game.away.seed, 10);

            if (homeSeed === playIn.seed && awaySeed === opponentSeed) {
                results.push({ playInGame: playIn, opponentName: game.away.names.short });
                break;
            }
            if (awaySeed === playIn.seed && homeSeed === opponentSeed) {
                results.push({ playInGame: playIn, opponentName: game.home.names.short });
                break;
            }
        }
    }

    return results;
}

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function formatDateForNcaa(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
}

async function fetchNcaaScoreboardGames(startDate) {
    const games = [];
    // Fetch Thursday and Friday of round-of-64 week
    for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayOffset);
        const datePath = formatDateForNcaa(date);
        const url = `https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/${datePath}/scoreboard.json`;

        try {
            const response = await got(url).json();
            if (response.games) {
                games.push(...response.games);
            }
        } catch (err) {
            console.log(`NCAA scoreboard fetch failed for ${datePath}:`, err.message);
        }
    }
    return games;
}

async function run(options = {}) {
    const tournamentId = options.tournament || FIREBASE_TOURNAMENT_ID;
    const dryRun = options.dryRun || false;

    const firebase = loginToFirebase();
    const teamsRef = firebase.ref('tournaments').child(tournamentId).child('teams');

    // Step 1: Fetch play-in games from theScore
    // Play-ins are Tue/Wed before the Thursday round-of-64 start.
    // moment().format() preserves the timezone offset, which theScore's API requires.
    const playInStartISO = moment(TOURNAMENT_START_TIME).subtract(4, 'days').format();
    // Don't filter by conference — play-in teams still show their actual conference, not "NCAA Tournament".
    // Fetch through TOURNAMENT_START_TIME (not END) to limit results; parsePlayInGames filters by tournament_name.
    const playInUrl = `https://api.thescore.com/ncaab/events?game_date.in=${playInStartISO},${TOURNAMENT_START_TIME}`;

    console.log('Fetching play-in games from theScore...');
    let allEvents;
    try {
        allEvents = await got(playInUrl).json();
    } catch (err) {
        throw new Error(`Failed to fetch play-in games from theScore (${playInUrl}): ${err.message}`);
    }
    const playInGames = parsePlayInGames(allEvents);

    if (playInGames.length === 0) {
        console.log('No play-in games found. Are tournament events in the API yet?');
        return;
    }

    console.log(`Found ${playInGames.length} play-in game(s):`);
    for (const g of playInGames) {
        console.log(`  ${g.region} region — #${g.seed} ${g.teamNames[0]} vs #${g.seed} ${g.teamNames[1]}`);
    }

    // Step 2+3: Auto-detect first-round opponents via NCAA API
    const tournamentStart = new Date(TOURNAMENT_START_TIME);
    const ncaaGames = await fetchNcaaScoreboardGames(tournamentStart);

    let opponentMatches = findFirstRoundOpponents(ncaaGames, playInGames);
    console.log(`NCAA auto-detect found ${opponentMatches.length} of ${playInGames.length} first-round opponent(s).`);

    // Fallback: interactive prompt for any play-in games not matched
    const matchedRegions = new Set(opponentMatches.map(m => m.playInGame.region));
    const unmatchedPlayIns = playInGames.filter(g => !matchedRegions.has(g.region));

    for (const playIn of unmatchedPlayIns) {
        const opponentSeed = firstRoundOpponentSeed(playIn.seed);
        const answer = await prompt(
            `Play-in: ${playIn.region} region — #${playIn.seed} ${playIn.teamNames[0]} vs #${playIn.seed} ${playIn.teamNames[1]}\n` +
            `  → The ${opponentSeed}-seed in the ${playIn.region} plays the winner.\n` +
            `  Enter the ${opponentSeed}-seed team name (e.g., "Auburn"): `
        );
        opponentMatches.push({ playInGame: playIn, opponentName: answer });
    }

    // Step 4: Look up first-round opponents in theScore's recent events
    const thirtyDaysAgoISO = moment().subtract(30, 'days').format();
    const nowISO = moment().format();
    const recentEventsUrl = `https://api.thescore.com/ncaab/events?game_date.in=${thirtyDaysAgoISO},${nowISO}`;
    let recentEvents;
    try {
        recentEvents = await got(recentEventsUrl).json();
    } catch (err) {
        throw new Error(`Failed to fetch recent events from theScore (${recentEventsUrl}): ${err.message}`);
    }

    const entries = [];
    for (const match of opponentMatches) {
        const team = findTeamInEvents(match.opponentName, recentEvents);
        if (!team) {
            console.error(`ERROR: Could not find team "${match.opponentName}" in theScore's recent events.`);
            continue;
        }

        const opponentSeed = firstRoundOpponentSeed(match.playInGame.seed);
        const entry = buildFirebaseEntry(team, opponentSeed, match.playInGame.region);
        entries.push(entry);

        console.log(`  ${match.playInGame.region} region: #${opponentSeed} ${entry.full_name} (${entry.id})`);
    }

    // Fail loudly if some or all lookups failed
    const failedCount = opponentMatches.length - entries.length;
    if (entries.length === 0) {
        throw new Error(`All ${opponentMatches.length} team lookup(s) failed. No teams were inserted.`);
    }
    if (failedCount > 0) {
        console.error(`WARNING: ${failedCount} of ${opponentMatches.length} team lookup(s) failed.`);
    }

    // Step 5: Insert into Firebase
    if (dryRun) {
        console.log('\n[DRY RUN] Would insert:');
        for (const entry of entries) {
            console.log(`  tournaments/${tournamentId}/teams/${entry.id}:`, JSON.stringify(entry));
        }
    } else {
        for (const entry of entries) {
            console.log(`Writing to tournaments/${tournamentId}/teams/${entry.id}...`);
            await teamsRef.child(entry.id).set(entry);
        }
        console.log(`Done! Inserted ${entries.length} team(s).`);
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    const tournamentIdx = args.indexOf('--tournament');
    const tournamentArg = tournamentIdx !== -1 ? args[tournamentIdx + 1] : undefined;
    if (tournamentIdx !== -1 && (!tournamentArg || tournamentArg.startsWith('--'))) {
        console.error('ERROR: --tournament requires a value (e.g., --tournament Development)');
        process.exit(1);
    }
    const options = {
        tournament: tournamentArg,
        dryRun: args.includes('--dry-run'),
    };

    run(options).then(() => {
        setTimeout(() => process.exit(), 5000);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { firstRoundOpponentSeed, parsePlayInGames, findTeamInEvents, buildFirebaseEntry, findFirstRoundOpponents, run };
