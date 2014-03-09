'use strict';

// Declare app level module which depends on filters, and services
angular.module('myApp',
      ['myApp.config',
       'myApp.routes',
       'myApp.services',
       'myApp.directives',
       'myApp.controllers',
       'simpleLoginTools',
       'routeSecurity'
    ])
   .run(['loginService', '$rootScope', function(loginService, $rootScope) {
        $rootScope.auth = loginService.init();
   }]);
