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
                         {field:'totalPoints', displayName:'Points', width:60},
                         {field:'num_teams_remaining', displayName:'Teams left', width:85}
                        ],
            // TODO: bold the row for the current user
            sortInfo: {fields: ['totalPoints'], directions: ['desc']},
            plugins: [new ngGridFlexibleHeightPlugin()]
        };

        if (!$scope.poolId) {
            console.log(new Error('tried to view brackets list page, without a poolId!'));
            return;
        }

        // any time a new bracket is added to the pool's list, add the full bracket object to the scope
        bracketService.findBracketIdsByPool($scope.poolId).$on('child_added', function(bracketIdSnapshot) {
            var bracketId = bracketIdSnapshot.snapshot.value;

            // Listen for changes to the bracket; this will be called first with the complete data, then again later if/when
            // any fields in the bracket change (e.g. total points or teams remaining).
            bracketService.findById(bracketId).$getRef().on('value', function(bracketSnapshot) {
                var bracket = bracketSnapshot.val();
                bracket.id = bracketId; // save the bracketId for later, so we can find it again

                // has the bracket already been added to the scope? If so, remove it before we re-add it
                for (var i in $scope.allBracketsInPool) {
                    if ($scope.allBracketsInPool[i].id === bracketId) {

                        // If the bracket has already been added to the scope, remove it so we can add it again.
                        // Note that removing the element from the array, calling $scope.apply(), and then re-adding it is the
                        // only way to make ng-grid aware of the change so it will re-render the updated bracket in the grid.
                        $scope.allBracketsInPool.splice(i, 1);
                        $scope.$apply();
                    }
                }

                $scope.allBracketsInPool.push(bracket);
            });
        });

        // when a bracket is removed, remove it from the backing array
        bracketService.findBracketIdsByPool($scope.poolId).$getRef().on('child_removed', function(bracketId) {
            for (var i in $scope.allBracketsInPool) {
                if ($scope.allBracketsInPool[i].$id === bracketId.val()) {
                    $scope.allBracketsInPool.splice(i, 1);
                    break;
                }
            }
        })
    }
]);
