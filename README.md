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

Running the full app locally:

* `export GOOGLE_AUTH_JSON=`<contents of service account's private key>
* `node web.js` (or `foreman start`)

Running just the web server, without the back-end to fetch scores:

* `npm install -g http-server`
* `http-server client -p 5000`

Running just the backend program to fetch scores, teams, etc.:

* `export GOOGLE_AUTH_JSON='<contents of service account's private key>'`
* `node theScore.js`

You can generate a new private key for the service account here: 
https://console.firebase.google.com/project/pick100pool/settings/serviceaccounts/adminsdk

https://devcenter.heroku.com/articles/git
