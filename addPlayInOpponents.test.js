// Mock got and tournamentConfig BEFORE requiring the module under test
jest.mock('got');
const mockSet = jest.fn().mockResolvedValue();
const mockChildFn = jest.fn();
const mockRef = jest.fn();

jest.mock('./tournamentConfig', () => ({
    FIREBASE_TOURNAMENT_ID: 'MarchMadness2026',
    TOURNAMENT_START_TIME: '2026-03-19T12:15:00-04:00',
    API_TOURNAMENT_NAME: "NCAA Men's Division I Basketball Tournament",
    loginToFirebase: jest.fn().mockReturnValue({ ref: mockRef }),
    getTeamID: (team) => team.short_name + '_' + team.id,
    getRound: (game) => (game.round || game.playoff.round) - 1,
}));

const got = require('got');
const {
    firstRoundOpponentSeed,
    parsePlayInGames,
    findTeamInEvents,
    findTeamByName,
    parseESPNPlayInOpponents,
    buildFirebaseEntry,
    findFirstRoundOpponents,
    run,
} = require('./addPlayInOpponents');

const API_TOURNAMENT_NAME = "NCAA Men's Division I Basketball Tournament";

function setupFirebaseChain() {
    const childObj = { set: mockSet, child: mockChildFn };
    mockChildFn.mockReturnValue(childObj);
    mockRef.mockReturnValue({ child: mockChildFn });
}

// Minimal theScore event fixture shaped like the real API
function makeEvent({ round = 1, tournamentName = API_TOURNAMENT_NAME, homeRegion = 'South', awayRegion = 'South',
                     homeSeed = 16, awaySeed = 16, homeTeam = {}, awayTeam = {} } = {}) {
    return {
        tournament_name: tournamentName,
        round,
        home_region: homeRegion,
        away_region: awayRegion,
        home_ranking: homeSeed,
        away_ranking: awaySeed,
        home_team: { id: 1, short_name: 'TMA', medium_name: 'Team A', name: 'Team A Mascots', ...homeTeam },
        away_team: { id: 2, short_name: 'TMB', medium_name: 'Team B', name: 'Team B Mascots', ...awayTeam },
    };
}

describe('firstRoundOpponentSeed', () => {
    test('play-in seed 16 faces seed 1', () => {
        expect(firstRoundOpponentSeed(16)).toBe(1);
    });

    test('play-in seed 11 faces seed 6', () => {
        expect(firstRoundOpponentSeed(11)).toBe(6);
    });

    test('throws for unexpected seed', () => {
        expect(() => firstRoundOpponentSeed(5)).toThrow();
    });
});

describe('parsePlayInGames', () => {
    test('filters to only play-in (round 0) games from the NCAA tournament', () => {
        const events = [
            makeEvent({ round: 1 }),
            makeEvent({ round: 2 }),
            makeEvent({ round: 1, tournamentName: 'NIT' }),
        ];

        const result = parsePlayInGames(events);
        expect(result).toHaveLength(1);
    });

    test('extracts region, seed, and team names from play-in games', () => {
        const events = [
            makeEvent({
                round: 1,
                homeRegion: 'East', awayRegion: 'East',
                homeSeed: 16, awaySeed: 16,
                homeTeam: { medium_name: 'Saint Francis' },
                awayTeam: { medium_name: 'Alabama State' },
            }),
        ];

        const [game] = parsePlayInGames(events);
        expect(game.region).toBe('East');
        expect(game.seed).toBe(16);
        expect(game.teamNames).toEqual(['Saint Francis', 'Alabama State']);
    });

    test('handles both 16-seed and 11-seed play-in games', () => {
        const events = [
            makeEvent({ homeSeed: 16, awaySeed: 16, homeRegion: 'South', awayRegion: 'South' }),
            makeEvent({ homeSeed: 11, awaySeed: 11, homeRegion: 'West', awayRegion: 'West' }),
        ];

        const result = parsePlayInGames(events);
        expect(result).toHaveLength(2);
        expect(result[0].seed).toBe(16);
        expect(result[1].seed).toBe(11);
    });

    test('returns empty array when no play-in games exist', () => {
        const events = [makeEvent({ round: 2 })];
        expect(parsePlayInGames(events)).toEqual([]);
    });

    test('falls back to away_ranking when home_ranking is null', () => {
        const events = [makeEvent({ round: 1, homeSeed: null, awaySeed: 16 })];
        const [game] = parsePlayInGames(events);
        expect(game.seed).toBe(16);
    });
});

describe('findTeamInEvents', () => {
    const events = [
        {
            home_team: { id: 42, short_name: 'AUB', medium_name: 'Auburn', name: 'Auburn Tigers' },
            away_team: { id: 99, short_name: 'HOU', medium_name: 'Houston', name: 'Houston Cougars' },
            home_conference: 'Southeastern',
            away_conference: 'American Athletic',
        },
        {
            home_team: { id: 50, short_name: 'DUKE', medium_name: 'Duke', name: 'Duke Blue Devils' },
            away_team: { id: 60, short_name: 'UNC', medium_name: 'North Carolina', name: 'North Carolina Tar Heels' },
            home_conference: 'Atlantic Coast',
            away_conference: 'Atlantic Coast',
        },
    ];

    test('finds home team by medium_name substring match (case-insensitive)', () => {
        const result = findTeamInEvents('auburn', events);
        expect(result).toEqual({
            id: 42, short_name: 'AUB', medium_name: 'Auburn', conference: 'Southeastern',
        });
    });

    test('finds away team by medium_name', () => {
        const result = findTeamInEvents('Houston', events);
        expect(result).toEqual({
            id: 99, short_name: 'HOU', medium_name: 'Houston', conference: 'American Athletic',
        });
    });

    test('matches against short_name', () => {
        expect(findTeamInEvents('DUKE', events).id).toBe(50);
    });

    test('matches against full name', () => {
        expect(findTeamInEvents('Tar Heels', events).id).toBe(60);
    });

    test('returns null when no team matches', () => {
        expect(findTeamInEvents('Kentucky', events)).toBeNull();
    });

    test('prefers exact match over substring match', () => {
        const ambiguousEvents = [
            {
                home_team: { id: 70, short_name: 'INDST', medium_name: 'Indiana State', name: 'Indiana State Sycamores' },
                away_team: { id: 71, short_name: 'IND', medium_name: 'Indiana', name: 'Indiana Hoosiers' },
                home_conference: 'Missouri Valley',
                away_conference: 'Big Ten',
            },
        ];
        // "Indiana" should match the exact "Indiana", not substring "Indiana State"
        expect(findTeamInEvents('Indiana', ambiguousEvents).id).toBe(71);
    });

    test('skips null/undefined team name fields without crashing', () => {
        const eventsWithNulls = [{
            home_team: { id: 1, short_name: null, medium_name: 'Test', name: undefined },
            away_team: { id: 2, short_name: 'TST', medium_name: null, name: 'Test Team' },
            home_conference: 'Conf', away_conference: 'Conf',
        }];
        expect(findTeamInEvents('Test', eventsWithNulls).id).toBe(1);
    });
});

describe('findTeamByName', () => {
    const teams = [
        { id: 659, short_name: 'MICH', medium_name: 'Michigan', name: 'Michigan', conference: 'Big Ten' },
        { id: 660, short_name: 'MSU', medium_name: 'Michigan State', name: 'Michigan State', conference: 'Big Ten' },
        { id: 380, short_name: 'FLA', medium_name: 'Florida', name: 'Florida', conference: 'Southeastern' },
        { id: 388, short_name: 'FSU', medium_name: 'Florida State', name: 'Florida State', conference: 'Atlantic Coast' },
        { id: 155, short_name: 'BYU', medium_name: 'BYU', name: 'BYU', conference: 'Big 12' },
        { id: 1063, short_name: 'TENN', medium_name: 'Tennessee', name: 'Tennessee', conference: 'Southeastern' },
    ];

    test('finds team by exact medium_name match (case-insensitive)', () => {
        const result = findTeamByName('Michigan', teams);
        expect(result).toEqual({
            id: 659, short_name: 'MICH', medium_name: 'Michigan', conference: 'Big Ten',
        });
    });

    test('prefers exact match over substring match', () => {
        const result = findTeamByName('Florida', teams);
        expect(result.id).toBe(380);
    });

    test('matches against short_name', () => {
        expect(findTeamByName('BYU', teams).id).toBe(155);
    });

    test('returns null when no team matches', () => {
        expect(findTeamByName('Kentucky', teams)).toBeNull();
    });

    test('case-insensitive matching', () => {
        expect(findTeamByName('tennessee', teams).id).toBe(1063);
    });
});

describe('parseESPNPlayInOpponents', () => {
    function makeESPNEvent({ region = 'Midwest', homeName = 'Michigan Wolverines', homeShort = 'Michigan',
                             homeSeed = 1, awayName = 'TBD', awayShort = 'TBD', awaySeed = 99 } = {}) {
        return {
            competitions: [{
                notes: [{ headline: `NCAA Men's Basketball Championship - ${region} Region - 1st Round` }],
                competitors: [
                    {
                        homeAway: 'home',
                        curatedRank: { current: homeSeed },
                        team: { displayName: homeName, shortDisplayName: homeShort },
                    },
                    {
                        homeAway: 'away',
                        curatedRank: { current: awaySeed },
                        team: { displayName: awayName, shortDisplayName: awayShort },
                    },
                ],
            }],
        };
    }

    test('extracts opponent name, seed, and region from TBD games', () => {
        const events = [makeESPNEvent({ region: 'Midwest', homeShort: 'Michigan', homeSeed: 1 })];
        const result = parseESPNPlayInOpponents(events);
        expect(result).toEqual([{ name: 'Michigan', seed: 1, region: 'Midwest' }]);
    });

    test('ignores games where neither team is TBD', () => {
        const events = [makeESPNEvent({ awayName: 'Siena Saints', awayShort: 'Siena', awaySeed: 16 })];
        expect(parseESPNPlayInOpponents(events)).toEqual([]);
    });

    test('handles TBD as home team (opponent is away)', () => {
        const events = [makeESPNEvent({
            region: 'South', homeName: 'TBD', homeShort: 'TBD', homeSeed: 99,
            awayName: 'Florida Gators', awayShort: 'Florida', awaySeed: 1,
        })];
        const result = parseESPNPlayInOpponents(events);
        expect(result).toEqual([{ name: 'Florida', seed: 1, region: 'South' }]);
    });

    test('finds multiple TBD games across events', () => {
        const events = [
            makeESPNEvent({ region: 'Midwest', homeShort: 'Michigan', homeSeed: 1 }),
            makeESPNEvent({ region: 'West', homeShort: 'BYU', homeSeed: 6 }),
            makeESPNEvent({ region: 'East', homeName: 'Duke Blue Devils', homeShort: 'Duke', homeSeed: 1,
                            awayName: 'Siena Saints', awayShort: 'Siena', awaySeed: 16 }),
        ];
        const result = parseESPNPlayInOpponents(events);
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('Michigan');
        expect(result[1].name).toBe('BYU');
    });

    test('extracts region from notes headline', () => {
        const events = [makeESPNEvent({ region: 'West' })];
        expect(parseESPNPlayInOpponents(events)[0].region).toBe('West');
    });

    test('returns empty array when no events provided', () => {
        expect(parseESPNPlayInOpponents([])).toEqual([]);
    });
});

describe('buildFirebaseEntry', () => {
    test('produces entry matching theScore.js format (lines 241-246)', () => {
        const team = { id: 42, short_name: 'AUB', medium_name: 'Auburn', conference: 'Southeastern' };
        expect(buildFirebaseEntry(team, 1, 'South')).toEqual({
            id: 'AUB_42', full_name: 'Auburn', seed: 1, region: 'South', conference: 'Southeastern',
        });
    });

    test('uses short_name + _ + id for the id field', () => {
        const team = { id: 7, short_name: 'GONZ', medium_name: 'Gonzaga', conference: 'West Coast' };
        expect(buildFirebaseEntry(team, 6, 'West').id).toBe('GONZ_7');
    });
});

describe('findFirstRoundOpponents (NCAA data)', () => {
    function makeNcaaGame({ region, homeSeed, awaySeed, homeName, awayName }) {
        return {
            bracketRegion: region,
            home: { seed: String(homeSeed), names: { short: homeName } },
            away: { seed: String(awaySeed), names: { short: awayName } },
        };
    }

    const playInGames = [
        { region: 'South', seed: 16, teamNames: ['Saint Francis', 'Alabama State'] },
        { region: 'West', seed: 11, teamNames: ['San Diego St.', 'North Carolina'] },
    ];

    test('finds first-round opponent by matching play-in seed and region', () => {
        const ncaaGames = [
            makeNcaaGame({ region: 'South', homeSeed: 1, awaySeed: 16, homeName: 'Auburn', awayName: 'TBD' }),
            makeNcaaGame({ region: 'West', homeSeed: 6, awaySeed: 11, homeName: 'Clemson', awayName: 'TBD' }),
            makeNcaaGame({ region: 'East', homeSeed: 1, awaySeed: 16, homeName: 'Duke', awayName: 'Somebody' }),
        ];

        const result = findFirstRoundOpponents(ncaaGames, playInGames);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ playInGame: playInGames[0], opponentName: 'Auburn' });
        expect(result[1]).toEqual({ playInGame: playInGames[1], opponentName: 'Clemson' });
    });

    test('returns empty array when no NCAA games match play-in regions', () => {
        const ncaaGames = [
            makeNcaaGame({ region: 'East', homeSeed: 1, awaySeed: 16, homeName: 'Duke', awayName: 'TBD' }),
        ];
        expect(findFirstRoundOpponents(ncaaGames, playInGames)).toEqual([]);
    });

    test('handles play-in seed on either side (home or away)', () => {
        const ncaaGames = [
            makeNcaaGame({ region: 'South', homeSeed: 16, awaySeed: 1, homeName: 'TBD', awayName: 'Auburn' }),
        ];

        const result = findFirstRoundOpponents(ncaaGames, [playInGames[0]]);
        expect(result).toHaveLength(1);
        expect(result[0].opponentName).toBe('Auburn');
    });
});

describe('run (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupFirebaseChain();
    });

    test('full flow: fetches play-in games, auto-detects opponents from NCAA, looks up in theScore, writes to Firebase', async () => {
        const theScorePlayInResponse = [
            makeEvent({
                round: 1, homeRegion: 'South', awayRegion: 'South',
                homeSeed: 16, awaySeed: 16,
                homeTeam: { id: 10, short_name: 'SFU', medium_name: 'Saint Francis' },
                awayTeam: { id: 11, short_name: 'ALST', medium_name: 'Alabama State' },
            }),
        ];

        const ncaaScoreboardGames = [{
            bracketRegion: 'South',
            home: { seed: '1', names: { short: 'Auburn' } },
            away: { seed: '16', names: { short: 'TBD' } },
        }];

        const theScoreRecentEvents = [{
            home_team: { id: 42, short_name: 'AUB', medium_name: 'Auburn', name: 'Auburn Tigers' },
            away_team: { id: 99, short_name: 'FLA', medium_name: 'Florida', name: 'Florida Gators' },
            home_conference: 'Southeastern',
            away_conference: 'Southeastern',
        }];

        // Track call order to distinguish play-in fetch (1st thescore call) from recent events (2nd)
        let theScoreCallCount = 0;
        got.mockImplementation((url) => ({
            json: () => {
                if (url.includes('data.ncaa.com')) {
                    return Promise.resolve({ games: ncaaScoreboardGames });
                }
                if (url.includes('api.thescore.com')) {
                    theScoreCallCount++;
                    return Promise.resolve(theScoreCallCount === 1 ? theScorePlayInResponse : theScoreRecentEvents);
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            },
        }));

        await run({ tournament: 'Development', dryRun: false });

        expect(mockRef).toHaveBeenCalledWith('tournaments');
        expect(mockSet).toHaveBeenCalledWith({
            id: 'AUB_42',
            full_name: 'Auburn',
            seed: 1,
            region: 'South',
            conference: 'Southeastern',
        });
    });

    test('dry-run mode does not write to Firebase', async () => {
        const theScorePlayInResponse = [
            makeEvent({
                round: 1, homeRegion: 'South', awayRegion: 'South',
                homeSeed: 16, awaySeed: 16,
                homeTeam: { id: 10, short_name: 'SFU', medium_name: 'Saint Francis' },
                awayTeam: { id: 11, short_name: 'ALST', medium_name: 'Alabama State' },
            }),
        ];

        const ncaaScoreboardGames = [{
            bracketRegion: 'South',
            home: { seed: '1', names: { short: 'Auburn' } },
            away: { seed: '16', names: { short: 'TBD' } },
        }];

        const theScoreRecentEvents = [{
            home_team: { id: 42, short_name: 'AUB', medium_name: 'Auburn', name: 'Auburn Tigers' },
            away_team: { id: 99, short_name: 'FLA', medium_name: 'Florida', name: 'Florida Gators' },
            home_conference: 'Southeastern',
            away_conference: 'Southeastern',
        }];

        let theScoreCallCount = 0;
        got.mockImplementation((url) => ({
            json: () => {
                if (url.includes('data.ncaa.com')) return Promise.resolve({ games: ncaaScoreboardGames });
                if (url.includes('api.thescore.com')) {
                    theScoreCallCount++;
                    return Promise.resolve(theScoreCallCount === 1 ? theScorePlayInResponse : theScoreRecentEvents);
                }
                return Promise.resolve(theScoreRecentEvents);
            },
        }));

        await run({ tournament: 'Development', dryRun: true });

        expect(mockSet).not.toHaveBeenCalled();
    });

    test('throws when all team lookups fail', async () => {
        const theScorePlayInResponse = [
            makeEvent({
                round: 1, homeRegion: 'South', awayRegion: 'South',
                homeSeed: 16, awaySeed: 16,
                homeTeam: { id: 10, short_name: 'SFU', medium_name: 'Saint Francis' },
                awayTeam: { id: 11, short_name: 'ALST', medium_name: 'Alabama State' },
            }),
        ];

        const ncaaScoreboardGames = [{
            bracketRegion: 'South',
            home: { seed: '1', names: { short: 'Auburn' } },
            away: { seed: '16', names: { short: 'TBD' } },
        }];

        // Return empty recent events so findTeamInEvents returns null
        let theScoreCallCount = 0;
        got.mockImplementation((url) => ({
            json: () => {
                if (url.includes('data.ncaa.com')) return Promise.resolve({ games: ncaaScoreboardGames });
                if (url.includes('api.thescore.com')) {
                    theScoreCallCount++;
                    return Promise.resolve(theScoreCallCount === 1 ? theScorePlayInResponse : []);
                }
                return Promise.resolve([]);
            },
        }));

        await expect(run({ tournament: 'Development', dryRun: false }))
            .rejects.toThrow('All 1 team lookup(s) failed');
        expect(mockSet).not.toHaveBeenCalled();
    });

    test('returns early when no play-in games found', async () => {
        // Return non-tournament games only
        got.mockImplementation(() => ({
            json: () => Promise.resolve([
                makeEvent({ round: 2, tournamentName: 'NIT' }),
            ]),
        }));

        await run({ tournament: 'Development', dryRun: false });

        expect(mockSet).not.toHaveBeenCalled();
    });
});
