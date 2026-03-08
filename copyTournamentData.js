// One-off script: copy team data from one tournament to another in Firebase.
// Usage: GOOGLE_AUTH_JSON='...' node copyTournamentData.js <source> <dest>
// Example: node copyTournamentData.js MarchMadness2026 Development

var { FIREBASE_TOURNAMENT_ID, loginToFirebase } = require('./tournamentConfig');

var firebase = loginToFirebase();

var source = process.argv[2] || FIREBASE_TOURNAMENT_ID;
var dest = process.argv[3] || 'Development';

console.log(`Copying teams from ${source} to ${dest}...`);

firebase.ref(`tournaments/${source}/teams`).once('value', function(snapshot) {
    var teams = snapshot.val();
    if (!teams) {
        console.log('No teams found in source tournament!');
        process.exit(1);
    }

    var count = Object.keys(teams).length;
    console.log(`Found ${count} teams. Writing to ${dest}...`);

    firebase.ref(`tournaments/${dest}/teams`).set(teams, function(err) {
        if (err) {
            console.error('Write failed:', err);
            process.exit(1);
        }
        console.log(`Done! Copied ${count} teams to ${dest}.`);
        setTimeout(() => process.exit(), 2000);
    });
});
