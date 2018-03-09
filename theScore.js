var rest = require('restler');
var util = require('util');
var Q = require("q");
var Firebase = require('firebase');
var moment = require('moment');

var API_TOURNAMENT_NAME = 'NCAA Final 64';
var API_SITE = 'thescore';

var FIREBASE_TOURNAMENT_ID = 'MarchMadness2018';
var FIREBASE_TOURNAMENT_NAME = 'March Madness 2018';

// the date and time of the first game in the second (i.e NOT play-in or "first four") round; brackets are read-only after this
var TOURNAMENT_START_TIME = '2018-03-15T12:00:00-04:00'; // UTC-4 is EDT
// the day after the final game, so we don't miss pulling the score for the final game
var TOURNAMENT_END_TIME = '2018-04-02T12:00:00-04:00';

function downloadGamesAndUpdateFirebase() {
    var tournamentRef;
    var allBracketsSnapshot;

    // login and return a ref to the root of the firebase
    function loginToFirebase() {
        var firebase = new Firebase('https://pick100pool.firebaseio.com');
        var firebaseSecret = process.env.FIREBASE_SECRET;

        if (!firebaseSecret) throw new Error('You need to define an environment variable called FIREBASE_SECRET');
        firebase.auth(firebaseSecret);

        return firebase;
    }

    // this creates the tournament in Firebase, if it doesn't already exist
    function getTournamentRef(firebase) {
        var tournamentRef = firebase.child('tournaments').child(FIREBASE_TOURNAMENT_ID);

        // example of conditionally setting a value in firebase, only if it doesn't already exist
        // (The reason for doing this is purely to save on calls to the firebaseio server.)
        tournamentRef.child('name').transaction(function (currentValue) {
            if (currentValue === null) return FIREBASE_TOURNAMENT_NAME;
        });
        tournamentRef.child('start_time').transaction(function (currentValue) {
            if (currentValue === null) return TOURNAMENT_START_TIME;
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
            //console.log('Found', snapshot.numChildren(), 'bracket(s) in the tournament.');

            allBracketsSnapshot = snapshot;
            deferred.resolve();
        });
        return deferred.promise;
    }

    function downloadGamesFromAPI(lastRunDateIsoString) {
        var currentDate = convertDateToString(new Date());

        tournamentRef.update({last_run_date: currentDate});

        var eventsUrlForDate = getEventsUrlForDate(lastRunDateIsoString);

        var requestHeaders = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Encoding': 'gzip,deflate,sdch',
            'Accept-Language': 'en-US,en;q=0.8',
            'Connection': 'keep-alive',
            'Host': 'api.' + API_SITE + '.com',
            'If-Modified-Since': new Date(lastRunDateIsoString).toUTCString(),
            'Origin': 'http://www.' + API_SITE + '.com',
            'Referer': 'http://www.' + API_SITE + '.com/ncaab/events/day/' + currentDate + '/Top%2025',
            'User-Agent':
        'Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_2 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8H7 Safari/6533.18.5',
            'X-Api-Version': '1.6.17',
            'X-Country-Code': 'CA'
        };

        var deferred = Q.defer();

        rest.get(eventsUrlForDate, {timeout: 10000, headers: requestHeaders}).on('complete', function(result) {
            if (result instanceof Error) {
                console.log('api call returned with error result:' + result);
                deferred.reject(result);
            } else {
                deferred.resolve(result);
            }
        });

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
        var numGamesUpdated = 0;

        console.log(games.length + ' games returned from API.');

        // if there are no games found, the rest.get() call returns an empty string instead of an array, without a forEach() function
        if (games.length > 0) {
            games.forEach(function (game) {
                // don't store results for play-in games, because teams don't participate in brackets until they've won the play-in,
                // and they don't earn any points for winning a play-in game
                if(game.tournament_name === API_TOURNAMENT_NAME && getRound(game) > 0) {
                    updateTeamInfo(game);
                    updateGameInfo(game);
                    updateAllBrackets(game);

                    numGamesUpdated++;
                }
            });

            console.log('Finished updating ' + numGamesUpdated + ' games in firebase, but the asynchronous writes might still be happening in the background.');
        }

        updateNewAndChangedBrackets();
    }

    function updateTeamInfo(game) {
        updateTeamInFirebase(game.home_team, getSeedForHomeTeam(game), game.home_region, game.home_conference, game);
        updateTeamInFirebase(game.away_team, getSeedForAwayTeam(game), game.away_region, game.away_conference, game);
    }

    function updateTeamInFirebase(team, seed, region, conference, game) {
        addTeamToFirebaseIfNotExists(team, seed, region, conference).then(function() {
            var teamInFirebase = tournamentRef.child('teams').child(team.short_name);
            var pointsForRound, winningTeam;

            // now add the points for the team winning or losing the round
            if (isGameOver(game)) {
                winningTeam = getWinningTeam(game);

                if (team.short_name === winningTeam.short_name) {
                    pointsForRound = winningTeam.points_for_round;

                    // console.log(team.name, "won round", getRound(game), "for", pointsForRound, "points");
                }
                else {
                    pointsForRound = 0;
                    teamInFirebase.update({is_eliminated: true});

                    // console.log(team.name, "is eliminated in round", getRound(game));
                }
                teamInFirebase.child('rounds').child(getRound(game)).set(pointsForRound);
            }
        })
    }

    function addTeamToFirebaseIfNotExists(team, seed, region, conference) {
        var deferred = Q.defer();

        var teamInFirebase = tournamentRef.child('teams').child(team.short_name);
        
        teamInFirebase.once('value', function(teamSnapshot) {
            if (!teamSnapshot.exists()) {
                console.log('team', teamSnapshot.key(), 'is new and will be added to the list of teams in firebase!');

                // we're using the short name of the team as its ID, to make foreign keys in firebase more intuitive
                teamInFirebase.set({
                    id: team.short_name,
                    full_name: team.full_name,
                    seed: seed,
                    region: region,
                    conference: conference
                });
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
        var gameId = game.away_team.short_name + '-' + game.home_team.short_name;
        var gameInFirebase, score;

        gameInFirebase = tournamentRef.child('rounds').child(round).child('games').child(gameId);

        gameInFirebase.update({game_date: game.game_date});

        // is the game over, so we can record the score?
        if (isGameOver(game)) {
            score = game.box_score.score;

            gameInFirebase.update({score: score.away.score + '-' + score.home.score,
                                   winning_team: getWinningTeam(game)});
        }
    }

    function updateAllBrackets(game) {
        var round = getRound(game);

        if (isGameOver(game) && round) {

            // find all brackets that contain the winning team, and recalculate their points for the round
            allBracketsSnapshot.forEach(function(bracket) {

                bracket.child('teams').forEach(function (bracketTeam) {

                    // if the bracket contains one of the teams that just finished the game, update the bracket's total points
                    // for this round (if the team won) and num_teams_remaining (if the team lost)
                    if(game.home_team.short_name === bracketTeam.val() || game.away_team.short_name === bracketTeam.val()) {
                        updatePointsForBracket(bracket, round);
                    }
                });
            });
        }
    }

    function updatePointsForBracket(bracket, round) {
        var totalBracketPointsForRoundRef = bracket.child('total_bracket_points_for_round').ref();
        var totalBracketPointsForRound = 0;
        var totalBracketPoints = 0;
        var numTeamsRemaining = 0;

        tournamentRef.child('teams').once('value', function(allTeamsSnapshot) {
            bracket.child('teams').forEach(function (teamId) {
                var team = allTeamsSnapshot.child(teamId.val());

                if (!team.exists()) {
                    console.log('ERROR: found team', teamId.val(), 'in bracket', bracket.val().name, 'that does not exist in tourney!');
                    return;
                }

                var teamPointsForRound = team.child('/rounds/' + round).val();
                totalBracketPointsForRound += teamPointsForRound || 0;

                console.log('updatePointsForBracket() for bracket =', bracket.val().name,
                            'round =', round,
                            'team =', team.val().id,
                            'teamPointsForRound =', team.child('/rounds/' + round).val(),
                            'is_eliminated =', team.child('is_eliminated').val());

                // console.log('team =', team.val());

                if (!team.child('is_eliminated').val()) {
                    // console.log('is_eliminated != true');
                    numTeamsRemaining++;
                }
            });

            totalBracketPointsForRoundRef.child(round).set(totalBracketPointsForRound);

            bracket.child('num_teams_remaining').ref().set(numTeamsRemaining);
            console.log('updated bracket', bracket.val().name, 'to have', numTeamsRemaining, 'teams remaining');

            // now recalculate the bracket's *total* points
            totalBracketPointsForRoundRef.once('value', function (rounds) {
                rounds.forEach(function (pointsForRound) {
                    totalBracketPoints += pointsForRound.val() || 0;
                });
                console.log('updating bracket', bracket.val().name, 'to have', totalBracketPoints, 'totalPoints');
                bracket.child('totalPoints').ref().set(totalBracketPoints);
            });
        });
    }

    function updateNewAndChangedBrackets() {
        allBracketsSnapshot.forEach(function (bracketSnapshot) {
            var bracket = bracketSnapshot.val();

            if (bracket.isNewOrUpdated) {
                console.log('updating points for new/changed bracket:', bracket.name);

                // we have to (re)calculate the points for each round
                tournamentRef.child('rounds').on('child_added', function (round) {
                    updatePointsForBracket(bracketSnapshot, round.key());
                });

                // clear the flag when we're done, so we don't have to do this update next time
                bracketSnapshot.child('isNewOrUpdated').ref().remove();
            }
        });
    }

    // HELPER FUNCTIONS

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
            winningTeam = {short_name: game.home_team.short_name, seed: getSeedForHomeTeam(game)};
        } else {
            winningTeam = {short_name: game.away_team.short_name, seed: getSeedForAwayTeam(game)};
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
    tournamentRef = getTournamentRef(loginToFirebase());

    fetchAllBrackets()
        .then(getLastRunDate)
        .then(downloadGamesFromAPI)
        .then(updateFirebaseWithGameData);
}

try {
    // are we running in standalone mode, i.e. "node theScore.js"
    if (require.main == module) {
        downloadGamesAndUpdateFirebase();

        // this process will never end, because of the socket connections that firebase creates. So we must forcibly end it,
        // after a 15 second delay to ensure all data has been written to firebase.
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
