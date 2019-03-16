
angular.module('myApp.service.firebase', ['firebase'])

   // a simple utility to create references to Firebase paths
   .factory('firebaseRef', ['firebase', function(firebase) {
      /**
       * @function
       * @name firebaseRef
       * @param {String|Array...} path
       * @return a Firebase instance
       */
      return function(path) {
          var pathArgs = Array.prototype.slice.call(arguments);

          return firebase.database().ref(pathRef(pathArgs));
      }
   }])

    .factory('tournamentRef', ['$firebaseObject', 'firebaseRef', 'FIREBASE_TOURNAMENT_ID',
                       function($firebaseObject, firebaseRef,   FIREBASE_TOURNAMENT_ID) {
        return firebaseRef('tournaments', FIREBASE_TOURNAMENT_ID);
    }])

    .factory('usersRef', ['firebaseRef', function(firebaseRef) {
        return firebaseRef('users');
    }]);

function pathRef(args) {
    for (var i = 0; i < args.length; i++) {
      if (angular.isArray(args[i])) {
        args[i] = pathRef(args[i]);
      }
      else if( typeof args[i] !== 'string' ) {
        throw new Error('Argument '+i+' to pathRef is not a string: '+args[i]);
      }
    }
    return args.join('/');
}