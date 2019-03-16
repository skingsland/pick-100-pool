"use strict";

// when $routeProvider.whenAuthenticated() is called, the path is stored in this list
// to be used by authRequired() in the services below
var securedRoutes = [];

angular.module('myApp.security', ['ngRoute', 'firebase', 'myApp.config'])

/**
 * Adds a special `whenAuthenticated` method onto $routeProvider. This special method,
 * when called, waits for auth status to be resolved asynchronously, and then fails/redirects
 * if the user is not properly authenticated.
 *
 * The promise either resolves to the authenticated user object and makes it available to
 * dependency injection, or rejects the promise if user is not logged in, forcing a redirect to the /login page
 */
  .config(['$routeProvider', function ($routeProvider) {
    // credits for this idea: https://groups.google.com/forum/#!msg/angular/dPr9BpIZID0/MgWVluo_Tg8J
    // unfortunately, a decorator cannot be use here because they are not applied until after
    // the .config calls resolve, so they can't be used during route configuration, so we have
    // to hack it directly onto the $routeProvider object
    $routeProvider.whenAuthenticated = function (path, route) {
      securedRoutes.push(path); // store all secured routes for use with authRequired() below
      route.resolve = route.resolve || {};
      route.resolve.user = ['$firebaseAuth', function ($firebaseAuth) {
        return $firebaseAuth().$requireSignIn();
      }];
      $routeProvider.when(path, route);
      return this;
    }
  }])

/**
 * Apply some route security. Any route's resolve method can reject the promise with
 * { authRequired: true } to force a redirect. This method enforces that and also watches
 * for changes in auth status which might require us to navigate away from a path
 * that we can no longer view.
 */
  .run(['$rootScope', '$firebaseAuth', '$location', 'loginRedirectPath',
    function ($rootScope, $firebaseAuth, $location, loginRedirectPath) {
      // watch for login status changes and redirect if appropriate
      $firebaseAuth().$onAuthStateChanged(check);

      // some of our routes may reject resolve promises with the special {authRequired: true} error
      // this redirects to the login page whenever that is encountered
      $rootScope.$on("$routeChangeError", function (e, next, prev, err) {
        if (err === "AUTH_REQUIRED") {
          $location.path(loginRedirectPath);
        }
      });

      function check(user) {
        if (!user && authRequired($location.path())) {
          // console.log('auth check failed', user, $location.path()); //debug
          $location.path(loginRedirectPath);
        }
      }

      function authRequired(path) {
        // console.log('authRequired?', path, securedRoutes.indexOf(path)); //debug
        return securedRoutes.indexOf(path) !== -1;
      }
    }
  ]);

