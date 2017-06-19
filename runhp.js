'use strict';

// this script runs a replay through the heroprotocoljs library

const heroprotocol = require('heroprotocol');

function run(filename, ppath, callback, queueCallback){
  var file = __dirname + '/filetmp/' + filename + '.StormReplay';
  const details = heroprotocol.get(heroprotocol.DETAILS, file);
  const header = heroprotocol.get(heroprotocol.HEADER, file);

  if(details && header){
    Object.assign(details, header);
    callback(filename, ppath, details);
  } else {
    callback(filename, ppath, '', 'Error processing replay');
  }

  if(queueCallback) queueCallback();
}

module.exports = run;
