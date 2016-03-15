'use strict';

// add this controller to the existing controllers module
angular.module('myApp.controllers').controller('HeaderController',
           ['$rootScope', '$scope', '$location', 'syncData', 'loginService', 'tournamentRef',
    function($rootScope,   $scope,   $location,   syncData,   loginService,   tournamentRef) {
        // enable the jQuery-based tooltip on the "Reset Password" button
        $(function () {
          $('[data-toggle="tooltip"]').tooltip();
        });

        // bind the user's data to the scope, once they're logged in

        $scope.user = {};

        tournamentRef.$child('start_time').$getRef().once('value', function(startTime) {
            $scope.tourneyStartTime = new Date(startTime.val());
            $scope.hasTourneyStarted = new Date() >= $scope.tourneyStartTime;
        });

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

        $scope.changePassword = function() {
            $location.path('/account');
        };

        $scope.navbarEntries = [
            {
              "title": "Play Now",
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
