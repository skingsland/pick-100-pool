'use strict';

angular.module('myApp.services').service('teamService',
           ['tournamentRef', '$firebaseArray',
    function(tournamentRef, $firebaseArray) {
        this.findAll = function() {
            return $firebaseArray(tournamentRef.child('teams'));
        };
    }
]);
