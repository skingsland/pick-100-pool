'use strict';

angular.module('myApp.config', [])

   // where to redirect users if they need to authenticate (see module.routeSecurity)
   .constant('loginRedirectPath', '/login')
    // TODO: figure out where we're going to redirect users to if they aren't logged in,
    // since we won't have a separate login page
//   .constant('loginRedirectPath', '/home')

   .constant('FBURL', 'https://pick13pool.firebaseio.com')
   .constant('FIREBASE_TOURNAMENT_NAME', 'MarchMadness2013')
