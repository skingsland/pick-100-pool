'use strict';

angular.module('myApp.controllers').controller('PoolsController',
           ['$scope', '$routeParams', '$location', '$q', 'userService', 'poolService', 'bracketService', '$firebaseObject', '$firebaseArray', 'firebaseRef',
    function($scope,   $routeParams,   $location,   $q,   userService,   poolService,   bracketService,   $firebaseObject,   $firebaseArray,   firebaseRef) {
        // the only reason I'm creating this object is so that I've got an object on the $scope to bind primitives to, since
        // prototypical inheritance doesn't work with primitives. Not sure if this matters though, since I'm not using ng-model.
        $scope.model = {};

        $scope.model.poolId = $routeParams.poolId;

        $scope.findPools = function () {
            $scope.pools = poolService.findAll();
        };
        $scope.findOnePool = function () {
            if (!$scope.model.poolId) {
                $scope.pool = { hideBracketsBeforeTourney: true };
            }
            else {
                var $pool = poolService.findById($scope.model.poolId);
                $pool.$bindTo($scope, 'pool');

                // using the pool's managerId property, look up the user and bind their data to the scope
                $pool.$ref().child('managerId').once('value', function(managerId) {
                    userService.findById(managerId.val()).$bindTo($scope, 'manager');
                });

                // set the bracketId for the currently-logged-in user, if there is one
                $scope.auth.$waitForSignIn().then(function(firebaseUser) {
                    if (firebaseUser) {
                        var currentUserBracketIdRef = bracketService.findBracketIdByPoolAndOwner($scope.model.poolId, firebaseUser.uid);

                        // the current user might not have a bracket yet, in which case the path in firebase this refers to won't exist;
                        // in that case, the on('value') method will return a snapshot where the value is null
                        currentUserBracketIdRef.on('value', function (snapshot) {
                            $scope.model.currentUserBracketId = snapshot.val();
                        })
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
            poolService.create($scope.pool, $scope.currentUserId, function (err, poolId) {
                if (!err) {
                    $scope.pool = null;
                    $location.path('/pools/' + poolId);
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
        if (model.currentUserBracketId) {
            return _.filter(bracketIds, function (bracketId) {
                return bracketId !== model.currentUserBracketId;
            });
        } else {
            // otherwise just return the unfiltered list
            return bracketIds;
        }
    };
});
