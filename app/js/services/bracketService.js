'use strict';

angular.module('myApp.services').service('bracketService',
           ['$q', 'tournamentRef', 'usersRef',
    function($q,   tournamentRef,   usersRef) {
        var allPools = tournamentRef.$child('pools');
        var allBrackets = tournamentRef.$child('brackets');

        this.findAll = function() {
            return allBrackets;
        };

        this.findById = function(bracketId) {
          return allBrackets.$child(bracketId);
        };

        this.create = function(bracket) {
            var deferred = $q.defer();

             // first add the bracket to the list of ALL brackets
            allBrackets.$add(bracket).then(function (newBracketRef) {
                var bracketId = newBracketRef.name();

                // add the bracket id to the list of brackets for the pool, and for the user
                allPools.$child(bracket.poolId).$child('brackets').$add(bracketId);
                usersRef.$child(bracket.ownerId).$child('brackets').$add(bracketId);

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