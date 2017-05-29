'use strict';

// this script runs a replay through heroprotocol.py using a python shell

const PythonShell = require('python-shell');

function run(filename, callback){
  PythonShell.run('heroprotocol.py',
    {
      mode: 'json',
      args: [__dirname + '/filetmp/' + filename + '.StormReplay', '--json', '--details'],
      scriptPath: __dirname + '/heroprotocol/'
    },
    function(err, res){
      if(err){
        callback(filename, '', err);
      } else {
        callback(filename, res);
      }
    }
  );
}

module.exports = run;
