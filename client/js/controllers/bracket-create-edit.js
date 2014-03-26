'use strict';

angular.module('myApp.controllers').controller('CreateEditBracketController',
           ['$scope', '$routeParams', '$location', '$q', '$timeout', 'poolService', 'bracketService', 'teamService', 'userService', 'NUMBER_OF_TEAMS_PER_BRACKET', 'SUM_OF_TEAM_SEEDS_PER_BRACKET',
    function($scope,   $routeParams,   $location,   $q,   $timeout,   poolService,   bracketService,   teamService,   userService,   NUMBER_OF_TEAMS_PER_BRACKET,   SUM_OF_TEAM_SEEDS_PER_BRACKET) {
        $scope.requiredNumTeams = NUMBER_OF_TEAMS_PER_BRACKET;
        $scope.requiredSumOfSeeds = SUM_OF_TEAM_SEEDS_PER_BRACKET;
        $scope.sumOfSeeds = 0;

        $scope.poolId = $routeParams.poolId;

        // the bracketId can be supplied in two different ways: from the parent scope, or via a route param (e.g. /bracket/1)
        if (!$scope.bracketId) {
            $scope.bracketId = $routeParams.bracketId;
        }
        $scope.isNewBracket = !$scope.bracketId;

        $scope.selectedTeams = [];
        $scope.selectTeamsGridOptions = {
            data: 'teams',
            selectedItems: $scope.selectedTeams,
            rowHeight: 25,
            columnDefs: [
                {field:'seed', displayName:'Seed', width:60},
                {field:'full_name', displayName:'Name'},
                {field:'region', displayName:'Region', width:85},
                {field:'conference', displayName:'Conference'}
            ],
            sortInfo: {fields: ['seed'], directions: ['asc']}
        };

        $scope.findAllTeams = function () {
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
        };
        $scope.$watchCollection('selectedTeams', function(selectedTeamsNewValue) {
            // calculate the sum of the seeds of all the selected teams, for visual feedback to the user
            $scope.sumOfSeeds = getSumOfSeeds(selectedTeamsNewValue);

            function calculateTeamsProgressBarType(selectedTeams) {
                if (selectedTeams.length < $scope.requiredNumTeams) return 'default';
                if (selectedTeams.length === $scope.requiredNumTeams) return 'success';
                return 'danger';
            }
            $scope.teamsProgressBarType = calculateTeamsProgressBarType(selectedTeamsNewValue);

            function calculateSeedsProgressBarType(sumOfSeeds) {
                if (sumOfSeeds < $scope.requiredSumOfSeeds) return 'default';
                if (sumOfSeeds === $scope.requiredSumOfSeeds) return 'success';
                return 'danger';
            }
            $scope.seedsProgressBarType = calculateSeedsProgressBarType($scope.sumOfSeeds);
        });
        $scope.getBracketForEditing = function () {
            // are we editing an existing bracket? If so, we will have a bracketId.
            if ($scope.bracketId) {
                var bracket = bracketService.findById($scope.bracketId);
                bracket.$bind($scope, 'bracket');

                // need to use a timeout, with a 0 sec delay, to ensure that ng-grid has finished loading the grid before we select rows
                $timeout(function() {
                    // get an array of all teams in the bracket, so we can select them in the grid
                    bracket.$child('teams').$getRef().once('value', function (bracketTeamsSnapshot) {
                        var bracketTeamsArray = bracketTeamsSnapshot.val();

                        angular.forEach($scope.teams, function (team, index) {
                            // is the team in the bracket? if so, select it
                            if (bracketTeamsArray.indexOf(team.id) >= 0) {
                                // need to use the ng-grid API to directly select the row for each team in the bracket, because
                                // ng-grid doesn't support auto-updating the grid if we were to update $scope.selectedTeams manually
                                $scope.selectTeamsGridOptions.selectItem(index, true);
                            }
                        });
                    });
                }, 0);
            } else {
                // create a new bracket object for the scope, since we're not editing an existing bracket
                $scope.bracket = {poolId: $scope.poolId, ownerId: $scope.auth.user.uid};
            }
        };

        $scope.saveBracket = function () {
            // update the bracket being created/saved with the user's selected teams
            $scope.bracket.teams = $scope.selectedTeams.map(function(selectedTeam) {
                return selectedTeam.id;
            });

            // tell the server to (re)calculate points per round for the bracket, which is needed if the tournament already started
            $scope.bracket.isNewOrUpdated = true;

            if ($scope.isNewBracket) {
                bracketService.create($scope.bracket).then(function (bracketId) {
                    if(!!bracketId) {
                        afterSuccessfulSave()
                    }
                });
            } else {
                $scope.bracket.$save().then(afterSuccessfulSave);
            }
        };

        function afterSuccessfulSave() {
            // after the bracket was successfully updated, send the user back to the pool overview page,
            // where they can see their bracket at the top of the page
            $location.path('/pools/' + $scope.poolId);
        }

        function getSumOfSeeds(teams) {
            return teams.reduce(function (accum, currentValue) {
                return accum + parseInt(currentValue.seed, 10);
            }, 0);
        }
    }
]);