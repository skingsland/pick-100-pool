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

                // add the bracket id to the list of brackets for the pool, and for the user
                var pool = allPools.$child(bracket.poolId);
                // key the bracket by the owner's user id, to allow for easy lookup of the current user's bracket in the pool
                pool.$child('brackets').$child(bracket.ownerId).$set(bracketId);

                // TODO: saving the bracket in the user record is not useful if we don't know what tournament it belongs to,
                // (because we can't load teams without that), and maybe which pool as well?
//                var user = userService.findById(bracket.ownerId);
//                user.$child('brackets').$add(bracketId);

                deferred.resolve(bracketId);
            });
            return deferred.promise;
        };

        /*
         return {
         , removeBracket: function(bracketId) {
         var bracket = this.find(bracketId);
         bracket.once('value', function(data) {
         FireRef.pools().child('/'+data.val().poolId).child('/brackets/'+bracketId).remove();
         FireRef.users().child('/'+data.val().ownerId).child('/brackets/'+bracketId).remove();
         })
         bracket.remove();
         return;
         }
         };
*/
}]);