'use strict';

angular.module('myApp.config', [])

   // where to redirect users if they need to authenticate (see module.routeSecurity)
   .constant('loginRedirectPath', '/login')
    // TODO: figure out where we're going to redirect users to if they aren't logged in,
    // since we won't have a separate login page
//   .constant('loginRedirectPath', '/home')

   .constant('FBURL', 'https://pick100pool.firebaseio.com')
   .constant('FIREBASE_TOURNAMENT_NAME', 'MarchMadness2013')
   .constant('NUMBER_OF_TEAMS_PER_BRACKET', 13)
   .constant('SUM_OF_TEAM_SEEDS_PER_BRACKET', 100)
