angular.module('myApp.services').service('userService', [
            'usersRef', '$firebaseObject', '$firebaseAuth',
    function(usersRef,   $firebaseObject,   $firebaseAuth) {

    this.findById = function (userId) {
        return $firebaseObject(usersRef.child(userId));
    };
    this.getCurrentUserId = function () {
        var authObj = $firebaseAuth();
        var currentUser = authObj.$getAuth();

        if (currentUser) {
            //console.log("Immediate User ID:", currentUser.uid);
            return Promise.resolve(currentUser.uid);
        } else {
            return authObj.$waitForSignIn().then(function(user) {
                if (user) {
                    //console.log("awaited User ID:", user.uid);
                    return user.uid;
                }
                return null;
            });
        }
    }
}]);
