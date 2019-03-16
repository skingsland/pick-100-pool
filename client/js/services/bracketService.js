'use strict';

angular.module('myApp.services').service('bracketService',
           ['$q', 'tournamentRef', '$firebaseObject', '$firebaseArray',
    function($q,   tournamentRef,   $firebaseObject,   $firebaseArray) {
        var self = this;

        this.findById = function(bracketId) {
          return $firebaseObject(tournamentRef.child('brackets').child(bracketId));
        };

        this.findAllBracketIdsByPool = function(poolId) {
            return tournamentRef.child('pools').child(poolId).child('brackets');
        };

        this.findBracketIdByPoolAndOwner = function(poolId, ownerId) {
            return this.findAllBracketIdsByPool(poolId).child(ownerId);
        };

        this.create = function(bracket) {
            var deferred = $q.defer();

             // first add the bracket to the list of ALL brackets
            $firebaseArray(tournamentRef.child('brackets')).$add(bracket).then(function (newBracketRef) {
                var bracketId = newBracketRef.key;

                // add the bracket id to the list of brackets for the pool;
                // key the bracket by the owner's user id, to allow for easy lookup of the current user's bracket in the pool
                self.findBracketIdByPoolAndOwner(bracket.poolId, bracket.ownerId).set(bracketId);

                deferred.resolve(bracketId);
            });
            return deferred.promise;
        };

        this.removeBracket = function (bracketId) {
            var $bracket = this.findById(bracketId);

            // first remove the bracket from the list of brackets in the pool
            $bracket.$loaded().then(function () {
                console.log('removing bracket', bracketId, 'from pool', $bracket.poolId);

                self.findBracketIdByPoolAndOwner($bracket.poolId, $bracket.ownerId).remove();

                // then remove the actual bracket itself
                $bracket.$remove();
            });
        };
    }
]);
