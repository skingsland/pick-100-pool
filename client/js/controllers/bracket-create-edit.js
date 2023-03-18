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
                {field:'conference', displayName:'Conference', width:220}
            ],
            sortInfo: {fields: ['seed'], directions: ['asc']}
        };

        $scope.findAllTeams = function () {
            var deferred = $q.defer();

            $scope.teams = teamService.findAll();

            $scope.teams.$loaded().then(function() {
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
                bracket.$bindTo($scope, 'bracket');

                // need to use a timeout, with a 0 sec delay, to ensure that ng-grid has finished loading the grid before we select rows
                $timeout(function() {
                    // get an array of all teams in the bracket, so we can select them in the grid

                    // TODO: does the $loaded() call need to be on the 'teams' child instead?
                    // bracket.$ref().child('teams').once('value', function (bracketTeamsSnapshot) {

                    bracket.$loaded().then(function() {
                        var bracketTeamsArray = bracket.teams;

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
                $scope.bracket = {poolId: $scope.poolId, ownerId: $scope.currentUserId};
            }
        };

        $scope.randomPicks = function () {
            $scope.clearPicks();

            $scope.teams.$loaded().then(function() {
                let randomPicks = randomlyPickTeams($scope.teams);

                while (randomPicks.length < 13) {
                    randomPicks = randomlyPickTeams($scope.teams);
                }

                angular.forEach($scope.teams, function (team, index) {
                    if (randomPicks.indexOf(team.id) >= 0) {
                        // need to use the ng-grid API to directly select the row for each team in the bracket, because
                        // ng-grid doesn't support auto-updating the grid if we were to update $scope.selectedTeams manually
                        $scope.selectTeamsGridOptions.selectItem(index, true);
                    }
                });
            });
        }

        $scope.clearPicks = function () {
            // unselect all items
            $scope.selectedTeams.length = 0;
            $scope.selectTeamsGridOptions.selectAll();
        }

        $scope.saveBracket = function () {
            // update the bracket being created/saved with the user's selected teams
            $scope.bracket.teams = $scope.selectedTeams.map(function(selectedTeam) {
                return selectedTeam.id;
            });

            // tell the server to (re)calculate points per round for the bracket, which is needed if the tournament already started
            $scope.bracket.isNewOrUpdated = true;

            if ($scope.isNewBracket) {
                $scope.bracket.created_on = new Date();

                bracketService.create($scope.bracket).then(function (bracketId) {
                    if(!!bracketId) {
                        afterSuccessfulSave()
                    }
                });
            } else {
                $scope.bracket.updated_on = new Date();

                // because we bound the bracket to the scope, that enabled 3 way data binding, so we don't (and can't) call
                // $scope.bracket.$save() to save the bracket. The changes have already been synced to firebase.
                afterSuccessfulSave();
            }
        };

        function randomlyPickTeams(teams) {
            let totalSeed = 0;
            let pickedTeams = [];
            let remainingTeams = teams.slice();

            // Keep picking teams until we have 13 or we can't reach 100 with the remaining teams
            while (pickedTeams.length < 13 && remainingTeams.length > 0) {
                // special-case picking the last team
                if (pickedTeams.length === 12) {
                    while (remainingTeams.length > 0) {
                        // Pick a random team from the remaining teams
                        let randomIndex = Math.floor(Math.random() * remainingTeams.length);
                        let pickedTeam = remainingTeams[randomIndex];

                        if (totalSeed + pickedTeam.seed === 100) {
                            pickedTeams.push(pickedTeam.id);

                            // success!
                            return pickedTeams;
                        }
                        remainingTeams.splice(randomIndex, 1);
                    }

                    // we failed; return a bad array and let the caller retry calling us
                    return pickedTeams;
                }

                // Pick a random team from the remaining teams
                let randomIndex = Math.floor(Math.random() * remainingTeams.length);
                let pickedTeam = remainingTeams[randomIndex];

                // If the total seed value of the picked teams plus the seed value of the picked team is less than or equal to 100,
                // add the picked team to the picked teams array and remove it from the remaining teams array.
                if (totalSeed + pickedTeam.seed <= 100) {
                    totalSeed += pickedTeam.seed;
                    pickedTeams.push(pickedTeam.id);
                }

                // regardless of whether we could actually use it, remove it from the remaining teams
                remainingTeams.splice(randomIndex, 1);
            }

            // it shouldn't be possible to reach this, but it definitely means we failed
            return pickedTeams;
        }

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
