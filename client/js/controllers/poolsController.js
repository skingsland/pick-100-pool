'use strict';

angular.module('myApp.controllers').controller('PoolsController',
           ['$scope', '$routeParams', '$location', '$q', 'poolService', 'syncData', 'waitForAuth',
    function($scope,   $routeParams,   $location,   $q,   poolService,   syncData,   waitForAuth) {
        // the only reason I'm creating this object is so that I've got an object on the $scope to bind primitives to, since
        // prototypical inheritance doesn't work with primitives. Not sure if this matters though, since I'm not using ng-model.
        $scope.model = {};

        $scope.model.poolId = $routeParams.poolId;

        // need this so the 'Create bracket' button will be hidden by default, instead of shown briefly
        $scope.model.currentUserHasLoaded = false;

        $scope.findPools = function () {
            $scope.pools = poolService.findAll();
        };
        $scope.findOnePool = function () {
            if (!$scope.model.poolId) {
                $scope.pool = { hideBracketsBeforeTourney: true };
            }
            else {
                var $pool = poolService.findById($scope.model.poolId);
                $pool.$bind($scope, 'pool');

                // if we already have the user's auth info, update it on the scope, instead of waiting for auth to sync
                if ($scope.auth.user) {
                    $pool.$child('brackets').$child($scope.auth.user.uid).$bind($scope, 'model.currentUserBracketId');
                    $scope.model.currentUserHasLoaded = true;
                }

                // using the pool's managerId property, look up the user and bind their data to the scope
                $pool.$getRef().child('managerId').once('value', function(managerId) {
                    syncData(['users', managerId.val()]).$bind($scope, 'manager');
                });

                // we can't get the id of the currently-logged-in user until their auth info has synced from firebase
                waitForAuth.then(function() {
                    // set the bracketId for the currently-logged-in user, if there is one
                    if ($scope.auth.user) {
                        var currentUserBracketId = $pool.$child('brackets').$child($scope.auth.user.uid);

                        currentUserBracketId.$bind($scope, 'model.currentUserBracketId').then(function() {
                            $scope.model.currentUserHasLoaded = true;
                        });
                    } else {
                        $scope.model.currentUserHasLoaded = true;
                    }
                });

                // Fetch two pieces of data from the server in parallel: whether the tourney has started, and whether users are
                // allowed to create or change brackets after it has started. Then combine then into a single flag on the scope.
                $q.all({'hasTourneyStarted': poolService.hasTourneyStarted(),
                        'allowBracketChangesDuringTourney': poolService.allowBracketChangesDuringTourney($pool)})
                    .then(function(results) {
                        $scope.model.isUserAllowedToCreateBracket = results['allowBracketChangesDuringTourney'] || !results['hasTourneyStarted'];
                });

                $q.all({'hasTourneyStarted': poolService.hasTourneyStarted(),
                        'hideBracketsBeforeTourney': poolService.hideBracketsBeforeTourney($pool)})
                    .then(function(results) {
                        $scope.model.showBrackets = results['hasTourneyStarted'] || !results['hideBracketsBeforeTourney'];
                });
            }
        };
        $scope.createPool = function () {
            var poolId = poolService.create($scope.pool, $scope.auth.user, function (err) {
                if (!err) {
                    $scope.pool = null;
                    $location.path('/pools/' + poolId);
                    $scope.$apply();
                }
            });
        };
        $scope.removePool = function (poolId) {
            poolService.removePool(poolId);
        };
    }
])
.filter('excludeBracketForCurrentUser', function() {
    return function(bracketIds, model) {
        // if the user is logged in, and they've created a bracket in this pool, filter it out of the list
        if (model.currentUserHasLoaded && model.currentUserBracketId) {
            return _.filter(bracketIds, function (bracketId) {
                return bracketId !== model.currentUserBracketId;
            });
        } else {
            // otherwise just return the unfiltered list
            return bracketIds;
        }
    };
});
