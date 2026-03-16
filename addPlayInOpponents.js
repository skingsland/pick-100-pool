// Utility script: auto-populate play-in ("First Four") opponents into Firebase
// Run once after Selection Sunday, before brackets open.

var got = require('got');
var {
    FIREBASE_TOURNAMENT_ID,
    TOURNAMENT_START_TIME,
    loginToFirebase,
    getTeamID,
} = require('./tournamentConfig');

var ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';
var THESCORE_TEAMS_URL = 'https://api.thescore.com/ncaab/teams';

function parseESPNPlayInOpponents(events) {
    const opponents = [];

    for (const event of events) {
        for (const comp of event.competitions || []) {
            const competitors = comp.competitors || [];
            const tbdTeam = competitors.find(c => c.team.displayName === 'TBD');
            if (!tbdTeam) continue;

            const opponent = competitors.find(c => c.team.displayName !== 'TBD');
            if (!opponent) continue;

            const headline = (comp.notes || []).find(n => n.headline)?.headline || '';
            const regionMatch = headline.match(/- (\w+) Region/);
            const region = regionMatch ? regionMatch[1] : '';

            opponents.push({
                name: opponent.team.shortDisplayName,
                seed: opponent.curatedRank.current,
                region,
            });
        }
    }

    return opponents;
}

function findTeamByName(teamName, teams) {
    const needle = teamName.toLowerCase();

    let substringMatch = null;
    for (const team of teams) {
        const fields = [team.medium_name, team.short_name, team.name].filter(Boolean);

        if (fields.some(f => f.toLowerCase() === needle)) {
            return {
                id: team.id,
                short_name: team.short_name,
                medium_name: team.medium_name,
                conference: team.conference,
            };
        }
        if (!substringMatch && fields.some(f => f.toLowerCase().includes(needle))) {
            substringMatch = {
                id: team.id,
                short_name: team.short_name,
                medium_name: team.medium_name,
                conference: team.conference,
            };
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

function formatDateForESPN(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

async function run(options = {}) {
    const tournamentId = options.tournament || FIREBASE_TOURNAMENT_ID;
    const dryRun = options.dryRun || false;

    const firebase = loginToFirebase();
    const teamsRef = firebase.ref('tournaments').child(tournamentId).child('teams');

    // Step 1: Fetch ESPN scoreboard for both days of the round of 64
    const tournamentStart = new Date(TOURNAMENT_START_TIME);
    const allESPNEvents = [];
    for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const date = new Date(tournamentStart);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = formatDateForESPN(date);
        const url = `${ESPN_SCOREBOARD_URL}?dates=${dateStr}&groups=100&limit=50`;

        try {
            const response = await got(url).json();
            allESPNEvents.push(...(response.events || []));
        } catch (err) {
            console.log(`ESPN scoreboard fetch failed for ${dateStr}:`, err.message);
        }
    }

    // Step 2: Find games with TBD opponents (play-in winner slots)
    const playInOpponents = parseESPNPlayInOpponents(allESPNEvents);

    if (playInOpponents.length === 0) {
        console.log('No TBD (play-in) games found in ESPN bracket. Are tournament games scheduled yet?');
        return;
    }

    console.log(`Found ${playInOpponents.length} play-in opponent(s) in ESPN bracket:`);
    for (const opp of playInOpponents) {
        console.log(`  ${opp.region} region — #${opp.seed} ${opp.name}`);
    }

    // Step 3: Fetch theScore teams list for metadata lookup
    console.log('Fetching theScore teams list...');
    let theScoreTeams;
    try {
        theScoreTeams = await got(THESCORE_TEAMS_URL).json();
    } catch (err) {
        throw new Error(`Failed to fetch theScore teams list: ${err.message}`);
    }

    // Step 4: Look up each opponent in theScore for Firebase metadata
    const entries = [];
    for (const opp of playInOpponents) {
        const team = findTeamByName(opp.name, theScoreTeams);
        if (!team) {
            console.error(`ERROR: Could not find team "${opp.name}" in theScore teams list.`);
            continue;
        }

        const entry = buildFirebaseEntry(team, opp.seed, opp.region);
        entries.push(entry);
        console.log(`  ${opp.region} region: #${opp.seed} ${entry.full_name} (${entry.id})`);
    }

    // Fail loudly if some or all lookups failed
    const failedCount = playInOpponents.length - entries.length;
    if (entries.length === 0) {
        throw new Error(`All ${playInOpponents.length} team lookup(s) failed. No teams were inserted.`);
    }
    if (failedCount > 0) {
        console.error(`WARNING: ${failedCount} of ${playInOpponents.length} team lookup(s) failed.`);
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

module.exports = { parseESPNPlayInOpponents, findTeamByName, buildFirebaseEntry, run };
