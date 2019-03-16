'use strict';

angular.module('myApp.services').service('poolService',
           ['$q','tournamentRef', '$firebaseObject', '$firebaseArray',
    function($q,  tournamentRef,   $firebaseObject,   $firebaseArray) {
        var allPools = $firebaseArray(tournamentRef.child('pools'));

        this.findAll = function() {
            return allPools;
        };
        this.findById = function(poolId) {
            return $firebaseObject(tournamentRef.child('pools').child(poolId));
        };

        this.create = function(pool, managerId, callback) {
            console.log("pool == null?", pool == null);
            console.log("manager == null?", managerId == null);
            console.log("poolService.create() called with", pool, managerId);

            return allPools.$add({
                name: pool.name,
                managerId: managerId,
                brackets: {},
                allowBracketChangesDuringTourney: !!pool.allowBracketChangesDuringTourney,
                hideBracketsBeforeTourney: !!pool.hideBracketsBeforeTourney
            }).then(function(ref) {
                // callback function cb takes (error, poolId)
                callback(null, ref.key); // returns the ID in firebase of the new pool
            });
        };

        this.removePool = function(poolId) {
            this.findById(poolId).$remove();
        };

        this.hasTourneyStarted = function() {
            var deferred = $q.defer();

            tournamentRef.once('value').then(function(snapshot) {
                var startTime = new Date(snapshot.val()['start_time']);

                deferred.resolve(new Date() > startTime);
            });

            return deferred.promise;
        };

        this.allowBracketChangesDuringTourney = function(pool) {
            var deferred = $q.defer();

            pool.$loaded().then(function() {
                deferred.resolve(pool.allowBracketChangesDuringTourney);
            });

            return deferred.promise;
        };

        this.hideBracketsBeforeTourney = function(pool) {
            var deferred = $q.defer();

            pool.$loaded().then(function() {
                deferred.resolve(pool.hideBracketsBeforeTourney);
            });

            return deferred.promise;
        };
    }
]);
