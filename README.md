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

Running just the backend program to fetch scores, teams, etc.:

* `export GOOGLE_AUTH_JSON='<contents of service account's private key>'`
* `node theScore.js`

Adding play-in ("First Four") opponents to Firebase after Selection Sunday:

* `export GOOGLE_AUTH_JSON='<contents of service account's private key>'`
* `node addPlayInOpponents.js --dry-run` (preview what would be inserted)
* `node addPlayInOpponents.js` (write to production tournament)
* `node addPlayInOpponents.js --tournament Development` (write to Development tournament for testing)

The script tries to auto-detect C teams (the 1-seeds and 6-seeds that face play-in winners) from the NCAA scoreboard API. If that data isn't available yet, it falls back to interactive prompts where you type each team name manually.

For the `GOOGLE_AUTH_JSON` contents, you can generate a new private key for the service account here: 
https://console.firebase.google.com/project/pick100pool/settings/serviceaccounts/adminsdk

https://devcenter.heroku.com/articles/git
