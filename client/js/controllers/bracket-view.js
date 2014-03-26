'use strict';

angular.module('myApp.controllers').controller('ViewBracketController',
           ['$scope', '$routeParams', '$location', '$q', '$timeout', 'poolService', 'bracketService', 'teamService', 'userService', 'NUMBER_OF_TEAMS_PER_BRACKET', 'SUM_OF_TEAM_SEEDS_PER_BRACKET',
    function($scope,   $routeParams,   $location,   $q,   $timeout,   poolService,   bracketService,   teamService,   userService,   NUMBER_OF_TEAMS_PER_BRACKET,   SUM_OF_TEAM_SEEDS_PER_BRACKET) {
        $scope.sumOfSeeds = SUM_OF_TEAM_SEEDS_PER_BRACKET;
        $scope.poolId = $routeParams.poolId;

        // the bracketId can be supplied in two different ways: from the parent scope, or via a route param (e.g. /bracket/1)
        $scope.bracketId = $scope.bracketId || $routeParams.bracketId;

        $scope.bracketGridOptions = {
            data: 'teamsWithScores',
            enableRowSelection: false,
            headerRowHeight: 50, // allow room for the <br/>
            rowHeight: 25,
            columnDefs: buildColumnDefsForBracketGrid(),
            showFooter: true,
            footerRowHeight: 30,
            footerTemplate: buildFooterTemplateForBracketGrid(),
            // TODO fix sorting (this doesn't seem to have any effect, perhaps because the data is loaded after the grid renders)
//            sortInfo: {fields: ['seed'], directions: ['asc']}
        };

        $scope.removeBracket = function() {
            bracketService.removeBracket($scope.bracketId);
            $scope.$destroy();
        };

        findAllTeams();
        getBracketWithScores();

        function findAllTeams () {
            var deferred = $q.defer();

            teamService.findAll().$on('value', function(teamsSnapshot) {
                var allTeams = teamsSnapshot.snapshot.value;

                // we don't want to just return the direct children of /teams, because each team is stored as a key-value pair,
                // where the key is the team id, and the value is the team object (which *also* includes its id).
                $scope.teams = Object.keys(allTeams).map(function (key) {
                    return allTeams[key];
                });

                deferred.resolve();
            });
            return deferred.promise;
        }
        function getBracketWithScores () {
            if (!$scope.bracketId) {
                console.log(new Error('view bracket page requested without a bracketId!'));
                return;
            }
            var bracket = bracketService.findById($scope.bracketId);
            bracket.$bind($scope, 'bracket');

            $scope.teamsWithScores = [];

            bracket.$child('ownerId').$getRef().once('value', function(ownerId) {
                // this will be null immediately after the bracket has been deleted
                if (ownerId.val()) {
                    userService.findById(ownerId.val()).$bind($scope, 'owner');
                }
            });

            bracket.$child('teams').$on('child_added', function(teamSnapshot) {
                var teamId = teamSnapshot.snapshot.value;
                var teamRef = teamService.findById(teamId);

                $scope.teamsWithScores.push(teamRef);

                // watch for changes to the team's points, which will update when new games finish by adding children to 'rounds'
                teamRef.$child('rounds').$on('child_added', function(roundSnapshot) {
                    var points = roundSnapshot.snapshot.value;

                    // update the points-per-team, for row totals
                    if (!teamRef.totalPoints) {
                        teamRef.totalPoints = 0;
                    }
                    teamRef.totalPoints += points;
                });
            });

            // when a column total changes (total points per round), update the grand total (points for the whole bracket)
            bracket.$child('total_bracket_points_for_round').$on('value', function(snapshot) {
                $scope.sumOfPoints = getTotalPoints(snapshot.snapshot.value);
            })
        }

        function getTotalPoints(totalPointsPerRound) {
            return _.reduce(totalPointsPerRound, function (memo, currentValue) {
                return memo + currentValue;
            }, 0);
        }

        function buildColumnDefsForBracketGrid() {
            // ngGrid's minWidth property doesn't work, so set the exact width for the first columns
            var columnDefs = [
                {field:'full_name', displayName:'Picks', width:150},
                {field:'seed', displayName:'Seed', width:60}
            ];

            for (var i = 1; i <= 6; i++) {
                var points = Math.pow(2, i - 1);

                columnDefs.push({field: 'rounds[' + i + ']',
                                 displayName: 'Round ' + i + '<br/><small>Seed # + ' + points + ' point' + (points > 1 ? 's' : '') + '</small>'
                });
            }

            columnDefs.push({field:'totalPoints', displayName:'Team Total'});
            return columnDefs;
        }

        function buildFooterTemplateForBracketGrid() {
            var footerTemplate = '<div class="ngFooterPanel" ng-style="footerStyle()">'
                + '                   <div class="ngFooterCell col0 colt0">'
                + '                       <span class="ngLabel">TOTALS:</span>'
                + '                   </div>'
                + '                   <div class="ngFooterCell col1 colt1">'
                + '                       <span class="ngLabel">{{sumOfSeeds}}</span>'
                + '                   </div>';

            for (var i = 1; i <= 6; i++) {
                footerTemplate += '   <div class="ngFooterCell col' + (i+1) + ' colt' + (i+1) + '">'
                + '                       <span class="ngLabel">{{bracket.total_bracket_points_for_round[' + i + ']}}</span>'
                + '                   </div>';
            }

            footerTemplate += '       <div class="ngFooterCell col7 colt7">'
            + '                           <span class="ngLabel">{{sumOfPoints}}</span>'
            + '                       </div>'
            + '                   </div>';

            return footerTemplate;
        }
    }
]);
