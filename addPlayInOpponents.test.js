// Mock got and tournamentConfig BEFORE requiring the module under test
jest.mock('got');
const mockSet = jest.fn().mockResolvedValue();
const mockChildFn = jest.fn();
const mockRef = jest.fn();

jest.mock('./tournamentConfig', () => ({
    FIREBASE_TOURNAMENT_ID: 'MarchMadness2026',
    TOURNAMENT_START_TIME: '2026-03-19T12:15:00-04:00',
    loginToFirebase: jest.fn().mockReturnValue({ ref: mockRef }),
    getTeamID: (team) => team.short_name + '_' + team.id,
}));

const got = require('got');
const {
    parseESPNPlayInOpponents,
    findTeamByName,
    buildFirebaseEntry,
    run,
} = require('./addPlayInOpponents');

function setupFirebaseChain() {
    const childObj = { set: mockSet, child: mockChildFn };
    mockChildFn.mockReturnValue(childObj);
    mockRef.mockReturnValue({ child: mockChildFn });
}

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

describe('run (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupFirebaseChain();
    });

    test('full flow: fetches ESPN TBD games, looks up teams in theScore, writes to Firebase', async () => {
        const espnDay1 = { events: [{
            competitions: [{
                notes: [{ headline: 'NCAA Men\'s Basketball Championship - South Region - 1st Round' }],
                competitors: [
                    { homeAway: 'home', curatedRank: { current: 1 }, team: { displayName: 'Florida Gators', shortDisplayName: 'Florida' } },
                    { homeAway: 'away', curatedRank: { current: 99 }, team: { displayName: 'TBD', shortDisplayName: 'TBD' } },
                ],
            }],
        }]};

        const espnDay2 = { events: [] };

        const theScoreTeams = [
            { id: 380, short_name: 'FLA', medium_name: 'Florida', name: 'Florida', conference: 'Southeastern' },
        ];

        let espnCallCount = 0;
        got.mockImplementation((url) => ({
            json: () => {
                if (url.includes('site.api.espn.com')) {
                    espnCallCount++;
                    return Promise.resolve(espnCallCount === 1 ? espnDay1 : espnDay2);
                }
                if (url.includes('api.thescore.com/ncaab/teams')) {
                    return Promise.resolve(theScoreTeams);
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            },
        }));

        await run({ tournament: 'Development', dryRun: false });

        expect(mockRef).toHaveBeenCalledWith('tournaments');
        expect(mockSet).toHaveBeenCalledWith({
            id: 'FLA_380',
            full_name: 'Florida',
            seed: 1,
            region: 'South',
            conference: 'Southeastern',
        });
    });

    test('dry-run mode does not write to Firebase', async () => {
        const espnResponse = { events: [{
            competitions: [{
                notes: [{ headline: 'NCAA Men\'s Basketball Championship - Midwest Region - 1st Round' }],
                competitors: [
                    { homeAway: 'home', curatedRank: { current: 1 }, team: { displayName: 'Michigan Wolverines', shortDisplayName: 'Michigan' } },
                    { homeAway: 'away', curatedRank: { current: 99 }, team: { displayName: 'TBD', shortDisplayName: 'TBD' } },
                ],
            }],
        }]};

        const theScoreTeams = [
            { id: 659, short_name: 'MICH', medium_name: 'Michigan', name: 'Michigan', conference: 'Big Ten' },
        ];

        got.mockImplementation((url) => ({
            json: () => {
                if (url.includes('site.api.espn.com')) return Promise.resolve(espnResponse);
                if (url.includes('api.thescore.com/ncaab/teams')) return Promise.resolve(theScoreTeams);
                return Promise.resolve({ events: [] });
            },
        }));

        await run({ tournament: 'Development', dryRun: true });

        expect(mockSet).not.toHaveBeenCalled();
    });

    test('throws when all team lookups fail', async () => {
        const espnDay1 = { events: [{
            competitions: [{
                notes: [{ headline: 'NCAA Men\'s Basketball Championship - South Region - 1st Round' }],
                competitors: [
                    { homeAway: 'home', curatedRank: { current: 1 }, team: { displayName: 'Florida Gators', shortDisplayName: 'Florida' } },
                    { homeAway: 'away', curatedRank: { current: 99 }, team: { displayName: 'TBD', shortDisplayName: 'TBD' } },
                ],
            }],
        }]};

        const espnDay2 = { events: [] };

        let espnCallCount = 0;
        got.mockImplementation((url) => ({
            json: () => {
                if (url.includes('site.api.espn.com')) {
                    espnCallCount++;
                    return Promise.resolve(espnCallCount === 1 ? espnDay1 : espnDay2);
                }
                if (url.includes('api.thescore.com/ncaab/teams')) return Promise.resolve([]);
                return Promise.resolve({ events: [] });
            },
        }));

        await expect(run({ tournament: 'Development', dryRun: false }))
            .rejects.toThrow('All 1 team lookup(s) failed');
        expect(mockSet).not.toHaveBeenCalled();
    });

    test('returns early when no TBD games found in ESPN data', async () => {
        const espnResponse = { events: [{
            competitions: [{
                notes: [{ headline: 'NCAA Men\'s Basketball Championship - East Region - 1st Round' }],
                competitors: [
                    { homeAway: 'home', curatedRank: { current: 1 }, team: { displayName: 'Duke Blue Devils', shortDisplayName: 'Duke' } },
                    { homeAway: 'away', curatedRank: { current: 16 }, team: { displayName: 'Siena Saints', shortDisplayName: 'Siena' } },
                ],
            }],
        }]};

        got.mockImplementation(() => ({
            json: () => Promise.resolve(espnResponse),
        }));

        await run({ tournament: 'Development', dryRun: false });

        expect(mockSet).not.toHaveBeenCalled();
    });
});
