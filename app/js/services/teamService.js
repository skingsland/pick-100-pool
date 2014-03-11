'use strict';

angular.module('myApp.services').service('teamService',
           ['$firebase', 'tournamentRef',
    function($firebase,   tournamentRef) {
        var teamsRef = tournamentRef.child('teams');

        this.findAll = function() {
            // TODO: sort this by seed (and region?)
            return $firebase(teamsRef);
        };
    }
]);
