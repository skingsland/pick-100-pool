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
        var currentUserObj = null;

        $scope.auth.$onAuthStateChanged(function(firebaseUser) {
            if (currentUserObj) {
                currentUserObj.$destroy();
                currentUserObj = null;
            }
            $scope.user = {};

            if (firebaseUser) {
                currentUserObj = userService.findById(firebaseUser.uid);
                currentUserObj.$loaded().then(function(user) {
                    $scope.user = { name: user.name };
                });
            }
        });

        $scope.logout = function() {
            $scope.auth.$signOut();

            if (currentUserObj) {
                currentUserObj.$destroy();
                currentUserObj = null;
            }
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
