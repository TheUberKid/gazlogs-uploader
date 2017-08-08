const heroprotocol = require('heroprotocol');

const file = process.argv[2];

const scores = heroprotocol.get(heroprotocol.ATTRIBUTES_EVENTS, file);

if(scores) console.log(scores.scopes['16']);
