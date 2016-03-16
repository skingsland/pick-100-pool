'use strict';

angular.module('myApp.services').service('bracketService',
           ['$q', 'tournamentRef',
    function($q,   tournamentRef) {
        var allPools = tournamentRef.$child('pools');
        var allBrackets = tournamentRef.$child('brackets');

        this.findById = function(bracketId) {
          return allBrackets.$child(bracketId);
        };

        this.findBracketIdsByPool = function(poolId) {
            var pool = allPools.$child(poolId);
            return pool.$child('brackets');
        };

        this.create = function(bracket) {
            var deferred = $q.defer();

             // first add the bracket to the list of ALL brackets
            allBrackets.$add(bracket).then(function (newBracketRef) {
                var bracketId = newBracketRef.name();

                // add the bracket id to the list of brackets for the pool
                var pool = allPools.$child(bracket.poolId);
                // key the bracket by the owner's user id, to allow for easy lookup of the current user's bracket in the pool
                pool.$child('brackets').$child(bracket.ownerId).$set(bracketId);

                deferred.resolve(bracketId);
            });
            return deferred.promise;
        };

        this.removeBracket = function (bracketId) {
            console.log('about to remove bracketId ' + bracketId);

            var $bracket = this.findById(bracketId);

            // first remove the bracket from the list of brackets in the pool
            $bracket.$getRef().once('value', function (snapshot) {
                var bracket = snapshot.val();
                console.log('removing bracket', JSON.stringify(bracket), 'from pool', bracket.poolId);
                var bracketRefToRemove = allPools.$child(bracket.poolId).$child('brackets').$child(bracket.ownerId);
                bracketRefToRemove.$remove();
            });

            // then remove the actual bracket itself
            $bracket.$remove();
        };
    }]);
