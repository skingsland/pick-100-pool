'use strict';

angular.module('myApp.services').service('poolService',
           ['tournamentRef',
    function(tournamentRef) {
        var allPools = tournamentRef.$child('pools');

        this.findAll = function() {
            return allPools;
        };
        this.findById = function(poolId) {
            return allPools.$child(poolId);
        };
        // TODO: rewrite this to use allPools.$add().then(...)
        this.create = function(pool, manager, cb) {
            return allPools.$getRef().push({
                name: pool.name,
                managerId: manager.uid,
                brackets: []
            }, cb).name();
        };

        this.removePool = function(poolId) {
            this.findById(poolId).$remove();
        };
    }
]);
