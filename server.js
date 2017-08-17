'use strict';

// includes
var logger = require('winston');
const config = require('./includes/config');
var processor = require('./includes/processor');

// express middleware
var compression = require('compression');
var efu = require('express-fileupload');

// database
var mongoose = require('mongoose');
mongoose.connect(config.mongodb_key);
mongoose.Promise = require('bluebird');

// server
var express = require('express'),
    app = express(),
    serv;

// redirect to https
if(!config.debug){
  serv = require('http').Server(app);
} else {
  // https server created in this way only on localhost testing (debug mode)
  serv = require('https').createServer({
    key: config.ssl_key,
    cert: config.ssl_cert,
    requestCert: false,
    rejectUnauthorized: false
  }, app);
}

var io = require('socket.io')(serv);

// receive requests
app.use(compression())
   .use(efu({
     safeFileNames: /[^a-zA-Z0-9.]+/g,
     limits: { fileSize: 4 * 1024 * 1024 }
   }))
   .use(function(req, res, next){
     res.header('Access-Control-Allow-Origin', '*');
     res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
     res.header('Access-Control-Allow-Headers', 'Content-Type');
     next();
   });

app.post('/', processor.receive);

// handle socket creation and disconnect (for polling)
io.on('connection', function(socket){

  // when client submits a polling path through socket.io
  socket.on('pollPath', function(path){
    processor.registerPoll(path, socket, function(success, path, status){
      if(success){
        socket.path = path;
        socket.emit('fileProgress', status);
      } else {
        socket.disconnect();
        logger.log('info', '[POLL] incorrect path requested');
      }
    });
  });
  socket.on('disconnect', function(){
    if(socket.path) processor.disconnectPoll(socket.path);
    socket.emit('badPoll');
    socket.disconnect();
  });
  socket.on('error', function(err){
    logger.log('info', '[POLL] client abruptly reset connection');
  });

});

// reject all GET requests
app.get('*', function(req, res){
  res.status(404);
});

// start the server
serv.listen(config.port, function(){
  logger.log('info', 'listening on port '+config.port);
});
