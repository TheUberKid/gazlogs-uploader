const heroprotocol = require('./heroprotocol');
var logger = require('winston');
var data;
var lastUsed;

module.exports = function(file, player){
  if(!lastUsed || file !== lastUsed){
    data = heroprotocol.get(heroprotocol.RAW_DATA, file);
    lastUsed = file;
  }

  if(data){

    var startPoint = data.indexOf(player+'#') + player.length + 1;
    var res = '';
    for(var i = 0; i < 10; i++){
      if(!isNaN(data[startPoint + i])){
        res += data[startPoint + i];
      } else {
        break;
      }
    }
    return +(res);

  } else {

    logger.log('info', '[REPLAY] Could not decode BattleTag of player '+player);
    return 0;

  }

}
