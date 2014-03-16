"use strict";

angular.module('myApp.routes', ['ngRoute'])

   // configure views; the authRequired parameter is used for specifying pages
   // which should only be available while logged in
   .config(['$routeProvider', function($routeProvider) {
      $routeProvider
          .when('/home', {
             templateUrl: 'partials/home.html'
          })
          .when('/account', {
             authRequired: true,
             templateUrl: 'partials/account.html',
             controller: 'AccountCtrl'
          })
          .when('/login', {
             templateUrl: 'partials/login.html',
             controller: 'LoginCtrl'
          })

          .when('/pools',               { templateUrl: 'views/pools/list.html', controller: 'PoolsController', authRequired: false })
          .when('/pools/create',        { templateUrl: 'views/pools/edit.html', controller: 'PoolsController', authRequired: true })
          .when('/pools/:poolId',       { templateUrl: 'views/pools/view.html', controller: 'PoolsController', authRequired: false })
          .when('/pools/:poolId/edit',  { templateUrl: 'views/pools/edit.html', controller: 'PoolsController', authRequired: true })

          .when('/pools/:poolId/brackets', {
              templateUrl: 'views/brackets/list.html'
          })
          .when('/pools/:poolId/brackets/create', {
              templateUrl: 'views/brackets/edit.html',
              authRequired: true
          })
          .when('/pools/:poolId/brackets/:bracketId', {
              templateUrl: 'views/brackets/view.html'
          })
          .when('/pools/:poolId/brackets/:bracketId/edit', {
              templateUrl: 'views/brackets/edit.html',
              authRequired: true
          })
          .otherwise({redirectTo: '/home'});
   }]);
