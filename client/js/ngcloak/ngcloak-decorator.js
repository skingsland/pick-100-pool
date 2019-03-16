/**
 * This module monitors angularFire's authentication and performs actions based on authentication state.
 *
 * Just like other ng-cloak ops, this works best if you put the following into your CSS:
 [ng\:cloak], [ng-cloak], [data-ng-cloak], [x-ng-cloak], .ng-cloak, .x-ng-cloak {
        display: none !important;
   }
 */
angular.module('myApp')
  .config(['$provide', function($provide) {
    // adapt ng-cloak to wait for auth before it does its magic
    $provide.decorator('ngCloakDirective', ['$delegate', '$rootScope',
      function($delegate, $rootScope) {
        var directive = $delegate[0];
        // make a copy of the old directive
        var _compile = directive.compile;
        directive.compile = function(element, attr) {
            $rootScope.auth.$waitForSignIn().then(function() {
            // after auth, run the original ng-cloak directive
            _compile.call(directive, element, attr);
          });
        };
        // return the modified directive
        return $delegate;
      }]);
  }]);
