#!/usr/bin/env node
const Beolink = require('./Beolink')
const commander = require('commander')

commander
  .version('1.0.0', '-v, --version')
  .usage('[OPTIONS]...')
  .option('-p, --pin', 'number data pin.')
  .parse(process.argv);

const options = commander.opts();

const pin = (options.pin ? options.pin : '17')

const { exec } = require('child_process');
new Beolink(pin, function(source,code) {
    console.log(`${source} ${code}`)
});
