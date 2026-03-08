// Shared tournament constants and helpers used by theScore.js and addPlayInOpponents.js

var firebaseAdminSdk = require('firebase-admin');

var FIREBASE_TOURNAMENT_ID = 'MarchMadness2026';
var FIREBASE_TOURNAMENT_NAME = 'March Madness 2026';

// the date and time of the first game in the second (i.e NOT play-in or "first four") round; brackets are read-only after this
var TOURNAMENT_START_TIME = '2026-03-19T12:15:00-04:00'; // UTC-4 is EDT
// the day AFTER the final game, so we don't miss pulling the score for the final game
var TOURNAMENT_END_TIME = '2026-04-07T12:00:00-04:00';

var API_TOURNAMENT_NAME = "NCAA Men's Division I Basketball Tournament";

function loginToFirebase() {
    var googleAuthJson = process.env.GOOGLE_AUTH_JSON;
    if (!googleAuthJson) throw new Error('The $GOOGLE_AUTH_JSON environment variable was not found!');

    return firebaseAdminSdk.initializeApp({
        credential: firebaseAdminSdk.credential.cert(JSON.parse(googleAuthJson)),
        databaseURL: "https://pick100pool.firebaseio.com"
    }).database();
}

function getTeamID(team) {
    return team.short_name + '_' + team.id;
}

function getRound(game) {
    return (game.round || game.playoff.round) - 1;
}

module.exports = {
    FIREBASE_TOURNAMENT_ID,
    FIREBASE_TOURNAMENT_NAME,
    TOURNAMENT_START_TIME,
    TOURNAMENT_END_TIME,
    API_TOURNAMENT_NAME,
    loginToFirebase,
    getTeamID,
    getRound,
};
