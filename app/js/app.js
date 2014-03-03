'use strict';

// Declare app level module which depends on filters, and services
angular.module('myApp',
      ['myApp.config',
       'myApp.routes',
       'myApp.filters',
       'myApp.services',
       'myApp.directives',
       'myApp.controllers',
       'simpleLoginTools',
       'routeSecurity'])
   .run(['loginService', '$rootScope', 'FBURL', function(loginService, $rootScope, FBURL) {
        $rootScope.auth = loginService.init();
        $rootScope.FBURL = FBURL;
   }]);
