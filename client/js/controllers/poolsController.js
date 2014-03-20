'use strict';

angular.module('myApp.controllers').controller('PoolsController',
           ['$scope', '$routeParams', '$location', 'poolService', 'bracketService', 'syncData', 'waitForAuth',
    function($scope,   $routeParams,   $location,   poolService,   bracketService,   syncData,   waitForAuth) {
        $scope.poolId = $routeParams.poolId;
        $scope.pool = {};
        // need to default this to true so the 'Create bracket' button will be hidden by default, instead of shown briefly
        $scope.currentUserHasLoaded = false;

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

                // sets the bracketId for the currently-logged-in user, or null if there isn't one
                $pool.$child('brackets').$on('loaded', function(brackets) {
                    // we can't get the id of the currently-logged in user until their auth info has synced from firebase
                    waitForAuth.then(function() {
                        if ($scope.auth.user && brackets) {
                            $scope.currentUserBracketId = brackets[$scope.auth.user.uid];
                        }
                        $scope.currentUserHasLoaded = true;
                    });
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
]);
