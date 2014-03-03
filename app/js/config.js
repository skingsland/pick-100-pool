'use strict';

// Declare app level module which depends on filters, and services
angular.module('myApp.config', [])

   // version of this seed app is compatible with angularFire 0.6
   // see tags for other versions: https://github.com/firebase/angularFire-seed/tags
   .constant('version', '0.6')

   // where to redirect users if they need to authenticate (see module.routeSecurity)
   .constant('loginRedirectPath', '/login')
//   .constant('loginRedirectPath', '/home')

   .constant('FBURL', 'https://pick13pool.firebaseio.com')
