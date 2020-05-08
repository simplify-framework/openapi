#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const yaml = require('yaml');
const fetch = require('node-fetch');

const processor = require('./processor.js');

var argv = require('yargs')
    .usage('simplify create|delete [options]')
    .describe('openapi', 'OpenAPI 3.0 spec YAML')
    .string('openapi')
    .alias('i', 'openapi')
    .describe('openapi', 'contains openapi.yaml specs files')
    .string('output')
    .alias('o', 'output')
    .describe('output', 'output directory')
    .default('output', './output')
    .boolean('verbose')
    .describe('verbose', 'Increase verbosity')
    .alias('v', 'verbose')
    .demandOption(['i', 'o'])
    .demandCommand(1)
    .argv;

let configPath = path.resolve(__dirname, 'boilerplates');
let configFile = path.join(path.join(configPath), 'config.json');
let config = yaml.parse(fs.readFileSync(configFile, 'utf8'), { prettyErrors: true });
let defName = path.resolve(path.join(argv.openapi || 'specs/openapi.yaml'));
config.outputDir = argv.output;

function mergeArrays(arrObj, moreArrObj) {
    if (!moreArrObj) return arrObj
    moreArrObj.forEach(function(tmp, i) {
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
    Object.keys(moreObj).map(function(k) {
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
        console.log('Loaded configuration.');
    }
    if (argv.lint) config.defaults.lint = true;
    if (argv.debug) config.defaults.debug = true;
    if (argv.stools) config.defaults.stools = true;
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
    if (argv.verbose) console.log('Loaded definition ' + defName, o);

    if (o && o.openapi) {
        despatch(o, config);
    }
    else {
        console.error('Unrecognised OpenAPI 3.0 version');
    }
}

runCommandLine()