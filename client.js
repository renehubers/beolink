var redis = require('redis');
var client = redis.createClient({host:'192.168.2.128'});
client.subscribe('beolink', function(err, msg) {
	console.log(JSON.parse(msg));
});