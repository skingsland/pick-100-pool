'use strict';

angular.module('myApp.services').service('poolService',
           ['$firebase', 'tournamentRef',
    function($firebase,   tournamentRef) {
        var poolsRef = tournamentRef.child('pools');

        this.findAll = function() {
          return $firebase(poolsRef);
        };

        this.findById = function(poolId) {
          return $firebase(poolsRef).$child(poolId);
        };

        // TODO: rewrite this to use $firebase(poolsRef).$add().then(...)
        this.create = function(pool, manager, cb) {
            return poolsRef.push({
                name: pool.name,
                managerId: manager.uid,
                brackets: []
            }, cb).name();
        };

        this.removePool = function(poolId) {
            this.findById(poolId).$remove();
        };
    }
])
