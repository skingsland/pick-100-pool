// the ExpressJS-based web server for pick100pool

var http = require('http');
var path = require('path');
var express = require('express');
var theScore = require('./theScore.js');

var router = express();
var server = http.createServer(router);

router.use(express.static(path.resolve(__dirname, 'client')));

// how often do we check for updated scores?
var minutes = 2;
var the_interval = minutes * 60 * 1000;

// call once right away, then schedule for repeated execution
theScore.downloadGamesAndUpdateFirebase();

setInterval(function() {
    theScore.downloadGamesAndUpdateFirebase();
}, the_interval);

server.listen(process.env.PORT || 5000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("pick-100-pool web server listening at", addr.address + ":" + addr.port);
});
