'use strict';

angular.module('myApp.controllers').controller('ListBracketsController',
           ['$scope', '$routeParams', 'bracketService', 'userService', '$anchorScroll', '$location', 'ceilingCalculator', 'poolService', 'teamService', 'FINAL_FOUR_PAIRINGS',
    function($scope,   $routeParams,   bracketService,   userService,   $anchorScroll,   $location,   ceilingCalculator,   poolService,   teamService,   FINAL_FOUR_PAIRINGS) {
        // the poolId can be supplied in two different ways: from the parent scope, or via a route param (e.g. /pool/1/brackets)
        $scope.poolId = $scope.poolId || $routeParams.poolId;

        $scope.allBracketsInPool = [];
        $scope.model = {};
        $scope.model.showOwners = false;

        function getCellTemplateForBracketNameColumn() {
            var finishedSpan = '<span ng-class="{\'eliminated\': model.tourneyInProgress && row.getProperty(\'num_teams_remaining\') === 0, \'current-user-bracket\': row.getProperty(\'isCurrentUser\')}">';
            if ($scope.enableBracketNameLink) {
                return '<div class="ngCellText" ng-class="col.colIndex()">'
                         + finishedSpan
                         + '<a ng-cell-text href="" ng-click="scrollTo(row.getProperty(\'id\'))">{{row.getProperty(col.field)}}</a>' +
                    '<span ng-show="model.showOwners" style="font-size: 11px">  by {{row.getProperty("owner")}}</span>' +
                    '</span></div>';
            } else {
                return '<div class="ngCellText" ng-class="col.colIndex()">'
                    + finishedSpan + '{{row.getProperty(col.field)}}' +
                    '<span ng-show="model.showOwners" style="font-size: 11px">  by {{row.getProperty("owner")}}</span>' +
                    '</span></div>';
            }
        }

        function getNumericCellTemplate() {
            return '<div class="ngCellText" ng-class="col.colIndex()">'
                + '<span ng-class="{\'current-user-bracket\': row.getProperty(\'isCurrentUser\')}">'
                + '{{row.getProperty(col.field)}}</span></div>';
        }

        function getColumnDefs() {
            var numericCell = getNumericCellTemplate();
            var cols = [
                {field:'name', displayName:'Bracket', cellTemplate: getCellTemplateForBracketNameColumn()},
                {field:'totalPoints', displayName:'Points', width:60, cellTemplate: numericCell}
            ];
            if ($scope.model.showCeiling) {
                cols.push({
                    field: 'ceilingPoints',
                    displayName: 'Ceiling',
                    width: 65,
                    cellTemplate: numericCell
                });
            }
            cols.push({field:'num_teams_remaining', displayName:'Teams', width:60, cellTemplate: numericCell});
            return cols;
        }

        $scope.myColumnDefs = getColumnDefs();

        $scope.allBracketsGridOptions = {
            data: 'allBracketsInPool',
            enableRowSelection: false,
            rowHeight: 25,
            columnDefs: 'myColumnDefs',
            sortInfo: {fields: ['totalPoints', 'num_teams_remaining'], directions: ['desc', 'desc']},
            plugins: [new ngGridFlexibleHeightPlugin()]
        };

        if (!$scope.poolId) {
            console.log(new Error('tried to view brackets list page, without a poolId!'));
            return;
        }

        $scope.scrollTo = function(id) {
            var currentPoolPath = '/pools/' + $scope.poolId;
            if ($location.path() !== currentPoolPath) {
                // On a different page (e.g. pools list) — navigate to the pool page with bracket ID as hash
                $location.path(currentPoolPath).hash(id);
                return;
            }
            // Already on the pool page — scroll in place.
            // Saving the old hash and resetting it after scrolling prevents the page from reloading,
            // while keeping the route clean.
            var old = $location.hash();
            $location.hash(id);

            // anchor hash linking doesn't work like normal because the AngularJS router intercepts hash links, so we use this
            $anchorScroll();

            // reset to old to keep any additional routing logic from kicking in
            $location.hash(old);
        };

        // Ceiling computation: runs on all pages that use this controller
        var allTeams = teamService.findAll();
        var teamsLoaded = allTeams.$loaded();

        poolService.hasTourneyStarted().then(function(started) {
            if (!started) return;

            poolService.hasTourneyEnded().then(function(ended) {
                $scope.model.tourneyInProgress = started && !ended;
                if (ended) return;
                // Setting showCeiling triggers the $watch which rebuilds column defs
                $scope.model.showCeiling = true;
            });
        });

        var recomputeDebounceTimer = null;
        $scope.$on('$destroy', function() {
            allTeams.$destroy();
            if (recomputeDebounceTimer) clearTimeout(recomputeDebounceTimer);
        });

        function scheduleRecomputeCeilings() {
            if (recomputeDebounceTimer) clearTimeout(recomputeDebounceTimer);
            recomputeDebounceTimer = setTimeout(function() {
                $scope.$evalAsync(recomputeCeilings);
            }, 200);
        }

        function recomputeCeilings() {
            teamsLoaded.then(function() {
                if ($scope.allBracketsInPool.length === 0) return;
                if (!$scope.model.showCeiling) return;

                $scope.allBracketsInPool.forEach(function(bracket) {
                    if (!bracket.teams) return;
                    var bracketTeams = bracket.teams.map(function(teamId) {
                        var team = allTeams.$getRecord(teamId);
                        if (!team) return null;
                        return ceilingCalculator.buildTeamData(team);
                    }).filter(Boolean);

                    // Store directly on bracket for ng-grid display and sorting.
                    // trimKeys will wipe it on Firebase sync, but recomputeCeilings
                    // re-runs after every sync via the debounced watch.
                    bracket.ceilingPoints = ceilingCalculator.computeBracketCeiling(bracketTeams, FINAL_FOUR_PAIRINGS);
                });
            }).catch(function(err) {
                console.error('Failed to load teams for ceiling calculation:', err);
            });
        }

        // Live updates when team data changes
        allTeams.$watch(scheduleRecomputeCeilings);

        // Update column defs when ceiling toggle changes
        $scope.$watch('model.showCeiling', function() {
            $scope.myColumnDefs = getColumnDefs();
        });

        // any time a new bracket is added to the pool's list, add the full bracket object to the scope
        bracketService.findAllBracketIdsByPool($scope.poolId).on('child_added', function(bracketIdSnapshot) {
            var bracketId = bracketIdSnapshot.val();

            // happens after a bracket is deleted, for some reason
            if (!bracketId) return;

            var bracket = bracketService.findById(bracketId);

            // Listen for changes to the bracket; this will be called first with the complete data, then again later if/when
            // any fields in the bracket change (e.g. total points or teams remaining).

            bracket.$loaded().then(function() {
                // TODO: still need this check?
                // this will happen right after the bracket is removed
                // if (bracket === null) {
                //     return;
                // }

                // TODO: still need to do this???
                bracket.id = bracketId; // save the bracketId for later, so we can find it again

                // this will be null immediately after the bracket has been deleted
                if (bracket.ownerId) {
                    bracket.isCurrentUser = (bracket.ownerId === $scope.currentUserId);
                    var owner = userService.findById(bracket.ownerId);
                    owner.$loaded().then(function() {
                        bracket.owner = owner.name;
                    })
                }

                // has the bracket already been added to the scope? If so, remove it before we re-add it
                var arrayLength = $scope.allBracketsInPool.length;

                for (var i = 0; i < arrayLength; i++) {
                    // for some reason, when brackets are updated, they don't (always?) have an "id" property
                    if ($scope.allBracketsInPool[i].id && $scope.allBracketsInPool[i].id === bracketId) {

                        // If the bracket has already been added to the scope, remove it so we can add it again.
                        // Note that removing the element from the array, calling $scope.apply(), and then re-adding it is the
                        // only way to make ng-grid aware of the change so it will re-render the updated bracket in the grid.
                        $scope.allBracketsInPool.splice(i, 1);
                        $scope.$apply();
                    }
                }

                $scope.allBracketsInPool.push(bracket);
                scheduleRecomputeCeilings();
            });
        });

        // when a bracket is removed, remove it from the backing array
        bracketService.findAllBracketIdsByPool($scope.poolId).on('child_removed', function(bracketId) {
            var arrayLength = $scope.allBracketsInPool.length;

            for (var i = 0; i < arrayLength; i++) {
                if ($scope.allBracketsInPool[i].$id === bracketId.val()) {
                    $scope.allBracketsInPool.splice(i, 1);
                    break;
                }
            }
        })
    }
]);
