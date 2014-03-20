var rest = require('restler');
var util = require('util');
var Q = require("q");
var Firebase = require('firebase');
var FirebaseTokenGenerator = require("firebase-token-generator");

var FIREBASE_TOURNAMENT_ID = 'MarchMadness2014';
var FIREBASE_TOURNAMENT_NAME = 'March Madness 2014';
var API_TOURNAMENT_NAME = 'NCAA Final 64';
var API_SITE = 'thescore';

function downloadGamesAndUpdateFirebase() {
    // to turn on logging in the firebase client
    //Firebase.enableLogging(true);

    // this is basically a "global variable", because it's needed by several of the functions below
    var tournamentRef = getTournamentRef(loginToFirebase());

    getLastRunDate()
        .then(downloadGamesFromAPI)
        .then(updateFirebaseWithGameData);

    // login and return a ref to the root of the firebase
    function loginToFirebase() {
        var firebase = new Firebase('https://pick100pool.firebaseio.com');
        var firebaseSecret = process.env.FIREBASE_SECRET;

        if (!firebaseSecret) throw new Error('You need to define an env. var called FIREBASE_SECRET');
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

        return tournamentRef;
    }

    function getLastRunDate() {
        var deferred = Q.defer();

        tournamentRef.child('last_run_date').once('value', function(snapshot) {
            deferred.resolve(snapshot.val());
        });
        return deferred.promise;
    }

    function downloadGamesFromAPI(lastRunDate) {
        var currentDate = convertDateToString(new Date());

        tournamentRef.update({last_run_date: currentDate});

        var eventsUrlForDate = getEventsUrlForDate(lastRunDate);

        var requestHeaders = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Encoding': 'gzip,deflate,sdch',
            'Accept-Language': 'en-US,en;q=0.8',
            'Connection': 'keep-alive',
            'Host': 'api.' + API_SITE + '.com',
            'If-Modified-Since': 'Mon, 13 Jan 2014 00:13:29 GMT',
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
        var eventsUrlTemplate = 'http://api.' + API_SITE + '.com/ncaab/events?game_date.in=%s,%s&conference=All+Conferences';

        // the API expects dates in UTC (not sure it supports different TZs), which is 4 hours ahead of EDT.
        // Thus 08:00 is 4am Eastern Time, and 1am Western Time. Thus the latest starting PDT game should have finished.
//        var startDateTime = '2014-03-20T08:00:00';

        // the start date is used to filter the game_date, but scores don't immediately appear after the game is finished,
        // so we subtract a few hours from the last run date, to make sure we get all completed games
        var lastRunDate = new Date(lastRunDateIsoString);
        lastRunDate.setHours(lastRunDate.getHours() - 4);
        var startDateIsoString = convertDateToString(lastRunDate);

        // the day after the final game
        var endDateTime = '2014-04-08T07:59:59';

        var eventsUrlForDate = util.format(eventsUrlTemplate, startDateIsoString, endDateTime);

        console.log('lastRunDate =', lastRunDateIsoString, '| startDateTime =', startDateIsoString, '| eventsUrlForDate =', eventsUrlForDate);

        return eventsUrlForDate;
    }

    function updateFirebaseWithGameData(games) {
        var numGamesUpdated = 0;
        console.log(games.length + ' games returned from firebase');

        games.forEach(function (game) {
            // is it a March Madness game, and has the tournament gotten past the play-in games, to the first round?
            if (game.tournament_name === API_TOURNAMENT_NAME && getRound(game) >= 1) {
                updateTeamInfo(game);
                updateGameInfo(game);
                numGamesUpdated++;
            }
        });
        console.log('Finished updating ' + numGamesUpdated + ' games in firebase, but the aysnchronous writes might still be happening in the background.');
    }

    function updateTeamInfo(game) {
        updateTeamInFirebase(game.home_team, getSeedForHomeTeam(game), game.home_region, game.home_conference, game);
        updateTeamInFirebase(game.away_team, getSeedForAwayTeam(game), game.away_region, game.away_conference, game);
    }

    function updateTeamInFirebase(team, seed, region, conference, game) {
        var teamInFirebase = tournamentRef.child('teams').child(team.name);
        var pointsForRound, winningTeam;

        // add the team to firebase, if it doesn't already exist
        teamInFirebase.transaction(function(currentValue) {
            // we're using the short name of the team as its ID, to make foreign keys in firebase more intuitive
            if (currentValue === null) {
                return {
                    id: team.name,
                    full_name: team.full_name,
                    seed: seed,
                    region: region,
                    conference: conference
                };
            }
        });

        // now add the points for the team winning or losing the round
        if (isGameOver(game)) {
            winningTeam = getWinningTeam(game);

            if(team.name === winningTeam.name) {
                pointsForRound = winningTeam.points_for_round;
            }
            else {
                pointsForRound = 0;
                teamInFirebase.update({is_eliminated: true});
            }
            teamInFirebase.child('rounds').child(getRound(game)).set(pointsForRound);
        }
    }

    // updates the game info in Firebase, based on what the API returned
    // NOTE:  this function doesn't bother checking to see if the data already exists in Firebase first, and just overwrites it each time.
    // The rationale being that reads need to happen synchronously, but writes can happen asynchronously in the background, so there's
    // no point in holding up the write to Firebase waiting on a read.
    function updateGameInfo(game) {
        var round = getRound(game);
        var gameId = game.away_team.name + '-' + game.home_team.name;
        var gameInFirebase, score;

        // not sure why the round number wouldn't exist, but we'll check just in case (should maybe throw an ex instead?)
        if (round) {
            gameInFirebase = tournamentRef.child('rounds').child(round).child('games').child(gameId);

            gameInFirebase.update({game_date: game.game_date});

            // is the game over, so we can record the score?
            if (isGameOver(game)) {
                score = game.box_score.score;

                gameInFirebase.update({score: score.away.score + '-' + score.home.score,
                                       winning_team: getWinningTeam(game)});
            }
        }
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
            winningTeam = {name: game.home_team.name, seed: getSeedForHomeTeam(game)};
        } else {
            winningTeam = {name: game.away_team.name, seed: getSeedForAwayTeam(game)};
        }
        winningTeam.points_for_round = getWinningTeamPointsForRound(winningTeam.seed, getRound(game));

        return winningTeam;
    }

    function getWinningTeamPointsForRound(teamSeed, roundNumber) {
        // the first round's bonus should be 1 point, which is 2^0, so subtract 1 from the round
        return teamSeed + Math.pow(2, roundNumber-1);
    }

    function getSeedForHomeTeam(game) {
        return game.home_ranking || game.top_25_rankings.home;
    }
    function getSeedForAwayTeam(game) {
        return game.away_ranking || game.top_25_rankings.away;
    }
}

try {
    // are we running in standalone mode, i.e. "node theScore.js", or being called as node module?
    if (require.main == module) {
        downloadGamesAndUpdateFirebase();

        // this process will never end, because of the socket connections that firebase creates. So we must forcibly end it,
        // after a 15 second delay to ensure all data has been written to firebase.
        setTimeout(function() {
            process.exit();
        }, 15000);
    } else {
        exports.downloadGamesAndUpdateFirebase = downloadGamesAndUpdateFirebase;
    }
} catch (err) {
    console.log(err);
}
