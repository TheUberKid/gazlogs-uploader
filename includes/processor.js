'use strict'

// includes
var logger = require('winston');
var async = require('async');
var heroprotocol = require('./heroprotocol');
var getBattleTags = require('./battletags');

// file uploading
var fs = require('fs-extra');

// database
var db_Replay = require('../models/replay');
var db_User = require('../models/user');

// dictionaries
var dictionary = {
  gametypes: {
    50041: 2, // training
    50021: 3, // vs. ai
    50031: 4, // brawl
    50051: 5, // unranked
    50001: 6, // quick match
    50061: 7, // hero league
    50071: 8  // team league
  },
  payoffs: {
    5: 100, // unranked
    6: 50, // quick match
    7: 100, // hero league
    8: 125 // team league
  }
}

// middleware for receiving files
module.exports.receive = function(req, res){
  if(!req.files) return res.status(200).send('nofile');

  // send a path for the client to poll the server for results via socket.io
  var pollPath = Math.floor(Math.random()*10000000);
  polls[pollPath] = new Poll(pollPath, Object.keys(req.files).length, req.body ? req.body.ultoken : undefined);
  res.status(200).send(pollPath.toString());

  // queue submitted files for processing
  queueFiles(req.files, pollPath);
}

// processing file queue
var queue = async.queue(function(args, callback){
  // validate files for proper extension and mimetype
  if(args.f.name.toLowerCase().endsWith('.stormreplay')
  && args.f.mimetype === 'application/octet-stream'){
    process(args.f, args.pollPath, callback);
  } else {
    logger.log('info', '[FILE] rejected file: ' + args.f.name);
    pollRes(args.pollPath, 0);
    callback();
  }
}, 2);

// process a replay
function process(file, pollPath, callback){
  // move file to local filestorage
  var fname = Math.floor(Math.random()*1000000000);
  file.mv(__dirname + '/../filetmp/' + fname + '.StormReplay', function(err){
    if(err){
      logger.log('info', '[FILE] move error: ' + err.message);
      pollRes(pollPath, 0, fname);
      callback();
      fs.unlink(__dirname + '/../filetmp/' + fname + '.StormReplay', (err) => {
        if(err) logger.log('info', '[FILE] delete error: ' + err.message);
      });
    } else {
      // all good? extract data from the replay
      runReplay(fname, pollPath, callback);
    }
  });
}

// run handle results of a replay
function runReplay(fname, pollPath, callback){

  // get lightweight data first for validation purposes
  var file = __dirname + '/../filetmp/' + fname + '.StormReplay'
  const details = heroprotocol.get(heroprotocol.DETAILS, file);
  const header = heroprotocol.get(heroprotocol.HEADER, file);
  const initdata = heroprotocol.get(heroprotocol.INITDATA, file).m_syncLobbyState;

  if(details && header && initdata){
    try {

      // check if gametype matches
      var gametype = dictionary.gametypes[initdata.m_gameDescription.m_gameOptions.m_ammId];
      if(!gametype || gametype < 5){
        pollRes(pollPath, gametype ? gametype : 0, fname);
        callback();
      } else {

        // if valid gametype, check for duplicates
        var id = initdata.m_gameDescription.m_randomValue;
        db_Replay.count({Id: id}, function(err, count){
          if(err){
            logger.log('info', '[REPLAY] database count error: ' + err.message);
            pollRes(pollPath, 0, fname);
            callback();
          } else if(count > 0){
            pollRes(pollPath, 1, fname); // duplicate found
            callback();
          } else {

            // otherwise, good to go. Read heavier objects
            var scores = heroprotocol.get(heroprotocol.TRACKER_EVENTS, file, {
              '_event' : ['NNet.Replay.Tracker.SScoreResultEvent']
            });
            const talents = heroprotocol.get(heroprotocol.TRACKER_EVENTS, file, {
              'm_eventName' : ['EndOfGameTalentChoices']
            });
            if(!scores || !talents){
              logger.log('info', '[REPLAY] tracker events processing error');
              pollRes(pollPath, 0, fname);
              callback();
              return 0;
            }

            // prepare for database entry
            var tmp = scores[scores.length-1].m_instanceList;
            scores = {};
            for(var i in tmp) scores[tmp[i].m_name] = tmp[i].m_values;
            var mvp = !!scores.EndOfMatchAwardMVPBoolean;

            // add each player to database object
            var players = [];
            for(var i=0; i<10; i++){
              var p = details.m_playerList[i];
              var t = talents[i].m_stringData;
              players.push({
                Name: p.m_name,
                BattleTag: getBattleTags(file, p.m_name),
                ToonId: p.m_toon.m_id,
                AI: p.m_toon.m_id === 0,
                Hero: initdata.m_lobbyState.m_slots[i].m_hero,
                Team: p.m_teamId,
                SoloKill: scores.SoloKill[i][0].m_value,
                Assists: scores.Assists[i][0].m_value,
                Deaths: scores.Deaths[i][0].m_value,
                ExperienceContribution: scores.ExperienceContribution[i][0].m_value,
                Healing: scores.Healing[i][0].m_value,
                SelfHealing: scores.SelfHealing[i][0].m_value,
                SiegeDamage: scores.SiegeDamage[i][0].m_value,
                StructureDamage: scores.StructureDamage[i][0].m_value,
                MinionDamage: scores.MinionDamage[i][0].m_value,
                CreepDamage: scores.CreepDamage[i][0].m_value,
                SummonDamage: scores.SummonDamage[i][0].m_value,
                HeroDamage: scores.HeroDamage[i][0].m_value,
                DamageTaken: scores.DamageTaken[i][0].m_value,
                MercCampCaptures: scores.MercCampCaptures[i][0].m_value,
                TimeSpentDead: scores.TimeSpentDead[i][0].m_value,
                TimeCCdEnemyHeroes: scores.TimeCCdEnemyHeroes[i][0].m_value,
                TimeSilencingEnemyHeroes: scores.TimeSilencingEnemyHeroes[i][0].m_value,
                TimeRootingEnemyHeroes: scores.TimeRootingEnemyHeroes[i][0].m_value,
                TimeStunningEnemyHeroes: scores.TimeStunningEnemyHeroes[i][0].m_value,
                ClutchHealsPerformed: scores.ClutchHealsPerformed[i][0].m_value,
                EscapesPerformed: scores.EscapesPerformed[i][0].m_value,
                VengeancesPerformed: scores.VengeancesPerformed[i][0].m_value,
                OutnumberedDeaths: scores.OutnumberedDeaths[i][0].m_value,
                TeamfightEscapesPerformed: scores.TeamfightEscapesPerformed[i][0].m_value,
                TeamfightHealingDone: scores.TeamfightHealingDone[i][0].m_value,
                TeamfightDamageTaken: scores.TeamfightDamageTaken[i][0].m_value,
                TeamfightHeroDamage: scores.TeamfightHeroDamage[i][0].m_value,
                HighestKillStreak: scores.HighestKillStreak[i][0].m_value,
                Tier1Talent: t[3] ? t[3].m_value : '',
                Tier2Talent: t[4] ? t[4].m_value : '',
                Tier3Talent: t[5] ? t[5].m_value : '',
                Tier4Talent: t[6] ? t[6].m_value : '',
                Tier5Talent: t[7] ? t[7].m_value : '',
                Tier6Talent: t[8] ? t[8].m_value : '',
                Tier7Talent: t[9] ? t[9].m_value : '',
                MVP: mvp ? scores.EndOfMatchAwardMVPBoolean[i][0].m_value === 1 : false
              });
            }

            var lvl = scores.TeamLevel ?
              [scores.TeamLevel[0][0].m_value, scores.TeamLevel[9][0].m_value] :
              [scores.Level[0][0].m_value, scores.Level[9][0].m_value];
            var replay = db_Replay({
              Id: id,
              Build: header.m_version.m_build,
              Region: details.m_playerList[0].m_toon.m_region,
              SubmittedBy: polls[pollPath].ultoken ? polls[pollPath].ultoken : 0,
              MapName: details.m_title,
              GameType: gametype,
              WinningTeam: talents[0].m_stringData[1].m_value === 'Win' ? 0 : 1,
              Team0Level: lvl[0],
              Team1Level: lvl[1],
              GameLength: header.m_elapsedGameLoops,
              TimePlayed: new Date(details.m_timeUTC / 10000 - 11644473600000).getTime(),
              TimeSubmitted: Date.now(),
              Players: players
            });

            // save to database
            replay.save(function(err){
              if(err){
                if(err.message.indexOf('duplicate') > -1){
                  pollRes(pollPath, 1, fname);
                } else {
                  pollRes(pollPath, 0, fname);
                  logger.log('info', '[REPLAY] save error: ' + err.message);
                }
              } else {
                pollRes(pollPath, gametype, fname);
              }
              callback();
            });

          }
        });

      }
    } catch(err) {
      // encountered error classifying or storing data
      logger.log('info', '[REPLAY] classification error: ' + err.message);
      pollRes(pollPath, 0, fname);
      callback();
    }
  } else {
    // missing data from replay
    logger.log('info', '[REPLAY] processing error');
    pollRes(pollPath, 0, fname);
    callback();

  }
}

// convert files from object to array, then add to the queue
function queueFiles(fileobj, pollPath){
  var n = 0;
  var files = Object.keys(fileobj).map(
    function(key){
      return fileobj[key];
    }
  );

  for(var i=0, j=files.length; i<j; i++) queue.push({f: files[i], pollPath: pollPath});
}

// polling objects
var polls = {};

module.exports.registerPoll = function(path, socket, callback){
  if(polls[path]){
    polls[path].socket = socket;
    callback(true, path, polls[path].status);
  } else {
    callback(false, path);
  }
}
module.exports.disconnectPoll = function(path){
  var p = polls[path];
  p.disconnected = true;
  if(p.done === p.total) delete polls[path];
}

// returns a result to a socket and updates a poll with payoffs
function pollRes(pollPath, responseCode, fname){
  var p = polls[pollPath];
  if(!p) return false;

  p.status.push(responseCode);
  p.done++;
  if(dictionary.payoffs[responseCode]) p.payoff += dictionary.payoffs[responseCode];

  if(p.socket)
    p.socket.emit('fileComplete', p.status.length, responseCode);

  if(fname)
    fs.unlink(__dirname + '/../filetmp/' + fname + '.StormReplay', (err) => {
      if(err) logger.log('info', '[FILE] delete error: ' + err.message);
    });

  // credit doubloons to user account when done
  if(p.done === p.total){
    if(p.payoff > 0 && p.ultoken){
      db_User.update({battletag: p.ultoken}, {
        $inc: {doubloons: p.payoff}
      }, function(err){
        if(err) logger.log('info', '[POLL] doubloon count update error: ' + err.message)
      });
    }
    if(p.disconnected) delete polls[pollPath];
  }
}

// return a poll object
var Poll = function(path, total, ultoken){
  this.path = path;
  this.done = 0;
  this.total = total;
  if(ultoken) this.ultoken = ultoken;
  this.payoff = 0;
  this.status = [];
  this.disconnected = false;
}
