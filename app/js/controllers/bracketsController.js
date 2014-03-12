'use strict';

angular.module('myApp.controllers').controller('BracketsController',
           ['$scope', '$routeParams', '$location', 'bracketService', 'teamService', 'syncData', 'NUMBER_OF_TEAMS_PER_BRACKET', 'SUM_OF_TEAM_SEEDS_PER_BRACKET',
    function($scope,   $routeParams,   $location,   bracketService,   teamService,   syncData,   NUMBER_OF_TEAMS_PER_BRACKET,   SUM_OF_TEAM_SEEDS_PER_BRACKET) {
        $scope.requiredNumTeams = NUMBER_OF_TEAMS_PER_BRACKET;
        $scope.requiredSumOfSeeds = SUM_OF_TEAM_SEEDS_PER_BRACKET;
        $scope.sumOfSeeds = 0;

        $scope.poolId = $routeParams.poolId;
        $scope.bracketId = $routeParams.bracketId;

        $scope.selectedTeams = [];
        $scope.gridOptions = {
            data: 'teams',
            selectedItems: $scope.selectedTeams,
            columnDefs: [{field:'seed', displayName:'Seed', width:60},
                         {field:'full_name', displayName:'Name'}],
            sortInfo: {fields: ['seed'], directions: ['asc']}
//            plugins: [new ngGridFlexibleHeightPlugin()]
        };
        $scope.findTeams = function () {
            return teamService.findAll().$on('value', function(teamsSnapshot) {
                var individualTeams = teamsSnapshot.snapshot.value;

                $scope.teams = Object.keys(individualTeams).map(function (key) {
                    return individualTeams[key];
                });
            });
        };
        $scope.$watchCollection('selectedTeams', function(selectedTeamsNewValue) {
            $scope.sumOfSeeds = calculateSumOfSeeds(selectedTeamsNewValue);
            // TODO: provide other convenience status variables for the view to use?
        });
        function calculateSumOfSeeds(selectedTeams) {
            // add up the seeds of all the selected teams
            return selectedTeams.reduce(function(accum, currentValue) {
                return accum + parseInt(currentValue.seed, 10);
            }, 0);
        }

        $scope.findBrackets = function () {
            $scope.brackets = bracketService.findAll();
        };
        $scope.findOneBracket = function () {
            if(!!$scope.bracketId) {
                var $bracket = bracketService.findById($scope.bracketId);
                $bracket.$bind($scope, 'bracket');

                // TODO: fetch the bracket's selected teams
                $scope.selectedTeams = [];
            }
        };
        $scope.createBracket = function () {
            console.log('createBracket called, $scope.selectedTeams =', $scope.selectedTeams);

            // TODO: create an array of all the $scope.selectedTeams.id values, and set as $scope.bracket.teams

            bracketService.create($scope.bracket, $scope.poolId, $scope.auth.user.uid).then(function (ref) {
                if(!!ref) {
                    $scope.bracket = null;
                    $location.path('/pools/' + poolId + '/brackets/' + bracketId);
                    $scope.$apply();
                }
            });
        };
        $scope.removeBracket = function (bracketId) {
            bracketService.removeBracket(bracketId);
        };
    }
]);
