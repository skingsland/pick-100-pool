'use strict';

angular.module('myApp.controllers').controller('ViewBracketController',
           ['$scope', '$routeParams', '$location', '$q', '$timeout', 'uiGridConstants', 'poolService', 'bracketService', 'teamService', 'userService', 'NUMBER_OF_TEAMS_PER_BRACKET', 'SUM_OF_TEAM_SEEDS_PER_BRACKET',
    function($scope,   $routeParams,   $location,   $q,   $timeout,   uiGridConstants,   poolService,   bracketService,   teamService,   userService,   NUMBER_OF_TEAMS_PER_BRACKET,   SUM_OF_TEAM_SEEDS_PER_BRACKET) {
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

        $scope.bracketGridOptions = {
            data: 'teamsWithScores',
            rowHeight: 25,
            columnDefs: buildColumnDefsForBracketGrid(),
            enableColumnMenus: false,
            showColumnFooter: true
        };

        $scope.removeBracket = function() {
            bracketService.removeBracket($scope.bracketId);
            $scope.$destroy();
        };

        $scope.findAllTeams = function () {
            var deferred = $q.defer();

            teamService.findAll().$getRef().once('value', function(teamsSnapshot) {
                deferred.resolve(teamsSnapshot.val());
            });

            return deferred.promise;
        };

        $scope.getBracketWithScores = function (allTeams) {
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

            // get the ID of each team in the bracket, and use the team ID to look up its team ref, containing the points for each round
            bracket.$child('teams').$getRef().on('child_added', function(teamSnapshot) {
                var teamId = teamSnapshot.val();
                var teamRef = allTeams[teamId];

                $scope.teamsWithScores.push(teamRef);

                // only calculate each team's total points once
                if (!teamRef.isTotalPointsCalculated) {
                    teamRef.isTotalPointsCalculated = true;

                    for (var i in teamRef.rounds) {
                        var points = teamRef.rounds[i];

                        if (i > 0 && points != null) {
                            // update the points-per-team, for row totals
                            if(!teamRef.totalPoints) {
                                teamRef.totalPoints = 0;
                            }
                            teamRef.totalPoints += points;
                        }
                    }
                }
            });

            // when a column total changes (total points per round), update the grand total (points for the whole bracket)
            bracket.$child('total_bracket_points_for_round').$getRef().on('value', function(snapshot) {
                $scope.sumOfPoints = getTotalPoints(snapshot.val());
            });
        };

        function getTotalPoints(totalPointsPerRound) {
            // this happens after the bracket is deleted, for some reason
            if (totalPointsPerRound == null) return 0;

            return totalPointsPerRound.reduce(function(previousValue, currentValue, currentIndex) {
                // there is no zero index in the array, since the first position is the first round of the tourney
                if (currentIndex === 0) return 0;

                return previousValue + currentValue;
            }, 0);
        }

        function getCellClassForEliminated(grid, row, col, rowRenderIndex, colRenderIndex) {
            return row.entity['is_eliminated'] ? 'eliminated' : '';
        }

        function buildColumnDefsForBracketGrid() {
            var columnDefs = [
                {field:'full_name', displayName:'Picks', minWidth:100, cellClass: getCellClassForEliminated,
                    footerCellTemplate: '<div class="ui-grid-cell-contents">TOTALS:</div>'
                },
                {field:'seed', displayName:'Seed', width:60, cellClass: getCellClassForEliminated,
                    footerCellTemplate: '<div class="ui-grid-cell-contents">{{grid.appScope.sumOfSeeds}}</div>',
                    // aggregationType: uiGridConstants.aggregationTypes.sum, aggregationHideLabel: true,
                    sort: {direction: uiGridConstants.ASC, priority: 1}}
            ];

            for (var i = 1; i <= 6; i++) {
                var points = Math.pow(2, i - 1);

                columnDefs.push({field: 'rounds[' + i + ']',
                                 displayName: 'Round ' + i + '<br/><small>Seed # + ' + points + ' point' + (points > 1 ? 's' : '') + '</small>',
                                 headerCellFilter: 'trustHtml', // name of the custom Angular filter to use to allow HTML in the column header
                                 cellTemplate: '<div class="ui-grid-cell-contents" title="TOOLTIP">'
                                                + '{{COL_FIELD || \'\'}}' // don't show zeros; it's distracting
                                             + '</div>',
                                 footerCellTemplate: '<div class="ui-grid-cell-contents">{{grid.appScope.bracket.total_bracket_points_for_round[' + i + '] || \'\'}}</div>'
                                 // aggregationType: uiGridConstants.aggregationTypes.sum, aggregationHideLabel: true
                });
            }

            columnDefs.push({field: 'totalPoints',
                             displayName: 'Team Total',
                             aggregationType: uiGridConstants.aggregationTypes.sum,
                             aggregationHideLabel: true});
            return columnDefs;
        }
    }
]);
