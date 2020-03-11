'use strict';

angular.module('myApp.controllers').controller('ViewBracketController',
           ['$scope', '$routeParams', '$q', 'poolService', 'bracketService', 'teamService', 'userService', 'SUM_OF_TEAM_SEEDS_PER_BRACKET',
    function($scope,   $routeParams,   $q,   poolService,   bracketService,   teamService,   userService,   SUM_OF_TEAM_SEEDS_PER_BRACKET) {
        $scope.sumOfSeeds = SUM_OF_TEAM_SEEDS_PER_BRACKET;
        $scope.poolId = $routeParams.poolId;

        var $pool = poolService.findById($scope.poolId);

        // Fetch two pieces of data from the server in parallel: whether the tourney has started, and whether users are
        // allowed to create or change brackets after it has started. Then combine then into a single flag on the scope.
        $q.all({'hasTourneyStarted': poolService.hasTourneyStarted(),
                'allowBracketChangesDuringTourney': poolService.allowBracketChangesDuringTourney($pool)})
            .then(function(results) {
                $scope.isUserAllowedToEditBracket = results['allowBracketChangesDuringTourney'] || !results['hasTourneyStarted'];
            });


        // the bracketId can be supplied in two different ways: from the parent scope, or via a route param (e.g. /bracket/1)
        $scope.bracketId = $scope.bracketId || $routeParams.bracketId;

        $scope.removeBracket = function() {
            bracketService.removeBracket($scope.bracketId);
            $scope.$destroy();
        };

        $scope.findAllTeams = function () {
            return teamService.findAll().$loaded();
        };

        // allTeams is a $firebaseArray that has been $loaded()
        $scope.getBracketWithScores = function (allTeams) {
            if (!$scope.bracketId) {
                console.log(new Error('view bracket page requested without a bracketId!'));
                return;
            }

            var bracket = bracketService.findById($scope.bracketId);
            bracket.$bindTo($scope, 'bracket');

            // use $watch() instead of $loaded(), so the teams in the bracket will auto refresh after the user changes their picks
            bracket.$watch(function() {
                // this will be null immediately after the bracket has been deleted
                if (!bracket.ownerId) {
                    console.log('bracket can not reload because it has been deleted');
                    return;
                }

                userService.findById(bracket.ownerId).$bindTo($scope, 'owner');

                var teamsWithScores = [];

                // get the ID of each team in the bracket, and use the team ID to look up its team ref, containing the points for each round
                bracket.teams.forEach(function(teamId) {
                    var teamRef = allTeams.$getRecord(teamId);

                    teamsWithScores.push(teamRef);

                    // only calculate each team's total points once
                    if (!teamRef.isTotalPointsCalculated) {
                        teamRef.isTotalPointsCalculated = true;

                        var arrayLength = teamRef.rounds ? teamRef.rounds.length : 0;

                        for (var i = 1; i < arrayLength; i++) {
                            var points = teamRef.rounds[i];

                            if (points !== null) {
                                // update the points-per-team, for row totals
                                if (!teamRef.totalPoints) {
                                    teamRef.totalPoints = 0;
                                }
                                teamRef.totalPoints += points;
                            }
                        }
                    }
                });

                    // add all the teams with scores to the scope at the same time, at the very end
                $scope.teamsWithScores = teamsWithScores;
            });

            // when a column total changes (total points per round), update the grand total (points for the whole bracket)
            bracket.$ref().child('total_bracket_points_for_round').on('value', function(snapshot) {
                $scope.sumOfPoints = getTotalPoints(snapshot.val());
            });
        };

        function getTotalPoints(totalPointsPerRound) {
            // this happens after the bracket is deleted, for some reason
            if (totalPointsPerRound === null) return 0;

            // the value returned from the snapshot isn't a real array (in some scenarios), so convert it to an array first
            return Array.from(totalPointsPerRound).reduce(function(previousValue, currentValue, currentIndex) {
                // there is no zero index in the array, since the first position is the first round of the tourney
                if (currentIndex === 0) return 0;

                return previousValue + currentValue;
            }, 0);
        }
    }
]);
