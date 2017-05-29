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
    app = express();

// receive requests
app.use(compression())
   .use(efu({
     safeFileNames: true,
     limits: { fileSize: 4 * 1024 * 1024 }
   }));

app.post('/', function(req, res){
  if(!req.files) return req.status(400).send('nofile');

  for(var i in req.files){
    var f = req.files[i];

    // validate files
    if(f.name.toLowerCase().endsWith('stormreplay')
    && f.mimetype === 'application/octet-stream'){
      process(f);
    } else {
      logger.log('info', '[FILE] rejected file ' + f.name);
    }

  }
});

// process a replay
function process(file){
  // move file to local filestorage
  var fname = Math.floor(Math.random()*100000000);
  file.mv(__dirname + '/filetmp/' + fname + '.StormReplay', function(err){
    if(err){
      logger.log('info', '[FILE] download error: ' + err.message);
    } else {
      runhp(fname, handleResults);
    }
  });
}

// handle results of a replay
function handleResults(fname, res, err){

  if(err){
    logger.log('info', 'error processing replay: '+err);
  } else {

    // printout results
    logger.log('info', ' ---------- ' + fname + ' ---------- ');
    var data = res[0];
    logger.log('info', '[REPLAY] MAP: ' + data.m_title);
    for(var i = 0; i < 10; i++){
      var p = data.m_playerList[i];
      logger.log('info', '[REPLAY] Team ' + (p.m_teamId === 0 ? 'BLUE' : 'RED') + ' / ' + p.m_name + ': ' + p.m_hero);
    }

    // delete the replay
    fs.unlink(__dirname + '/filequeue/' + fname + '.StormReplay', (err) => {
      if(err) logger.log('[FILE] delete error '+err.message);
    });

  }

}

// reject wildcard requests
app.get('*', function(req, res){
  res.status(404);
});

// start the server
app.listen(config.port, function(){
  logger.log('info', 'listening on port '+config.port);
});
