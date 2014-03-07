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

                // Create a Firebase reference to the pool, instead of using $pool, since the $on('value', cb)
                // event callback doesn't work. See: https://github.com/firebase/angularFire/issues/272
                $pool.$getRef().child('commissionerId').once('value', function(commissionerId) {
                    // using the pool's commissionerId property, look up the user and bind their data to the scope
                    syncData(['users', commissionerId.val()]).$bind($scope, 'commissioner');
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
    }])
