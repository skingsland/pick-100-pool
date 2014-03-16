'use strict';

angular.module('myApp.controllers').controller('PoolsController',
           ['$scope', '$routeParams', '$location', 'poolService', 'bracketService', 'syncData', 'waitForAuth',
    function($scope,   $routeParams,   $location,   poolService,   bracketService,   syncData,   waitForAuth) {

        $scope.pool = {};
        $scope.poolId = $routeParams.poolId;

        $scope.findPools = function () {
            $scope.pools = poolService.findAll();
        };
        $scope.findOnePool = function () {
            if ($scope.poolId) {
                var $pool = poolService.findById($scope.poolId);
                $pool.$bind($scope, 'pool');

                // using the pool's managerId property, look up the user and bind their data to the scope
                $pool.$getRef().child('managerId').once('value', function(managerId) {
                    syncData(['users', managerId.val()]).$bind($scope, 'manager');
                });
            }
        };
        $scope.findBrackets = function() {
            // this is the straightforward way, but it takes an extra 1-2 seconds to load the brackets into the grids!
//            bracketService.findBracketIdsByPool($scope.poolId).$bind($scope, 'bracketIds');

            waitForAuth.then(function() {
                var $brackets = bracketService.findBracketIdsByPool($scope.poolId);

                $brackets.$on('value', function(bracketsSnapshot) {
                    var brackets = bracketsSnapshot.snapshot.value;

                    if ($scope.auth.user) {
                        var userId = $scope.auth.user.uid;
                        //$scope.currentUserBracketId = brackets[userId];
                        // an awful, awful hack: ng-init won't delay scope variable resolution long enough to pick up this value,
                        // so I'm assigning it to an array and using ng-repeat instead (even though there can be one 1 user's bracket).
                        $scope.currentUserBrackets = [brackets[userId]];

                        // remove the current user's bracket from the list of all brackets,
                        // so it's not displayed again in the list of all brackets
                        delete brackets[userId];
                    }
                    $scope.bracketIds = brackets;
                });
            });
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
]);
