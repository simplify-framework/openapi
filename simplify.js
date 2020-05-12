#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const yaml = require('yaml');
const fetch = require('node-fetch');
const logger = require('./logger');
const mkdirp = require('mkdirp');

const processor = require('./processor.js');

var argv = require('yargs')
    .usage('simplify generate|reverse [options]')
    .describe('openapi', 'OpenAPI 3.0 spec YAML')
    .string('openapi')
    .alias('i', 'openapi')
    .describe('openapi', 'contains openapi.yaml specs files')
    .string('output')
    .alias('o', 'output')
    .describe('output', 'output directory')
    .default('output', './output')
    .boolean('verbose')
    .default('verbose', false)
    .describe('verbose', 'Increase verbosity')
    .alias('v', 'verbose')
    .boolean('merge')
    .default('merge', true)
    .describe('merge', 'Auto merge files')
    .boolean('diff')
    .default('diff', false)
    .describe('diff', 'Generate diff file')
    .demandOption(['o'])
    .demandCommand(1)
    .argv;

if (argv._[0] !== 'generate' && argv._[0] !== 'petsample') {
    console.log(` - The command '${argv._[0]}' is not supported or no longer supported. Try with 'generate' command`)
    process.exit(-1)
}

let configPath = path.resolve(__dirname, 'packages');
let configFile = path.join(path.join(configPath), 'config.json');
let config = yaml.parse(fs.readFileSync(configFile, 'utf8'), { prettyErrors: true });
let defName = path.resolve(path.join(argv.openapi || 'openapi.yaml'));
config.outputDir = argv.output;

mkdirp(path.join(__dirname, config.outputDir)).then(function () {
    fs.writeFileSync(path.join(__dirname, config.outputDir, 'openapi.yaml'), fs.readFileSync(defName, 'utf8'), 'utf8')
    if (argv._[0] === 'petsample') {
        process.exit(-1)
    }
})

function mergeArrays(arrObj, moreArrObj) {
    if (!moreArrObj) return arrObj
    moreArrObj.forEach(function (tmp, i) {
        if (typeof tmp === 'object') {
            if (Array.isArray(tmp)) {
                arrObj[i] = arrObj[i] || []
                arrObj[i] = mergeArrays(arrObj[i], tmp)
            } else {
                arrObj[i] = arrObj[i] || {}
                arrObj[i] = mergeObjects(arrObj[i], tmp)
            }
        } else {
            arrObj[i] = tmp
        }
    })
    return arrObj
}

function mergeObjects(obj, moreObj) {
    if (!moreObj) return obj
    Object.keys(moreObj).map(function (k) {
        if (Array.isArray(moreObj[k])) {
            obj[k] = obj[k] || []
            obj[k] = mergeArrays(obj[k], moreObj[k])
        } else if (typeof moreObj[k] == 'object') {
            obj[k] = obj[k] || {}
            obj[k] = mergeObjects(obj[k], moreObj[k])
        } else {
            obj[k] = moreObj[k]
        }
    })
    return obj
}

function runCommandLine() {

    if (config.generator) {
        let generator_path = path.resolve(configPath, config.generator);
        config.generator = require(generator_path);
    }
    if (argv.verbose) {
        config.defaults.verbose = true;
        logger.debug('Loaded configuration.');
    }
    if (argv.diff) {
        config.defaults.diff = true;
    }
    if (argv.merge) {
        config.defaults.merge = true;
    }
    if (argv.zip) {
        processor.fileFunctions.createFile = zipFile;
        processor.fileFunctions.rimraf = nop;
        processor.fileFunctions.mkdirp = nop;
        processor.fileFunctions.mkdirp.sync = nop;
    }
    config.defaults.source = defName;
    config.defaults.flat = true;

    let up = url.parse(defName);
    if (up.protocol && up.protocol.startsWith('http')) {
        fetch(defName)
            .then(function (res) {
                return res.text();
            }).then(function (body) {
                main(body);
            }).catch(function (err) {
                console.error(err.message);
            });
    }
    else {
        let o = {}
        let arrFiles = defName.split('+')
        arrFiles.forEach(function (f) {
            let s = fs.readFileSync(f.trim(), 'utf8');
            o = mergeObjects(o, yaml.parse(s, { prettyErrors: true }))
        })
        main(o);
    }
}

function nop(arg, callback) { if (callback) callback(null, true); return true; }

function despatch(obj, config, callback) {
    processor.main(obj, config, callback);
}

function main(o) {
    console.log("╓───────────────────────────────────────────────────────────────╖")
    console.log("║                        Simplify Framework                     ║")
    console.log("╙───────────────────────────────────────────────────────────────╜")
    console.log(` - OpenAPI definition ${defName}`);
    if (o && o.openapi) {
        despatch(o, config, function (err) {
            console.warn(` - Automatic code merge is ${config.defaults.merge ? 'on (use option --merge=false to turn off)' : 'off (use option --merge to turn on)'}`)
            console.warn(` - Diff file generation is ${config.defaults.diff ? 'on (automatic turn on if --merge=false)' : 'off (use option --diff to turn on)'}`)
            console.log(` - Finished generation ${!err ? `with NO error. See ${config.outputDir} for your generated code!` : err}`);
        });
    }
    else {
        console.error('Unrecognised OpenAPI 3.0 version');
    }
}

runCommandLine()