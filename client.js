var redis = require('redis');
var Server = require('squeezenode')
var squeeze = new Server('http://192.168.2.50', 9000)
var playerName = "beoplay"

var client = redis.createClient({ host: 'beoplay' });
client.on("message", function (channel, message) {
    console.log("received " + message + " from " + channel);
    command(JSON.parse(message))
});
client.subscribe('beolink');

squeeze.on('register', () => {
    console.log('squeeze server registered!')
})
var command = ({ source, key }) => {
    key = key.toLowerCase()
    console.log(`key=${key} source=${source}`)
    playerIdByName(playerName, function (reply) {
        console.log(reply)
        if (reply.ok) {
            const player = squeeze.players[reply.playerId]
            if (key == 'go') {
                player.pause();
            } else if (key == 'stop') {
                stop(player)
            } else if (key == 'up') {
                skip(player,+1);
            } else if (key == 'down') {
                skip(player,-1)
            } else if (key.match(/\d+/)) {
                player.playIndex(key - 1)
            } else if (key == 'radio') {
                player.clearPlayList()
                player.addToPlaylist('RADIO')
                player.play()
            } else if (key == 'cd') {
                player.getStatus((response) => {
                    console.log(response)
                })
            }
        }
    })
}

/* helper function*/
function playerIdByName(name, callback) {
    var found = false;
    squeeze.getPlayers(function (reply) {
        console.log('getPlayer')
        for (var id in reply.result) {
            if (reply.result[id].name === name) {
                found = true;
                callback({ ok: true, playerId: reply.result[id].playerid });
            }
        }
        if (!found)
            callback({ ok: false });
    });
}

function skip(player, amount) {
    status(player, (result) => {
        const index= parseInt(result['playlist_cur_index'])+amount
        const trackcount= result['playlist_tracks']+0
        console.log(`index: ${index} trackcount: ${trackcount}`)
        if (index >= 0 && index < trackcount) {
            player.playIndex(index)
        }
    })
}

function status(player, callback) {
    player.getStatus((response) => callback(response.result))
}

function stop(player, callback) {
    player.request(player.playerId,['stop'],callback);
}
