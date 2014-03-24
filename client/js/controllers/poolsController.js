'use strict';

angular.module('myApp.controllers').controller('PoolsController',
           ['$scope', '$routeParams', '$location', 'poolService',
    function($scope,   $routeParams,   $location,   poolService) {
        // the only reason I'm creating this object is so that I've got an object on the $scope to bind primitives to, since
        // prototypal inheritance doesn't work with primitives. Not sure if this matters though, since I'm not using ng-model.
        $scope.model = {};

        $scope.model.poolId = $routeParams.poolId;
        $scope.pool = {};

        $scope.findPools = function () {
            $scope.pools = poolService.findAll();
        };
        $scope.findOnePool = function () {
            if ($scope.model.poolId) {
                poolService.findById($scope.model.poolId).$bind($scope, 'pool');
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
