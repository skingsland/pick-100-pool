'use strict';

angular.module('myApp.controllers').controller('PoolsController',
           ['$scope', '$routeParams', '$location', 'poolService', 'syncData',
    function($scope,   $routeParams,   $location,   poolService,   syncData) {

        $scope.pool = {};
        $scope.poolId = $routeParams.poolId;

        $scope.findPools = function () {
            $scope.pools = poolService.findAll();
        }

        $scope.findOnePool = function () {
            if(!!$scope.poolId) {
                var $pool = poolService.findById($scope.poolId);
                $pool.$bind($scope, 'pool');

                // using the pool's managerId property, look up the user and bind their data to the scope
                $pool.$getRef().child('managerId').once('value', function(managerId) {
                    syncData(['users', managerId.val()]).$bind($scope, 'manager');
                });
            }
        }

        $scope.createPool = function () {
            var poolId = poolService.create($scope.pool, $scope.auth.user, function (err) {
                if(!err) {
                    $scope.pool = null;
                    $location.path('/pools/' + poolId);
                    $scope.$apply();
                }
            });
        }

        $scope.removePool = function (poolId) {
            poolService.removePool(poolId);
        }
    }
])
