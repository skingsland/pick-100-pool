'use strict';

angular.module('myApp.services').service('bracketService',
           ['$firebase', 'tournamentRef', 'usersRef',
    function($firebase,   tournamentRef,   usersRef) {
        var poolsRef = tournamentRef.child('pools');
        var bracketsRef = tournamentRef.child('brackets');

        this.findAll = function () {
            return $firebase(bracketsRef);
        };

        this.findById = function(bracketId) {
          return $firebase(bracketsRef).$child(bracketId);
        };

        this.create = function(bracket, poolId, ownerId) {
             // add the bracket primarily to the list of brackets
            return $firebase(bracketsRef)
                .$add({name: bracket.name, teams: bracket.teams, poolId: poolId, ownerId: ownerId})
                .then(function (ref) {
                    // TODO: is this right? Or should it be ref.$id?
                    var bracketId = ref.name();

                    // add the bracket id to the list of brackets for the pool, and for the user
                    $firebase(poolsRef).$child(poolId).$child('brackets').$add(bracketId);
                    $firebase(usersRef).$child(ownerId).$child('brackets').$add(bracketId);
                });
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