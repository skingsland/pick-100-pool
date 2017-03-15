'use strict';

angular.module('myApp.services').service('poolService',
           ['$q','tournamentRef',
    function($q,  tournamentRef) {
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
                brackets: [],
                allowBracketChangesDuringTourney: !!pool.allowBracketChangesDuringTourney,
                hideBracketsBeforeTourney: !!pool.hideBracketsBeforeTourney
            }, cb).name();  // returns the ID in firebase of the new pool
        };

        this.removePool = function(poolId) {
            this.findById(poolId).$remove();
        };

        this.hasTourneyStarted = function() {
            var deferred = $q.defer();

            tournamentRef.$child('start_time').$getRef().once('value', function(startTime) {
                deferred.resolve(new Date() > new Date(startTime.val()));
            });

            return deferred.promise;
        };

        this.allowBracketChangesDuringTourney = function(pool) {
            var deferred = $q.defer();

            pool.$child('allowBracketChangesDuringTourney').$getRef().once('value', function(allowBracketChangesDuringTourney) {
                deferred.resolve(allowBracketChangesDuringTourney.val());
            });

            return deferred.promise;
        };

        this.hideBracketsBeforeTourney = function(pool) {
            var deferred = $q.defer();

            pool.$child('hideBracketsBeforeTourney').$getRef().once('value', function(hideBracketsBeforeTourney) {
                deferred.resolve(hideBracketsBeforeTourney.val());
            });

            return deferred.promise;
        };
    }
]);
