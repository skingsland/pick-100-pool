'use strict';

angular.module('myApp.controllers').controller('ListBracketsController',
           ['$scope', '$routeParams', 'bracketService', '$anchorScroll', '$location', 'uiGridConstants',
    function($scope,   $routeParams,   bracketService,   $anchorScroll,   $location,   uiGridConstants) {
        // the poolId can be supplied in two different ways: from the parent scope, or via a route param (e.g. /pool/1/brackets)
        $scope.poolId = $scope.poolId || $routeParams.poolId;

        $scope.allBracketsInPool = [];

        function getCellTemplateForBracketNameColumn() {
            if ($scope.enableBracketNameLink) {
                return '<div class="ui-grid-cell-contents" title="TOOLTIP">'
                         + '<a href="" ng-click="scrollTo(row.entity[\'id\']))">{{COL_FIELD CUSTOM_FILTERS}}</a>'
                     + '</div>';
            }
            return ''; // use the normal, built-in cell template
        }

        $scope.allBracketsGridOptions = {
            data: 'allBracketsInPool',
            rowHeight: 25,
            columnDefs: [{field:'name',
                          displayName:'Bracket',
                          cellTemplate: getCellTemplateForBracketNameColumn()},
                         {field:'totalPoints', displayName:'Points', width:60, sort: {direction: uiGridConstants.DESC, priority: 1}},
                         {field:'num_teams_remaining', displayName:'Teams left', width:90}
                        ],
            enableColumnMenus: false
            // TODO: bold the row for the current user
        };

        if (!$scope.poolId) {
            console.log(new Error('tried to view brackets list page, without a poolId!'));
            return;
        }

        $scope.scrollTo = function(id) {
            // saving the old hash and resetting it after scrolling to the anchor prevents the page from reloading,
            // while keeping the route clean
            var old = $location.hash();
            $location.hash(id);

            // anchor hash linking doesn't work like normal because the AngularJS router intercepts hash links, so we use this
            $anchorScroll();

            // reset to old to keep any additional routing logic from kicking in
            $location.hash(old);
        };

        // any time a new bracket is added to the pool's list, add the full bracket object to the scope
        bracketService.findBracketIdsByPool($scope.poolId).$on('child_added', function(bracketIdSnapshot) {
            var bracketId = bracketIdSnapshot.snapshot.value;
            
            // happens after a bracket is deleted, for some reason
            if (!bracketId) return;

            // Listen for changes to the bracket; this will be called first with the complete data, then again later if/when
            // any fields in the bracket change (e.g. total points or teams remaining).
            bracketService.findById(bracketId).$getRef().on('value', function(bracketSnapshot) {
                var bracket = bracketSnapshot.val();

                // this will happen right after the bracket is removed
                if (bracket === null) {
                    return;
                }

                bracket.id = bracketId; // save the bracketId for later, so we can find it again

                // has the bracket already been added to the scope? If so, remove it before we re-add it
                for (var i in $scope.allBracketsInPool) {
                    if ($scope.allBracketsInPool[i].id === bracketId) {

                        // If the bracket has already been added to the scope, remove it so we can add it again.
                        // Note that removing the element from the array, calling $scope.apply(), and then re-adding it is the
                        // only way to make ui-grid aware of the change so it will re-render the updated bracket in the grid.
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
