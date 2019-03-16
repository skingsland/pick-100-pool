'use strict';

angular.module('myApp.config', ['firebase'])
    .constant('version', '2.0.0')

   // where to redirect users if they need to authenticate (see myApp.security module)
   .constant('loginRedirectPath', '/login')

   .constant('FBURL', 'https://pick100pool.firebaseio.com')
   .constant('FIREBASE_TOURNAMENT_ID', 'MarchMadness2018')
   .constant('NUMBER_OF_TEAMS_PER_BRACKET', 13)
   .constant('SUM_OF_TEAM_SEEDS_PER_BRACKET', 100)

    // unsubscribe listeners when elements are destroyed
    .config(function ($provide) {
       $provide.decorator('$rootScope', ['$delegate', function ($delegate) {
          $delegate.constructor.prototype.$onRootScope = function (name, listener) {
             var unsubscribe = $delegate.$on(name, listener);
             this.$on('$destroy', unsubscribe);
          };
          return $delegate;
       }]);
    })

    // TODO: technically this probably belongs in another module, but not sure which one
    .run(['firebase', function(firebase) {
        // un-comment this to enable debug logging in the web console, across page refreshes
        // firebase.database.enableLogging(true, true);
        firebase.database.enableLogging(false);

        var config = {
            // This "apiKey" is NOT private. It identifies the firebase client to the auth server, and is public.
            // See https://firebase.google.com/docs/web/setup#add_firebase_to_your_app for more details, as well as
            // https://stackoverflow.com/questions/37482366/is-it-safe-to-expose-firebase-apikey-to-the-public
            apiKey: "AIzaSyCGbqCxT0a5xeDhhzBvfjXCCw1mKbDKqzM",
            authDomain: "pick100pool.firebaseapp.com",
            databaseURL: 'https://pick100pool.firebaseio.com',
            projectId: "pick100pool"
            // storageBucket: "pick100pool.appspot.com",
            // messagingSenderId: "1046441132702"
        };

        firebase.initializeApp(config);
    }]);
