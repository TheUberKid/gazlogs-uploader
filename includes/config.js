'use strict';

function moduleAvailable(name){
  try {
    require.resolve(name);
    return true;
  } catch(e){}
  return false;
}

// test for environment by checking existence of keys module (ignored by git) and load the relevant config
// hide secret keys in either local keys.js module or as heroku environment variables
var mongodb_key, debug;
if(moduleAvailable('./keys')){
  const Keys = require('./keys');
  mongodb_key = Keys.mongodb_key;
  debug = true;
} else {
  mongodb_key = process.env.mongodb_key;
  debug = false;
}

// non-secret keys can be shown here
const port = debug ? 3000 : process.env.PORT;

module.exports = {
  'mongodb_key': mongodb_key,
  'debug': debug,
  'port': port
}
