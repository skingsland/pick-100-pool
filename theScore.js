var got = require('got');
var util = require('util');
var Q = require("q");
const firebaseAdminSdk = require('firebase-admin');
var moment = require('moment');

var API_TOURNAMENT_NAME = "NCAA Men's Division I Basketball Tournament";
var API_SITE = 'thescore';

var FIREBASE_TOURNAMENT_ID = 'MarchMadness2022';
var FIREBASE_TOURNAMENT_NAME = 'March Madness 2022';

// the date and time of the first game in the second (i.e NOT play-in or "first four") round; brackets are read-only after this
var TOURNAMENT_START_TIME = '2022-03-17T12:00:00-04:00'; // UTC-4 is EDT
// the day AFTER the final game, so we don't miss pulling the score for the final game
var TOURNAMENT_END_TIME = '2022-04-05T12:00:00-04:00';

const firebaseDatabaseRef = loginToFirebase();

// login and return a ref to the root of the firebase
function loginToFirebase() {
    // JSON stored in this env variable must come from Firebase Admin SDK service account private key:
    // https://console.firebase.google.com/project/pick100pool/settings/serviceaccounts/adminsdk
    const googleAuthJson = process.env.GOOGLE_AUTH_JSON;
    if (!googleAuthJson) throw new Error('The $GOOGLE_AUTH_JSON environment variable was not found!');

    return firebaseAdminSdk.initializeApp({
        credential: firebaseAdminSdk.credential.cert(JSON.parse(googleAuthJson)),
        databaseURL: "https://pick100pool.firebaseio.com"
    }).database();
}

function downloadGamesAndUpdateFirebase() {
    var tournamentRef;
    var allBracketsSnapshot;

    // this creates the tournament in Firebase, if it doesn't already exist
    function getTournamentRef(firebase) {
        var tournamentRef = firebase.ref('tournaments').child(FIREBASE_TOURNAMENT_ID);

        // example of conditionally setting a value in firebase, only if it doesn't already exist
        // (The reason for doing this is purely to save on calls to the firebaseio server.)
        tournamentRef.child('name').transaction(function (currentValue) {
            return currentValue || FIREBASE_TOURNAMENT_NAME;
        });
        tournamentRef.child('start_time').transaction(function (currentValue) {
            return currentValue || TOURNAMENT_START_TIME;
        });

        return tournamentRef;
    }

    function getLastRunDate() {
        var deferred = Q.defer();

        tournamentRef.child('last_run_date').once('value', function(snapshot) {
            deferred.resolve(snapshot.val());
        });
        return deferred.promise;
    }

    function fetchAllBrackets() {
        var deferred = Q.defer();

        tournamentRef.child('brackets').once('value', function(snapshot) {
            console.log('Found', snapshot.numChildren(), 'bracket(s) in the tournament.');

            allBracketsSnapshot = snapshot;
            deferred.resolve();
        });
        return deferred.promise;
    }

    function downloadGamesFromAPI(lastRunDateIsoString) {
        var deferred = Q.defer();

        try {
            var currentDate = convertDateToString(new Date());
            tournamentRef.update({last_run_date: currentDate});

            var eventsUrlForDate = getEventsUrlForDate(lastRunDateIsoString);

            got(eventsUrlForDate).json().then(function(response) {
                deferred.resolve(response);
            }).catch(function(error) {
                console.log('API call returned with error result:' + error.response.body);
                deferred.reject(error.response.body);
            });
        }
        catch(error) {
            console.error(error);
            deferred.reject(error);
        }

        return deferred.promise;
    }

    function convertDateToString(date) {
        // strip off the milliseconds and the following "Z" (e.g. ".857Z"), by getting rid of the period (".") and everything after it
        return date.toISOString().replace(/\..+/, '');
    }

    function getEventsUrlForDate(lastRunDateIsoString) {
        var eventsUrlTemplate = 'http://api.' + API_SITE + '.com/ncaab/events?game_date.in=%s,%s&conference=NCAA%20Tournament';
        var startDateIsoString;
        var endDateIsoString = TOURNAMENT_END_TIME; // the end of the date range to fetch games, teams, scores, etc. for

        if (lastRunDateIsoString) {
            var lastRunDate = new Date(lastRunDateIsoString);

            // if we're running BEFORE the tournament has started, then use the tournament start date (the date of the first game)
            // also do the same for running AFTER the tourney ended, which is common when testing using last year's data
            if (lastRunDate < new Date(TOURNAMENT_START_TIME) || lastRunDate > new Date(TOURNAMENT_END_TIME)) {
                startDateIsoString = TOURNAMENT_START_TIME;
            } else {
                // The start date is used to filter the game_date (which is the date and time the game STARTED),
                // but scores don't immediately appear after the game is finished,
                // so we subtract several hours from the last run date to make sure we get ALL completed games.
                // There is extra buffer built in as well to handle delayed games, since we query by the *scheduled* start time.
                lastRunDate.setHours(lastRunDate.getHours() - 5);

                // format the start date as a proper ISO 8601 date with a UTC offset, because the API expects it that way
                startDateIsoString = moment(lastRunDate).format();
            }
        } else {
            // else if the last run date is null, it means this is the first time we're downloading scores for this tournament.
            // So download scores for all games in the tournament, starting just before the tourney began.
            startDateIsoString = TOURNAMENT_START_TIME;
        }

        // for testing:
        // startDateIsoString = '2015-03-16T08:00:00-04:00';
        // endDateIsoString = '2015-03-20T08:00:00-04:00';
        
        var eventsUrlForDate = util.format(eventsUrlTemplate, startDateIsoString, endDateIsoString);

        console.log('lastRunDate =', lastRunDateIsoString, '| startDateTime =', startDateIsoString, '| eventsUrlForDate =', eventsUrlForDate);

        return eventsUrlForDate;
    }

    function updateFirebaseWithGameData(games) {
        try {
            console.log(games.length + ' games returned from API.');

            for (i = 0; i < games.length; i++) {
            // for (i = 0; i < 10; i++) {
                game = games[i];
                console.log('downloaded game #', i, game.home_region, 'region game from API with date:', game.game_date);

                // don't store results for play-in games, because teams don't participate in brackets until they've won the play-in,
                // and they don't earn any points for winning a play-in game
                if (game.tournament_name === API_TOURNAMENT_NAME && getRound(game) > 0) {
                    updateFirebaseForGame(game);
                }
            }

            // this would need to wait for a promise that resolves when all the game updates are done above, to have numGamesUpdated be the correct number
            // console.log('Finished updating ' + numGamesUpdated + ' games in firebase, but the asynchronous writes might still be happening in the background.');

            // TODO: how do we know that the team updates above are complete, before updating new or changed brackets?
            updateNewAndChangedBrackets();
        }
        catch(error) {
            console.error(error);
        }
    }

    function updateFirebaseForGame(game) {
        // In the hours after selection sunday, the tourney seed ("away_ranking", "home_ranking", and "top_25_rankings"
        // fields) is null in the API, for many of the teams.
        // It eventually gets filled in later, so we wait to update firebase until we've got the seed for both teams.
        if (getSeedForHomeTeam(game) && getSeedForAwayTeam(game)) {
            // even if the game hasn't happened yet, we still want to update the list of teams and games
            updateTeamInfo(game).then(function() {
                updateGameInfo(game);

                // but brackets are only updated after the game is over
                if (isGameOver(game)) {
                    updateAllBrackets(game);
                }
            });
        } else {
            console.log('ERROR: this game has no seed for the home and/or away team:', game);
        }
    }

    function updateTeamInfo(game) {
        return Q.all([
            updateTeamInFirebase(game.home_team, getSeedForHomeTeam(game), game.home_region, game.home_conference, game),
            updateTeamInFirebase(game.away_team, getSeedForAwayTeam(game), game.away_region, game.away_conference, game)
        ]);
    }

    function updateTeamInFirebase(team, seed, region, conference, game) {
        const deferred = Q.defer();

        addTeamToFirebaseIfNotExists(team, seed, region, conference).then(function() {
            var teamInFirebaseRef = tournamentRef.child('teams').child(getTeamID(team));
            var pointsForRound, winningTeam;

            // now add the points for the team winning or losing the round
            if (isGameOver(game)) {
                winningTeam = getWinningTeam(game);

                if (getTeamID(team) === getTeamID(winningTeam)) {
                    pointsForRound = winningTeam.points_for_round;

                    console.log(team.name, "won round", getRound(game), "for", pointsForRound, "points");
                }
                else {
                    pointsForRound = 0;
                    teamInFirebaseRef.update({is_eliminated: true});

                    console.log(team.name, "is eliminated in round", getRound(game));
                }

                // TODO: figure out why this sometimes overwrites the team's points from earlier rounds
                teamInFirebaseRef.child('rounds').child(getRound(game)).set(pointsForRound);
            }
            deferred.resolve();
        })

        return deferred.promise;
    }

    function addTeamToFirebaseIfNotExists(team, seed, region, conference) {
        var deferred = Q.defer();

        var teamId = getTeamID(team);
        console.log('checking to see whether team exists in firebase:', teamId);

        var teamInFirebase = tournamentRef.child('teams').child(teamId);

        teamInFirebase.once('value', function(teamSnapshot) {
            // I don't know why, but for some reason the conference field wasn't set correctly for about half of the teams
            // when they were first loaded on 3/17/2019, so I added this check to make sure we update them.
            if (!teamSnapshot.exists() || teamSnapshot.val().conference !== conference || teamSnapshot.val().full_name !== team.medium_name) {
                console.log('team', teamSnapshot.key, 'is new and will be added to the list of teams in firebase, or needs to be updated');

                teamInFirebase.set({
                    id: teamId,
                    full_name: team.medium_name,
                    seed: seed,
                    region: region,
                    conference: conference
                });
            }
            else {
                console.log('team', teamSnapshot.key, 'already exists in firebase, so will not be updated.');
            }

            deferred.resolve();
        });

        return deferred.promise;
    }

    // updates the game info in Firebase, based on what the API returned
    // NOTE:  this function doesn't bother checking to see if the data already exists in Firebase first, and just overwrites it each time.
    // The rationale being that reads need to happen synchronously, but writes can happen asynchronously in the background, so there's
    // no point in holding up the write to Firebase waiting on a read.
    function updateGameInfo(game) {
        var round = getRound(game);
        var gameId = getTeamID(game.away_team) + '-' + getTeamID(game.home_team);
        var gameInFirebase, score;

        gameInFirebase = tournamentRef.child('rounds').child(round).child('games').child(gameId);

        console.log('updating game', gameId, 'for round', getRound(game))
        gameInFirebase.update({game_date: game.game_date});

        // is the game over, so we can record the score?
        if (isGameOver(game)) {
            score = game.box_score.score;

            console.log('updating completed game', gameId, 'for round', getRound(game))
            gameInFirebase.update({score: score.away.score + '-' + score.home.score,
                                   winning_team: getWinningTeam(game)});
        }
    }

    function updateAllBrackets(game) {
        const round = getRound(game);

        tournamentRef.child('teams').once('value', function(allTeamsSnapshot) {
            // find all brackets that contain either the winning or losing team
            allBracketsSnapshot.forEach(function(bracketSnapshot) {
                bracketSnapshot.child('teams').forEach(function (bracketTeam) {
                    // if the bracket contains one of the teams that just finished the game, update the bracket's total points
                    // for this round (if the team won) and num_teams_remaining (if the team lost)
                    if (getTeamID(game.home_team) === bracketTeam.val() || getTeamID(game.away_team) === bracketTeam.val()) {
                        // console.log('updating points for bracket:', bracketSnapshot.val().name, 'and round:', round,
                        //     'home_team:', game.home_team.short_name, 'away_team:', game.away_team.short_name,
                        //     'bracketTeam:', bracketTeam.val());

                        updatePointsForBracket(allTeamsSnapshot, bracketSnapshot, round);
                    }
                });
            });
        });
    }

    function updatePointsForBracket(allTeamsSnapshot, bracketSnapshot, round) {
        const bracketName = bracketSnapshot.val().name;
        var totalBracketPointsForRoundRef = bracketSnapshot.child('total_bracket_points_for_round').ref;
        var totalBracketPointsForRound = 0;
        var numTeamsRemaining = 0;

        // calculate the bracket's total points for the round, and number of teams remaining (not eliminated)
        bracketSnapshot.child('teams').forEach(function (teamId) {
            var team = allTeamsSnapshot.child(teamId.val());

            if (!team.exists()) {
                console.log('ERROR: found team', teamId.val(), 'in bracket', bracketName, 'that does not exist in tourney!');
                return;
            }

            var teamPointsForRound = team.child('/rounds/' + round).val();
            totalBracketPointsForRound += teamPointsForRound || 0;
            var isTeamEliminated = team.child('is_eliminated').val();

            // console.log('updatePointsForBracket() for bracket =', bracketName,
            //             ', round =', round,
            //             ', team =', team.val().id,
            //             ', teamPointsForRound =', teamPointsForRound,
            //             ', is_eliminated =', isTeamEliminated);

            if (!isTeamEliminated) {
                numTeamsRemaining++;
            }
        });

        totalBracketPointsForRoundRef.child(round).set(totalBracketPointsForRound);
        bracketSnapshot.child('num_teams_remaining').ref.set(numTeamsRemaining);

        console.log('updated bracket', bracketName, 'to have', totalBracketPointsForRound, 'points for round', round,
            'and', numTeamsRemaining, 'teams remaining');

        // now recalculate the bracket's *total* points, by summing the points for all rounds
        totalBracketPointsForRoundRef.once('value', function (rounds) {
            var totalBracketPoints = 0;

            rounds.forEach(function (pointsForRound) {
                totalBracketPoints += pointsForRound.val() || 0;
            });

            bracketSnapshot.child('totalPoints').ref.set(totalBracketPoints);
            console.log('updated bracket', bracketName, 'to have', totalBracketPoints, 'totalPoints for all rounds');
        });
    }

    function updateNewAndChangedBrackets() {
        tournamentRef.child('teams').once('value', function(allTeamsSnapshot) {
            allBracketsSnapshot.forEach(function (bracketSnapshot) {
                var bracket = bracketSnapshot.val();

                // this flag is set by the front-end when a new bracket is added or updated, so we know to (re)calculate its points
                if (bracket.isNewOrUpdated) {
                    console.log('updating points for new/changed bracket:', bracket.name);

                    // we have to (re)calculate the points for each round
                    tournamentRef.child('rounds').on('child_added', function (round) {
                        console.log('recalculating points for bracket:', bracket.name, 'and round:', round.key);
                        updatePointsForBracket(allTeamsSnapshot, bracketSnapshot, round.key);
                    });

                    // clear the flag when we're done, so we don't have to do this update next time
                    bracketSnapshot.child('isNewOrUpdated').ref.remove();
                }
            });
        });
    }

    // HELPER FUNCTIONS

    function getTeamID(team) {
        // Use the short name of the team as its ID, to make foreign keys in firebase more intuitive;
        // however some teams share the same short name (e.g. San Diego State U and South Dakota State U),
        // so append the team's id from the API to ensure the ID is unique. We can't use the medium or full name,
        // since that can contain periods (e.g. "N.C. State") which aren't allowed in firebase paths.
        return team.short_name + '_' + team.id;
    }

    function getRound(game) {
        // the play-in game is returned as round 1 from the API, so we need to subtract 1 from the round number,
        // so the first real tournament game that we store in firebase will be round 1 (instead of round 2)
        return (game.round || game.playoff.round) - 1;
    }

    function isGameOver(game) {
        return game.event_status === 'final' && game.box_score !== null;
    }

    function getWinningTeam(game) {
        var score = game.box_score.score;
        var winningTeam;

        if (score.home.score > score.away.score) {
            winningTeam = {id: game.home_team.id, short_name: game.home_team.short_name, seed: getSeedForHomeTeam(game)};
        } else {
            winningTeam = {id: game.away_team.id, short_name: game.away_team.short_name, seed: getSeedForAwayTeam(game)};
        }
        winningTeam.points_for_round = getWinningTeamPointsForRound(winningTeam.seed, getRound(game));

        return winningTeam;
    }

    function getWinningTeamPointsForRound(teamSeed, roundNumber) {
        // round 0 is the play-in round, so no points should be awarded
        if (roundNumber === 0) {
            return 0;
        }

        // round 1 = 1 point, 2 = 2 points, 3 = 4 points, 4 = 8 points, etc.
        var bonusForRound = Math.pow(2, roundNumber-1);

        return teamSeed + bonusForRound;
    }

    function getSeedForHomeTeam(game) {
        return game.home_ranking || game.top_25_rankings.home;
    }
    function getSeedForAwayTeam(game) {
        return game.away_ranking || game.top_25_rankings.away;
    }


    // to turn on logging in the firebase client
    // Firebase.enableLogging(true);

    // this is basically a "global variable", because it's needed by several of the functions above
    tournamentRef = getTournamentRef(firebaseDatabaseRef);

    fetchAllBrackets()
        .then(getLastRunDate)
        .then(downloadGamesFromAPI)
        .then(updateFirebaseWithGameData);
}

try {
    // are we running in standalone mode, i.e. "node theScore.js"
    if (require.main === module) {
        downloadGamesAndUpdateFirebase();

        // This process will never end, because of the socket connections that firebase creates. So we must forcibly end it,
        // after a 15 second delay to ensure all data has been written to firebase. We can't call firebase.unauth(), since we
        // don't know when the background writes to the database finish, and if we unauth too soon we'll get PERMISSION_DENIED errors.
        setTimeout(function() {
            process.exit();
        }, 15000);
    } else {
        // else we're being called as node module
        exports.downloadGamesAndUpdateFirebase = downloadGamesAndUpdateFirebase;
    }
} catch (err) {
    console.log(err);
}
