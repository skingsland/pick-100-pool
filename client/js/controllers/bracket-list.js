'use strict';

angular.module('myApp.controllers').controller('ListBracketsController',
           ['$scope', '$routeParams', 'bracketService',
    function($scope,   $routeParams,   bracketService) {
        // the poolId can be supplied in two different ways: from the parent scope, or via a route param (e.g. /pool/1/brackets)
        $scope.poolId = $scope.poolId || $routeParams.poolId;

        $scope.allBracketsInPool = [];

        $scope.allBracketsGridOptions = {
            data: 'allBracketsInPool',
            enableRowSelection: false,
            rowHeight: 25,
            columnDefs: [{field:'name', displayName:'Bracket'},
                         {field:'totalPoints', displayName:'Points', width:60}
                        ],
            // TODO: bold the row for the current user
            sortInfo: {fields: ['totalPoints'], directions: ['desc']},
            plugins: [new ngGridFlexibleHeightPlugin()]
        };

        if (!$scope.poolId) {
            console.log(new Error('tried to view brackets list page, without a poolId!'));
            return;
        }

        bracketService.findBracketIdsByPool($scope.poolId).$on('child_added', function(bracketId) {

            bracketService.findById(bracketId.snapshot.value).$on('value', function(bracketSnapshot) {
                var bracket = bracketSnapshot.snapshot.value;

                bracket.totalPoints = _.reduce(bracket.total_bracket_points_for_round, function(memo, currentValue) {
                    return memo + currentValue;
                }, 0);

                $scope.allBracketsInPool.push(bracket);
            })
        })
    }
]);
