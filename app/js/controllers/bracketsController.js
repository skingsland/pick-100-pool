'use strict';

angular.module('myApp.controllers').controller('BracketsController',
           ['$scope', '$routeParams', '$location', 'bracketService', 'teamService', 'syncData',
    function($scope,   $routeParams,   $location,   bracketService,   teamService,   syncData) {

//        function mockData() {
//            return [{full_name: 'Arizona', seed: '1'}, {full_name: 'Duke', seed: '2'}];
//        }

        $scope.poolId = $routeParams.poolId;
        $scope.bracketId = $routeParams.bracketId;

        // TODO: do we need either of these?
//      $scope.noBracket = !$routeParams.bracketId;
//        $scope.pool = {};

        $scope.selectedTeams = [];
        $scope.gridOptions = {
            data: 'teams',
            selectedItems: $scope.selectedTeams,
            columnDefs: [{field:'seed', displayName:'Seed', width:60},
                         {field:'full_name', displayName:'Name'}]
//            plugins: [new ngGridFlexibleHeightPlugin()]
        };


        $scope.findTeams = function () {
            return teamService.findAll().$on('value', function(teamsSnapshot) {
                var individualTeams = teamsSnapshot.snapshot.value;

                $scope.teams = Object.keys(individualTeams).map(function (key) {
                    return individualTeams[key];
                });

                // do I need to call this?
//                $scope.$apply();
            });
        };
        $scope.sumOfSeeds = function () {
            // add up the seeds of all the selected teams
            return $scope.selectedTeams.reduce(function(accum, currentValue) {
                return accum + parseInt(currentValue.seed, 10);
            }, 0);
        };

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
            var bracketId = bracketService.create($scope.bracket, $scope.poolId, $scope.auth.user.uid, function (err) {
                if(!err) {
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
