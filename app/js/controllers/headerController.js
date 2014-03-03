'use strict';

// add this controller to the existing controllers module
angular.module('myApp.controllers').controller('HeaderController',
           ['$rootScope', '$scope', '$location', 'syncData', 'loginService', 'waitForAuth',
    function($rootScope,   $scope,   $location,   syncData,   loginService,   waitForAuth) {
        // bind the user's data to the scope, once they're logged in

        $scope.user = {};

        // these didn't exactly work, but they might be needed to ensure we don't bind a user without being logged in
//        waitForAuth.then(function() {
//        if (!!($rootScope.auth && $rootScope.auth.user)) {

        $rootScope.$on('$firebaseSimpleLogin:login', function() {
            syncData(['users', $rootScope.auth.user.uid]).$bind($scope, 'user').then(function(unBind) {
                $scope.unBindAccount = unBind;
            });
        });


        $scope.logout = function() {
            loginService.logout();

            // remove the old user's firebase and scope bindings
            $scope.unBindAccount();
            $scope.user = null;
        };

        $scope.navbarEntries = [
        {
          "title": "Pools",
          "link": "/pools"
        },
        {
          "title": "Brackets",
          "link": "/brackets"
        }
        ];

        $scope.$on('$routeChangeSuccess', function() {
            $scope.navbarEntries.forEach(
              function(data) {
                data.isActive = ($location.path().indexOf(data.link) == 0);
              }
            )
        })
    }])
