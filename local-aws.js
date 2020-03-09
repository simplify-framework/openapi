// @ts-nocheck

'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const Hogan = require('hogan.js');
const clone = require('reftools/lib/clone.js').circularClone;

const adaptor = require('./adaptor-aws.js');
const lambdas = require('./lambdas.js');

let ff = {
    readFileSync: fs.readFileSync,
    createFile: fs.writeFileSync,
    existsSync: fs.existsSync,
    rimraf: rimraf,
    mkdirp: mkdirp
};

function tpl(config, ...segments) {
    if (config.templateDir) {
        segments.splice(0, 1);
        return path.join(config.templateDir, ...segments);
    }
    return path.join(__dirname, 'templates', ...segments)
}

function main(o, config, configName, callback) {
    let outputDir = config.outputDir || './out/';
    let verbose = config.defaults.verbose;
    config.defaults.configName = configName;
    adaptor.transform(o, config.defaults, function (err, model) {
        let actions = [];
        for (let t in config.transformations) {
            let tx = config.transformations[t];
            if (tx.input) {
                if (verbose) console.log('Processing template ' + tx.input);
                tx.template = ff.readFileSync(tpl(config, configName, tx.input), 'utf8');
            }
            actions.push(tx);
        }
        const subDir = (config.defaults.flat ? '' : configName);
        if (verbose) console.log('Making/cleaning output directories');
        ff.mkdirp(path.join(outputDir, subDir), function () {
            ff.rimraf(path.join(outputDir, subDir) + '/*', function () {
                for (let action of actions) {
                    if (verbose) console.log('Rendering ' + action.output);
                    let template = Hogan.compile(action.template);
                    let cServices = Object.assign({}, model, model.apiInfo)
                    let content = template.render(cServices, config.partials);
                    let requestDir = require('path').dirname(path.join(outputDir, subDir, action.output))
                    if (!ff.existsSync(requestDir)) {
                        ff.mkdirp.sync(requestDir);
                    }
                    console.log("Generating...", path.join(outputDir, subDir, action.output))
                    ff.createFile(path.join(outputDir, subDir, action.output), content, 'utf8');
                }
                if (config.perGateway) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let gw of config.perGateway) {
                        let fnTemplate = Hogan.compile(gw.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, gw.input), 'utf8'));
                        let rootModel = Object.assign({}, config.defaults, gw.defaults || {}, toplevel, model.apiInfo, config.apis);
                        let filename = fnTemplate.render(rootModel, config.partials);
                        let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                        if (!ff.existsSync(requestDir)) {
                            ff.mkdirp.sync(requestDir);
                        }
                        console.log("Generating...", filename)
                        ff.createFile(path.join(outputDir, subDir, filename), template.render(rootModel, config.partials), 'utf8');
                    }
                }
                if (config.perService) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let item of config.perService) {
                        let fnTemplate = Hogan.compile(item.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, item.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            let serviceModel = Object.assign({}, config.defaults, item.defaults || {}, toplevel, svc, config.apis);
                            let filename = fnTemplate.render(serviceModel, config.partials);
                            let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                            if (!ff.existsSync(requestDir)) {
                                ff.mkdirp.sync(requestDir);
                            }
                            console.log("Generating...", filename)
                            ff.createFile(path.join(outputDir, subDir, filename), template.render(serviceModel, config.partials), 'utf8');
                        })
                    }
                }
                if (config.perServiceModel) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let item of config.perServiceModel) {
                        let fnTemplate = Hogan.compile(item.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, item.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            let models = {}
                            svc.servicePoints.map(endpoint => {
                                if (!models[endpoint.className]) {
                                    models[endpoint.className] = endpoint
                                } else {
                                    models[endpoint.className] = [...models[endpoint.className].operations, ...endpoint.operations]
                                }
                            })
                            Object.keys(models).forEach(key => {                                
                                let serviceModel = Object.assign({}, config.defaults, item.defaults || {}, toplevel, models[key], config.apis);
                                let filename = fnTemplate.render(serviceModel, config.partials);                                
                                let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                if (!ff.existsSync(requestDir)) {
                                    ff.mkdirp.sync(requestDir);
                                }
                                console.log("Generating...", filename)
                                ff.createFile(path.join(outputDir, subDir, filename), template.render(serviceModel, config.partials), 'utf8');
                            })
                        })
                    }
                }
                if (config.perOperation) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let item of config.perOperation) {
                        let fnTemplate = Hogan.compile(item.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, item.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            svc.servicePoints.map(endpoint => {
                                endpoint.operations.map(op => {
                                    let operation = Object.assign({}, config.defaults, item.defaults || {}, toplevel, endpoint, op, config.apis);
                                    let filename = fnTemplate.render(operation, config.partials);
                                    let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                    if (!ff.existsSync(requestDir)) {
                                        ff.mkdirp.sync(requestDir);
                                    }
                                    console.log("Generating...", filename)
                                    ff.createFile(path.join(outputDir, subDir, filename), template.render(operation, config.partials), 'utf8');
                                })
                            })
                        })
                    }
                }
                if (callback) callback(null, true);
            });
        });
    });
}

module.exports = {
    fileFunctions: ff,
    main: main
};

