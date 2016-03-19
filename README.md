A hobby project in which I integrate AngularJS with Firebase, to build a March Madness Pool site with a slightly different take on the normal rules.
This is basically just an excuse for me to learn AngularJS and get better at Javascript and CSS.

One-time Heroku setup:

* install the Heroku toolbelt (which includes the heroku CLI and foreman)
* upload public key file to heroku.com
* `heroku login`
* `heroku config:set FIREBASE_SECRET=... --remote heroku`

Deployment to heroku:

* `git commit ...`
* `git push heroku master`
* `heroku logs --tail --app pick100pool`

Deployment to heroku "dev" tier, from the local `dev` branch:

* `git push heroku-dev dev:master`
* `heroku logs --tail --app pick100pool-dev`

Building the server and client (optional, since all dependencies are checked in):
* `npm install`
* `bower install`

Running the full app locally:

* `export FIREBASE_SECRET=`<copied from https://pick100pool.firebaseio.com/?page=Admin>
* `node web.js` (or `foreman start`)

Running just the web server, without the back-end to fetch scores:

* `npm install -g http-server`
* `http-server client -p 5000`

Running just the backend program to fetch scores, teams, etc.:

* `node theScore.js`

https://devcenter.heroku.com/articles/git
