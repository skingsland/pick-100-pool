'use strict';

angular.module('myApp.config', [])

   // where to redirect users if they need to authenticate (see module.routeSecurity)
   .constant('loginRedirectPath', '/login')

   .constant('FBURL', 'https://pick100pool.firebaseio.com')
   .constant('FIREBASE_TOURNAMENT_ID', 'MarchMadness2017')
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
