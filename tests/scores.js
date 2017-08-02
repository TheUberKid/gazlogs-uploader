const heroprotocol = require('heroprotocol');

const file = process.argv[2];

const scores = heroprotocol.get(heroprotocol.TRACKER_EVENTS, file, {
  '_event' : ['NNet.Replay.Tracker.SScoreResultEvent']
});

if(scores) console.log(scores[scores.length-1]);
