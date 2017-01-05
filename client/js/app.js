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
       'ui.grid',
       'ui.grid.resizeColumns',
       'ui.grid.selection',
       'timer'
    ])
    .run(['loginService', '$rootScope', '$templateCache', function(loginService, $rootScope, $templateCache) {
        $rootScope.auth = loginService.init();
    }])
    .filter('trustHtml', function($sce) {
        return function(val) {
            return $sce.trustAsHtml(val);
        };
    })
