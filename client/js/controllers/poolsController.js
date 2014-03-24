'use strict';

angular.module('myApp.controllers').controller('PoolsController',
           ['$scope', '$routeParams', '$location', 'poolService', 'bracketService', 'syncData', 'waitForAuth',
    function($scope,   $routeParams,   $location,   poolService,   bracketService,   syncData,   waitForAuth) {
        // the only reason I'm creating this object is so that I've got an object on the $scope to bind primitives to, since
        // prototypical inheritance doesn't work with primitives. Not sure if this matters though, since I'm not using ng-model.
        $scope.model = {};

        $scope.model.poolId = $routeParams.poolId;
        $scope.pool = {};
        // need this so the 'Create bracket' button will be hidden by default, instead of shown briefly
        $scope.model.currentUserHasLoaded = false;

        $scope.findPools = function () {
            $scope.pools = poolService.findAll();
        };
        $scope.findOnePool = function () {
            if ($scope.model.poolId) {
                var $pool = poolService.findById($scope.model.poolId);
                $pool.$bind($scope, 'pool');

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
            }
        };
        $scope.createPool = function () {
            var poolId = poolService.create($scope.pool, $scope.auth.user, function (err) {
                if(!err) {
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
    return function(bracketIds, currentUserBracketId) {
        return _.filter(bracketIds, function(bracketId) {
            return bracketId !== currentUserBracketId;
        });
    };
});