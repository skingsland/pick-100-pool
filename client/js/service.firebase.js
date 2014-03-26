
angular.module('myApp.service.firebase', ['firebase'])

   // a simple utility to create references to Firebase paths
   .factory('firebaseRef', ['Firebase', 'FBURL', function(Firebase, FBURL) {
      /**
       * @function
       * @name firebaseRef
       * @param {String|Array...} path
       * @return a Firebase instance
       */
      return function(path) {
          var pathArgs = [FBURL].concat(Array.prototype.slice.call(arguments));

          return new Firebase(pathRef(pathArgs));
      }
   }])

   // a simple utility to create $firebase objects from angularFire
   .service('syncData', ['$firebase', 'firebaseRef', function($firebase, firebaseRef) {
      /**
       * @function
       * @name syncData
       * @param {String|Array...} path
       * @param {int} [limit]
       * @return a Firebase instance
       */
      return function(path, limit) {
         var ref = firebaseRef(path);
         limit && (ref = ref.limit(limit));
         return $firebase(ref);
      }
   }])

    .factory('tournamentRef', ['syncData', 'FIREBASE_TOURNAMENT_NAME',
                       function(syncData,   FIREBASE_TOURNAMENT_NAME) {
        return syncData(['tournaments', FIREBASE_TOURNAMENT_NAME]);
    }])
    .factory('usersRef', ['syncData',
                  function(syncData) {
        return syncData('users');
    }])

function pathRef(args) {
   for(var i=0; i < args.length; i++) {
      if( typeof(args[i]) === 'object' ) {
         args[i] = pathRef(args[i]);
      }
   }
   return args.join('/');
}