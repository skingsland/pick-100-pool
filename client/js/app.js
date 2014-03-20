'use strict';

// Declare app level module which depends on filters, and services
angular.module('myApp',
      ['myApp.config',
       'myApp.routes',
       'myApp.services',
       'myApp.directives',
       'myApp.controllers',
       'simpleLoginTools',
       'routeSecurity',
       'ngGrid',
    ])
    .run(['loginService', '$rootScope', '$templateCache', function(loginService, $rootScope, $templateCache) {
        $rootScope.auth = loginService.init();

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
