'use strict';

angular.module('myApp.services').service('teamService',
           ['tournamentRef',
    function(tournamentRef) {
        var allTeams = tournamentRef.$child('teams');

        this.findAll = function() {
            return allTeams;
        };
        this.findById = function(teamId) {
            return allTeams.$child(teamId);
        };
    }
]);
