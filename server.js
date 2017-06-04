'use strict';

// includes
var logger = require('winston');
const config = require('./includes/config');
var runhp = require('./runhp');

// express middleware
var compression = require('compression');

// file uploading
var fs = require('fs-extra');
var efu = require('express-fileupload');

// database
var mongoose = require('mongoose');
var db_Replay = require('./models/replay');

// server
var express = require('express'),
    app = express(),
    serv = require('http').Server(app),
    io = require('socket.io')(serv);

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

app.post('/', function(req, res){
  if(!req.files) return res.status(200).send('nofile');

  // send a path for polling
  var pollPath = Math.floor(Math.random()*10000000);
  polls[pollPath] = new Poll(pollPath, Object.keys(req.files).length);
  res.status(200).send(pollPath.toString());
  setTimeout(function(){
    var d = new Date().getTime();
    for(var i in polls){
      if(d - polls[i].time > 1000*60*15 && polls[i].status.length >= polls[i].total && !polls[i].socket){
        logger.log('[POLL]', 'poll expired');
        delete polls[i];
      }
    }
  }, 1000*60*20);

  queueFiles(req.files, pollPath);
});

// run through files but pause every nth file to allow async operations to finish
function queueFiles(fileobj, pollPath){
  var n = 0;
  var files = Object.keys(fileobj).map(
    function(key){
      return fileobj[key];
    }
  );

  function start(){
    for(var i=0; i<5; i++){
      if(files[i+n]){
        var f = files[i+n];

        // validate files
        if(f.name.toLowerCase().endsWith('.stormreplay')
        && f.mimetype === 'application/octet-stream'){
          process(f, pollPath);
        } else {
          logger.log('info', '[FILE] rejected file ' + f.name);
          pollRes(pollPath, 0);
        }

        // pause and start next 10
        if(i === 4 && files[i+n+1]){
          n += 5;
          setTimeout(start, 100);
        }

      } else {
        break;
      }
    }
  }

  start();
}

// process a replay
function process(file, pollPath){
  // move file to local filestorage
  var fname = Math.floor(Math.random()*1000000000);
  file.mv(__dirname + '/filetmp/' + fname + '.StormReplay', function(err){
    if(err){
      logger.log('info', '[FILE] download error: ' + err.message);
      pollRes(pollPath, 0);
      fs.unlink(__dirname + '/filetmp/' + fname + '.StormReplay', (err) => {
        if(err) logger.log('[FILE] delete error '+err.message);
      });
    } else {
      runhp(fname, pollPath, handleResults);
    }
  });
}

// handle results of a replay
function handleResults(fname, pollPath, res, err){

  if(err){

    logger.log('info', '[REPLAY] '+err);
    pollRes(pollPath, 0);
    fs.unlink(__dirname + '/filetmp/' + fname + '.StormReplay', (err) => {
      if(err) logger.log('[FILE] delete error '+err.message);
    });

  } else {
    try {
      // printout results
      /**logger.log('info', ' ---------- ' + fname + ' ---------- ');
      var data = res[0];
      logger.log('info', '[REPLAY] MAP: ' + data.m_title);
      for(var i = 0; i < 10; i++){
        var p = data.m_playerList[i];
        logger.log('info', '[REPLAY] Team ' + (p.m_teamId === 0 ? 'BLUE' : 'RED') + ' / ' + p.m_name + ': ' + p.m_hero);
      }**/
      pollRes(pollPath, 1);

    // catch errors
    } catch(e) {
      pollRes(pollPath, 0);
    }

    // delete the replay
    fs.unlink(__dirname + '/filetmp/' + fname + '.StormReplay', (err) => {
      if(err) logger.log('[FILE] delete error '+err.message);
    });
  }
}

// polling objects
var polls = {};
var Poll = function(path, total){
  this.time = new Date().getTime();
  this.path = path;
  this.total = total;
  this.status = [];
}

// handle socket creation and disconnect (for polling)
io.on('connection', function(socket){

  socket.on('pollPath', function(path){
    if(polls[path]){
      polls[path].socket = socket;
      socket.path = path;
      socket.emit('fileProgress', polls[path].status);
    } else {
      socket.disconnect();
      logger.log('info', '[POLL] incorrect path requested');
    }
  });
  socket.on('disconnect', function(){
    if(socket.path) delete polls[socket.path];
    socket.disconnect();
  });
});

// returns a response to a polling socket
function pollRes(pollPath, responseCode){
  var p = polls[pollPath];
  if(!p) return false;

  p.status.push(responseCode);

  if(p.socket)
    p.socket.emit('fileComplete', p.status.length, responseCode);
}

// reject wildcard requests
app.get('*', function(req, res){
  res.status(404);
});

// start the server
serv.listen(config.port, function(){
  logger.log('info', 'listening on port '+config.port);
});
