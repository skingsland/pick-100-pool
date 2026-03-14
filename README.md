A hobby project in which I integrate AngularJS with Firebase, to build a March Madness Pool site with a slightly different take on the normal rules.
This is basically just an excuse for me to learn AngularJS and get better at Javascript and CSS.

One-time Heroku setup:

* install the Heroku CLI: `brew tap heroku/brew && brew install heroku`
* `heroku login`
* upload public key file to heroku.com: `heroku config:set GOOGLE_AUTH_JSON=... --remote heroku`
* add the git remote: `heroku git:remote -a pick100pool`

Deployment to heroku:

* `git push heroku master`
* `heroku logs --tail --app pick100pool`

Deployment to heroku "dev" tier, from the local `dev` branch:

* `git push heroku-dev dev:master`
* `heroku logs --tail --app pick100pool-dev`

Building the server and client (optional, since all dependencies are checked in):
* `npm install`
* `bower install`

Running tests:
* `npm test` (unit and integration tests only)
* `GOOGLE_AUTH_JSON='...' npm test` (all tests, including end-to-end tests against the Firebase Development tournament)

Running E2E tests (Playwright):
* One-time setup: `npx playwright install chromium`
* One-time setup: populate the Testing tournament in Firebase: `GOOGLE_AUTH_JSON='...' npm run test:setup-fixtures`
* Create a `.env` file with `E2E_TEST_PASSWORD='<password for e2e-tests@pick100pool.com>'`
* `npm run test:e2e` (headless)
* `npm run test:e2e:headed` (visible browser)

Running the full app locally:

* `export GOOGLE_AUTH_JSON='<contents of service account's private key>'`
* `node web.js` (or `foreman start`)

Running just the web server, without the back-end to fetch scores:

* `npm install -g http-server`
* `http-server client -p 5001`
* Visit `http://localhost:5001` (loads the current production tournament)
* Add `?tournament=Testing` to load the E2E test tournament instead

Viewing different tournament scenarios locally:

One-time setup: `GOOGLE_AUTH_JSON='...' node e2e/fixtures/setup-scenario-tournaments.js`

* A copy of the 2025 tournament (17 pools, 104 brackets): `http://localhost:5001/?tournament=Testing_2025#/pools`
* Pre-tourney (no ceiling): `http://localhost:5001/?tournament=Testing_PreTourney#/pools`
* Day 1, no games played (max ceiling): `http://localhost:5001/?tournament=Testing_Day1#/pools`
* After Round 2 (mid-tournament): `http://localhost:5001/?tournament=Testing#/pools`
* After Round 5 (championship pending, one bracket with 0 teams): `http://localhost:5001/?tournament=Testing_Round5#/pools`
* Tournament over (no ceiling): `http://localhost:5001/?tournament=Testing_Final#/pools`

Running just the backend program to fetch scores, teams, etc.:

* `export GOOGLE_AUTH_JSON='<contents of service account's private key>'`
* `node theScore.js`

Adding play-in ("First Four") opponents to Firebase after Selection Sunday:

* `export GOOGLE_AUTH_JSON='<contents of service account's private key>'`
* `node addPlayInOpponents.js --dry-run` (preview what would be inserted)
* `node addPlayInOpponents.js` (write to production tournament)
* `node addPlayInOpponents.js --tournament Development` (write to Development tournament for testing)

The script tries to auto-detect C teams (the 1-seeds and 6-seeds that face play-in winners) from the NCAA scoreboard API. If that data isn't available yet, it falls back to interactive prompts where you type each team name manually.

Annual Selection Sunday checklist:

1. Update tournament constants in two files:
   * `tournamentConfig.js`: update `FIREBASE_TOURNAMENT_ID` (e.g. `MarchMadness2027`), `FIREBASE_TOURNAMENT_NAME`, `TOURNAMENT_START_TIME` (first game of Round 1, NOT the play-in round), and `TOURNAMENT_END_TIME` (day after the championship game)
   * `client/js/config.js`: update the year in the `FIREBASE_TOURNAMENT_ID` default fallback, and update `FINAL_FOUR_PAIRINGS` if the NCAA changes region names or pairings
   * Google "march madness first round tv schedule with times" to find the exact start time
   * Example commit: https://github.com/skingsland/pick-100-pool/commit/859e191bad4bb243e76bed6b9514bb868b75cbbe
2. Deploy to Heroku so `theScore.js` starts pulling teams: `git push heroku master`
3. Verify the 60 non-play-in teams appear in Firebase (usually by ~10pm ET on Selection Sunday)
4. Create pools: "Delta Phis", "Opower", "XP", "Ashlawn"
5. Run the admin script to add the play-in game opponents (the 1-seeds and 6-seeds that face play-in winners). This can run as soon as the bracket is announced on Selection Sunday; if the NCAA API doesn't have the data yet, the script falls back to interactive prompts.
   * `GOOGLE_AUTH_JSON='...' node addPlayInOpponents.js --dry-run` (preview)
   * `GOOGLE_AUTH_JSON='...' node addPlayInOpponents.js` (write to production)
   * Verify all 60 non-play-in teams now appear (56 from theScore.js + 4 play-in opponents from this script)

For the `GOOGLE_AUTH_JSON` contents, you can generate a new private key for the service account here:
https://console.firebase.google.com/project/pick100pool/settings/serviceaccounts/adminsdk

https://devcenter.heroku.com/articles/git
