#!/usr/bin/env node
var Beolink = require('./Beolink')
const { exec } = require('child_process');
new Beolink("17", function(source,code) {
    exec(`echo "beolink command ${code.toLowerCase()}"|nc -N -v 192.168.1.50 9090`,(err,stdout,stderr)=>
    {
        if(err) {
            console.error(`exec error: ${err}`)
        }
    });
});
