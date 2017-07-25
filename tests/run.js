const heroprotocol = require('heroprotocol');

const file = process.argv[2];

const details = heroprotocol.get(heroprotocol.DETAILS, file);
const header = heroprotocol.get(heroprotocol.HEADER, file);
const initdata = heroprotocol.get(heroprotocol.INITDATA, file).m_syncLobbyState;
const scores = heroprotocol.get(heroprotocol.TRACKER_EVENTS, file, {
  '_event' : ['NNet.Replay.Tracker.SScoreResultEvent']
});
const talents = heroprotocol.get(heroprotocol.TRACKER_EVENTS, file, {
  'm_eventName' : ['EndOfGameTalentChoices']
});

const gametypes = {
  50001: 'quick match',
  50021: 'versus ai',
  50031: 'brawl',
  50041: 'training',
  50051: 'unranked',
  50061: 'hero league',
  50071: 'team league'
};

if (details && header && initdata && scores && talents) {

  var gametype = gametypes[initdata.m_gameDescription.m_gameOptions.m_ammId].toUpperCase();
  var tmp = scores[scores.length-1].m_instanceList;
  var stats = {};
  for(var i in tmp) stats[tmp[i].m_name] = tmp[i].m_values;

  console.log(' ------- ' + gametype + ' (' + initdata.m_gameDescription.m_randomValue + ' b' + header.m_version.m_build + ') ------- ');
  console.log('MAP: ' + details.m_title);

  var lvl = stats.TeamLevel ?
    [stats.TeamLevel[0][0].m_value, stats.TeamLevel[9][0].m_value] :
    [stats.Level[0][0].m_value, stats.Level[9][0].m_value];
  console.log('LVL: BLUE ' + lvl[0] + ' / RED ' + lvl[1]);
  for(var i = 0; i < 10; i++){
    var p = details.m_playerList[i];
    console.log(
      (p.m_teamId === 0 ? 'BLUE' : 'RED ')
      + ' / ' + p.m_name + ': ' + p.m_hero + ' - '
      + stats.SoloKill[i][0].m_value + '/' + stats.Assists[i][0].m_value + '/' + stats.Deaths[i][0].m_value
      + (stats.EndOfMatchAwardMVPBoolean && stats.EndOfMatchAwardMVPBoolean[i][0].m_value == 1 ? ' (MVP)' : '')
    );
  }

  console.log('WINNER: ' + (talents[0].m_stringData[1].m_value === 'Win' ? 'BLUE' : 'RED'));
  console.log('DURATION: ' + parseInt(header.m_elapsedGameLoops / 16) + ' seconds');

}
