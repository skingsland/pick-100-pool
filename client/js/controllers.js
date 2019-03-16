'use strict';

/* Controllers */

angular.module('myApp.controllers', ['firebase', 'ui.bootstrap'])
   .controller('LoginCtrl', ['$scope', '$location', '$route', 'firebaseRef',
                     function($scope,   $location,   $route,   firebaseRef) {
      $scope.email = null;
      $scope.pass = null;
      $scope.confirm = null;
      $scope.createMode = false;

      $scope.login = function() {
         $scope.err = null;

         if( !$scope.email ) {
            $scope.err = 'Please enter an email address';
         }
         else if( !$scope.pass ) {
            $scope.err = 'Please enter a password';
         }
         else {
            $scope.auth.$signInWithEmailAndPassword($scope.email, $scope.pass).then(function(firebaseUser) {
               console.log("Logged in as:", firebaseUser.uid);

               // TODO: should I set isLoggedIn and currentUserId here on the $rootScope,
               //  and in createAccount() and other auth controller methods? Or is it sufficient to rely on the
               //  $onAuthStateChanged() callback in app.js?
               // $scope.isLoggedIn = true;
               // $scope.currentUserId = firebaseUser.uid;

               // reload the current page, so the parts that should be displayed or hidden based on isLoggedIn will be rendered correctly
               $route.reload();
            }).catch(function(error) {
               console.error("Authentication failed:", error);

               if (error.code === 'auth/wrong-password') {
                  $scope.err = 'Incorrect password, please try again.';
               } else {
                  $scope.err = error.message;
               }
            });
         }
      };

      $scope.createAccount = function() {
         $scope.err = null;

         if(isValidEmailAddressAndPassword()) {
            $scope.auth.$createUserWithEmailAndPassword($scope.email, $scope.pass).then(function(firebaseUser) {
               console.log("User " + firebaseUser.uid + " created successfully, and logged in!");

               var firstPartOfEmail = $scope.email.substr(0, $scope.email.indexOf('@'));

               // create their user profile, with an auto-generated username based on their email address
               firebaseRef('users', firebaseUser.uid).set({
                  email: $scope.email,
                  name: firstPartOfEmail
               }, function(error) {
                  if (error) {
                     console.error(error);
                     $scope.err = error;
                  } else {
                     $location.path('/pools');
                  }
               });
            }).catch(function(error) {
               console.error(error);
               $scope.err = error.message;
            });
         }
      };

      $scope.resetPassword = function() {
         $scope.err = null;
         if (!$scope.email) {
            $scope.err = 'Please enter an email address';
         }
         else {
            $scope.auth.$sendPasswordResetEmail($scope.email).then(function() {
               console.log("Password reset email sent successfully!");

               $scope.msg = 'Just sent you a password reset email.'
            }).catch(function(error) {
               console.error(error);
               
               $scope.err = error;
            });
         }
      };

      function isValidEmailAddressAndPassword() {
         if( !$scope.email ) {
            $scope.err = 'Please enter an email address';
         }
         else if( !$scope.pass || !$scope.confirm ) {
            $scope.err = 'Please enter a password';
         }
         else if( $scope.pass !== $scope.confirm ) {
            $scope.err = 'Passwords do not match';
         }
         return !$scope.err;
      }
   }])

   .controller('AccountCtrl', ['$scope', '$timeout',
                       function($scope,   $timeout) {
      $scope.oldpass = null;
      $scope.newpass = null;
      $scope.confirm = null;

      $scope.reset = function() {
         $scope.err = null;
         $scope.msg = null;
         $scope.emailerr = null;
         $scope.emailmsg = null;
      };

      $scope.changePassword = function() {
         $scope.reset();

         if (!$scope.newpass) {
            $timeout(function() { $scope.err = 'Please enter a new password'; });
         }
         else if ($scope.newpass !== $scope.confirm) {
            $timeout(function() { $scope.err = 'Passwords do not match'; });
         }
         else {
            $scope.auth.$updatePassword($scope.newpass).then(function() {
               console.log("Password changed successfully!");

               $scope.oldpass = null;
               $scope.newpass = null;
               $scope.confirm = null;
               $scope.msg = 'Password updated!';

               // not technically needed, but forces Angular to update the view a lot sooner
               // $scope.$apply();
            }).catch(function(error) {
               console.error(error);

               if (error.code === 'auth/requires-recent-login') {
                  $scope.err = "Changing your password requires a more recent login. Please log out, log back in," +
                      " and then try changing your password again. Sorry, I know it's a pain. - Steve";
               } else {
                  $scope.err = error.message;
               }
            });
         }
      };
   }]
);
