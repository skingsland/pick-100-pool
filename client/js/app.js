'use strict';

// Declare app level module which depends on filters, and services
angular.module('myApp',
    ['firebase',
     'myApp.config',
     'myApp.security',
     'myApp.routes',
     'myApp.services',
     'myApp.directives',
     'myApp.controllers',
     'ngGrid',
     'smart-table',
     'timer'
    ])
    .run(['firebase', '$rootScope', '$firebaseAuth', '$templateCache', function(firebase, $rootScope, $firebaseAuth, $templateCache) {
        // https://github.com/firebase/angularfire/blob/master/docs/reference.md#firebaseauth
        $rootScope.auth = $firebaseAuth();

        // $rootScope.isLoggedIn = false;
        // $rootScope.currentUserId = null;

        $rootScope.auth.$onAuthStateChanged(function(firebaseUser) {
            // Add a boolean variable to the scope that can be used by ng-show and ng-hide to control whether content is shown,
            // based on whether a user is logged in or not.
            $rootScope.isLoggedIn = !!firebaseUser;

            // console.log('$onAuthStateChanged() fired, isLoggedIn:', $rootScope.isLoggedIn, 'firebaseUser:', firebaseUser);

            if ($rootScope.isLoggedIn) {
                $rootScope.currentUserId = firebaseUser.uid;
            } else {
                $rootScope.currentUserId = null;
            }
        });

        $templateCache.put('headerCellTemplate.html',
          "<div class=\"ngHeaderSortColumn {{col.headerClass}}\" ng-style=\"{'cursor': col.cursor}\" ng-class=\"{ 'ngSorted': !noSortVisible }\">\r" +
          "    <div ng-click=\"col.sort($event)\" ng-class=\"'colt' + col.index\" class=\"ngHeaderText\"" +

          // original version:
//        "    >{{col.displayName}}</div>\r" +
          // changed version, to support embedding (safe) HTML in ng-grid column headers
          "         ng-bind-html=\"col.displayName | trustHtml\"></div>\r" +

          "    <div class=\"ngSortButtonDown\" ng-show=\"col.showSortButtonDown()\"></div>\r" +
          "    <div class=\"ngSortButtonUp\" ng-show=\"col.showSortButtonUp()\"></div>\r" +
          "    <div class=\"ngSortPriority\">{{col.sortPriority}}</div>\r" +
          "    <div ng-class=\"{ ngPinnedIcon: col.pinned, ngUnPinnedIcon: !col.pinned }\" ng-click=\"togglePin(col)\" ng-show=\"col.pinnable\"></div>\r" +
          "</div>\r" +
          "<div ng-show=\"col.resizable\" class=\"ngHeaderGrip\" ng-click=\"col.gripClick($event)\" ng-mousedown=\"col.gripOnMouseDown($event)\"></div>"
        );

    }])
    .filter('trustHtml', function($sce) {
        return function(val) {
            return $sce.trustAsHtml(val);
        };
    })
    .factory('moment', function ($window) {
        return $window.moment;
    });

// TODO: is this needed, to declare the dependency from the 'myApp.services' module to the other two modules?
angular.module('myApp.services', ['firebase', 'myApp.service.firebase']);