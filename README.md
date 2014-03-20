A hobby project in which I integrate AngularJS with Firebase, to build a March Madness Pool site with a slightly different take on the normal rules. This is basically just an excuse for me to get a chance to play around with angular and get better at Javascript, since I'm mostly a server-side developer at work.

One-time heroku setup:

* upload public key file to heroku.com
* `heroku login`
* `heroku config:set FIREBASE_SECRET=...`

Deployment to heroku:

* `git commit ...`
* `git push heroku master`

https://devcenter.heroku.com/articles/git
