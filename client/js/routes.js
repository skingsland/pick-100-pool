"use strict";

angular.module('myApp.routes', ['ngRoute', 'myApp.security'])

   .config(['$routeProvider', function($routeProvider) {
      $routeProvider
          .when('/home', {
             templateUrl: 'partials/home.html'
          })
          .whenAuthenticated('/account', {
             templateUrl: 'partials/account.html',
             controller: 'AccountCtrl'
          })
          .when('/login', {
             templateUrl: 'partials/login.html',
             controller: 'LoginCtrl'
          })
          .when('/pools', {
              templateUrl: 'views/pools/list.html',
              controller: 'PoolsController'
          })
          .whenAuthenticated('/pools/create', {
              templateUrl: 'views/pools/edit.html',
              controller: 'PoolsController'
          })
          .when('/pools/:poolId', {
              templateUrl: 'views/pools/view.html',
              controller: 'PoolsController'
          })
          .whenAuthenticated('/pools/:poolId/edit', {
              templateUrl: 'views/pools/edit.html',
              controller: 'PoolsController'
          })
          .when('/pools/:poolId/brackets', {
              templateUrl: 'views/brackets/list.html'
          })
          .whenAuthenticated('/pools/:poolId/brackets/create', {
              templateUrl: 'views/brackets/edit.html'
          })
          .when('/pools/:poolId/brackets/:bracketId', {
              templateUrl: 'views/brackets/view.html'
          })
          .whenAuthenticated('/pools/:poolId/brackets/:bracketId/edit', {
              templateUrl: 'views/brackets/edit.html'
          })

          .otherwise({redirectTo: '/home'});
   }]);
