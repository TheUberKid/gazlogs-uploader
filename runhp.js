'use strict';

// this script runs a replay through heroprotocol.py using a python shell

const PythonShell = require('python-shell');

function run(filename, ppath, callback){
  PythonShell.run('heroprotocol.py',
    {
      mode: 'json',
      args: [__dirname + '/filetmp/' + filename + '.StormReplay', '--json', '--details', '--header', '--stats'],
      scriptPath: __dirname + '/heroprotocol/'
    },
    function(err, res){
      if(err){
        callback(filename, ppath, '', err);
      } else {
        callback(filename, ppath, res);
      }
    }
  );
}

module.exports = run;
