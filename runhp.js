'use strict';

// this script runs a replay through the heroprotocoljs library

const heroprotocol = require('./heroprotocol');

function run(filename, ppath, callback, queueCallback){
  var file = __dirname + '/filetmp/' + filename + '.StormReplay';
  const details = heroprotocol.get(heroprotocol.DETAILS, file);
  const header = heroprotocol.get(heroprotocol.HEADER, file);
  const initdata = heroprotocol.get(heroprotocol.INITDATA, file).m_syncLobbyState;
  const scores = heroprotocol.get(heroprotocol.TRACKER_EVENTS, file, {
    '_event' : ['NNet.Replay.Tracker.SScoreResultEvent']
  });
  const talents = heroprotocol.get(heroprotocol.TRACKER_EVENTS, file, {
    'm_eventName' : ['EndOfGameTalentChoices']
  });

  if(details && header && initdata && scores && talents){
    callback(filename, ppath, queueCallback, {
      details: details,
      header: header,
      initdata: initdata,
      scores: scores,
      talents: talents
    });
  } else {
    callback(filename, ppath, queueCallback, '', 'Error processing replay');
  }

}

module.exports = run;
