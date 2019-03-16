angular.module('myApp.services').service('userService', ['usersRef', '$firebaseObject', function(usersRef, $firebaseObject) {
    this.findById = function (userId) {
        return $firebaseObject(usersRef.child(userId));
    };
}]);
