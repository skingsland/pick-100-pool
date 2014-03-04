'use strict';

// add this controller to the existing controllers module
angular.module('myApp.controllers').controller('HeaderController',
           ['$rootScope', '$scope', '$location', 'syncData', 'loginService',
    function($rootScope,   $scope,   $location,   syncData,   loginService) {
        // bind the user's data to the scope, once they're logged in

        $scope.user = {};

        $rootScope.$on('$firebaseSimpleLogin:login', function() {
            syncData(['users', $scope.auth.user.uid]).$bind($scope, 'user').then(function(unBind) {
                $scope.unBindAccount = unBind;
            });
        });


        $scope.logout = function() {
            loginService.logout();

            // clear the old user's firebase and scope bindings
            $scope.unBindAccount();
            $scope.user = {};
        };

        $scope.navbarEntries = [
//        {
//          "title": "Pools",
//          "link": "/pools"
//        },
//        {
//          "title": "Brackets",
//          "link": "/brackets"
//        }
        ];

        $scope.$on('$routeChangeSuccess', function() {
            $scope.navbarEntries.forEach(
              function(data) {
                data.isActive = ($location.path().indexOf(data.link) == 0);
              }
            )
        })
    }])
