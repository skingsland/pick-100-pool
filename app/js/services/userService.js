angular.module('myApp.services').service('userService', ['usersRef', function(usersRef) {
    this.findById = function (userId) {
        return usersRef.$child(userId);
    };
}]);
