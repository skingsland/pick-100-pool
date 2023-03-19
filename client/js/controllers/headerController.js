'use strict';

// add this controller to the existing controllers module
angular.module('myApp.controllers').controller('HeaderController',
           ['$rootScope', '$scope', '$location', 'userService', 'tournamentRef', 'moment',
    function($rootScope,   $scope,   $location,   userService,   tournamentRef,   moment) {
        // enable the jQuery-based tooltip on the "Reset Password" button
        $(function () {
          $('[data-toggle="tooltip"]').tooltip();
        });

        // bind the user's data to the scope, once they're logged in
        $scope.user = {};

        // this allows the view to check for null to see if this has been loaded yet
        $scope.hasTourneyStarted = null;

        tournamentRef.once('value').then(function(snapshot) {
            $scope.tourneyStartTime = moment(snapshot.val()['start_time']);
            $scope.hasTourneyStarted = moment().isAfter($scope.tourneyStartTime);
        });

        // TODO: should this be in app.js, and/or on $rootScope?
        $scope.auth.$onAuthStateChanged(function(firebaseUser) {
            $scope.user = {};

            // whenever a new user logs in, bind their user data to the $scope so we can show their username in the view
            if (firebaseUser) {
                userService.findById(firebaseUser.uid).$bindTo($scope, 'user').then(function (unBind) {
                    $rootScope.unBindUser = unBind;
                });
            } else {
                // otherwise the user logged out; clear their firebase and scope bindings
                // $rootScope.unBindUser();
                $scope.user = {};
            }
        });

        $scope.logout = function() {
            $scope.auth.$signOut();

            // clear the old user's firebase and scope bindings
            $rootScope.unBindUser();
            $scope.user = {};
        };

        $scope.changePassword = function() {
            // redirect the user to the account page where they can change their password
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
