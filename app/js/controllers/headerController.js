'use strict';

// add this controller to the existing controllers module
angular.module('myApp.controllers').controller('HeaderController',
           ['$rootScope', '$scope', '$location', 'syncData', 'loginService',
    function($rootScope,   $scope,   $location,   syncData,   loginService) {
        // bind the user's data to the scope, once they're logged in

        $scope.user = {};

        // whenever a new user logs in, bind their user data to the $scope so we can show their username in the view
        $rootScope.$on('$firebaseSimpleLogin:login', function(event, user) {
            $scope.user = {};
            syncData(['users', user.uid]).$bind($scope, 'user').then(function(unBind) {
                $scope.unBindUser = unBind;
            });
        });

        $scope.logout = function() {
            loginService.logout();

            // clear the old user's firebase and scope bindings
            $scope.unBindUser();
            $scope.user = {};
        };

        $scope.navbarEntries = [
            {
              "title": "Pools",
              "link": "/pools"
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
