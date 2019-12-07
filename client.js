var redis = require('redis');
var client = redis.createClient({host:'192.168.2.128'});
client.on("message", function(channel,message) {
	console.log("received " + message + " from " + channel);
});
client.subscribe('beolink');
